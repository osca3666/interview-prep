import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  neetcode150Problems,
  type ProblemSetItem,
} from "@/data/problem-sets/neetcode-150";
import type { Database, Tables } from "@/types/database";

type TypedSupabaseClient = SupabaseClient<Database>;
type RoadmapUserProblem = Pick<
  Tables<"user_problems">,
  | "leetcode_slug"
  | "title"
  | "difficulty"
  | "pattern"
  | "mastery_score"
  | "review_stage"
  | "total_reviews"
  | "next_review_at"
  | "lifecycle_state"
>;

export type RoadmapProgress = {
  label: string;
  isPreview: boolean;
  totalInRoadmap: number;
  trackedCount: number;
  unseenCount: number;
  reviewedCount: number;
  strongCount: number;
  nextSuggestedProblems: ProblemSetItem[];
};

function isStrongProblem(problem: RoadmapUserProblem) {
  return problem.mastery_score >= 8 || problem.review_stage >= 4;
}

export async function getRoadmapProgress(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  const problemsResult = await supabase
    .from("user_problems")
    .select(
      "leetcode_slug,title,difficulty,pattern,mastery_score,review_stage,total_reviews,next_review_at,lifecycle_state",
    )
    .eq("user_id", userId);

  if (problemsResult.error) {
    return {
      data: null,
      error: problemsResult.error,
    };
  }

  const userProblems = problemsResult.data ?? [];
  const roadmapSlugs = new Set(
    neetcode150Problems.map((problem) => problem.slug),
  );
  const trackedRoadmapProblems = userProblems.filter((problem) =>
    roadmapSlugs.has(problem.leetcode_slug),
  );
  const trackedSlugs = new Set(
    trackedRoadmapProblems.map((problem) => problem.leetcode_slug),
  );
  const nextSuggestedProblems = neetcode150Problems
    .filter((problem) => !trackedSlugs.has(problem.slug))
    .sort((first, second) => first.order - second.order)
    .slice(0, 5);

  return {
    data: {
      label:
        neetcode150Problems.length === 150
          ? "NeetCode 150"
          : "NeetCode 150 preview",
      isPreview: neetcode150Problems.length < 150,
      totalInRoadmap: neetcode150Problems.length,
      trackedCount: trackedRoadmapProblems.length,
      unseenCount: neetcode150Problems.length - trackedRoadmapProblems.length,
      reviewedCount: trackedRoadmapProblems.filter(
        (problem) => problem.total_reviews > 0,
      ).length,
      strongCount: trackedRoadmapProblems.filter(isStrongProblem).length,
      nextSuggestedProblems,
    } satisfies RoadmapProgress,
    error: null,
  };
}
