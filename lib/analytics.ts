import type { StudyRating } from "@/lib/ratings";
import {
  normalizeDifficulty,
  type CanonicalDifficulty,
} from "@/lib/difficulty-styles";

export type AnalyticsRating = StudyRating;

export type AnalyticsReviewEvent = {
  id: string;
  userProblemId: string;
  rating: string;
  reviewedAt: string;
  practiceLocalDate?: string | null;
  prePracticeProblemType?: string | null;
};

export type AnalyticsProblem = {
  id: string;
  topics: string[];
  masteryScore: number;
  difficulty?: string;
  source?: string;
  externalPracticeStatus?: string | null;
  externalActivityDate?: string | null;
};

export type PracticeOverTimeGroup = "week" | "month";
export type PracticeOverTimeBreakdown = "difficulty" | "activity";
export type PracticeActivityType = "historicalAccepted" | "new" | "review";

export type PracticeOverTimeBucket = {
  key: string;
  label: string;
  difficulty: Record<CanonicalDifficulty, number>;
  activity: Record<PracticeActivityType, number>;
  importedAccepted: number;
  interviewPrepPractice: number;
  total: number;
};

export type ActivityBucket = {
  key: string;
  label: string;
  firstPractices: number;
  reviews: number;
  total: number;
};

export type AnalyticsRange = "7d" | "30d" | "3m" | "6m" | "1y" | "all";

export type ActivityCalendarDay = {
  date: string;
  count: number;
  isToday: boolean;
  isFuture: boolean;
};

export type AnalyticsComparison = {
  current: number;
  previous: number;
  difference: number;
  currentLabel: string;
  previousLabel: string;
};

export type AnalyticsSnapshot = {
  generatedAt: string;
  timeZone: string;
  lifetimeSessions: number;
  summary: {
    uniqueProblems: number;
    sessions: number;
    reviews: number;
    activeDays: number;
  };
  activity: {
    daily: ActivityBucket[];
    weekly: ActivityBucket[];
    monthly: ActivityBucket[];
  };
  activityRanges: Record<AnalyticsRange, ActivityBucket[]>;
  practiceOverTime: {
    weekly: PracticeOverTimeBucket[];
    monthly: PracticeOverTimeBucket[];
  };
  lifetimeRecordedActivity: number;
  calendar: {
    startDate: string;
    endDate: string;
    days: ActivityCalendarDay[];
  };
  consistency: {
    activeDays: number;
    totalDays: number;
    currentStreak: number;
    longestStreak: number;
  };
  ratings: {
    bad: number;
    ok: number;
    good: number;
  };
  topics: Array<{
    topic: string;
    uniqueProblems: number;
  }>;
  comparisons: {
    week: AnalyticsComparison;
    month: AnalyticsComparison;
  };
  mastery: {
    building: number;
    developing: number;
    strong: number;
  };
};

const DAY_MS = 86_400_000;
const formatterCache = new Map<string, Intl.DateTimeFormat>();

function getDateFormatter(timeZone: string) {
  const cached = formatterCache.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  formatterCache.set(timeZone, formatter);
  return formatter;
}

export function getLocalDateKey(date: Date, timeZone: string) {
  const parts = getDateFormatter(timeZone).formatToParts(date);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  if (!year || !month || !day) throw new RangeError("Could not resolve local date");
  return `${year}-${month}-${day}`;
}

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateKey(date: Date) {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function addDays(value: string, amount: number) {
  return dateKey(new Date(dateFromKey(value).getTime() + amount * DAY_MS));
}

function addMonths(value: string, amount: number) {
  const date = dateFromKey(value);
  date.setUTCDate(1);
  date.setUTCMonth(date.getUTCMonth() + amount);
  return dateKey(date);
}

function monthDistance(start: string, end: string) {
  const startDate = dateFromKey(start);
  const endDate = dateFromKey(end);
  return (
    (endDate.getUTCFullYear() - startDate.getUTCFullYear()) * 12 +
    endDate.getUTCMonth() -
    startDate.getUTCMonth()
  );
}

function startOfWeek(value: string, weekStartsOn: 0 | 1) {
  const day = dateFromKey(value).getUTCDay();
  const offset = (day - weekStartsOn + 7) % 7;
  return addDays(value, -offset);
}

function formatShortDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(dateFromKey(value));
}

function formatMonth(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "2-digit",
    timeZone: "UTC",
  }).format(dateFromKey(value));
}

function makeBucket(key: string, label: string): ActivityBucket {
  return { key, label, firstPractices: 0, reviews: 0, total: 0 };
}

