"use server";

import { revalidatePath } from "next/cache";
import {
  addProblemToToday,
  deferDailyStudyPlanTask,
  ensureTodaysDailyStudyPlan,
  getDailyStudyWorkspace,
  getOwnedDailyStudyTask,
  getTodaysDailyStudyPlan,
  rateNewDailyStudyTask,
} from "@/data/daily-study-plans";
import type {
  AddProblemToTodayResult,
  PersistedStudyAttempt,
  StudyPlanActionResult,
  StudyTaskRating,
  StudyTaskRatingResult,
  TodayProblemIntent,
} from "@/lib/daily-study-plan-view";
import { isUuid } from "@/lib/form-data";
import { getLeetCodeProblemByFrontendId, getLeetCodeProblemBySlug } from "@/lib/leetcode-catalog";
import { createClient } from "@/lib/supabase/server";
import { getExtraStudyRecommendation } from "@/data/keep-studying";
import { correctReviewRating, getReviewAttempt, submitProblemReview } from "@/data/reviews";
import type { AddRecommendedProblemResult, ExtraStudyError, ExtraStudyMode } from "@/lib/keep-studying";
import { isStudyRating } from "@/lib/ratings";

function logError(operation: string, error: unknown) {
  if (process.env.NODE_ENV !== "production") {
    const details = error as { code?: string; message?: string; details?: string; hint?: string };
    console.error("Study plan action failed", {
      operation, code: details?.code, message: details?.message,
      details: details?.details, hint: details?.hint,
    });
  }
}

export async function ensureTodayStudyPlanAction(timeZone: string): Promise<StudyPlanActionResult> {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) return { ok: false, error: "not_authenticated" };
    if (typeof timeZone !== "string" || timeZone.length > 100) return { ok: false, error: "invalid_time_zone" };

    // PostgreSQL validates the first timezone and ignores later devices' timezone changes.
    const result = await ensureTodaysDailyStudyPlan(client, userId, timeZone);
    if (result.error || !result.data) {
      logError("create_daily_study_plan", result.error);
      return { ok: false, error: result.error?.code === "P0001" && result.error.message === "invalid_time_zone"
        ? "invalid_time_zone" : "save_failed" };
    }
    const workspace = await getDailyStudyWorkspace(client, userId, result.data);
    if (workspace.error || !workspace.data) {
      logError("getDailyStudyWorkspace", workspace.error);
      return { ok: false, error: "save_failed" };
    }
    return { ok: true, workspace: workspace.data };
  } catch (error) {
    logError("ensureTodayStudyPlanAction", error);
    return { ok: false, error: "save_failed" };
  }
}

export async function addProblemToTodayAction(
  frontendId: string,
  intent: TodayProblemIntent,
): Promise<AddProblemToTodayResult> {
  try {
    const client = await createClient();
    const { data: claims, error: claimsError } = await client.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (claimsError || !userId) return { ok: false, error: "not_authenticated" };
    if (typeof frontendId !== "string" || !frontendId.trim() || !["todo", "done"].includes(intent)) {
      return { ok: false, error: "invalid_problem" };
    }

    const canonical = getLeetCodeProblemByFrontendId(frontendId.trim());
    if (!canonical) return { ok: false, error: "invalid_problem" };

    const result = await addProblemToToday(client, {
      p_intent: intent,
      p_leetcode_frontend_id: canonical.frontendId,
      p_leetcode_slug: canonical.slug,
      p_leetcode_url: canonical.leetcodeUrl,
      p_title: canonical.title,
      p_difficulty: canonical.difficulty,
      p_leetcode_topics: canonical.topics,
    });
    if (result.error) {
      if (result.error.code === "P0001") {
        const controlled = [
          "already_in_today",
          "already_completed_today",
          "already_deferred_today",
          "problem_not_active",
        ] as const;
        const controlledError = controlled.find((value) => value === result.error?.message);
        if (controlledError) return { ok: false, error: controlledError };
        if (result.error.message === "not_authenticated") return { ok: false, error: "not_authenticated" };
        if (result.error.message === "plan_not_found") return { ok: false, error: "plan_changed" };
        if (result.error.message === "invalid_submission") return { ok: false, error: "invalid_problem" };
      }
      logError("add_problem_to_today", result.error);
      return { ok: false, error: "save_failed" };
    }

    const saved = result.data?.[0];
    if (!saved || (saved.outcome !== "added_todo" && saved.outcome !== "marked_done")) {
      return { ok: false, error: "save_failed" };
    }
    let attempt: PersistedStudyAttempt | null = null;
    if (saved.review_event_id) {
      attempt = await loadPersistedAttempt(client, userId, saved.review_event_id);
      if (!attempt) return { ok: false, error: "save_failed" };
    }

    revalidatePath("/dashboard");
    revalidatePath("/problems");
    revalidatePath("/roadmaps/neetcode-150");
    return {
      ok: true,
      outcome: saved.outcome,
      taskId: saved.task_id,
      attempt,
    };
  } catch (error) {
    logError("addProblemToTodayAction", error);
    return { ok: false, error: "save_failed" };
  }
}

