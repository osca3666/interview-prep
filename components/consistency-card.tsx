import { Flame } from "lucide-react";
import type { ConsistencySnapshot } from "@/lib/consistency";

const weekdays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

function getDayLabel(day: ConsistencySnapshot["calendarDays"][number]) {
  const dateLabel = new Intl.DateTimeFormat("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(`${day.date}T12:00:00.000Z`));
  if (day.isFuture) return `${dateLabel}, future date`;
  if (day.count === 0) return `${dateLabel}, no practice`;
  return `${dateLabel}, ${day.count} ${day.count === 1 ? "practice event" : "practice events"}`;
}

export function ConsistencyCard({ snapshot }: { snapshot: ConsistencySnapshot }) {
  return (
    <section
      data-dashboard-card="consistency"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-orange-50 text-orange-600 dark:bg-orange-950/50 dark:text-orange-300">
          <Flame className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">Consistency</h2>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 divide-x divide-zinc-200 border-y border-zinc-200 py-2.5 dark:divide-zinc-800 dark:border-zinc-800">
        <div className="min-w-0 pr-3">
          <dt className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Daily streak</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950 dark:text-white">
            {snapshot.currentDailyStreak} {snapshot.currentDailyStreak === 1 ? "day" : "days"}
          </dd>
        </div>
        <div className="min-w-0 pl-3">
          <dt className="text-[10px] font-medium text-zinc-500 dark:text-zinc-400">Weekly streak</dt>
          <dd className="mt-0.5 text-base font-semibold tabular-nums text-zinc-950 dark:text-white">
            {snapshot.currentWeeklyStreak} {snapshot.currentWeeklyStreak === 1 ? "week" : "weeks"}
          </dd>
        </div>
      </dl>

      <div className="mt-3 flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">{snapshot.monthLabel}</h3>
      </div>
      <div
        data-consistency-calendar
        className="consistency-calendar-grid mt-2.5"
        role="grid"
        aria-label={`${snapshot.monthLabel} practice calendar`}
      >
        {weekdays.map((weekday) => (
          <div key={weekday} role="columnheader" className="pb-0.5 text-center text-[10px] font-medium text-zinc-400 dark:text-zinc-500">
            {weekday.slice(0, 1)}
          </div>
        ))}
        {snapshot.calendarDays.map((day) => {
          const label = getDayLabel(day);
          return (
            <span
              key={day.date}
              role="gridcell"
              aria-label={label}
              title={label}
              className={[
                "flex aspect-square w-full max-w-7 items-center justify-center justify-self-center rounded-full text-[10px] font-medium tabular-nums",
                !day.isCurrentMonth
                  ? "text-zinc-300 dark:text-zinc-700"
                  : day.isFuture
                    ? "text-zinc-300 dark:text-zinc-600"
                    : day.count > 0
                      ? "bg-violet-600 text-white dark:bg-violet-500"
                      : "text-zinc-600 dark:text-zinc-400",
                day.isToday ? "ring-2 ring-violet-500 ring-offset-2 ring-offset-white dark:ring-violet-300 dark:ring-offset-zinc-900" : "",
              ].filter(Boolean).join(" ")}
            >
              {day.dayOfMonth}
            </span>
          );
        })}
      </div>
    </section>
  );
}