function makePracticeBucket(key: string, label: string): PracticeOverTimeBucket {
  return {
    key,
    label,
    difficulty: { easy: 0, medium: 0, hard: 0 },
    activity: { historicalAccepted: 0, new: 0, review: 0 },
    importedAccepted: 0,
    interviewPrepPractice: 0,
    total: 0,
  };
}

function isDateOnly(value: string | null | undefined): value is string {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = dateFromKey(value);
  return dateKey(date) === value;
}

function incrementPracticeBucket(
  bucket: PracticeOverTimeBucket | undefined,
  difficulty: CanonicalDifficulty | null,
  activityType: PracticeActivityType,
) {
  if (!bucket || !difficulty) return;
  bucket.difficulty[difficulty] += 1;
  bucket.activity[activityType] += 1;
  bucket.total += 1;
  if (activityType === "historicalAccepted") bucket.importedAccepted += 1;
  else bucket.interviewPrepPractice += 1;
}

function incrementBucket(bucket: ActivityBucket, isFirstPractice: boolean) {
  bucket.total += 1;
  if (isFirstPractice) bucket.firstPractices += 1;
  else bucket.reviews += 1;
}

function countRange(dayCounts: Map<string, number>, start: string, end: string) {
  let total = 0;
  for (const [day, count] of dayCounts) {
    if (day >= start && day <= end) total += count;
  }
  return total;
}

function comparePeriods(
  dayCounts: Map<string, number>,
  currentStart: string,
  currentEnd: string,
  previousStart: string,
  previousEnd: string,
  currentLabel: string,
  previousLabel: string,
): AnalyticsComparison {
  const current = countRange(dayCounts, currentStart, currentEnd);
  const previous = countRange(dayCounts, previousStart, previousEnd);
  return {
    current,
    previous,
    difference: current - previous,
    currentLabel,
    previousLabel,
  };
}

