import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { neetcode150Problems } from "@/data/problem-sets/neetcode-150";
import {
  selectDailyStudyPlan,
  type DailyStudyRecommendations,
  type StudyPlanCandidate,
} from "@/lib/study-plan";
import type { Database } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;
type DueCandidatesResult = {
  data: StudyPlanCandidate[] | null;
  error: PostgrestError | null;
};
type RecommendationsResult = {
  data: DailyStudyRecommendations | null;
  error: PostgrestError | null;
};

const pageSize = 500;

export async function listDueCandidates(
  supabase: TypedSupabaseClient,
  userId: string,
  referenceTime: string,
): Promise<DueCandidatesResult> {
  const candidates: StudyPlanCandidate[] = [];
  let cursor: { nextReviewAt: string; id: string } | null = null;

  while (true) {
    let query = supabase
      .from("user_problems")
      .select(
        "id,leetcode_frontend_id,leetcode_slug,title,difficulty,leetcode_url,lifecycle_state,mastery_score,next_review_at,schedule_version,total_reviews,source,external_practice_status,external_activity_date",
      )
      .eq("user_id", userId)
      .eq("lifecycle_state", "active")
      .lte("next_review_at", referenceTime)
      .order("next_review_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(pageSize);

    if (cursor) {
      // Both cursor values come from typed database rows, not submitted filter text.
      query = query.or(
        `next_review_at.gt.${cursor.nextReviewAt},and(next_review_at.eq.${cursor.nextReviewAt},id.gt.${cursor.id})`,
      );
    }

    const { data, error } = await query;

    if (error) {
      return { data: null, error };
    }

    const page = data ?? [];
    candidates.push(...page);

    if (page.length < pageSize) {
      return { data: candidates, error: null };
    }

    const lastProblem = page[page.length - 1];
    cursor = {
      nextReviewAt: lastProblem.next_review_at,
      id: lastProblem.id,
    };
  }
}

export async function getDailyStudyRecommendations(
  supabase: TypedSupabaseClient,
  userId: string,
  referenceTime: Date,
): Promise<RecommendationsResult> {
  const fixedReferenceTime = new Date(referenceTime.getTime());
  const [dueResult, trackedResult] = await Promise.all([
    listDueCandidates(supabase, userId, fixedReferenceTime.toISOString()),
    supabase
      .from("user_problems")
      .select("leetcode_slug")
      .eq("user_id", userId)
      .in("leetcode_slug", neetcode150Problems.map((problem) => problem.slug)),
  ]);

  if (dueResult.error || trackedResult.error) {
    return { data: null, error: dueResult.error ?? trackedResult.error };
  }

  return {
    data: selectDailyStudyPlan({
      dueProblems: dueResult.data ?? [],
      trackedSlugs: (trackedResult.data ?? []).map((problem) => problem.leetcode_slug),
      roadmapProblems: neetcode150Problems,
      referenceTime: fixedReferenceTime,
    }),
    error: null,
  };
}
