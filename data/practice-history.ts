import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export type PracticeHistoryProblem = Pick<
  Tables<"user_problems">,
  | "id"
  | "leetcode_frontend_id"
  | "title"
  | "difficulty"
  | "leetcode_url"
  | "leetcode_topics"
  | "mastery_score"
  | "last_reviewed_at"
  | "next_review_at"
  | "total_reviews"
>;

type TypedSupabaseClient = SupabaseClient<Database>;

export async function listPracticeHistory(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  return supabase
    .from("user_problems")
    .select(
      "id,leetcode_frontend_id,title,difficulty,leetcode_url,leetcode_topics,mastery_score,last_reviewed_at,next_review_at,total_reviews",
    )
    .eq("user_id", userId)
    .order("last_reviewed_at", { ascending: false, nullsFirst: false });
}
