import type { ActivityCalendarDay } from "@/lib/analytics";

function intensityClass(count: number, maximum: number, isFuture: boolean) {
  if (isFuture) return "bg-transparent";
  if (count === 0) return "bg-zinc-100 dark:bg-zinc-800/80";
  const ratio = count / maximum;
  if (ratio <= 0.25) return "bg-emerald-100 dark:bg-emerald-950";
  if (ratio <= 0.5) return "bg-emerald-300 dark:bg-emerald-800";
  if (ratio <= 0.75) return "bg-emerald-500 dark:bg-emerald-600";
  return "bg-emerald-700 dark:bg-emerald-300";
}

function formatMonthLabel(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${value}T12:00:00Z`));
}

export function ActivityCalendar({
  days,
  startDate,
  endDate,
}: {
  days: ActivityCalendarDay[];
  startDate: string;
  endDate: string;
}) {
  const maximum = Math.max(1, ...days.map((day) => day.count));
  const weeks = Array.from(
    { length: Math.ceil(days.length / 7) },
    (_, weekIndex) => days.slice(weekIndex * 7, weekIndex * 7 + 7),
  );
  const monthStarts = weeks.reduce<Array<{ label: string; weekIndex: number }>>(
    (labels, week, weekIndex) => {
      const month = week[0]?.date.slice(0, 7);
      const previousMonth = weeks[weekIndex - 1]?.[0]?.date.slice(0, 7);
      if (month && (weekIndex === 0 || month !== previousMonth)) {
        labels.push({ label: formatMonthLabel(week[0].date), weekIndex });
      }
      return labels;
    },
    [],
  );
  const visibleMonthStarts = monthStarts.length > 6
    ? monthStarts.slice(-6)
    : monthStarts;

  return (
    <div>
      <div data-calendar-scroll className="scrollbar-app overflow-x-auto pb-2">
        <div data-calendar-grid className="grid min-w-[19.5rem] grid-cols-[1.5rem_repeat(26,0.625rem)] grid-rows-[1rem_repeat(7,0.625rem)] gap-x-px gap-y-1 text-[9px] sm:min-w-[22.75rem] sm:grid-cols-[1.75rem_repeat(26,0.6875rem)] sm:grid-rows-[1rem_repeat(7,0.6875rem)] sm:gap-x-0.5">
          {visibleMonthStarts.map((month, index) => {
            const nextStart = visibleMonthStarts[index + 1]?.weekIndex ?? weeks.length;
            return (
              <span
                key={`${month.label}-${month.weekIndex}`}
                className="self-end whitespace-nowrap font-medium text-zinc-500 dark:text-zinc-400"
                style={{
                  gridColumn: `${month.weekIndex + 2} / span ${nextStart - month.weekIndex}`,
                  gridRow: 1,
                  justifySelf: index === visibleMonthStarts.length - 1 ? "end" : "start",
                }}
                aria-hidden="true"
              >
                {month.label}
              </span>
            );
          })}

          {[
            { label: "Mon", row: 3 },
            { label: "Wed", row: 5 },
            { label: "Fri", row: 7 },
          ].map(({ label, row }) => (
            <span
              key={label}
              className="self-center text-zinc-400 dark:text-zinc-500"
              style={{ gridColumn: 1, gridRow: row }}
              aria-hidden="true"
            >
              {label}
            </span>
          ))}

          {days.map((day, index) => {
            const weekIndex = Math.floor(index / 7);
            const dayIndex = index % 7;
            const description = day.isFuture
              ? `${formatDate(day.date)}: future date`
              : `${formatDate(day.date)}: ${day.count} practice ${day.count === 1 ? "session" : "sessions"}${day.isToday ? ", today" : ""}`;

            return (
              <div
                key={day.date}
                data-calendar-week={dayIndex === 0 ? weekIndex + 1 : undefined}
                data-calendar-cell={day.count > 0 ? "active" : "empty"}
                className={`h-2.5 w-2.5 rounded-[2px] sm:h-[0.6875rem] sm:w-[0.6875rem] sm:rounded-[3px] ${intensityClass(day.count, maximum, day.isFuture)} ${day.isToday ? "ring-2 ring-emerald-700 ring-offset-1 ring-offset-white dark:ring-emerald-300 dark:ring-offset-zinc-900" : ""}`}
                style={{ gridColumn: weekIndex + 2, gridRow: dayIndex + 2 }}
                title={description}
                aria-label={description}
                role="img"
              />
            );
          })}
        </div>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs text-zinc-500 dark:text-zinc-400">
        <span className="inline-flex items-center gap-1.5" aria-label={`Activity intensity from ${formatDate(startDate)} to ${formatDate(endDate)}`}>
          Less
          {[0, 0.2, 0.45, 0.7, 1].map((ratio, index) => (
            <span key={ratio} className={`h-3.5 w-3.5 rounded-[3px] ${intensityClass(index === 0 ? 0 : Math.max(1, Math.ceil(maximum * ratio)), maximum, false)}`} aria-hidden="true" />
          ))}
          More
        </span>
      </div>
    </div>
  );
}
