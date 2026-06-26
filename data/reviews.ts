import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export type DueProblem = Pick<
  Tables<"user_problems">,
  | "id"
  | "title"
  | "difficulty"
  | "pattern"
  | "notes"
  | "leetcode_url"
  | "review_stage"
  | "next_review_at"
  | "schedule_version"
>;

type TypedSupabaseClient = SupabaseClient<Database>;

export type ReviewRating = "again" | "hard" | "good" | "easy";

export async function listDueProblems(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  return supabase
    .from("user_problems")
    .select(
      "id,title,difficulty,pattern,notes,leetcode_url,review_stage,next_review_at,schedule_version",
    )
    .eq("user_id", userId)
    .eq("lifecycle_state", "active")
    .lte("next_review_at", new Date().toISOString())
    .order("next_review_at", { ascending: true })
    .limit(20);
}

export async function submitProblemReview(
  supabase: TypedSupabaseClient,
  input: {
    userProblemId: string;
    rating: ReviewRating;
    expectedScheduleVersion: number;
  },
) {
  return supabase.rpc("submit_problem_review", {
    p_user_problem_id: input.userProblemId,
    p_rating: input.rating,
    p_expected_schedule_version: input.expectedScheduleVersion,
  });
}
