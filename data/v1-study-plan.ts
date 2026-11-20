import "server-only";

import type { PostgrestError, SupabaseClient } from "@supabase/supabase-js";
import { neetcode150Problems } from "@/data/problem-sets/neetcode-150";
import type { EffectiveStudyPlanSettings } from "@/data/study-settings";
import { getLeetCodeProblemBySlug } from "@/lib/leetcode-catalog";
import {
  buildEligibleReviewPools,
  reconcileGeneratedAssignments,
  selectV1SchedulingPlan,
  type NewProblemHistory,
  type ReviewAllocationEntry,
  type SchedulingProblem,
} from "@/lib/scheduling-engine";
import { getDateOnlyInTimeZone } from "@/lib/time-zone";
import type { Database, Json } from "@/types/database";

type Client = SupabaseClient<Database>;
type ProposalResult = { data: Json[] | null; error: PostgrestError | null };

export type V1StudyPlanSettingsDraft = {
  dailyNewTarget: number;
  dailyReviewTarget: number;
  followedRoadmapId: string | null;
  newSelectionMode: "sequential" | "shuffled";
  reviewSource: "all" | "selected_roadmaps";
  reviewRoadmapIds: string[];
  timeZone: string;
};

const PAGE_SIZE = 500;

async function listSchedulingProblems(client: Client, userId: string) {
  const rows: Database["public"]["Tables"]["user_problems"]["Row"][] = [];
  let offset = 0;
  while (true) {
    const { data, error } = await client.from("user_problems")
      .select("*").eq("user_id", userId)
      .order("id").range(offset, offset + PAGE_SIZE - 1);
    if (error) return { data: null, error };
    const page = data ?? [];
    rows.push(...page);
    if (page.length < PAGE_SIZE) return { data: rows, error: null };
    offset += PAGE_SIZE;
  }
}

