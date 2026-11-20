import { getDateOnlyInTimeZone, isValidTimeZone } from "@/lib/time-zone";

export type ConsistencyEvent = {
  id: string;
  reviewedAt: string;
};

export type ConsistencyCalendarDay = {
  date: string;
  dayOfMonth: number;
  count: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isFuture: boolean;
};

export type ConsistencySnapshot = {
  timeZone: string;
  today: string;
  monthLabel: string;
  currentDailyStreak: number;
  currentWeeklyStreak: number;
  activeDaysThisMonth: number;
  calendarDays: ConsistencyCalendarDay[];
};

const DAY_MS = 86_400_000;

function dateFromKey(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day, 12));
}

function dateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
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

function startOfWeek(value: string) {
  const day = dateFromKey(value).getUTCDay();
  return addDays(value, -((day + 6) % 7));
}

function countConsecutiveDays(activeDays: ReadonlySet<string>, today: string) {
  let cursor = activeDays.has(today) ? today : addDays(today, -1);
  let count = 0;

  while (activeDays.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -1);
  }

  return count;
}

function countConsecutiveWeeks(activeWeeks: ReadonlySet<string>, today: string) {
  const currentWeek = startOfWeek(today);
  let cursor = activeWeeks.has(currentWeek)
    ? currentWeek
    : addDays(currentWeek, -7);
  let count = 0;

  while (activeWeeks.has(cursor)) {
    count += 1;
    cursor = addDays(cursor, -7);
  }

  return count;
}

export function buildConsistencySnapshot({
  events,
  timeZone,
  referenceTime = new Date(),
}: {
  events: readonly ConsistencyEvent[];
  timeZone: string;
  referenceTime?: Date;
}): ConsistencySnapshot {
  if (!isValidTimeZone(timeZone)) throw new RangeError("Invalid time zone");
  if (Number.isNaN(referenceTime.getTime())) throw new RangeError("Invalid reference time");

  const today = getDateOnlyInTimeZone(referenceTime, timeZone);
  if (!today) throw new RangeError("Could not resolve local date");

  const seenEventIds = new Set<string>();
  const dayCounts = new Map<string, number>();

  for (const event of events) {
    if (seenEventIds.has(event.id)) continue;
    seenEventIds.add(event.id);
    const reviewedAt = new Date(event.reviewedAt);
    if (Number.isNaN(reviewedAt.getTime()) || reviewedAt > referenceTime) continue;
    const localDate = getDateOnlyInTimeZone(reviewedAt, timeZone);
    if (!localDate || localDate > today) continue;
    dayCounts.set(localDate, (dayCounts.get(localDate) ?? 0) + 1);
  }

  const activeDays = new Set(dayCounts.keys());
  const activeWeeks = new Set(Array.from(activeDays, startOfWeek));
  const monthStart = `${today.slice(0, 7)}-01`;
  const nextMonthStart = addMonths(monthStart, 1);
  const monthEnd = addDays(nextMonthStart, -1);
  const calendarStart = startOfWeek(monthStart);
  const calendarEnd = addDays(startOfWeek(monthEnd), 6);
  const calendarDays: ConsistencyCalendarDay[] = [];

  for (let cursor = calendarStart; cursor <= calendarEnd; cursor = addDays(cursor, 1)) {
    const isCurrentMonth = cursor >= monthStart && cursor <= monthEnd;
    calendarDays.push({
      date: cursor,
      dayOfMonth: dateFromKey(cursor).getUTCDate(),
      count: isCurrentMonth ? dayCounts.get(cursor) ?? 0 : 0,
      isCurrentMonth,
      isToday: cursor === today,
      isFuture: cursor > today,
    });
  }

  return {
    timeZone,
    today,
    monthLabel: new Intl.DateTimeFormat("en-US", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(dateFromKey(monthStart)),
    currentDailyStreak: countConsecutiveDays(activeDays, today),
    currentWeeklyStreak: countConsecutiveWeeks(activeWeeks, today),
    activeDaysThisMonth: Array.from(activeDays).filter(
      (date) => date >= monthStart && date <= monthEnd,
    ).length,
    calendarDays,
  };
}
