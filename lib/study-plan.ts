import type { ProblemSetItem } from "@/data/problem-sets/neetcode-150";
import type { Tables } from "@/types/database";

export type StudyPlanCandidate = Pick<
  Tables<"user_problems">,
  | "id"
  | "leetcode_frontend_id"
  | "leetcode_slug"
  | "title"
  | "difficulty"
  | "leetcode_url"
  | "lifecycle_state"
  | "mastery_score"
  | "next_review_at"
  | "schedule_version"
  | "total_reviews"
  | "source"
  | "external_practice_status"
  | "external_activity_date"
>;

export type StudyPlanRoadmapProblem = Pick<
  ProblemSetItem,
  "order" | "slug" | "title" | "difficulty" | "leetcode_url"
>;

type TaskDisplay = {
  slug: string;
  title: string;
  difficulty: string;
  leetcodeUrl: string;
};

type TrackedTaskDetails = TaskDisplay & {
  userProblemId: string;
  frontendId: string | null;
  masteryScore: number;
  nextReviewAt: string;
  scheduleVersion: number;
};

export type ReviewStudyTask = TrackedTaskDetails & { kind: "review" };
export type CalibrationStudyTask = TrackedTaskDetails & { kind: "calibration" };
export type TrackedNewProblemTask = TrackedTaskDetails & {
  kind: "new_problem";
  origin: "tracked";
};
export type RoadmapNewProblemTask = TaskDisplay & {
  kind: "new_problem";
  origin: "roadmap";
  roadmapId: "neetcode-150";
  order: number;
};

export type StudyPlanTask =
  | ReviewStudyTask
  | CalibrationStudyTask
  | TrackedNewProblemTask
  | RoadmapNewProblemTask;

export type DailyStudyRecommendations = {
  target: 4;
  referenceTime: string;
  tasks: StudyPlanTask[];
  counts: { reviews: number; newProblems: number; calibrations: number };
};

type SelectDailyStudyPlanInput = {
  dueProblems: readonly StudyPlanCandidate[];
  trackedSlugs: readonly string[];
  roadmapProblems: readonly StudyPlanRoadmapProblem[];
  referenceTime: Date;
};

type TimedCandidate = { problem: StudyPlanCandidate; dueTime: number };

const dayInMilliseconds = 86_400_000;
const reviewLimit = 3;

function compareIds(left: string, right: string) {
  return left < right ? -1 : left > right ? 1 : 0;
}

function compareOldest(left: TimedCandidate, right: TimedCandidate) {
  return (
    left.dueTime - right.dueTime ||
    compareIds(left.problem.id, right.problem.id)
  );
}

function compareCalibration(left: TimedCandidate, right: TimedCandidate) {
  const leftDate = left.problem.external_activity_date ?? "9999-12-31";
  const rightDate = right.problem.external_activity_date ?? "9999-12-31";
  return (
    leftDate.localeCompare(rightDate) ||
    compareOldest(left, right)
  );
}

function toTrackedTaskDetails(problem: StudyPlanCandidate): TrackedTaskDetails {
  return {
    userProblemId: problem.id,
    frontendId: problem.leetcode_frontend_id,
    slug: problem.leetcode_slug,
    title: problem.title,
    difficulty: problem.difficulty,
    leetcodeUrl: problem.leetcode_url,
    masteryScore: problem.mastery_score,
    nextReviewAt: problem.next_review_at,
    scheduleVersion: problem.schedule_version,
  };
}

