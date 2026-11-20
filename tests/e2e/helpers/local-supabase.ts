import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database, TablesInsert } from "@/types/database";

type CatalogSeed = {
  frontendId: string;
  slug: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
  topics: string[];
};

const reviewedSeeds: CatalogSeed[] = [
  { frontendId: "176", slug: "second-highest-salary", title: "Second Highest Salary", difficulty: "medium", topics: ["Database"] },
  { frontendId: "177", slug: "nth-highest-salary", title: "Nth Highest Salary", difficulty: "medium", topics: ["Database"] },
  { frontendId: "178", slug: "rank-scores", title: "Rank Scores", difficulty: "medium", topics: ["Database"] },
  { frontendId: "180", slug: "consecutive-numbers", title: "Consecutive Numbers", difficulty: "medium", topics: ["Database"] },
];

function required(name: string) {
  const value = process.env[name];
  if (!value) throw new Error(`Missing ${name}. Run this spec through npm run test:e2e.`);
  return value;
}

function assertLocalUrl(value: string) {
  const url = new URL(value);
  if (!["127.0.0.1", "localhost"].includes(url.hostname) || url.port !== "54321") {
    throw new Error(`Refusing non-local Supabase URL: ${url.origin}`);
  }
  return value;
}

export const localSupabaseUrl = assertLocalUrl(required("E2E_SUPABASE_URL"));
export const localPublishableKey = required("E2E_SUPABASE_PUBLISHABLE_KEY");

export function createLocalAdminClient(): SupabaseClient<Database> {
  class UnusedRealtimeTransport {
    constructor() {
      throw new Error("Realtime is not available in local E2E fixtures.");
    }
  }
  return createClient<Database>(
    localSupabaseUrl,
    required("E2E_SUPABASE_SERVICE_ROLE_KEY"),
    {
      auth: { autoRefreshToken: false, persistSession: false },
      realtime: { transport: UnusedRealtimeTransport as never },
    },
  );
}

export async function createDisposableUser(
  admin: SupabaseClient<Database>,
  label: string,
) {
  const email = `e2e-${label}-${crypto.randomUUID()}@example.test`;
  const password = `E2e-${crypto.randomUUID()}!`;
  const { data, error } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("Failed to create test user.");
  return { id: data.user.id, email, password };
}

export async function deleteDisposableUser(
  admin: SupabaseClient<Database>,
  userId: string | undefined,
) {
  if (!userId) return;
  const { error } = await admin.auth.admin.deleteUser(userId);
  if (error && !error.message.toLowerCase().includes("not found")) throw error;
}

export async function findUserByEmail(
  admin: SupabaseClient<Database>,
  email: string,
) {
  for (let page = 1; page <= 10; page += 1) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 100 });
    if (error) throw error;
    const match = data.users.find((user) => user.email === email);
    if (match) return match;
    if (data.users.length < 100) return null;
  }
  return null;
}

export async function seedDueReviewedProblems(
  admin: SupabaseClient<Database>,
  userId: string,
  count: number,
) {
  const now = Date.now();
  const problems: TablesInsert<"user_problems">[] = reviewedSeeds
    .slice(0, count)
    .map((problem, index) => ({
      user_id: userId,
      leetcode_frontend_id: problem.frontendId,
      leetcode_slug: problem.slug,
      leetcode_url: `https://leetcode.com/problems/${problem.slug}/`,
      title: problem.title,
      difficulty: problem.difficulty,
      leetcode_topics: problem.topics,
      lifecycle_state: "active",
      mastery_score: 2 + index,
      review_stage: 1,
      total_reviews: 1,
      schedule_version: 0,
      last_reviewed_at: new Date(now - (12 + index) * 86_400_000).toISOString(),
      next_review_at: new Date(now - (5 + index) * 86_400_000).toISOString(),
      source: "manual",
    }));
  const inserted = await admin.from("user_problems").insert(problems).select("*");
  if (inserted.error) throw inserted.error;
  const events: TablesInsert<"review_events">[] = (inserted.data ?? []).map((problem, index) => ({
    correctable_until: new Date(now - (12 + index) * 86_400_000 + 300_000).toISOString(),
    user_id: userId,
    user_problem_id: problem.id,
    rating: "ok",
    previous_mastery_score: 0,
    previous_review_stage: 0,
    previous_total_reviews: 0,
    new_review_stage: 1,
    previous_next_review_at: null,
    next_review_at: problem.next_review_at,
    reviewed_at: new Date(now - (12 + index) * 86_400_000).toISOString(),
    resulting_schedule_version: 0,
    transition_kind: "initial_practice",
    transition_time_zone: "UTC",
  }));
  const eventResult = await admin.from("review_events").insert(events);
  if (eventResult.error) throw eventResult.error;
  return inserted.data ?? [];
}

