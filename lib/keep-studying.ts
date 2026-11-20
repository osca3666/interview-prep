import type { StudyPlanCandidate } from "@/lib/study-plan";
import type { Tables } from "@/types/database";

export type ExtraStudyMode = "review" | "roadmap";
export type AssignedStudyProblem = Pick<Tables<"daily_study_plan_tasks">,
  "user_problem_id" | "original_user_problem_id" | "leetcode_frontend_id" | "leetcode_slug">;
export type TrackedRoadmapIdentity = Pick<Tables<"user_problems">,
  "leetcode_frontend_id" | "leetcode_slug" | "total_reviews" | "source" | "external_practice_status">;
type DisplayProblem = { frontendId: string | null; slug: string; title: string; difficulty: string; leetcodeUrl: string };
export type ExtraStudyCandidate =
  | (DisplayProblem & { kind: "review"; userProblemId: string; scheduleVersion: number })
  | (DisplayProblem & { kind: "roadmap"; frontendId: string; order: number });
export type ExtraRoadmapProblem = DisplayProblem & { frontendId: string; order: number };
export type ExtraStudyError = "not_authenticated" | "plan_changed" | "candidate_changed" | "save_failed";
export type ExtraRecommendationResult = { ok: true; candidate: ExtraStudyCandidate | null } | { ok: false; error: ExtraStudyError };
export type AddRecommendedProblemResult =
  | { ok: true; added: false }
  | { ok: true; added: true; taskId: string }
  | { ok: false; error: ExtraStudyError };

const frontendKey = (value: string | null | undefined) => value?.trim() || null;

export function isAssignedStudyProblem(tasks: readonly AssignedStudyProblem[], problem: { id?: string; frontendId: string | null; slug: string }) {
  return tasks.some((task) =>
    (problem.id && (task.user_problem_id === problem.id || task.original_user_problem_id === problem.id)) ||
    (frontendKey(problem.frontendId) && frontendKey(task.leetcode_frontend_id) === frontendKey(problem.frontendId)) ||
    task.leetcode_slug === problem.slug,
  );
}

export function isPracticedRoadmapProblem(tracked: readonly TrackedRoadmapIdentity[], problem: ExtraRoadmapProblem) {
  return tracked.some((row) => (
    row.leetcode_slug === problem.slug
    || frontendKey(row.leetcode_frontend_id) === frontendKey(problem.frontendId)
  ) && (
    row.total_reviews > 0
    || (row.source === "leetcode_import" && row.external_practice_status === "accepted")
  ));
}

export function selectExtraReview(problems: readonly StudyPlanCandidate[], assigned: readonly AssignedStudyProblem[]): ExtraStudyCandidate | null {
  const problem = problems
    .filter((row) => row.lifecycle_state === "active" && row.total_reviews > 0)
    .filter((row) => !isAssignedStudyProblem(assigned, {
      id: row.id, frontendId: row.leetcode_frontend_id, slug: row.leetcode_slug,
    }))
    .slice()
    .sort((left, right) => left.next_review_at.localeCompare(right.next_review_at) || left.id.localeCompare(right.id))[0];
  return problem ? {
    kind: "review", userProblemId: problem.id, scheduleVersion: problem.schedule_version,
    frontendId: problem.leetcode_frontend_id, slug: problem.leetcode_slug,
    title: problem.title, difficulty: problem.difficulty, leetcodeUrl: problem.leetcode_url,
  } : null;
}

export function selectExtraRoadmap(problems: readonly ExtraRoadmapProblem[], tracked: readonly TrackedRoadmapIdentity[], assigned: readonly AssignedStudyProblem[]): ExtraStudyCandidate | null {
  const problem = [...problems].sort((a, b) => a.order - b.order || (a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0))
    .find((row) => !isAssignedStudyProblem(assigned, row) && !isPracticedRoadmapProblem(tracked, row));
  if (!problem) return null;
  const { frontendId, slug, title, difficulty, leetcodeUrl, order } = problem;
  return { kind: "roadmap", frontendId, slug, title, difficulty, leetcodeUrl, order };
}

export function isCurrentStudyDay(plan: { study_date: string; time_zone: string; day_starts_at: string; day_ends_at: string }, referenceTime: Date) {
  const time = referenceTime.getTime();
  // UTC snapshots are authoritative and already encode both DST boundaries.
  return Number.isFinite(time) && time >= Date.parse(plan.day_starts_at) && time < Date.parse(plan.day_ends_at);
}