export async function deferStudyTaskAction(taskId: string): Promise<{ ok: boolean }> {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub || !isUuid(taskId)) return { ok: false };
    const result = await deferDailyStudyPlanTask(client, taskId);
    if (result.error) {
      logError("defer_daily_study_plan_task", result.error);
      return { ok: false };
    }
    // No plan creation or second review/practice write path is introduced here.
    revalidatePath("/dashboard");
    return { ok: true };
  } catch (error) {
    logError("deferStudyTaskAction", error);
    return { ok: false };
  }
}

export async function rateNewStudyTaskAction(taskId: string, rating: StudyTaskRating): Promise<StudyTaskRatingResult> {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) return { ok: false, error: "not_authenticated" };
    if (typeof taskId !== "string" || !isUuid(taskId) || !isStudyRating(rating)) {
      return { ok: false, error: "task_changed" };
    }
    const task = await getOwnedDailyStudyTask(client, userId, taskId);
    if (task.error) {
      logError("getOwnedDailyStudyTask", task.error);
      return { ok: false, error: "save_failed" };
    }
    const canonical = task.data?.leetcode_frontend_id
      ? getLeetCodeProblemByFrontendId(task.data.leetcode_frontend_id.trim()) : null;
    if (!canonical || canonical.slug !== task.data?.leetcode_slug) return { ok: false, error: "task_changed" };

    // Only task identity/rating come from the browser. SQL derives the saved study date/timezone.
    const result = await rateNewDailyStudyTask(client, {
      p_task_id: taskId, p_rating: rating,
      p_leetcode_frontend_id: canonical.frontendId, p_leetcode_slug: canonical.slug,
      p_leetcode_url: canonical.leetcodeUrl, p_title: canonical.title,
      p_difficulty: canonical.difficulty, p_leetcode_topics: canonical.topics,
    });
    if (result.error) {
      if (result.error.code === "P0001") {
        if (result.error.message === "not_authenticated") return { ok: false, error: "not_authenticated" };
        if (["not_found", "task_not_pending", "stale_task", "duplicate_problem", "invalid_date"].includes(result.error.message)) {
          revalidatePath("/dashboard");
          return { ok: false, error: "task_changed" };
        }
      }
      logError("rate_new_daily_study_task", result.error);
      return { ok: false, error: "save_failed" };
    }
    const eventId = result.data?.completed_review_event_id;
    if (!eventId) return { ok: false, error: "save_failed" };
    const attempt = await loadPersistedAttempt(client, userId, eventId);
    if (!attempt) return { ok: false, error: "save_failed" };
    revalidatePath("/dashboard");
    revalidatePath("/problems");
    revalidatePath("/roadmaps/neetcode-150");
    return { ok: true, attempt };
  } catch (error) {
    logError("rateNewStudyTaskAction", error);
    return { ok: false, error: "save_failed" };
  }
}

async function loadPersistedAttempt(
  client: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  reviewEventId: string,
): Promise<PersistedStudyAttempt | null> {
  const result = await getReviewAttempt(client, userId, reviewEventId);
  if (result.error || !result.data || !isStudyRating(result.data.rating)) {
    if (result.error) logError("getReviewAttempt", result.error);
    return null;
  }
  return {
    reviewEventId: result.data.id,
    rating: result.data.rating,
    correctableUntil: result.data.correctable_until,
  };
}

function taskActionError(error: { code?: string; message?: string }):
  Extract<StudyTaskRatingResult, { ok: false }> {
  if (error.code === "P0001") {
    if (error.message === "not_authenticated") return { ok: false, error: "not_authenticated" };
    if ([
      "not_found", "task_not_pending", "stale_task", "stale_review",
      "problem_not_due", "problem_not_active", "duplicate_problem",
      "correction_expired", "invalid_date",
    ].includes(error.message ?? "")) return { ok: false, error: "task_changed" };
  }
  logError("study_task_attempt", error);
  return { ok: false, error: "save_failed" };
}

