import type { Tables } from "@/types/database";
import type { StudyRating } from "@/lib/ratings";

export type PersistedDailyStudyPlan = {
  plan: Tables<"daily_study_plans">;
  tasks: Tables<"daily_study_plan_tasks">[];
};

export type StudyPlanLiveProblem = Pick<
  Tables<"user_problems">,
  "id" | "lifecycle_state" | "next_review_at" | "schedule_version"
>;

export type StudyPlanDisplayTask = Pick<Tables<"daily_study_plan_tasks">,
  "id" | "kind" | "origin" | "status" | "user_problem_id" | "leetcode_frontend_id" |
  "title" | "difficulty" | "leetcode_url" | "assignment_source" | "position" |
  "created_at" | "completed_at" | "deferred_at"
>;

export type DailyStudyWorkspace = {
  plan: Pick<Tables<"daily_study_plans">,
    "id" | "study_date" | "time_zone" | "day_ends_at" | "planned_task_count"
  >;
  tasks: StudyPlanDisplayTask[];
  liveProblems: StudyPlanLiveProblem[];
  asOf: string;
};

export type StudyPlanActionResult =
  | { ok: true; workspace: DailyStudyWorkspace }
  | { ok: false; error: "not_authenticated" | "invalid_time_zone" | "save_failed" };

export type StudyTaskRating = StudyRating;
export type PersistedStudyAttempt = {
  reviewEventId: string;
  rating: StudyRating;
  correctableUntil: string;
};
export type StudyTaskRatingResult =
  | { ok: true; attempt: PersistedStudyAttempt }
  | { ok: false; error: "not_authenticated" | "task_changed" | "save_failed" };

export type TodayProblemIntent = "todo" | "done";
export type AddProblemToTodayResult =
  | {
      ok: true;
      outcome: "added_todo" | "marked_done";
      taskId: string;
      attempt: PersistedStudyAttempt | null;
    }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_problem"
        | "plan_changed"
        | "already_in_today"
        | "already_completed_today"
        | "already_deferred_today"
        | "problem_not_active"
        | "save_failed";
    };

export function getStudyPlanSummary({ plan, tasks }: {
  plan: { planned_task_count: number };
  tasks: readonly { status: string }[];
}) {
  const total = plan.planned_task_count;
  const completed = tasks.filter((task) => task.status === "completed").length;
  const deferred = tasks.filter((task) => task.status === "deferred").length;
  return {
    total, completed, deferred,
    percent: total > 0 ? Math.min(100, (completed / total) * 100) : 0,
    state: total === 0 ? "empty" : completed === total ? "completed"
      : completed + deferred === total ? "resolved" : "active",
  };
}

const statusRank = { pending: 0, deferred: 1, completed: 2 } as const;

function timestamp(value: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : 0;
}

/** Actionable work stays first; persisted positions/timestamps make ordering refresh-stable. */
export function orderStudyPlanTasks(
  tasks: readonly StudyPlanDisplayTask[],
  optimisticCompletedIds: ReadonlySet<string> = new Set(),
) {
  return [...tasks].sort((a, b) => {
    const aStatus = optimisticCompletedIds.has(a.id) ? "completed" : a.status;
    const bStatus = optimisticCompletedIds.has(b.id) ? "completed" : b.status;
    const rankDifference = statusRank[aStatus as keyof typeof statusRank]
      - statusRank[bStatus as keyof typeof statusRank];
    if (rankDifference !== 0) return rankDifference;

    if (aStatus === "pending") {
      const aAdded = a.assignment_source !== "generated";
      const bAdded = b.assignment_source !== "generated";
      if (aAdded !== bAdded) return aAdded ? -1 : 1;
      return aAdded ? b.position - a.position : a.position - b.position;
    }
    if (aStatus === "completed") {
      const aCompletedAt = optimisticCompletedIds.has(a.id) ? Number.MAX_SAFE_INTEGER : timestamp(a.completed_at);
      const bCompletedAt = optimisticCompletedIds.has(b.id) ? Number.MAX_SAFE_INTEGER : timestamp(b.completed_at);
      const completedDifference = aCompletedAt - bCompletedAt;
      if (completedDifference !== 0) return completedDifference;
    }
    return a.position - b.position;
  });
}

export function getStudyTaskAction(
  task: StudyPlanDisplayTask,
  liveProblem: StudyPlanLiveProblem | undefined,
  referenceTime: string,
) {
  if (task.status !== "pending") return "resolved";
  if (!task.user_problem_id) return task.kind === "new_problem" && task.origin === "roadmap" && task.leetcode_frontend_id ? "practice_new" : "unavailable";
  if (!liveProblem || liveProblem.id !== task.user_problem_id || liveProblem.lifecycle_state !== "active") return "unavailable";
  return task.assignment_source === "manual_today"
    || Date.parse(liveProblem.next_review_at) <= Date.parse(referenceTime)
    ? "review"
    : "scheduled";
}

// A new server snapshot remounts only the workspace, including obsolete form/dialog state.
export function getStudyWorkspaceRevision(workspace: DailyStudyWorkspace | null) {
  return workspace ? JSON.stringify([
    workspace.plan.id,
    workspace.tasks.map((task) => [task.id, task.status, task.user_problem_id, task.assignment_source,
      getStudyTaskAction(task, workspace.liveProblems.find((problem) => problem.id === task.user_problem_id), workspace.asOf)]),
    workspace.liveProblems.map((problem) => [problem.id, problem.lifecycle_state, problem.schedule_version, problem.next_review_at]),
  ]) : "initialize";
}
