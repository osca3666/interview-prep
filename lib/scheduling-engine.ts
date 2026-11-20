export type StudyRating = "bad" | "ok" | "good";
export type ReviewPool = "imported" | "established";
export type ReviewClassification = ReviewPool | "unpracticed";

export type RatingTransition = {
  rating: StudyRating;
  masteryScore: number;
  consecutiveGoodCount: number;
  intervalDays: number;
  nextReviewAt: string;
};

export type SchedulingProblem = {
  id: string;
  canonicalId: string;
  masteryScore: number;
  consecutiveGoodCount: number;
  genuineRatingCount: number;
  importedAccepted: boolean;
  acceptedDate: string | null;
  lastPracticedAt: string | null;
  nextReviewAt: string | null;
  roadmapIds: readonly string[];
};

export type ReviewSourceFilter =
  | { mode: "all" }
  | { mode: "roadmaps"; roadmapIds: readonly string[] };

export type ReviewEligibilityContext = {
  referenceTime: Date;
  studyDate: string;
  sourceFilter: ReviewSourceFilter;
  manualSelection?: boolean;
};

export type EligibleReviewCandidate = {
  problem: SchedulingProblem;
  pool: ReviewPool;
  timing: "due" | "early" | "imported";
};

export type AllocationWeights = Record<ReviewPool, number>;

export type ReviewAllocationEntry = {
  allocationId: string;
  candidateId: string;
  pool: ReviewPool;
  source: "generated" | "manual";
  weights: AllocationWeights;
  active: boolean;
};

export type ReviewAllocationState = {
  entries: readonly ReviewAllocationEntry[];
};

export type AllocatedReview = EligibleReviewCandidate & {
  allocationId: string;
};

export type RoadmapProblem = {
  roadmapId: string;
  canonicalId: string;
  order: number;
  title: string;
};

export type RoadmapDefinition = {
  id: string;
  problems: readonly RoadmapProblem[];
};

export type NewProblemHistory = {
  canonicalId: string;
  genuinelyPracticed: boolean;
  importedAccepted: boolean;
};

export type NewProblemSelection = {
  sourceRoadmapId: string;
  source: "followed" | "suggested_default";
  mode: "sequential" | "shuffled";
  problems: RoadmapProblem[];
  shortage: number;
  exhausted: boolean;
};

export type V1SchedulingPlan = {
  reviews: AllocatedReview[];
  newProblems: RoadmapProblem[];
  allocationState: ReviewAllocationState;
  shortages: { reviews: number; newProblems: number };
  roadmap: Omit<NewProblemSelection, "problems" | "shortage">;
};

export type ExistingGeneratedAssignment = {
  taskId: string;
  position: number;
  eligible: boolean;
};

export type GeneratedAssignmentReconciliation = {
  keptTaskIds: string[];
  unassignedTaskIds: string[];
};

const DAY_IN_MILLISECONDS = 86_400_000;
const EARLY_REVIEW_COOLDOWN = 2 * DAY_IN_MILLISECONDS;
const IMPORTED_DATE_COOLDOWN_DAYS = 3;

function assertFiniteDate(value: Date, label: string) {
  if (!Number.isFinite(value.getTime())) {
    throw new RangeError(`Invalid ${label}.`);
  }
}

function clampMastery(value: number) {
  return Math.max(0, Math.min(10, Math.trunc(value)));
}

function compareText(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function parseTimestamp(value: string | null) {
  if (!value) return null;
  const timestamp = Date.parse(value);
  return Number.isFinite(timestamp) ? timestamp : null;
}

function parseDateOnly(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return null;
  const timestamp = Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]));
  const normalized = new Date(timestamp).toISOString().slice(0, 10);
  return normalized === value ? timestamp : null;
}

function goodIntervalDays(consecutiveGoodCount: number) {
  if (consecutiveGoodCount <= 1) return 7;
  if (consecutiveGoodCount === 2) return 14;
  if (consecutiveGoodCount === 3) return 30;
  return 60;
}

