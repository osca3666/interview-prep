"use client";

import { useState } from "react";
import Link from "next/link";
import { Activity } from "lucide-react";
import {
  ActivityChart,
  type ActivityChartSeries,
} from "@/components/analytics/activity-chart";
import { difficultyStyles } from "@/lib/difficulty-styles";
import type {
  AnalyticsSnapshot,
  PracticeOverTimeBreakdown,
  PracticeOverTimeGroup,
} from "@/lib/analytics";

const panelClass =
  "rounded-lg border border-zinc-200 bg-white p-4 sm:p-5 dark:border-zinc-800 dark:bg-zinc-900";

const difficultySeries: ActivityChartSeries[] = [
  {
    key: "easy",
    label: "Easy",
    fillClassName: difficultyStyles.easy.chart,
    markerClassName: difficultyStyles.easy.marker,
  },
  {
    key: "medium",
    label: "Medium",
    fillClassName: difficultyStyles.medium.chart,
    markerClassName: difficultyStyles.medium.marker,
  },
  {
    key: "hard",
    label: "Hard",
    fillClassName: difficultyStyles.hard.chart,
    markerClassName: difficultyStyles.hard.marker,
  },
];

const activitySeries: ActivityChartSeries[] = [
  {
    key: "historicalAccepted",
    label: "Historical Accepted",
    fillClassName: "fill-zinc-400 dark:fill-zinc-500",
    markerClassName: "bg-zinc-400 dark:bg-zinc-500",
  },
  {
    key: "new",
    label: "New",
    fillClassName: "fill-violet-500 dark:fill-violet-400",
    markerClassName: "bg-violet-500 dark:bg-violet-400",
  },
  {
    key: "review",
    label: "Review",
    fillClassName: "fill-sky-500 dark:fill-sky-400",
    markerClassName: "bg-sky-500 dark:bg-sky-400",
  },
];

function EmptyAnalytics() {
  return (
    <section className="rounded-lg border border-dashed border-zinc-300 bg-white px-5 py-10 text-center dark:border-zinc-700 dark:bg-zinc-900">
      <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-violet-50 text-violet-700 dark:bg-violet-950/70 dark:text-violet-300">
        <Activity className="h-5 w-5" aria-hidden="true" />
      </div>
      <h2 className="mt-4 text-lg font-semibold text-zinc-950 dark:text-zinc-100">
        Your practice story starts here
      </h2>
      <p className="mx-auto mt-1.5 max-w-md text-sm leading-6 text-zinc-600 dark:text-zinc-400">
        Import Accepted history or rate your first practice to start building a real activity history.
      </p>
      <Link
        href="/dashboard"
        className="mt-4 inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white"
      >
        Go to today&apos;s plan
      </Link>
    </section>
  );
}

function SegmentedControl<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: T;
  options: Array<{ value: T; label: string }>;
  onChange: (value: T) => void;
}) {
  return (
    <div className="flex items-center gap-2">
      <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
        {label}
      </span>
      <div
        className="inline-grid grid-flow-col rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800"
        role="group"
        aria-label={label}
      >
        {options.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={value === option.value}
            onClick={() => onChange(option.value)}
            className={`rounded px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
              value === option.value
                ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function AnalyticsDashboard({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const [groupBy, setGroupBy] = useState<PracticeOverTimeGroup>("month");
  const [breakdown, setBreakdown] =
    useState<PracticeOverTimeBreakdown>("difficulty");

  if (snapshot.lifetimeRecordedActivity === 0) return <EmptyAnalytics />;

  const buckets =
    groupBy === "month"
      ? snapshot.practiceOverTime.monthly
      : snapshot.practiceOverTime.weekly;
  const series = breakdown === "difficulty" ? difficultySeries : activitySeries;

  return (
    <div className="space-y-4">
      <section className={`${panelClass} min-w-0`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0">
            <h2 className="text-lg font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
              Practice Over Time
            </h2>
            <p className="mt-0.5 text-[13px] text-zinc-500 dark:text-zinc-400">
              Your recorded LeetCode journey and InterviewPrep practice
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3 lg:justify-end">
            <SegmentedControl
              label="Group by"
              value={groupBy}
              options={[
                { value: "week", label: "Week" },
                { value: "month", label: "Month" },
              ]}
              onChange={setGroupBy}
            />
            <SegmentedControl
              label="Breakdown"
              value={breakdown}
              options={[
                { value: "difficulty", label: "Difficulty" },
                { value: "activity", label: "Activity type" },
              ]}
              onChange={setBreakdown}
            />
          </div>
        </div>
        <div className="mt-3">
          <ActivityChart buckets={buckets} breakdown={breakdown} series={series} />
        </div>
      </section>
    </div>
  );
}