export function buildAnalyticsSnapshot({
  events,
  problems,
  timeZone,
  referenceTime = new Date(),
}: {
  events: readonly AnalyticsReviewEvent[];
  problems: readonly AnalyticsProblem[];
  timeZone: string;
  referenceTime?: Date;
}): AnalyticsSnapshot {
  if (Number.isNaN(referenceTime.getTime())) throw new RangeError("Invalid reference time");
  // Validate the persisted timezone before using it in every event conversion.
  getDateFormatter(timeZone).format(referenceTime);

  const today = getLocalDateKey(referenceTime, timeZone);
  const dailyStart = addDays(today, -29);
  const currentWeekStart = startOfWeek(today, 1);
  const weeklyStart = addDays(currentWeekStart, -77);
  const currentMonthStart = `${today.slice(0, 7)}-01`;
  const monthlyStart = addMonths(currentMonthStart, -11);

  const seenEventIds = new Set<string>();
  const sortedEvents = events
    .filter((event) => {
      if (seenEventIds.has(event.id)) return false;
      seenEventIds.add(event.id);
      return true;
    })
    .slice()
    .sort((left, right) => {
      const timeDifference = new Date(left.reviewedAt).getTime() - new Date(right.reviewedAt).getTime();
      return timeDifference || left.id.localeCompare(right.id);
    });

  const earliestEventDay = sortedEvents.reduce<string | null>((earliest, event) => {
    const instant = new Date(event.reviewedAt);
    if (Number.isNaN(instant.getTime())) return earliest;
    const localDay = getLocalDateKey(instant, timeZone);
    if (localDay > today) return earliest;
    return earliest === null || localDay < earliest ? localDay : earliest;
  }, null);
  const allStart = `${(earliestEventDay ?? today).slice(0, 7)}-01`;

  const makeDailyBuckets = (start: string, length: number) =>
    Array.from({ length }, (_, index) => {
      const key = addDays(start, index);
      return makeBucket(key, formatShortDate(key));
    });
  const makeWeeklyBuckets = (start: string, length: number) =>
    Array.from({ length }, (_, index) => {
      const key = addDays(start, index * 7);
      return makeBucket(key, formatShortDate(key));
    });
  const makeMonthlyBuckets = (start: string, length: number) =>
    Array.from({ length }, (_, index) => {
      const key = addMonths(start, index);
      return makeBucket(key.slice(0, 7), formatMonth(key));
    });

  const activityRanges: Record<AnalyticsRange, ActivityBucket[]> = {
    "7d": makeDailyBuckets(addDays(today, -6), 7),
    "30d": makeDailyBuckets(dailyStart, 30),
    "3m": makeWeeklyBuckets(addDays(currentWeekStart, -84), 13),
    "6m": makeWeeklyBuckets(addDays(currentWeekStart, -175), 26),
    "1y": makeMonthlyBuckets(monthlyStart, 12),
    all: makeMonthlyBuckets(
      allStart,
      Math.max(1, monthDistance(allStart, currentMonthStart) + 1),
    ),
  };

  const daily = activityRanges["30d"];
  const weekly = Array.from({ length: 12 }, (_, index) => {
    const key = addDays(weeklyStart, index * 7);
    return makeBucket(key, formatShortDate(key));
  });
  const monthly = activityRanges["1y"];
  const practiceWeekly = Array.from({ length: 12 }, (_, index) => {
    const key = addDays(weeklyStart, index * 7);
    return makePracticeBucket(key, formatShortDate(key));
  });
  const practiceMonthly = Array.from({ length: 12 }, (_, index) => {
    const key = addMonths(monthlyStart, index);
    return makePracticeBucket(key.slice(0, 7), formatMonth(key));
  });
  const weeklyByKey = new Map(weekly.map((bucket) => [bucket.key, bucket]));
  const practiceWeeklyByKey = new Map(
    practiceWeekly.map((bucket) => [bucket.key, bucket]),
  );
  const practiceMonthlyByKey = new Map(
    practiceMonthly.map((bucket) => [bucket.key, bucket]),
  );
  const rangeMaps = Object.fromEntries(
    Object.entries(activityRanges).map(([range, buckets]) => [
      range,
      new Map(buckets.map((bucket) => [bucket.key, bucket])),
    ]),
  ) as Record<AnalyticsRange, Map<string, ActivityBucket>>;
  const firstSeenProblems = new Set<string>();
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));
  const practicedProblemIds = new Set<string>();
  const recentProblemIds = new Set<string>();
  const activeDays = new Set<string>();
  const recentProblemTopics = new Map<string, Set<string>>();
  const dayCounts = new Map<string, number>();
  const recentRatings = { bad: 0, ok: 0, good: 0 };
  let recentSessions = 0;
  let recentReviews = 0;

  for (const event of sortedEvents) {
    const instant = new Date(event.reviewedAt);
    if (Number.isNaN(instant.getTime())) continue;
    const localDay = isDateOnly(event.practiceLocalDate)
      ? event.practiceLocalDate
      : getLocalDateKey(instant, timeZone);
    const isFirstPractice = !firstSeenProblems.has(event.userProblemId);
    firstSeenProblems.add(event.userProblemId);
    const problem = problemById.get(event.userProblemId);
    const activityType: PracticeActivityType =
      event.prePracticeProblemType === "new" ||
      event.prePracticeProblemType === "review"
        ? event.prePracticeProblemType
        : problem?.source === "leetcode_import" &&
            problem.externalPracticeStatus === "accepted"
          ? "review"
          : isFirstPractice
            ? "new"
            : "review";
    const difficulty = normalizeDifficulty(problem?.difficulty ?? "");
    incrementPracticeBucket(
      practiceWeeklyByKey.get(startOfWeek(localDay, 1)),
      difficulty,
      activityType,
    );
    incrementPracticeBucket(
      practiceMonthlyByKey.get(localDay.slice(0, 7)),
      difficulty,
      activityType,
    );
    practicedProblemIds.add(event.userProblemId);
    dayCounts.set(localDay, (dayCounts.get(localDay) ?? 0) + 1);

    const weeklyBucket = weeklyByKey.get(startOfWeek(localDay, 1));
    if (weeklyBucket) incrementBucket(weeklyBucket, isFirstPractice);
    for (const range of ["7d", "30d"] as const) {
      const bucket = rangeMaps[range].get(localDay);
      if (bucket) incrementBucket(bucket, isFirstPractice);
    }
    for (const range of ["3m", "6m"] as const) {
      const bucket = rangeMaps[range].get(startOfWeek(localDay, 1));
      if (bucket) incrementBucket(bucket, isFirstPractice);
    }
    for (const range of ["1y", "all"] as const) {
      const bucket = rangeMaps[range].get(localDay.slice(0, 7));
      if (bucket) incrementBucket(bucket, isFirstPractice);
    }

    if (localDay < dailyStart || localDay > today) continue;
    recentSessions += 1;
    if (!isFirstPractice) recentReviews += 1;
    recentProblemIds.add(event.userProblemId);
    activeDays.add(localDay);
    if (event.rating === "bad") recentRatings.bad += 1;
    else if (event.rating === "ok") recentRatings.ok += 1;
    else if (event.rating === "good") recentRatings.good += 1;
  }

  let importedAcceptedTotal = 0;
  for (const problem of problems) {
    if (
      problem.source !== "leetcode_import" ||
      problem.externalPracticeStatus !== "accepted" ||
      !isDateOnly(problem.externalActivityDate) ||
      problem.externalActivityDate > today
    ) {
      continue;
    }
    const difficulty = normalizeDifficulty(problem.difficulty ?? "");
    if (!difficulty) continue;
    importedAcceptedTotal += 1;
    incrementPracticeBucket(
      practiceWeeklyByKey.get(startOfWeek(problem.externalActivityDate, 1)),
      difficulty,
      "historicalAccepted",
    );
    incrementPracticeBucket(
      practiceMonthlyByKey.get(problem.externalActivityDate.slice(0, 7)),
      difficulty,
      "historicalAccepted",
    );
  }
  for (const problemId of recentProblemIds) {
    const problem = problemById.get(problemId);
    if (!problem) continue;
    for (const rawTopic of problem.topics) {
      const topic = rawTopic.trim();
      if (!topic) continue;
      const problemIds = recentProblemTopics.get(topic) ?? new Set<string>();
      problemIds.add(problemId);
      recentProblemTopics.set(topic, problemIds);
    }
  }
  const topics = [...recentProblemTopics]
    .map(([topic, problemIds]) => ({ topic, uniqueProblems: problemIds.size }))
    .sort((left, right) => right.uniqueProblems - left.uniqueProblems || left.topic.localeCompare(right.topic))
    .slice(0, 8);

  const mastery = { building: 0, developing: 0, strong: 0 };
  for (const problemId of practicedProblemIds) {
    const score = problemById.get(problemId)?.masteryScore;
    if (score === undefined) continue;
    if (score >= 8) mastery.strong += 1;
    else if (score >= 4) mastery.developing += 1;
    else mastery.building += 1;
  }

  const calendarWeekStart = startOfWeek(today, 0);
  const calendarStart = addDays(calendarWeekStart, -25 * 7);
  const calendarDays = Array.from({ length: 26 * 7 }, (_, index) => {
    const date = addDays(calendarStart, index);
    return {
      date,
      count: date > today ? 0 : (dayCounts.get(date) ?? 0),
      isToday: date === today,
      isFuture: date > today,
    };
  });
  const visibleCalendarDays = calendarDays.filter((day) => !day.isFuture);
  const consistencyActiveDays = visibleCalendarDays.filter((day) => day.count > 0).length;
  let currentStreak = 0;
  let streakCursor = dayCounts.get(today) ? today : addDays(today, -1);
  while (streakCursor >= calendarStart && (dayCounts.get(streakCursor) ?? 0) > 0) {
    currentStreak += 1;
    streakCursor = addDays(streakCursor, -1);
  }
  let longestStreak = 0;
  let runningStreak = 0;
  for (const day of visibleCalendarDays) {
    runningStreak = day.count > 0 ? runningStreak + 1 : 0;
    longestStreak = Math.max(longestStreak, runningStreak);
  }

  const currentWeekDay = (dateFromKey(today).getUTCDay() + 6) % 7;
  const previousWeekStart = addDays(currentWeekStart, -7);
  const previousWeekEnd = addDays(previousWeekStart, currentWeekDay);
  const currentDayOfMonth = Number(today.slice(8, 10));
  const previousMonthStart = addMonths(currentMonthStart, -1);
  const previousMonthNext = addMonths(previousMonthStart, 1);
  const previousMonthLastDay = Number(addDays(previousMonthNext, -1).slice(8, 10));
  const previousMonthEnd = `${previousMonthStart.slice(0, 8)}${String(Math.min(currentDayOfMonth, previousMonthLastDay)).padStart(2, "0")}`;

  return {
    generatedAt: referenceTime.toISOString(),
    timeZone,
    lifetimeSessions: sortedEvents.length,
    lifetimeRecordedActivity: sortedEvents.length + importedAcceptedTotal,
    summary: {
      uniqueProblems: recentProblemIds.size,
      sessions: recentSessions,
      reviews: recentReviews,
      activeDays: activeDays.size,
    },
    activity: { daily, weekly, monthly },
    activityRanges,
    practiceOverTime: {
      weekly: practiceWeekly,
      monthly: practiceMonthly,
    },
    calendar: {
      startDate: calendarStart,
      endDate: today,
      days: calendarDays,
    },
    consistency: {
      activeDays: consistencyActiveDays,
      totalDays: visibleCalendarDays.length,
      currentStreak,
      longestStreak,
    },
    ratings: recentRatings,
    topics,
    comparisons: {
      week: comparePeriods(
        dayCounts,
        currentWeekStart,
        today,
        previousWeekStart,
        previousWeekEnd,
        "This week through today",
        "Same days last week",
      ),
      month: comparePeriods(
        dayCounts,
        currentMonthStart,
        today,
        previousMonthStart,
        previousMonthEnd,
        "This month through today",
        "Same days last month",
      ),
    },
    mastery,
  };
}