export function calculateMasteryAfterRating(masteryScore: number, rating: StudyRating) {
  const masteryDelta = rating === "bad" ? -2 : rating === "ok" ? 1 : 3;
  return clampMastery(clampMastery(masteryScore) + masteryDelta);
}

export function calculateRatingInterval(
  rating: StudyRating,
  previousConsecutiveGoodCount: number,
) {
  const previousGoodCount = Math.max(0, Math.trunc(previousConsecutiveGoodCount));
  const consecutiveGoodCount = rating === "good" ? previousGoodCount + 1 : 0;
  return {
    consecutiveGoodCount,
    intervalDays: rating === "bad"
      ? 1
      : rating === "ok"
        ? 3
        : goodIntervalDays(consecutiveGoodCount),
  };
}

export function calculateRatingTransition(input: {
  masteryScore: number;
  consecutiveGoodCount: number;
  rating: StudyRating;
  completedAt: Date;
}): RatingTransition {
  assertFiniteDate(input.completedAt, "rating completion time");
  const { consecutiveGoodCount, intervalDays } = calculateRatingInterval(
    input.rating,
    input.consecutiveGoodCount,
  );

  return {
    rating: input.rating,
    masteryScore: calculateMasteryAfterRating(input.masteryScore, input.rating),
    consecutiveGoodCount,
    intervalDays,
    nextReviewAt: new Date(input.completedAt.getTime() + intervalDays * DAY_IN_MILLISECONDS).toISOString(),
  };
}

export function classifyReviewProblem(problem: SchedulingProblem): ReviewClassification {
  if (problem.genuineRatingCount > 0) return "established";
  if (problem.importedAccepted) return "imported";
  return "unpracticed";
}

export function getSchedulingMastery(problem: SchedulingProblem) {
  return classifyReviewProblem(problem) === "imported" ? 3 : clampMastery(problem.masteryScore);
}

export function applyProblemRating(input: {
  problem: SchedulingProblem;
  rating: StudyRating;
  completedAt: Date;
}) {
  const classificationBefore = classifyReviewProblem(input.problem);
  if (input.problem.genuineRatingCount < 0) {
    throw new RangeError("Genuine rating count cannot be negative.");
  }

  return {
    classificationBefore,
    classificationAfter: "established" as const,
    transition: calculateRatingTransition({
      masteryScore: getSchedulingMastery(input.problem),
      consecutiveGoodCount: input.problem.consecutiveGoodCount,
      rating: input.rating,
      completedAt: input.completedAt,
    }),
  };
}

function matchesReviewSource(problem: SchedulingProblem, filter: ReviewSourceFilter) {
  if (filter.mode === "all") return true;
  const selected = new Set(filter.roadmapIds);
  return problem.roadmapIds.some((roadmapId) => selected.has(roadmapId));
}

export function getReviewEligibility(
  problem: SchedulingProblem,
  context: ReviewEligibilityContext,
): EligibleReviewCandidate | null {
  assertFiniteDate(context.referenceTime, "review reference time");
  const studyDate = parseDateOnly(context.studyDate);
  if (studyDate === null) throw new RangeError("Invalid study date.");
  if (!matchesReviewSource(problem, context.sourceFilter)) return null;

  const classification = classifyReviewProblem(problem);
  if (classification === "unpracticed") return null;

  if (classification === "imported") {
    if (context.manualSelection || problem.acceptedDate === null) {
      return { problem, pool: "imported", timing: "imported" };
    }
    const acceptedDate = parseDateOnly(problem.acceptedDate);
    if (acceptedDate === null) return null;
    return studyDate >= acceptedDate + IMPORTED_DATE_COOLDOWN_DAYS * DAY_IN_MILLISECONDS
      ? { problem, pool: "imported", timing: "imported" }
      : null;
  }

  const referenceTime = context.referenceTime.getTime();
  const nextReviewAt = parseTimestamp(problem.nextReviewAt);
  if (nextReviewAt !== null && nextReviewAt <= referenceTime) {
    return { problem, pool: "established", timing: "due" };
  }
  if (context.manualSelection) {
    return { problem, pool: "established", timing: "early" };
  }
  const lastPracticedAt = parseTimestamp(problem.lastPracticedAt);
  return lastPracticedAt !== null && referenceTime - lastPracticedAt >= EARLY_REVIEW_COOLDOWN
    ? { problem, pool: "established", timing: "early" }
    : null;
}

