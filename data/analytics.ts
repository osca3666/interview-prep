import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  buildAnalyticsSnapshot,
  type AnalyticsProblem,
  type AnalyticsReviewEvent,
  type AnalyticsSnapshot,
} from "@/lib/analytics";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type AnalyticsError = Pick<PostgrestError, "code" | "message" | "details" | "hint">;

const PAGE_SIZE = 1_000;
const MAX_EVENTS = 50_000;
const MAX_PROBLEMS = 10_000;

function limitError(resource: "events" | "problems"): AnalyticsError {
  return {
    code: "analytics_limit_exceeded",
    message: `Analytics ${resource} limit exceeded`,
    details: "",
    hint: "",
  };
}

async function listReviewEvents(client: Client, userId: string) {
  const rows: AnalyticsReviewEvent[] = [];
  let cursor: { reviewedAt: string; id: string } | null = null;

  while (true) {
    let query = client
      .from("review_events")
      .select(
        "id,user_problem_id,rating,reviewed_at,practice_local_date,pre_practice_problem_type",
      )
      .eq("user_id", userId)
      .order("reviewed_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);

    if (cursor) {
      query = query.or(
        `reviewed_at.gt.${cursor.reviewedAt},and(reviewed_at.eq.${cursor.reviewedAt},id.gt.${cursor.id})`,
      );
    }

    const result = await query;
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    rows.push(
      ...page.map((event) => ({
        id: event.id,
        userProblemId: event.user_problem_id,
        rating: event.rating,
        reviewedAt: event.reviewed_at,
        practiceLocalDate: event.practice_local_date,
        prePracticeProblemType: event.pre_practice_problem_type,
      })),
    );
    if (rows.length > MAX_EVENTS) return { data: null, error: limitError("events") };
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
    const last = page.at(-1);
    if (!last) return { data: rows, error: null };
    cursor = { reviewedAt: last.reviewed_at, id: last.id };
  }
}

async function listAnalyticsProblems(client: Client, userId: string) {
  const rows: AnalyticsProblem[] = [];
  let cursor: string | null = null;

  while (true) {
    let query = client
      .from("user_problems")
      .select(
        "id,leetcode_topics,mastery_score,difficulty,source,external_practice_status,external_activity_date",
      )
      .eq("user_id", userId)
      .order("id", { ascending: true })
      .limit(PAGE_SIZE);
    if (cursor) query = query.gt("id", cursor);

    const result = await query;
    if (result.error) return { data: null, error: result.error };
    const page = result.data ?? [];
    rows.push(
      ...page.map((problem) => ({
        id: problem.id,
        topics: problem.leetcode_topics,
        masteryScore: problem.mastery_score,
        difficulty: problem.difficulty,
        source: problem.source,
        externalPracticeStatus: problem.external_practice_status,
        externalActivityDate: problem.external_activity_date,
      })),
    );
    if (rows.length > MAX_PROBLEMS) return { data: null, error: limitError("problems") };
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
    const last = page.at(-1);
    if (!last) return { data: rows, error: null };
    cursor = last.id;
  }
}

export async function getAnalyticsSnapshot(
  client: Client,
  userId: string,
  referenceTime = new Date(),
): Promise<{ data: AnalyticsSnapshot | null; error: AnalyticsError | null }> {
  const [preferences, events, problems] = await Promise.all([
    client
      .from("user_study_preferences")
      .select("time_zone")
      .eq("user_id", userId)
      .maybeSingle(),
    listReviewEvents(client, userId),
    listAnalyticsProblems(client, userId),
  ]);

  const error = preferences.error ?? events.error ?? problems.error;
  if (error || !events.data || !problems.data) return { data: null, error };

  return {
    data: buildAnalyticsSnapshot({
      events: events.data,
      problems: problems.data,
      timeZone: preferences.data?.time_zone ?? "UTC",
      referenceTime,
    }),
    error: null,
  };
}
