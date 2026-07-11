import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables } from "@/types/database";

export type UserProblem = Tables<"user_problems">;
export type TypedSupabaseClient = SupabaseClient<Database>;
export type CreateUserProblemArgs =
  Database["public"]["Functions"]["create_user_problem_with_timezone"]["Args"];

export async function listUserProblems(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  return supabase
    .from("user_problems")
    .select(
      "id,leetcode_frontend_id,title,difficulty,leetcode_topics,lifecycle_state,next_review_at,leetcode_url,created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function createUserProblem(
  supabase: TypedSupabaseClient,
  problem: CreateUserProblemArgs,
) {
  return supabase.rpc("create_user_problem_with_timezone", problem);
}