function rankImported(left: EligibleReviewCandidate, right: EligibleReviewCandidate) {
  const leftDate = left.problem.acceptedDate;
  const rightDate = right.problem.acceptedDate;
  if (leftDate === null && rightDate !== null) return 1;
  if (leftDate !== null && rightDate === null) return -1;
  return (leftDate ?? "").localeCompare(rightDate ?? "")
    || compareText(left.problem.id, right.problem.id);
}

function dueTimestamp(candidate: EligibleReviewCandidate) {
  return parseTimestamp(candidate.problem.nextReviewAt) ?? Number.POSITIVE_INFINITY;
}

function rankEstablished(
  candidates: readonly EligibleReviewCandidate[],
  referenceTime: Date,
) {
  const due = candidates
    .filter((candidate) => candidate.timing === "due")
    .slice()
    .sort((left, right) => dueTimestamp(left) - dueTimestamp(right)
      || compareText(left.problem.id, right.problem.id));
  const oldest = due.shift();
  const referenceMilliseconds = referenceTime.getTime();
  due.sort((left, right) => {
    const leftPriority = (referenceMilliseconds - dueTimestamp(left)) / DAY_IN_MILLISECONDS
      + (10 - getSchedulingMastery(left.problem));
    const rightPriority = (referenceMilliseconds - dueTimestamp(right)) / DAY_IN_MILLISECONDS
      + (10 - getSchedulingMastery(right.problem));
    return rightPriority - leftPriority
      || dueTimestamp(left) - dueTimestamp(right)
      || getSchedulingMastery(left.problem) - getSchedulingMastery(right.problem)
      || compareText(left.problem.id, right.problem.id);
  });
  const early = candidates
    .filter((candidate) => candidate.timing === "early")
    .slice()
    .sort((left, right) => dueTimestamp(left) - dueTimestamp(right)
      || compareText(left.problem.id, right.problem.id));
  return oldest ? [oldest, ...due, ...early] : early;
}

export function buildEligibleReviewPools(
  problems: readonly SchedulingProblem[],
  context: ReviewEligibilityContext,
) {
  const unique = new Map<string, EligibleReviewCandidate>();
  for (const problem of problems) {
    if (unique.has(problem.canonicalId)) continue;
    const eligible = getReviewEligibility(problem, context);
    if (eligible) unique.set(problem.canonicalId, eligible);
  }
  const candidates = [...unique.values()];
  return {
    imported: candidates.filter((candidate) => candidate.pool === "imported").sort(rankImported),
    established: rankEstablished(
      candidates.filter((candidate) => candidate.pool === "established"),
      context.referenceTime,
    ),
  };
}

export function getAllocationWeights(poolSizes: Record<ReviewPool, number>): AllocationWeights {
  if (poolSizes.imported === 0) return { imported: 0, established: 1 };
  if (poolSizes.established === 0) return { imported: 1, established: 0 };
  if (poolSizes.imported === poolSizes.established) return { imported: 1, established: 1 };
  return poolSizes.imported > poolSizes.established
    ? { imported: 3, established: 2 }
    : { imported: 2, established: 3 };
}

