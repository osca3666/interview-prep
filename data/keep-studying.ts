import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getTodaysDailyStudyPlan, type DailyStudyPlanError } from "@/data/daily-study-plans";
import { neetcode150Problems } from "@/data/problem-sets/neetcode-150";
import { getLeetCodeProblemBySlug } from "@/lib/leetcode-catalog";
import {
  isCurrentStudyDay, selectExtraReview, selectExtraRoadmap,
  type ExtraRoadmapProblem, type ExtraStudyCandidate, type ExtraStudyMode,
} from "@/lib/keep-studying";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
const controlledError = (message: string): DailyStudyPlanError => ({ code: "P0001", message, details: "", hint: "" });

export async function getCurrentExtraStudyPlan(client: Client, userId: string, planId: string, referenceTime = new Date()) {
  const result = await getTodaysDailyStudyPlan(client, userId, referenceTime);
  if (result.error) return result;
  const persisted = result.data;
  if (!persisted || persisted.plan.id !== planId || persisted.plan.user_id !== userId
    || !isCurrentStudyDay(persisted.plan, referenceTime)
    || persisted.tasks.length !== persisted.plan.planned_task_count) {
    return { data: null, error: controlledError("plan_changed") };
  }
  return result;
}

function roadmapProblems(): ExtraRoadmapProblem[] {
  return neetcode150Problems.map((row) => {
    const canonical = getLeetCodeProblemBySlug(row.slug);
    if (!canonical) throw new Error("Missing canonical roadmap problem");
    return { order: row.order, frontendId: canonical.frontendId, slug: canonical.slug, title: canonical.title,
      difficulty: canonical.difficulty, leetcodeUrl: canonical.leetcodeUrl };
  });
}

async function trackedRoadmapProblems(client: Client, userId: string, roadmap: ExtraRoadmapProblem[]) {
  // At most 150 unique matches per query, across every lifecycle/date state.
  const fields = "leetcode_frontend_id,leetcode_slug,total_reviews,source,external_practice_status";
  const [byId, bySlug] = await Promise.all([
    client.from("user_problems").select(fields).eq("user_id", userId)
      .in("leetcode_frontend_id", roadmap.map((row) => row.frontendId)).limit(roadmap.length),
    client.from("user_problems").select(fields).eq("user_id", userId)
      .in("leetcode_slug", roadmap.map((row) => row.slug)).limit(roadmap.length),
  ]);
  return { data: [...(byId.data ?? []), ...(bySlug.data ?? [])], error: byId.error ?? bySlug.error };
}

async function practicedReviewProblems(client: Client, userId: string) {
  const rows = [];
  let cursor: { nextReviewAt: string; id: string } | null = null;

  while (true) {
    let query = client.from("user_problems")
      .select("id,leetcode_frontend_id,leetcode_slug,title,difficulty,leetcode_url,lifecycle_state,mastery_score,next_review_at,schedule_version,total_reviews,source,external_practice_status,external_activity_date")
      .eq("user_id", userId)
      .eq("lifecycle_state", "active")
      .gt("total_reviews", 0)
      .order("next_review_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(500);
    if (cursor) {
      query = query.or(
        `next_review_at.gt.${cursor.nextReviewAt},and(next_review_at.eq.${cursor.nextReviewAt},id.gt.${cursor.id})`,
      );
    }
    const result = await query;
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    rows.push(...page);
    if (page.length < 500) return { data: rows, error: null };
    const last = page.at(-1);
    if (!last) return { data: rows, error: null };
    cursor = { nextReviewAt: last.next_review_at, id: last.id };
  }
}

export async function getExtraStudyRecommendation(client: Client, userId: string, planId: string, mode: ExtraStudyMode, referenceTime = new Date()): Promise<{ data: ExtraStudyCandidate | null; error: DailyStudyPlanError | null }> {
  const plan = await getCurrentExtraStudyPlan(client, userId, planId, referenceTime);
  if (!plan.data || plan.error) return { data: null, error: plan.error };
  if (mode === "review") {
    const practiced = await practicedReviewProblems(client, userId);
    return { data: practiced.error ? null : selectExtraReview(practiced.data ?? [], plan.data.tasks), error: practiced.error };
  }
  const roadmap = roadmapProblems();
  const tracked = await trackedRoadmapProblems(client, userId, roadmap);
  return { data: tracked.error ? null : selectExtraRoadmap(roadmap, tracked.data, plan.data.tasks), error: tracked.error };
}

/** Re-read eligibility, not client display metadata. This never creates a plan or task. */
