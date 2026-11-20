import {
  buildAnalyticsSnapshot,
  getLocalDateKey,
  type AnalyticsProblem,
  type AnalyticsReviewEvent,
} from "@/lib/analytics";

const DAY_MS = 86_400_000;
const topics = [
  ["Array", "Hash Table"],
  ["Two Pointers", "String"],
  ["Sliding Window", "Array"],
  ["Tree", "Depth-First Search"],
  ["Graph", "Breadth-First Search"],
  ["Dynamic Programming", "Array"],
  ["Stack", "Monotonic Stack"],
  ["Binary Search", "Array"],
];

export function isAnalyticsDemoEnabled(
  value: string | string[] | undefined,
  nodeEnv: string | undefined,
) {
  const requested = Array.isArray(value) ? value[0] === "1" : value === "1";
  return nodeEnv === "development" && requested;
}

export function createAnalyticsDemoSnapshot({
  referenceTime = new Date(),
  timeZone = "America/Denver",
}: {
  referenceTime?: Date;
  timeZone?: string;
} = {}) {
  const problems: AnalyticsProblem[] = Array.from({ length: 36 }, (_, index) => ({
    id: `demo-problem-${String(index + 1).padStart(2, "0")}`,
    topics: topics[index % topics.length],
    masteryScore: 2 + ((index * 3) % 9),
    difficulty: ["easy", "medium", "hard"][index % 3],
    source: index < 12 ? "leetcode_import" : "manual",
    externalPracticeStatus: index < 12 ? "accepted" : null,
    externalActivityDate:
      index < 12
        ? getLocalDateKey(
            new Date(referenceTime.getTime() - (index * 30 + 12) * DAY_MS),
            timeZone,
          )
        : null,
  }));
  const events: AnalyticsReviewEvent[] = [];
  const practicedProblemIds = new Set<string>();
  let eventIndex = 0;

  // Build chronologically so the same pure aggregator determines first practices.
  for (let daysAgo = 89; daysAgo >= 0; daysAgo -= 1) {
    const chronologicalDay = 89 - daysAgo;
    const weekday = new Date(referenceTime.getTime() - daysAgo * DAY_MS).getUTCDay();
    const isStudyDay = weekday !== 0 && (weekday !== 6 || chronologicalDay % 3 === 0);
    if (!isStudyDay || chronologicalDay % 11 === 0) continue;

    const phaseVolume = daysAgo > 60 ? 1 : daysAgo > 30 ? 2 : 2 + (chronologicalDay % 3);
    for (let session = 0; session < phaseVolume; session += 1) {
      const problemIndex = (chronologicalDay * 5 + session * 7) % problems.length;
      const ratingCycle = (chronologicalDay + session * 2) % 10;
      const rating = ratingCycle < 2 ? "bad" : ratingCycle < 7 ? "ok" : "good";
      const practicedAt = new Date(
        referenceTime.getTime() - daysAgo * DAY_MS + session * 15 * 60_000,
      );
      const problem = problems[problemIndex];
      const isImportedAccepted =
        problem.source === "leetcode_import" &&
        problem.externalPracticeStatus === "accepted";
      events.push({
        id: `demo-event-${String(eventIndex).padStart(4, "0")}`,
        userProblemId: problem.id,
        rating,
        reviewedAt: practicedAt.toISOString(),
        practiceLocalDate: getLocalDateKey(practicedAt, timeZone),
        prePracticeProblemType:
          isImportedAccepted || practicedProblemIds.has(problem.id)
            ? "review"
            : "new",
      });
      practicedProblemIds.add(problem.id);
      eventIndex += 1;
    }
  }

  return buildAnalyticsSnapshot({ events, problems, timeZone, referenceTime });
}