export function getAllocationDeficits(state: ReviewAllocationState): AllocationWeights {
  const deficits: AllocationWeights = { imported: 0, established: 0 };
  for (const entry of state.entries) {
    if (!entry.active) continue;
    const totalWeight = entry.weights.imported + entry.weights.established;
    deficits.imported += entry.weights.imported - (entry.pool === "imported" ? totalWeight : 0);
    deficits.established += entry.weights.established - (entry.pool === "established" ? totalWeight : 0);
  }
  return deficits;
}

export function chooseNextReviewPool(
  state: ReviewAllocationState,
  poolSizes: Record<ReviewPool, number>,
): ReviewPool | null {
  if (poolSizes.imported <= 0 && poolSizes.established <= 0) return null;
  if (poolSizes.imported <= 0) return "established";
  if (poolSizes.established <= 0) return "imported";
  const weights = getAllocationWeights(poolSizes);
  const deficits = getAllocationDeficits(state);
  const importedScore = deficits.imported + weights.imported;
  const establishedScore = deficits.established + weights.established;
  return importedScore >= establishedScore ? "imported" : "established";
}

export function recordReviewAllocation(
  state: ReviewAllocationState,
  entry: Omit<ReviewAllocationEntry, "active">,
): ReviewAllocationState {
  if (state.entries.some((existing) => existing.allocationId === entry.allocationId)) return state;
  return { entries: [...state.entries, { ...entry, active: true }] };
}

export function reverseGeneratedAllocation(
  state: ReviewAllocationState,
  allocationId: string,
): ReviewAllocationState {
  let changed = false;
  const entries = state.entries.map((entry) => {
    if (entry.allocationId !== allocationId || entry.source !== "generated" || !entry.active) return entry;
    changed = true;
    return { ...entry, active: false };
  });
  return changed ? { entries } : state;
}

/**
 * Existing generated work keeps its persisted priority order. Reconciliation
 * removes ineligible work first, then the lowest-priority surplus. Manual and
 * resolved work never enters this helper.
 */
export function reconcileGeneratedAssignments(
  assignments: readonly ExistingGeneratedAssignment[],
  target: number,
): GeneratedAssignmentReconciliation {
  const limit = Math.max(0, Math.trunc(target));
  const ordered = assignments.slice().sort((left, right) =>
    left.position - right.position || compareText(left.taskId, right.taskId));
  const eligible = ordered.filter((assignment) => assignment.eligible);
  const keptTaskIds = eligible.slice(0, limit).map((assignment) => assignment.taskId);
  const kept = new Set(keptTaskIds);
  return {
    keptTaskIds,
    unassignedTaskIds: ordered
      .filter((assignment) => !kept.has(assignment.taskId))
      .map((assignment) => assignment.taskId),
  };
}

export function allocateReviewCandidates(input: {
  pools: { imported: readonly EligibleReviewCandidate[]; established: readonly EligibleReviewCandidate[] };
  limit: number;
  state: ReviewAllocationState;
  allocationIds: readonly string[];
  source?: "generated" | "manual";
}) {
  const remaining = {
    imported: input.pools.imported.slice(),
    established: input.pools.established.slice(),
  };
  const selected: AllocatedReview[] = [];
  let state = input.state;
  const limit = Math.max(0, Math.trunc(input.limit));

  for (let index = 0; index < limit; index += 1) {
    const allocationId = input.allocationIds[index];
    if (!allocationId) throw new RangeError("An allocation ID is required for every review slot.");
    const pool = chooseNextReviewPool(state, {
      imported: remaining.imported.length,
      established: remaining.established.length,
    });
    if (!pool) break;
    const candidate = remaining[pool].shift();
    if (!candidate) break;
    const weights = getAllocationWeights({
      imported: remaining.imported.length + (pool === "imported" ? 1 : 0),
      established: remaining.established.length + (pool === "established" ? 1 : 0),
    });
    selected.push({ ...candidate, allocationId });
    state = recordReviewAllocation(state, {
      allocationId,
      candidateId: candidate.problem.id,
      pool,
      source: input.source ?? "generated",
      weights,
    });
  }

  return { selected, state };
}

