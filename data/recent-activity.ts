import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  buildRecentActivitySnapshot,
  type RecentActivityEvent,
  type RecentActivityProblem,
  type RecentActivitySnapshot,
} from "@/lib/recent-activity";
import { isValidTimeZone } from "@/lib/time-zone";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type RecentActivityError = Pick<PostgrestError, "code" | "message" | "details" | "hint">;

export async function getRecentActivity(
  client: Client,
  userId: string,
  timeZone: string,
  referenceTime = new Date(),
): Promise<{ data: RecentActivitySnapshot | null; error: RecentActivityError | null }> {
  const eventsResult = await client
    .from("review_events")
    .select("id,user_problem_id,rating,reviewed_at,transition_kind")
    .eq("user_id", userId)
    .order("reviewed_at", { ascending: false })
    .order("id", { ascending: false })
    .limit(10);

  if (eventsResult.error) return { data: null, error: eventsResult.error };

  const events: RecentActivityEvent[] = (eventsResult.data ?? []).map((event) => ({
    id: event.id,
    userProblemId: event.user_problem_id,
    rating: event.rating,
    reviewedAt: event.reviewed_at,
    transitionKind: event.transition_kind,
  }));
  const problemIds = Array.from(new Set(events.map((event) => event.userProblemId)));

  let problems: RecentActivityProblem[] = [];
  if (problemIds.length > 0) {
    const problemsResult = await client
      .from("user_problems")
      .select("id,leetcode_frontend_id,title,difficulty,leetcode_url")
      .eq("user_id", userId)
      .in("id", problemIds);
    if (problemsResult.error) return { data: null, error: problemsResult.error };
    problems = (problemsResult.data ?? []).map((problem) => ({
      id: problem.id,
      frontendId: problem.leetcode_frontend_id,
      title: problem.title,
      difficulty: problem.difficulty,
      leetcodeUrl: problem.leetcode_url,
    }));
  }

  const safeTimeZone = isValidTimeZone(timeZone) ? timeZone : "UTC";
  return {
    data: buildRecentActivitySnapshot({
      events,
      problems,
      timeZone: safeTimeZone,
      referenceTime,
    }),
    error: null,
  };
}
