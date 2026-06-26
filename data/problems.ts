import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Tables, TablesInsert } from "@/types/database";

export type UserProblem = Tables<"user_problems">;
export type UserProblemInsert = TablesInsert<"user_problems">;
export type TypedSupabaseClient = SupabaseClient<Database>;

export async function listUserProblems(
  supabase: TypedSupabaseClient,
  userId: string,
) {
  return supabase
    .from("user_problems")
    .select(
      "id,title,difficulty,pattern,lifecycle_state,next_review_at,leetcode_url,created_at",
    )
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
}

export async function insertUserProblem(
  supabase: TypedSupabaseClient,
  problem: UserProblemInsert,
) {
  return supabase.from("user_problems").insert(problem);
}
