import { getDateOnlyInTimeZone, isValidTimeZone } from "@/lib/time-zone";
import { isStudyRating, type StudyRating } from "@/lib/ratings";

export type RecentActivityEvent = {
  id: string;
  userProblemId: string;
  rating: string;
  reviewedAt: string;
  transitionKind: string;
};

export type RecentActivityProblem = {
  id: string;
  frontendId: string | null;
  title: string;
  difficulty: string;
  leetcodeUrl: string;
};

export type RecentActivityItem = {
  id: string;
  userProblemId: string;
  frontendId: string | null;
  title: string;
  difficulty: string | null;
  leetcodeUrl: string | null;
  rating: StudyRating;
  kind: "new" | "review";
  reviewedAt: string;
  reviewedAtLabel: string;
};

export type RecentActivitySnapshot = {
  timeZone: string;
  items: RecentActivityItem[];
};

const DAY_MS = 86_400_000;

function previousDateKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day, 12));
  date.setTime(date.getTime() - DAY_MS);
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

export function formatRecentActivityTime(
  reviewedAt: string,
  timeZone: string,
  referenceTime = new Date(),
) {
  if (!isValidTimeZone(timeZone)) throw new RangeError("Invalid time zone");
  const reviewedDate = new Date(reviewedAt);
  if (Number.isNaN(reviewedDate.getTime())) return "Practice date unavailable";

  const today = getDateOnlyInTimeZone(referenceTime, timeZone);
  const eventDate = getDateOnlyInTimeZone(reviewedDate, timeZone);
  if (!today || !eventDate) return "Practice date unavailable";

  const time = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone,
  }).format(reviewedDate);

  if (eventDate === today) return `Today, ${time}`;
  if (eventDate === previousDateKey(today)) return `Yesterday, ${time}`;

  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone,
  }).format(reviewedDate);
  return `${date} · ${time}`;
}

export function buildRecentActivitySnapshot({
  events,
  problems,
  timeZone,
  referenceTime = new Date(),
}: {
  events: readonly RecentActivityEvent[];
  problems: readonly RecentActivityProblem[];
  timeZone: string;
  referenceTime?: Date;
}): RecentActivitySnapshot {
  if (!isValidTimeZone(timeZone)) throw new RangeError("Invalid time zone");
  const problemById = new Map(problems.map((problem) => [problem.id, problem]));

  const items = events
    .filter((event) => isStudyRating(event.rating))
    .slice()
    .sort((left, right) => {
      const dateOrder = right.reviewedAt.localeCompare(left.reviewedAt);
      return dateOrder || right.id.localeCompare(left.id);
    })
    .slice(0, 10)
    .map((event): RecentActivityItem => {
      const problem = problemById.get(event.userProblemId);
      return {
        id: event.id,
        userProblemId: event.userProblemId,
        frontendId: problem?.frontendId ?? null,
        title: problem?.title ?? "Problem unavailable",
        difficulty: problem?.difficulty ?? null,
        leetcodeUrl: problem?.leetcodeUrl ?? null,
        rating: event.rating as StudyRating,
        kind: event.transitionKind === "initial_practice" ? "new" : "review",
        reviewedAt: event.reviewedAt,
        reviewedAtLabel: formatRecentActivityTime(event.reviewedAt, timeZone, referenceTime),
      };
    });

  return { timeZone, items };
}