export async function getV1StudyPlanProposal(
  client: Client,
  userId: string,
  settings: EffectiveStudyPlanSettings,
  referenceTime: Date,
): Promise<ProposalResult> {
  const studyDate = getDateOnlyInTimeZone(referenceTime, settings.time_zone);
  if (!studyDate) return { data: null, error: null };

  const [problemResult, membershipResult, allocationResult, activityResult] = await Promise.all([
    listSchedulingProblems(client, userId),
    client.from("study_roadmap_problems").select("roadmap_id,leetcode_slug"),
    client.from("review_allocation_entries")
      .select("allocation_key,candidate_problem_id_snapshot,pool,source,imported_weight,established_weight,active")
      .eq("user_id", userId)
      .eq("context_id", settings.review_allocation_context_id)
      .order("created_at").order("id"),
    client.from("review_events")
      .select("pre_practice_problem_type")
      .eq("user_id", userId)
      .eq("practice_local_date", studyDate),
  ]);
  const error = problemResult.error ?? membershipResult.error ?? allocationResult.error ?? activityResult.error;
  if (error || !problemResult.data) return { data: null, error };

  const roadmapIdsBySlug = new Map<string, string[]>();
  for (const membership of membershipResult.data ?? []) {
    const ids = roadmapIdsBySlug.get(membership.leetcode_slug) ?? [];
    ids.push(membership.roadmap_id);
    roadmapIdsBySlug.set(membership.leetcode_slug, ids);
  }

  const bySlug = new Map(problemResult.data.map((problem) => [problem.leetcode_slug, problem]));
  const schedulingProblems: SchedulingProblem[] = problemResult.data
    .filter((problem) => problem.lifecycle_state === "active")
    .map((problem) => ({
    id: problem.id,
    canonicalId: problem.leetcode_slug,
    masteryScore: problem.mastery_score,
    consecutiveGoodCount: problem.consecutive_good_count,
    genuineRatingCount: problem.total_reviews,
    importedAccepted: problem.source === "leetcode_import" && problem.external_practice_status === "accepted",
    acceptedDate: problem.external_activity_date,
    lastPracticedAt: problem.last_reviewed_at,
    nextReviewAt: problem.next_review_at,
    roadmapIds: roadmapIdsBySlug.get(problem.leetcode_slug) ?? [],
  }));
  const history: NewProblemHistory[] = problemResult.data.map((problem) => ({
    canonicalId: problem.leetcode_slug,
    genuinelyPracticed: problem.total_reviews > 0 || problem.lifecycle_state !== "active",
    importedAccepted: problem.source === "leetcode_import" && problem.external_practice_status === "accepted",
  }));
  const allocationEntries: ReviewAllocationEntry[] = (allocationResult.data ?? []).map((entry) => ({
    allocationId: entry.allocation_key,
    candidateId: entry.candidate_problem_id_snapshot,
    pool: entry.pool === "imported" ? "imported" : "established",
    source: entry.source === "manual" ? "manual" : "generated",
    weights: { imported: entry.imported_weight, established: entry.established_weight },
    active: entry.active,
  }));
  const practicedReviewCount = (activityResult.data ?? [])
    .filter((event) => event.pre_practice_problem_type === "review").length;
  const practicedNewCount = (activityResult.data ?? [])
    .filter((event) => event.pre_practice_problem_type === "new").length;
  const reviewTarget = Math.max(0, settings.daily_review_target - practicedReviewCount);
  const newTarget = Math.max(0, settings.daily_new_target - practicedNewCount);
  const allocationIds = Array.from(
    { length: reviewTarget },
    (_, index) => `v1:${studyDate}:review:${index}`,
  );
  const roadmap = {
    id: "neetcode-150",
    problems: neetcode150Problems.map((problem) => ({
      roadmapId: "neetcode-150",
      canonicalId: problem.slug,
      order: problem.order,
      title: problem.title,
    })),
  };
  const plan = selectV1SchedulingPlan({
    problems: schedulingProblems,
    eligibility: {
      referenceTime,
      studyDate,
      sourceFilter: settings.review_source === "all"
        ? { mode: "all" }
        : { mode: "roadmaps", roadmapIds: settings.review_roadmap_ids },
    },
    reviewTarget,
    allocationState: { entries: allocationEntries },
    allocationIds,
    roadmaps: [roadmap],
    followedRoadmapId: settings.followed_roadmap_id,
    suggestedRoadmapId: "neetcode-150",
    newProblemHistory: history,
    newProblemTarget: newTarget,
    newProblemMode: settings.new_selection_mode === "shuffled" ? "shuffled" : "sequential",
    shuffleSeed: `${userId}:${studyDate}:${settings.version}`,
  });

  const newAllocationByKey = new Map(
    plan.allocationState.entries
      .filter((entry) => !allocationEntries.some((existing) => existing.allocationId === entry.allocationId))
      .map((entry) => [entry.allocationId, entry]),
  );
  const tasks: Json[] = plan.reviews.map((review) => {
    const problem = problemResult.data!.find((candidate) => candidate.id === review.problem.id)!;
    const allocation = newAllocationByKey.get(review.allocationId)!;
    return {
      kind: review.pool === "imported" ? "calibration" : "review",
      origin: "tracked",
      user_problem_id: problem.id,
      schedule_version: problem.schedule_version,
      review_pool: review.pool,
      allocation_key: review.allocationId,
      imported_weight: allocation.weights.imported,
      established_weight: allocation.weights.established,
    };
  });
  for (const selected of plan.newProblems) {
    const canonical = getLeetCodeProblemBySlug(selected.canonicalId);
    if (!canonical) return { data: null, error: null };
    const tracked = bySlug.get(selected.canonicalId);
    tasks.push({
      kind: "new_problem",
      origin: tracked ? "tracked" : "roadmap",
      user_problem_id: tracked?.id,
      frontend_id: canonical.frontendId,
      slug: canonical.slug,
      title: canonical.title,
      difficulty: canonical.difficulty,
      leetcode_url: canonical.leetcodeUrl,
      roadmap_order: selected.order,
    });
  }
  return { data: tasks, error: null };
}

function taskCategory(kind: string) {
  return kind === "new_problem" ? "new" : "review";
}

/**
 * Prepares only replacement assignments. The protected RPC independently
 * repeats eligibility, ordering, allocation, and canonical-identity checks
 * after taking the per-user transaction lock.
 */
