import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { getDailyStudyRecommendations } from "@/data/study-plan";
import { getEffectiveStudyPlanSettings } from "@/data/study-settings";
import { getV1StudyPlanProposal } from "@/data/v1-study-plan";
import { getLeetCodeProblemBySlug } from "@/lib/leetcode-catalog";
import type { DailyStudyRecommendations } from "@/lib/study-plan";
import type { DailyStudyWorkspace, PersistedDailyStudyPlan } from "@/lib/daily-study-plan-view";
import { getDateOnlyInTimeZone, normalizeTimeZone } from "@/lib/time-zone";
import type { Database, Json, Tables } from "@/types/database";

type Client = SupabaseClient<Database>;
export type { PersistedDailyStudyPlan } from "@/lib/daily-study-plan-view";
export type DailyStudyPlanError = Pick<
  PostgrestError,
  "code" | "message" | "details" | "hint"
>;
export type AddProblemToTodayArgs =
  Database["public"]["Functions"]["add_problem_to_today"]["Args"];
type PlanResult = {
  data: PersistedDailyStudyPlan | null;
  error: DailyStudyPlanError | null;
};

/** Only the assigned rows are loaded; current versions must never come from task snapshots. */
export async function getDailyStudyWorkspace(
  client: Client,
  userId: string,
  persisted: PersistedDailyStudyPlan,
): Promise<{ data: DailyStudyWorkspace | null; error: DailyStudyPlanError | null }> {
  const { id, study_date, time_zone, day_ends_at, planned_task_count } = persisted.plan;
  const display = {
    plan: { id, study_date, time_zone, day_ends_at, planned_task_count },
    tasks: persisted.tasks.map(({ id, kind, origin, status, user_problem_id, leetcode_frontend_id, title, difficulty, leetcode_url, assignment_source, position, created_at, completed_at, deferred_at }) =>
      ({ id, kind, origin, status, user_problem_id, leetcode_frontend_id, title, difficulty, leetcode_url, assignment_source, position, created_at, completed_at, deferred_at })),
  };

  const ids = Array.from(new Set(
    persisted.tasks.flatMap((task) => task.user_problem_id ? [task.user_problem_id] : []),
  ));
  if (ids.length === 0) {
    return { data: { ...display, liveProblems: [], asOf: new Date().toISOString() }, error: null };
  }
  const { data, error } = await client.from("user_problems")
    .select("id,lifecycle_state,next_review_at,schedule_version")
    .eq("user_id", userId).in("id", ids).order("id");
  if (error) return { data: null, error };
  const liveProblems = (data ?? []).map((problem) => ({
    id: problem.id,
    lifecycle_state: problem.lifecycle_state,
    next_review_at: problem.next_review_at,
    schedule_version: problem.schedule_version,
  }));
  return { data: { ...display, liveProblems, asOf: new Date().toISOString() }, error: null };
}

export async function addProblemToToday(
  client: Client,
  input: AddProblemToTodayArgs,
) {
  return client.rpc("add_problem_to_today", input);
}

/** Defers only an owned, still-untracked roadmap task; no practice or scheduling transition. */
export async function deferDailyStudyPlanTask(client: Client, taskId: string) {
  return client.rpc("defer_daily_study_plan_task", { p_task_id: taskId });
}

export async function getOwnedDailyStudyTask(client: Client, userId: string, taskId: string) {
  return client.from("daily_study_plan_tasks")
    .select("leetcode_frontend_id,leetcode_slug")
    .eq("user_id", userId).eq("id", taskId).maybeSingle();
}

export async function rateNewDailyStudyTask(
  client: Client,
  args: Database["public"]["Functions"]["rate_new_daily_study_task"]["Args"],
) {
  return client.rpc("rate_new_daily_study_task", args);
}

function controlledError(message: string): PlanResult {
  return { data: null, error: { code: "P0001", message, details: "", hint: "" } };
}

async function loadTasks(
  client: Client,
  userId: string,
  plan: Tables<"daily_study_plans">,
): Promise<PlanResult> {
  const { data, error } = await client
    .from("daily_study_plan_tasks")
    .select("*")
    .eq("user_id", userId)
    .eq("plan_id", plan.id)
    .order("position", { ascending: true });
  if (error) return { data: null, error };
  const assignedTasks = (data ?? []).filter((task) => task.status !== "unassigned");
  if (assignedTasks.length !== plan.planned_task_count) return controlledError("save_failed");
  return { data: { plan, tasks: assignedTasks }, error: null };
}

