import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import {
  buildConsistencySnapshot,
  type ConsistencyEvent,
  type ConsistencySnapshot,
} from "@/lib/consistency";
import { isValidTimeZone } from "@/lib/time-zone";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;
type ConsistencyError = Pick<PostgrestError, "code" | "message" | "details" | "hint">;

const PAGE_SIZE = 1_000;
const MAX_EVENTS = 50_000;

function limitError(): ConsistencyError {
  return {
    code: "consistency_limit_exceeded",
    message: "Consistency event limit exceeded",
    details: "",
    hint: "",
  };
}

async function listPracticeEvents(client: Client, userId: string) {
  const rows: ConsistencyEvent[] = [];
  let cursor: { reviewedAt: string; id: string } | null = null;

  while (true) {
    let query = client
      .from("review_events")
      .select("id,reviewed_at")
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
        reviewedAt: event.reviewed_at,
      })),
    );
    if (rows.length > MAX_EVENTS) return { data: null, error: limitError() };
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
    const last = page.at(-1);
    if (!last) return { data: rows, error: null };
    cursor = { reviewedAt: last.reviewed_at, id: last.id };
  }
}

export async function getConsistencySnapshot(
  client: Client,
  userId: string,
  referenceTime = new Date(),
): Promise<{ data: ConsistencySnapshot | null; error: ConsistencyError | null }> {
  const [preferences, events] = await Promise.all([
    client
      .from("user_study_preferences")
      .select("time_zone")
      .eq("user_id", userId)
      .maybeSingle(),
    listPracticeEvents(client, userId),
  ]);

  const error = preferences.error ?? events.error;
  if (error || !events.data) return { data: null, error };
  const savedTimeZone = preferences.data?.time_zone ?? "UTC";
  const timeZone = isValidTimeZone(savedTimeZone) ? savedTimeZone : "UTC";

  return {
    data: buildConsistencySnapshot({
      events: events.data,
      timeZone,
      referenceTime,
    }),
    error: null,
  };
}
