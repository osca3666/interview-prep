import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export async function importLeetCodeHistory(
  client: Client,
  problems: Database["public"]["Functions"]["import_leetcode_history"]["Args"]["p_problems"],
) {
  return client.rpc("import_leetcode_history", { p_problems: problems });
}