/** Read only: the saved timezone, not the current device timezone, defines today. */
export async function getTodaysDailyStudyPlan(
  client: Client,
  userId: string,
  referenceTime = new Date(),
): Promise<PlanResult> {
  const { data: preferences, error: preferenceError } = await client
    .from("user_study_preferences")
    .select("time_zone")
    .eq("user_id", userId)
    .maybeSingle();
  if (preferenceError) return { data: null, error: preferenceError };
  if (!preferences) return { data: null, error: null };

  const studyDate = getDateOnlyInTimeZone(referenceTime, preferences.time_zone);
  if (!studyDate) return controlledError("invalid_time_zone");
  const { data: plan, error } = await client
    .from("daily_study_plans")
    .select("*")
    .eq("user_id", userId)
    .eq("study_date", studyDate)
    .maybeSingle();
  if (error || !plan) return { data: null, error };
  return loadTasks(client, userId, plan);
}

function proposalTasks(recommendations: DailyStudyRecommendations): Json[] | null {
  const tasks: Json[] = [];
  for (const task of recommendations.tasks) {
    if (
      task.kind === "review" ||
      task.kind === "calibration" ||
      (task.kind === "new_problem" && task.origin === "tracked")
    ) {
      // SQL snapshots metadata from the owned row, not from this proposal.
      tasks.push({
        kind: task.kind,
        origin: "tracked",
        user_problem_id: task.userProblemId,
        schedule_version: task.scheduleVersion,
      });
      continue;
    }
    const canonical = getLeetCodeProblemBySlug(task.slug);
    if (!canonical) return null;
    // The trusted static catalog is enforced here, not independently by PostgreSQL.
    tasks.push({
      kind: "new_problem",
      origin: "roadmap",
      frontend_id: canonical.frontendId,
      slug: canonical.slug,
      title: canonical.title,
      difficulty: canonical.difficulty,
      leetcode_url: canonical.leetcodeUrl,
      roadmap_order: task.order,
    });
  }
  return tasks;
}

/** Server-only entry point. The RPC authoritatively resolves today's date and existing plan. */
export async function ensureTodaysDailyStudyPlan(
  client: Client,
  userId: string,
  detectedTimeZone: string,
): Promise<PlanResult> {
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const referenceTime = new Date();
    const existing = await getTodaysDailyStudyPlan(client, userId, referenceTime);
    if (existing.error) return existing;
    let tasks: Json[] | null = null;
    if (!existing.data) {
      const settings = await getEffectiveStudyPlanSettings(client, referenceTime);
      if (settings.error) return { data: null, error: settings.error };
      if (settings.data) {
        const proposal = await getV1StudyPlanProposal(
          client,
          userId,
          settings.data,
          referenceTime,
        );
        if (proposal.error) return { data: null, error: proposal.error };
        if (!proposal.data) return controlledError("save_failed");
        const { data: plan, error } = await client.rpc("create_v1_daily_study_plan", {
          p_time_zone: normalizeTimeZone(detectedTimeZone),
          p_reference_time: referenceTime.toISOString(),
          p_settings_revision_id: settings.data.revision_id,
          p_tasks: proposal.data,
        });
        if (error?.code === "P0001" && ["stale_recommendations", "stale_settings", "stale_allocation"].includes(error.message) && attempt === 0) continue;
        if (error) return { data: null, error };
        if (!plan) return controlledError("save_failed");
        return loadTasks(client, userId, plan);
      }
      const recommendations = await getDailyStudyRecommendations(client, userId, referenceTime);
      if (recommendations.error) return { data: null, error: recommendations.error };
      if (!recommendations.data) return controlledError("save_failed");
      tasks = proposalTasks(recommendations.data);
      if (!tasks) return controlledError("invalid_submission");
    }

    // A null proposal means "return existing only", never "create an empty plan".
    const { data: plan, error } = await client.rpc("create_daily_study_plan", {
      p_time_zone: normalizeTimeZone(detectedTimeZone),
      p_reference_time: referenceTime.toISOString(),
      p_tasks: tasks,
    });
    if (error?.code === "P0001" && error.message === "stale_recommendations" && attempt === 0) continue;
    if (error) return { data: null, error };
    if (!plan) return controlledError("save_failed");
    return loadTasks(client, userId, plan);
  }
  return controlledError("stale_recommendations");
}