export async function getV1StudyPlanReconciliationProposal(
  client: Client,
  userId: string,
  draft: V1StudyPlanSettingsDraft,
  referenceTime: Date,
): Promise<ProposalResult> {
  const { data: preferences, error: preferenceError } = await client
    .from("user_study_preferences").select("time_zone")
    .eq("user_id", userId).maybeSingle();
  if (preferenceError) return { data: null, error: preferenceError };
  const timeZone = preferences?.time_zone ?? draft.timeZone;
  const studyDate = getDateOnlyInTimeZone(referenceTime, timeZone);
  if (!studyDate) return { data: null, error: null };

  const { data: plan, error: planError } = await client.from("daily_study_plans")
    .select("*").eq("user_id", userId).eq("study_date", studyDate).maybeSingle();
  if (planError) return { data: null, error: planError };
  if (!plan) return { data: [], error: null };

  const reviewRoadmapIds = [...new Set(draft.reviewRoadmapIds.map((id) => id.trim()).filter(Boolean))]
    .sort();
  const fingerprint = `${draft.reviewSource}:${reviewRoadmapIds.join(",")}`;
  const [problemResult, membershipResult, taskResult, activityResult, contextResult, revisionResult] =
    await Promise.all([
      listSchedulingProblems(client, userId),
      client.from("study_roadmap_problems").select("roadmap_id,leetcode_slug,position"),
      client.from("daily_study_plan_tasks").select("*")
        .eq("user_id", userId).eq("plan_id", plan.id).order("position"),
      client.from("review_events").select("pre_practice_problem_type")
        .eq("user_id", userId)
        .gte("reviewed_at", plan.day_starts_at).lt("reviewed_at", plan.day_ends_at),
      client.from("review_allocation_contexts").select("id")
        .eq("user_id", userId).eq("filter_fingerprint", fingerprint).maybeSingle(),
      client.from("study_plan_setting_revisions").select("*")
        .eq("user_id", userId).order("version", { ascending: false }),
    ]);
  const baseError = problemResult.error ?? membershipResult.error ?? taskResult.error
    ?? activityResult.error ?? contextResult.error ?? revisionResult.error;
  if (baseError || !problemResult.data) return { data: null, error: baseError };

  const contextId = contextResult.data?.id ?? null;
  const revisions = revisionResult.data ?? [];
  const identicalRevision = contextId ? revisions.find((revision) =>
    revision.effective_study_date === studyDate
    && revision.daily_new_target === draft.dailyNewTarget
    && revision.daily_review_target === draft.dailyReviewTarget
    && revision.followed_roadmap_id === draft.followedRoadmapId
    && revision.new_selection_mode === draft.newSelectionMode
    && revision.review_allocation_context_id === contextId) : null;
  const expectedVersion = identicalRevision?.version ?? ((revisions[0]?.version ?? 0) + 1);

  const allocationResult = contextId
    ? await client.from("review_allocation_entries")
      .select("allocation_key,candidate_problem_id_snapshot,pool,source,imported_weight,established_weight,active,daily_study_plan_task_id_snapshot")
      .eq("user_id", userId).eq("context_id", contextId).order("created_at").order("id")
    : { data: [], error: null };
  if (allocationResult.error) return { data: null, error: allocationResult.error };

  const roadmapIdsBySlug = new Map<string, string[]>();
  for (const membership of membershipResult.data ?? []) {
    const ids = roadmapIdsBySlug.get(membership.leetcode_slug) ?? [];
    ids.push(membership.roadmap_id);
    roadmapIdsBySlug.set(membership.leetcode_slug, ids);
  }
  const problemById = new Map(problemResult.data.map((problem) => [problem.id, problem]));
  const problemBySlug = new Map(problemResult.data.map((problem) => [problem.leetcode_slug, problem]));
  const schedulingProblems: SchedulingProblem[] = problemResult.data
    .filter((problem) => problem.lifecycle_state === "active")
    .map((problem) => ({
      id: problem.id,
      canonicalId: problem.leetcode_slug,
      masteryScore: problem.mastery_score,
      consecutiveGoodCount: problem.consecutive_good_count,
      genuineRatingCount: problem.total_reviews,
      importedAccepted: problem.source === "leetcode_import"
        && problem.external_practice_status === "accepted",
      acceptedDate: problem.external_activity_date,
      lastPracticedAt: problem.last_reviewed_at,
      nextReviewAt: problem.next_review_at,
      roadmapIds: roadmapIdsBySlug.get(problem.leetcode_slug) ?? [],
    }));
  const sourceFilter = draft.reviewSource === "all"
    ? { mode: "all" as const }
    : { mode: "roadmaps" as const, roadmapIds: reviewRoadmapIds };
  const pools = buildEligibleReviewPools(schedulingProblems, {
    referenceTime, studyDate, sourceFilter,
  });
  const eligibleReviewById = new Map(
    [...pools.imported, ...pools.established].map((candidate) => [candidate.problem.id, candidate]),
  );
  const sourceRoadmap = draft.followedRoadmapId ?? "neetcode-150";
  const sourceRoadmapSlugs = new Set(
    (membershipResult.data ?? [])
      .filter((membership) => membership.roadmap_id === sourceRoadmap)
      .map((membership) => membership.leetcode_slug),
  );
  const activeTasks = (taskResult.data ?? []).filter((task) => task.status !== "unassigned");
  const practicedReviews = (activityResult.data ?? [])
    .filter((event) => event.pre_practice_problem_type === "review").length;
  const practicedNew = (activityResult.data ?? [])
    .filter((event) => event.pre_practice_problem_type === "new").length;
  const fixedReview = activeTasks.filter((task) => taskCategory(task.kind) === "review"
    && (task.status === "deferred"
      || (task.status === "pending" && task.assignment_source !== "generated"))).length;
  const fixedNew = activeTasks.filter((task) => taskCategory(task.kind) === "new"
    && (task.status === "deferred"
      || (task.status === "pending" && task.assignment_source !== "generated"))).length;
  const reviewGeneratedTarget = Math.max(0, draft.dailyReviewTarget - practicedReviews - fixedReview);
  const newGeneratedTarget = Math.max(0, draft.dailyNewTarget - practicedNew - fixedNew);

  const generatedReviewTasks = activeTasks.filter((task) => task.status === "pending"
    && task.assignment_source === "generated" && taskCategory(task.kind) === "review");
  const generatedNewTasks = activeTasks.filter((task) => task.status === "pending"
    && task.assignment_source === "generated" && taskCategory(task.kind) === "new");
  const reviewReconciliation = reconcileGeneratedAssignments(
    generatedReviewTasks.map((task) => {
      const problem = task.user_problem_id ? problemById.get(task.user_problem_id) : undefined;
      const eligible = problem ? eligibleReviewById.get(problem.id) : undefined;
      return {
        taskId: task.id,
        position: task.position,
        eligible: Boolean(problem && eligible
          && eligible.pool === task.review_pool_snapshot
          && problem.schedule_version === task.schedule_version_snapshot),
      };
    }),
    reviewGeneratedTarget,
  );
  const newReconciliation = reconcileGeneratedAssignments(
    generatedNewTasks.map((task) => {
      const problem = problemBySlug.get(task.leetcode_slug);
      return {
        taskId: task.id,
        position: task.position,
        eligible: sourceRoadmapSlugs.has(task.leetcode_slug)
          && (!problem || (problem.lifecycle_state === "active" && problem.total_reviews === 0
            && !(problem.source === "leetcode_import"
              && problem.external_practice_status === "accepted"))),
      };
    }),
    newGeneratedTarget,
  );
  const unassignedTaskIds = new Set([
    ...reviewReconciliation.unassignedTaskIds,
    ...newReconciliation.unassignedTaskIds,
  ]);
  const retainedTasks = activeTasks.filter((task) => !unassignedTaskIds.has(task.id));
  const retainedProblemIds = new Set(
    retainedTasks.flatMap((task) => task.user_problem_id ? [task.user_problem_id] : []),
  );
  const retainedSlugs = new Set(retainedTasks.map((task) => task.leetcode_slug));
  const reviewAdditions = Math.max(0, reviewGeneratedTarget - reviewReconciliation.keptTaskIds.length);
  const newAdditions = Math.max(0, newGeneratedTarget - newReconciliation.keptTaskIds.length);

  const allocationEntries: ReviewAllocationEntry[] = (allocationResult.data ?? []).map((entry) => ({
    allocationId: entry.allocation_key,
    candidateId: entry.candidate_problem_id_snapshot,
    pool: entry.pool === "imported" ? "imported" : "established",
    source: entry.source === "manual" ? "manual" : "generated",
    weights: { imported: entry.imported_weight, established: entry.established_weight },
    active: entry.active && !(entry.daily_study_plan_task_id_snapshot
      && unassignedTaskIds.has(entry.daily_study_plan_task_id_snapshot)),
  }));
  const allocationIds = Array.from({ length: reviewAdditions }, (_, index) =>
    `v1:${studyDate}:revision:${expectedVersion}:review:${index}`);
  const history: NewProblemHistory[] = problemResult.data.map((problem) => ({
    canonicalId: problem.leetcode_slug,
    genuinelyPracticed: problem.total_reviews > 0 || problem.lifecycle_state !== "active"
      || retainedSlugs.has(problem.leetcode_slug),
    importedAccepted: problem.source === "leetcode_import"
      && problem.external_practice_status === "accepted",
  }));
  for (const slug of retainedSlugs) {
    if (!problemBySlug.has(slug)) {
      history.push({ canonicalId: slug, genuinelyPracticed: true, importedAccepted: false });
    }
  }
  const seed = plan.new_selection_mode_snapshot === draft.newSelectionMode
    ? plan.shuffle_seed ?? `${userId}:${studyDate}:${expectedVersion}`
    : `${userId}:${studyDate}:${expectedVersion}`;
  const roadmap = {
    id: "neetcode-150",
    problems: neetcode150Problems.map((problem) => ({
      roadmapId: "neetcode-150", canonicalId: problem.slug,
      order: problem.order, title: problem.title,
    })),
  };
  const proposal = selectV1SchedulingPlan({
    problems: schedulingProblems.filter((problem) => !retainedProblemIds.has(problem.id)),
    eligibility: { referenceTime, studyDate, sourceFilter },
    reviewTarget: reviewAdditions,
    allocationState: { entries: allocationEntries },
    allocationIds,
    roadmaps: [roadmap],
    followedRoadmapId: draft.followedRoadmapId,
    suggestedRoadmapId: "neetcode-150",
    newProblemHistory: history,
    newProblemTarget: newAdditions,
    newProblemMode: draft.newSelectionMode,
    shuffleSeed: seed,
  });

  const newAllocationByKey = new Map(
    proposal.allocationState.entries
      .filter((entry) => !allocationEntries.some((existing) => existing.allocationId === entry.allocationId))
      .map((entry) => [entry.allocationId, entry]),
  );
  const tasks: Json[] = proposal.reviews.map((review) => {
    const problem = problemById.get(review.problem.id)!;
    const allocation = newAllocationByKey.get(review.allocationId)!;
    return {
      kind: review.pool === "imported" ? "calibration" : "review",
      origin: "tracked",
      user_problem_id: problem.id,
      schedule_version: problem.schedule_version,
      review_pool: review.pool,
      allocation_key: review.allocationId,
      imported_weight: allocation.weights.imported,
      established_weight: allocation.weights.established,
    };
  });
  for (const selected of proposal.newProblems) {
    const canonical = getLeetCodeProblemBySlug(selected.canonicalId);
    if (!canonical) return { data: null, error: null };
    const tracked = problemBySlug.get(selected.canonicalId);
    tasks.push({
      kind: "new_problem",
      origin: tracked ? "tracked" : "roadmap",
      user_problem_id: tracked?.id,
      frontend_id: canonical.frontendId,
      slug: canonical.slug,
      title: canonical.title,
      difficulty: canonical.difficulty,
      leetcode_url: canonical.leetcodeUrl,
      roadmap_order: selected.order,
    });
  }
  return { data: tasks, error: null };
}