export async function completeStudyTaskAction(taskId: string): Promise<StudyTaskRatingResult> {
  try {
    const client = await createClient();
    const { data: claims, error: claimsError } = await client.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (claimsError || !userId) return { ok: false, error: "not_authenticated" };
    if (!isUuid(taskId)) return { ok: false, error: "task_changed" };

    const persisted = await getTodaysDailyStudyPlan(client, userId);
    if (persisted.error) return taskActionError(persisted.error);
    const task = persisted.data?.tasks.find((candidate) => candidate.id === taskId);
    if (!task || task.status !== "pending") return { ok: false, error: "task_changed" };

    let reviewEventId: string | null = null;
    if (task.user_problem_id) {
      const problem = await client.from("user_problems")
        .select("id,schedule_version")
        .eq("user_id", userId)
        .eq("id", task.user_problem_id)
        .single();
      if (problem.error || !problem.data) return { ok: false, error: "task_changed" };
      const result = await submitProblemReview(client, {
        userProblemId: problem.data.id,
        expectedScheduleVersion: problem.data.schedule_version,
        rating: "ok",
      });
      if (result.error) return taskActionError(result.error);
      reviewEventId = result.data?.[0]?.review_event_id ?? null;
    } else {
      const canonical = task.leetcode_frontend_id
        ? getLeetCodeProblemByFrontendId(task.leetcode_frontend_id.trim())
        : null;
      if (!canonical || canonical.slug !== task.leetcode_slug) {
        return { ok: false, error: "task_changed" };
      }
      const result = await rateNewDailyStudyTask(client, {
        p_task_id: task.id,
        p_rating: "ok",
        p_leetcode_frontend_id: canonical.frontendId,
        p_leetcode_slug: canonical.slug,
        p_leetcode_url: canonical.leetcodeUrl,
        p_title: canonical.title,
        p_difficulty: canonical.difficulty,
        p_leetcode_topics: canonical.topics,
      });
      if (result.error) return taskActionError(result.error);
      reviewEventId = result.data?.completed_review_event_id ?? null;
    }

    if (!reviewEventId) return { ok: false, error: "save_failed" };
    const attempt = await loadPersistedAttempt(client, userId, reviewEventId);
    if (!attempt) return { ok: false, error: "save_failed" };
    return { ok: true, attempt };
  } catch (error) {
    logError("completeStudyTaskAction", error);
    return { ok: false, error: "save_failed" };
  }
}

export async function correctStudyAttemptAction(
  reviewEventId: string,
  rating: StudyTaskRating,
): Promise<StudyTaskRatingResult> {
  try {
    const client = await createClient();
    const { data: claims, error: claimsError } = await client.auth.getClaims();
    const userId = claims?.claims?.sub;
    if (claimsError || !userId) return { ok: false, error: "not_authenticated" };
    if (!isUuid(reviewEventId) || !isStudyRating(rating)) {
      return { ok: false, error: "task_changed" };
    }
    const result = await correctReviewRating(client, { reviewEventId, rating });
    if (result.error) return taskActionError(result.error);
    const attempt = await loadPersistedAttempt(client, userId, reviewEventId);
    if (!attempt) return { ok: false, error: "save_failed" };
    return { ok: true, attempt };
  } catch (error) {
    logError("correctStudyAttemptAction", error);
    return { ok: false, error: "save_failed" };
  }
}

function extraStudyError(operation: string, error: { code?: string; message?: string; details?: string; hint?: string }): { ok: false; error: ExtraStudyError } {
  if (error.code === "P0001") {
    if (error.message === "not_authenticated") return { ok: false, error: "not_authenticated" };
    if (["plan_changed", "plan_not_found", "plan_not_resolved"].includes(error.message ?? "")) return { ok: false, error: "plan_changed" };
    if (["candidate_changed", "already_in_today", "already_completed_today", "already_deferred_today", "stale_review", "problem_not_due", "problem_not_active", "not_found", "duplicate_problem", "invalid_date"].includes(error.message ?? "")) {
      return { ok: false, error: "candidate_changed" };
    }
  }
  logError(operation, error);
  return { ok: false, error: "save_failed" };
}

export async function addRecommendedProblemToTodayAction(
  planId: string,
  mode: ExtraStudyMode,
): Promise<AddRecommendedProblemResult> {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    const userId = data?.claims?.sub;
    if (error || !userId) return { ok: false, error: "not_authenticated" };
    if (typeof planId !== "string" || !isUuid(planId) || !["review", "roadmap"].includes(mode)) return { ok: false, error: "plan_changed" };
    const result = await getExtraStudyRecommendation(client, userId, planId, mode);
    if (result.error) return extraStudyError("getExtraStudyRecommendation", result.error);
    const candidate = result.data;
    if (!candidate) return { ok: true, added: false };

    const canonical = candidate.frontendId
      ? getLeetCodeProblemByFrontendId(candidate.frontendId)
      : getLeetCodeProblemBySlug(candidate.slug);
    if (!canonical || canonical.slug !== candidate.slug) return { ok: false, error: "candidate_changed" };

    const saved = await addProblemToToday(client, {
      p_intent: "todo",
      p_leetcode_frontend_id: canonical.frontendId,
      p_leetcode_slug: canonical.slug,
      p_leetcode_url: canonical.leetcodeUrl,
      p_title: canonical.title,
      p_difficulty: canonical.difficulty,
      p_leetcode_topics: canonical.topics,
    });
    if (saved.error) return extraStudyError("add_problem_to_today", saved.error);
    const inserted = saved.data?.[0];
    if (!inserted?.task_id || inserted.outcome !== "added_todo") return { ok: false, error: "save_failed" };
    revalidatePath("/dashboard");
    return { ok: true, added: true, taskId: inserted.task_id };
  } catch (error) {
    logError("addRecommendedProblemToTodayAction", error);
    return { ok: false, error: "save_failed" };
  }
}