export async function seedFutureReviewedProblems(
  admin: SupabaseClient<Database>,
  userId: string,
) {
  const now = Date.now();
  const futureOffsets = [5, 2, 8];
  const problems: TablesInsert<"user_problems">[] = reviewedSeeds
    .slice(0, futureOffsets.length)
    .map((problem, index) => ({
      user_id: userId,
      leetcode_frontend_id: problem.frontendId,
      leetcode_slug: problem.slug,
      leetcode_url: `https://leetcode.com/problems/${problem.slug}/`,
      title: problem.title,
      difficulty: problem.difficulty,
      leetcode_topics: problem.topics,
      lifecycle_state: "active",
      mastery_score: 4,
      review_stage: 1,
      total_reviews: 1,
      schedule_version: 0,
      last_reviewed_at: new Date(now - 7 * 86_400_000).toISOString(),
      next_review_at: new Date(now + futureOffsets[index] * 86_400_000).toISOString(),
      source: "manual",
    }));
  const inserted = await admin.from("user_problems").insert(problems).select("*");
  if (inserted.error) throw inserted.error;
  const events: TablesInsert<"review_events">[] = (inserted.data ?? []).map((problem) => ({
    correctable_until: new Date(now - 7 * 86_400_000 + 300_000).toISOString(),
    user_id: userId,
    user_problem_id: problem.id,
    rating: "ok",
    previous_mastery_score: 0,
    previous_review_stage: 0,
    previous_total_reviews: 0,
    new_review_stage: 1,
    previous_next_review_at: null,
    next_review_at: problem.next_review_at,
    reviewed_at: new Date(now - 7 * 86_400_000).toISOString(),
    resulting_schedule_version: 0,
    transition_kind: "initial_practice",
    transition_time_zone: "UTC",
  }));
  const eventResult = await admin.from("review_events").insert(events);
  if (eventResult.error) throw eventResult.error;
  return (inserted.data ?? []).slice().sort((left, right) =>
    left.next_review_at.localeCompare(right.next_review_at) || left.id.localeCompare(right.id));
}

export async function seedTrackedUnpracticedRoadmapProblem(
  admin: SupabaseClient<Database>,
  userId: string,
) {
  const result = await admin.from("user_problems").insert({
    user_id: userId,
    leetcode_frontend_id: "217",
    leetcode_slug: "contains-duplicate",
    leetcode_url: "https://leetcode.com/problems/contains-duplicate/",
    title: "Contains Duplicate",
    difficulty: "easy",
    leetcode_topics: ["Array", "Hash Table"],
    lifecycle_state: "active",
    mastery_score: 0,
    review_stage: 0,
    total_reviews: 0,
    schedule_version: 0,
    next_review_at: new Date(Date.now() + 30 * 86_400_000).toISOString(),
    source: "manual",
  }).select("*").single();
  if (result.error) throw result.error;
  return result.data;
}

export async function seedRecentActivity(
  admin: SupabaseClient<Database>,
  userId: string,
  count: number,
) {
  const now = Date.now();
  const problems: TablesInsert<"user_problems">[] = Array.from({ length: count }, (_, index) => ({
    user_id: userId,
    leetcode_frontend_id: String(8_000 + index),
    leetcode_slug: `recent-activity-${index}`,
    leetcode_url: `https://leetcode.com/problems/recent-activity-${index}/`,
    title: `Recent Activity Problem ${index + 1}`,
    difficulty: (["easy", "medium", "hard"] as const)[index % 3],
    leetcode_topics: ["Array"],
    lifecycle_state: "active",
    mastery_score: index % 4,
    review_stage: 1,
    total_reviews: 1,
    schedule_version: 1,
    last_reviewed_at: new Date(now - index * 3_600_000).toISOString(),
    next_review_at: new Date(now + 86_400_000).toISOString(),
    source: "manual",
  }));
  const inserted = await admin.from("user_problems").insert(problems).select("*");
  if (inserted.error) throw inserted.error;

  const events: TablesInsert<"review_events">[] = (inserted.data ?? []).map((problem, index) => {
    const reviewedAt = new Date(now - index * 3_600_000).toISOString();
    return {
      correctable_until: new Date(new Date(reviewedAt).getTime() + 300_000).toISOString(),
      user_id: userId,
      user_problem_id: problem.id,
      rating: (["good", "ok", "bad"] as const)[index % 3],
      previous_mastery_score: 0,
      previous_review_stage: 0,
      previous_total_reviews: 0,
      new_review_stage: 1,
      previous_next_review_at: null,
      next_review_at: problem.next_review_at,
      reviewed_at: reviewedAt,
      resulting_schedule_version: 1,
      transition_kind: index % 2 === 0 ? "initial_practice" : "review",
      transition_time_zone: index % 2 === 0 ? "America/Denver" : null,
    };
  });
  const eventResult = await admin.from("review_events").insert(events);
  if (eventResult.error) throw eventResult.error;
}

export async function getCurrentPlan(
  admin: SupabaseClient<Database>,
  userId: string,
) {
  const planResult = await admin
    .from("daily_study_plans")
    .select("*")
    .eq("user_id", userId)
    .order("study_date", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (planResult.error) throw planResult.error;
  if (!planResult.data) return null;
  const tasksResult = await admin
    .from("daily_study_plan_tasks")
    .select("*")
    .eq("plan_id", planResult.data.id)
    .order("position");
  if (tasksResult.error) throw tasksResult.error;
  return { plan: planResult.data, tasks: tasksResult.data ?? [] };
}