function stableHash(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function selectNewProblems(input: {
  roadmaps: readonly RoadmapDefinition[];
  followedRoadmapId: string | null;
  suggestedRoadmapId: string;
  history: readonly NewProblemHistory[];
  count: number;
  mode: "sequential" | "shuffled";
  shuffleSeed: string;
}): NewProblemSelection {
  const sourceRoadmapId = input.followedRoadmapId ?? input.suggestedRoadmapId;
  const source = input.followedRoadmapId ? "followed" : "suggested_default";
  const roadmap = input.roadmaps.find((candidate) => candidate.id === sourceRoadmapId);
  const requestedCount = Math.max(0, Math.trunc(input.count));
  if (!roadmap) {
    return {
      sourceRoadmapId,
      source,
      mode: input.mode,
      problems: [],
      shortage: requestedCount,
      exhausted: true,
    };
  }

  const practiced = new Set(
    input.history
      .filter((problem) => problem.genuinelyPracticed || problem.importedAccepted)
      .map((problem) => problem.canonicalId),
  );
  const unique = new Map<string, RoadmapProblem>();
  for (const problem of roadmap.problems) {
    if (practiced.has(problem.canonicalId)) continue;
    const existing = unique.get(problem.canonicalId);
    if (!existing || problem.order < existing.order) unique.set(problem.canonicalId, problem);
  }
  const eligible = [...unique.values()];
  eligible.sort(input.mode === "sequential"
    ? (left, right) => left.order - right.order || compareText(left.canonicalId, right.canonicalId)
    : (left, right) => stableHash(`${input.shuffleSeed}:${left.canonicalId}`)
      - stableHash(`${input.shuffleSeed}:${right.canonicalId}`)
      || left.order - right.order
      || compareText(left.canonicalId, right.canonicalId));
  const problems = eligible.slice(0, requestedCount);

  return {
    sourceRoadmapId,
    source,
    mode: input.mode,
    problems,
    shortage: requestedCount - problems.length,
    exhausted: eligible.length <= requestedCount,
  };
}

export function selectV1SchedulingPlan(input: {
  problems: readonly SchedulingProblem[];
  eligibility: ReviewEligibilityContext;
  reviewTarget: number;
  allocationState: ReviewAllocationState;
  allocationIds: readonly string[];
  roadmaps: readonly RoadmapDefinition[];
  followedRoadmapId: string | null;
  suggestedRoadmapId: string;
  newProblemHistory: readonly NewProblemHistory[];
  newProblemTarget: number;
  newProblemMode: "sequential" | "shuffled";
  shuffleSeed: string;
}): V1SchedulingPlan {
  const pools = buildEligibleReviewPools(input.problems, input.eligibility);
  const allocated = allocateReviewCandidates({
    pools,
    limit: input.reviewTarget,
    state: input.allocationState,
    allocationIds: input.allocationIds,
  });
  const newSelection = selectNewProblems({
    roadmaps: input.roadmaps,
    followedRoadmapId: input.followedRoadmapId,
    suggestedRoadmapId: input.suggestedRoadmapId,
    history: input.newProblemHistory,
    count: input.newProblemTarget,
    mode: input.newProblemMode,
    shuffleSeed: input.shuffleSeed,
  });

  return {
    reviews: allocated.selected,
    newProblems: newSelection.problems,
    allocationState: allocated.state,
    shortages: {
      reviews: Math.max(0, Math.trunc(input.reviewTarget)) - allocated.selected.length,
      newProblems: newSelection.shortage,
    },
    roadmap: {
      sourceRoadmapId: newSelection.sourceRoadmapId,
      source: newSelection.source,
      mode: newSelection.mode,
      exhausted: newSelection.exhausted,
    },
  };
}