/** The same fairness-first review order is used by daily plans and optional work. */
export function rankDueReviews(problems: readonly StudyPlanCandidate[], referenceTime: Date): StudyPlanCandidate[] {
  const referenceMilliseconds = referenceTime.getTime();
  if (!Number.isFinite(referenceMilliseconds)) throw new RangeError("Invalid study plan reference time.");
  const unique = new Map<string, TimedCandidate>();
  for (const problem of problems) {
    const dueTime = Date.parse(problem.next_review_at);
    if (problem.lifecycle_state === "active" && problem.total_reviews > 0 && Number.isFinite(dueTime)
      && dueTime <= referenceMilliseconds && !unique.has(problem.id)) unique.set(problem.id, { problem, dueTime });
  }
  const reviews = Array.from(unique.values()).sort(compareOldest);
  const oldest = reviews[0];
  if (!oldest) return [];
  const getPriority = ({ problem, dueTime }: TimedCandidate) =>
    (referenceMilliseconds - dueTime) / dayInMilliseconds + (10 - problem.mastery_score);
  return [oldest, ...reviews.slice(1).sort((left, right) =>
    getPriority(right) - getPriority(left) || left.dueTime - right.dueTime ||
    left.problem.mastery_score - right.problem.mastery_score || compareIds(left.problem.id, right.problem.id),
  )].map(({ problem }) => problem);
}

export function selectDailyStudyPlan({
  dueProblems,
  trackedSlugs,
  roadmapProblems,
  referenceTime,
}: SelectDailyStudyPlanInput): DailyStudyRecommendations {
  const referenceMilliseconds = referenceTime.getTime();

  if (!Number.isFinite(referenceMilliseconds)) {
    throw new RangeError("Invalid study plan reference time.");
  }

  const eligibleById = new Map<string, TimedCandidate>();
  const tracked = new Set(trackedSlugs);

  for (const problem of dueProblems) {
    tracked.add(problem.leetcode_slug);
    const dueTime = Date.parse(problem.next_review_at);

    if (
      problem.lifecycle_state === "active" &&
      Number.isFinite(dueTime) &&
      dueTime <= referenceMilliseconds &&
      !eligibleById.has(problem.id)
    ) {
      eligibleById.set(problem.id, { problem, dueTime });
    }
  }

  const eligible = Array.from(eligibleById.values());
  const selectedReviews = rankDueReviews(eligible.map(({ problem }) => problem), referenceTime).slice(0, reviewLimit);
  const tasks: StudyPlanTask[] = selectedReviews.map((problem) => ({
    kind: "review",
    ...toTrackedTaskDetails(problem),
  }));
  const calibration = eligible
    .filter(({ problem }) =>
      problem.total_reviews === 0 &&
      problem.source === "leetcode_import" &&
      problem.external_practice_status === "accepted",
    )
    .sort(compareCalibration)[0];
  const unpracticed = eligible
    .filter(({ problem }) =>
      problem.total_reviews === 0 &&
      !(
        problem.source === "leetcode_import" &&
        problem.external_practice_status === "accepted"
      ),
    )
    .sort(compareOldest)[0];

  if (calibration) {
    tasks.push({
      kind: "calibration",
      ...toTrackedTaskDetails(calibration.problem),
    });
  } else if (unpracticed) {
    tasks.push({
      kind: "new_problem",
      origin: "tracked",
      ...toTrackedTaskDetails(unpracticed.problem),
    });
  } else {
    const nextRoadmapProblem = roadmapProblems
      .filter((problem) => !tracked.has(problem.slug))
      .sort((left, right) =>
        left.order - right.order || compareIds(left.slug, right.slug),
      )[0];

    if (nextRoadmapProblem) {
      tasks.push({
        kind: "new_problem",
        origin: "roadmap",
        roadmapId: "neetcode-150",
        order: nextRoadmapProblem.order,
        slug: nextRoadmapProblem.slug,
        title: nextRoadmapProblem.title,
        difficulty: nextRoadmapProblem.difficulty,
        leetcodeUrl: nextRoadmapProblem.leetcode_url,
      });
    }
  }

  return {
    target: 4,
    referenceTime: new Date(referenceMilliseconds).toISOString(),
    tasks,
    counts: {
      reviews: selectedReviews.length,
      newProblems: tasks.filter((task) => task.kind === "new_problem").length,
      calibrations: tasks.filter((task) => task.kind === "calibration").length,
    },
  };
}
