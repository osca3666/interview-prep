"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { saveStudyPlanSettingsAction } from "@/app/study-settings/actions";
import { createUserProblem } from "@/data/problems";
import { neetcode150Problems } from "@/data/problem-sets/neetcode-150";
import { getStudyPlanSettingsOverview } from "@/data/study-settings";
import { getTrimmedStringField } from "@/lib/form-data";
import { getLeetCodeProblemBySlug } from "@/lib/leetcode-catalog";
import { createRoadmapFollowSettingsInput } from "@/lib/roadmaps";
import type { StudyPlanApplyWhen } from "@/lib/study-plan-settings";
import { createClient } from "@/lib/supabase/server";
import {
  getDateOnlyInTimeZone,
  isValidTimeZone,
  normalizeTimeZone,
} from "@/lib/time-zone";

const roadmapReturnPath = "/roadmaps/neetcode-150";
const controlledRpcMessages = new Set([
  "not_authenticated",
  "invalid_start_mode",
  "invalid_rating",
  "invalid_date",
  "invalid_time_zone",
  "duplicate_problem",
]);

type DatabaseError = {
  code?: string;
  message?: string;
};

function getReturnPath(formData: FormData) {
  const value = getTrimmedStringField(formData, "return_to");
  return value === roadmapReturnPath ? value : roadmapReturnPath;
}

function getControlledRpcMessage(error: DatabaseError) {
  if (error.code !== "P0001" || !error.message) {
    return null;
  }

  return controlledRpcMessages.has(error.message) ? error.message : null;
}

function logRoadmapProblemSaveError(error: DatabaseError) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  console.error("Roadmap problem save error", {
    operation: "create_user_problem_with_timezone",
    code: error.code ?? null,
    message: error.message ?? null,
  });
}

export async function addRoadmapProblemAction(formData: FormData) {
  const returnTo = getReturnPath(formData);
  const roadmapSlug = getTrimmedStringField(formData, "roadmap_slug");
  const timeZone = normalizeTimeZone(
    getTrimmedStringField(formData, "time_zone"),
  );
  const roadmapProblem = neetcode150Problems.find(
    (problem) => problem.slug === roadmapSlug,
  );
  const catalogProblem = roadmapProblem
    ? getLeetCodeProblemBySlug(roadmapProblem.slug)
    : null;

  if (!roadmapProblem || !catalogProblem) {
    redirect(`${returnTo}?error=invalid_roadmap_problem`);
  }

  if (!isValidTimeZone(timeZone)) {
    redirect(`${returnTo}?error=invalid_time_zone`);
  }

  const startDate = getDateOnlyInTimeZone(new Date(), timeZone);

  if (!startDate) {
    redirect(`${returnTo}?error=invalid_date`);
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const { error } = await createUserProblem(supabase, {
    p_leetcode_frontend_id: catalogProblem.frontendId,
    p_leetcode_slug: catalogProblem.slug,
    p_leetcode_url: catalogProblem.leetcodeUrl,
    p_title: catalogProblem.title,
    p_difficulty: catalogProblem.difficulty,
    p_leetcode_topics: catalogProblem.topics,
    p_notes: "",
    p_start_mode: "scheduled",
    p_rating: "ok",
    p_start_date: startDate,
    p_time_zone: timeZone,
  });

  if (error) {
    logRoadmapProblemSaveError(error);

    const controlledMessage = getControlledRpcMessage(error);

    if (controlledMessage === "not_authenticated") {
      redirect("/sign-in");
    }

    if (controlledMessage === "duplicate_problem") {
      redirect(`${returnTo}?error=already_added`);
    }

    if (controlledMessage === "invalid_time_zone") {
      redirect(`${returnTo}?error=invalid_time_zone`);
    }

    if (controlledMessage === "invalid_date") {
      redirect(`${returnTo}?error=invalid_date`);
    }

    redirect(`${returnTo}?error=save_failed`);
  }

  revalidatePath("/roadmaps/neetcode-150");
  revalidatePath("/roadmaps");
  revalidatePath("/dashboard");
  revalidatePath("/problems");
  redirect(`${returnTo}?message=roadmap_added`);
}

export type ChangeFollowedRoadmapInput = {
  roadmapId: string | null;
  applyWhen: StudyPlanApplyWhen;
};

export async function changeFollowedRoadmapAction(
  input: ChangeFollowedRoadmapInput,
) {
  if (
    !input ||
    !["today", "tomorrow"].includes(input.applyWhen) ||
    (input.roadmapId !== null &&
      (typeof input.roadmapId !== "string" || !input.roadmapId.trim()))
  ) {
    return { ok: false as const, error: "invalid_settings" as const };
  }

  const supabase = await createClient();
  const { data: claims, error: claimsError } = await supabase.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) {
    return { ok: false as const, error: "not_authenticated" as const };
  }

  const overviewResult = await getStudyPlanSettingsOverview(supabase, userId);
  if (overviewResult.error || !overviewResult.data) {
    return { ok: false as const, error: "save_failed" as const };
  }

  const overview = overviewResult.data;
  const roadmapId = input.roadmapId?.trim() || null;
  if (
    roadmapId &&
    !overview.roadmaps.some((roadmap) => roadmap.id === roadmapId)
  ) {
    return { ok: false as const, error: "invalid_roadmap" as const };
  }

  const effective = overview.effective;
  const base =
    input.applyWhen === "today" && effective
      ? {
          dailyNewTarget: effective.daily_new_target,
          dailyReviewTarget: effective.daily_review_target,
          newSelectionMode:
            effective.new_selection_mode === "shuffled"
              ? ("shuffled" as const)
              : ("sequential" as const),
          reviewSource:
            effective.review_source === "selected_roadmaps"
              ? ("selected_roadmaps" as const)
              : ("all" as const),
          reviewRoadmapIds: effective.review_roadmap_ids,
          timeZone: effective.time_zone,
        }
      : overview.latest
        ? {
            dailyNewTarget: overview.latest.dailyNewTarget,
            dailyReviewTarget: overview.latest.dailyReviewTarget,
            newSelectionMode: overview.latest.newSelectionMode,
            reviewSource: overview.latest.reviewSource,
            reviewRoadmapIds: overview.latest.reviewRoadmapIds,
            timeZone: overview.latest.timeZone,
          }
        : null;

  if (!base) {
    return { ok: false as const, error: "settings_required" as const };
  }

  const result = await saveStudyPlanSettingsAction(
    createRoadmapFollowSettingsInput(
      base,
      roadmapId,
      input.applyWhen,
    ),
  );

  if (result.ok) {
    revalidatePath("/roadmaps");
    revalidatePath("/roadmaps/neetcode-150");
  }

  return result;
}
