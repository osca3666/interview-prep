import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";
import type { StudyRating } from "@/lib/ratings";

export type DueProblem = Pick<
  Tables<"user_problems">,
  | "id"
  | "title"
  | "difficulty"
  | "notes"
  | "leetcode_url"
  | "review_stage"
  | "next_review_at"
  | "schedule_version"
>;

type TypedSupabaseClient = SupabaseClient<Database>;

export type ReviewRating = StudyRating;

export async function listDueProblems(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  return supabase
    .from("user_problems")
    .select(
      "id,title,difficulty,notes,leetcode_url,review_stage,next_review_at,schedule_version",
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

export async function snoozeProblemReview(
  supabase: TypedSupabaseClient,
  input: {
    userProblemId: string;
    timeZone: string;
    expectedScheduleVersion: number;
  },
){
  return supabase.rpc("snooze_problem_review", {
    p_expected_schedule_version: input.expectedScheduleVersion,
    p_time_zone:  input.timeZone,
    p_user_problem_id: input.userProblemId,
  });
}

export async function correctReviewRating(
  supabase: TypedSupabaseClient,
  input: { reviewEventId: string; rating: ReviewRating },
) {
  return supabase.rpc("correct_review_rating", {
    p_review_event_id: input.reviewEventId,
    p_rating: input.rating,
  });
}

export async function getReviewAttempt(
  supabase: TypedSupabaseClient,
  userId: string,
  reviewEventId: string,
) {
  return supabase
    .from("review_events")
    .select("id,rating,correctable_until")
    .eq("user_id", userId)
    .eq("id", reviewEventId)
    .single();
}
