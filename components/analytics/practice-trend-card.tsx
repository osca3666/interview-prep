"use client";

import { useState } from "react";
import Link from "next/link";
import { TrendingUp } from "lucide-react";
import { useResponsiveChartSize } from "@/components/analytics/use-responsive-chart-size";
import type {
  AnalyticsSnapshot,
  PracticeOverTimeBucket,
  PracticeOverTimeGroup,
} from "@/lib/analytics";

const DEFAULT_WIDTH = 760;
const DESKTOP_HEIGHT = 184;
const MOBILE_HEIGHT = 166;
const PLOT_LEFT = 30;
const PLOT_TOP = 14;

function TrendChart({ buckets }: { buckets: PracticeOverTimeBucket[] }) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { containerRef, size } = useResponsiveChartSize({
    defaultWidth: DEFAULT_WIDTH,
    desktopHeight: DESKTOP_HEIGHT,
    mobileHeight: MOBILE_HEIGHT,
  });
  const dataMaximum = Math.max(0, ...buckets.map((bucket) => bucket.total));
  const maximum = Math.max(1, dataMaximum * 1.12);
  const plotRight = size.width - 12;
  const plotBottom = size.height - 34;
  const plotHeight = plotBottom - PLOT_TOP;
  const plotWidth = plotRight - PLOT_LEFT;
  const step = plotWidth / Math.max(1, buckets.length - 1);
  const points = buckets.map((bucket, index) => ({
    x: PLOT_LEFT + index * step,
    y: plotBottom - (bucket.total / maximum) * plotHeight,
  }));
  const labelStep = size.width < 520 ? 3 : 2;
  const activeBucket = activeIndex === null ? null : buckets[activeIndex];
  const activePoint = activeIndex === null ? null : points[activeIndex];
  const tooltipPosition = activePoint
    ? (() => {
        const width = Math.min(208, size.width - 16);
        const height = 112;
        const gap = 12;
        const preferredLeft =
          activePoint.x > size.width / 2
            ? activePoint.x - width - gap
            : activePoint.x + gap;

        return {
          width,
          left: Math.min(size.width - width - 8, Math.max(8, preferredLeft)),
          top: Math.min(size.height - height - 8, Math.max(8, activePoint.y - height / 2)),
        };
      })()
    : null;

  return (
    <div ref={containerRef} className="relative min-w-0" onMouseLeave={() => setActiveIndex(null)}>
      <svg
        viewBox={`0 0 ${size.width} ${size.height}`}
        className="w-full"
        style={{ height: size.height }}
        role="img"
        aria-label="Recorded activity trend"
      >
        {[0, 0.5, 1].map((ratio) => {
          const y = plotBottom - ratio * plotHeight;
          return (
            <line
              key={ratio}
              x1={PLOT_LEFT}
              x2={plotRight}
              y1={y}
              y2={y}
              className="stroke-zinc-200/80 dark:stroke-zinc-800"
              strokeDasharray={ratio === 0 ? undefined : "3 6"}
            />
          );
        })}

        {dataMaximum > 0 ? (
          <polyline
            data-practice-trend-line="true"
            points={points.map((point) => `${point.x},${point.y}`).join(" ")}
            fill="none"
            className="stroke-violet-500 dark:stroke-violet-400"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        ) : null}

        {buckets.map((bucket, index) => {
          const point = points[index];
          const showLabel = index % labelStep === 0 || index === buckets.length - 1;
          return (
            <g
              key={bucket.key}
              data-practice-trend-point="true"
              tabIndex={0}
              aria-label={`${bucket.label}. ${bucket.total} recorded activities.`}
              onMouseEnter={() => setActiveIndex(index)}
              onFocus={() => setActiveIndex(index)}
              onBlur={() => setActiveIndex(null)}
              className="outline-none"
            >
              <title>{`${bucket.label}: ${bucket.total} recorded activities`}</title>
              {dataMaximum > 0 ? (
                <>
                  <circle cx={point.x} cy={point.y} r="10" className="fill-transparent" />
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={activeIndex === index ? 4 : 2.75}
                    className="fill-white stroke-violet-500 transition-all dark:fill-zinc-900 dark:stroke-violet-400"
                    strokeWidth="2"
                  />
                </>
              ) : null}
              {showLabel ? (
                <text
                  x={point.x}
                  y={size.height - 12}
                  textAnchor="middle"
                  className="fill-zinc-500 text-[10px] dark:fill-zinc-500"
                >
                  {bucket.label}
                </text>
              ) : null}
            </g>
          );
        })}

        {dataMaximum === 0 ? (
          <text
            x={(PLOT_LEFT + plotRight) / 2}
            y={(PLOT_TOP + plotBottom) / 2}
            textAnchor="middle"
            className="fill-zinc-500 text-xs dark:fill-zinc-400"
          >
            No recorded activity yet
          </text>
        ) : null}
      </svg>

      {activeBucket && tooltipPosition ? (
        <div
          role="tooltip"
          className="pointer-events-none absolute z-10 rounded-md border border-zinc-200 bg-white p-2.5 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
          style={tooltipPosition}
        >
          <p className="font-semibold text-zinc-950 dark:text-zinc-100">{activeBucket.label}</p>
          <dl className="mt-1.5 space-y-1 text-zinc-600 dark:text-zinc-300">
            <div className="flex justify-between gap-3">
              <dt>Recorded activity</dt>
              <dd className="font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
                {activeBucket.total}
              </dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>Historical Accepted</dt>
              <dd className="tabular-nums">{activeBucket.importedAccepted}</dd>
            </div>
            <div className="flex justify-between gap-3">
              <dt>InterviewPrep practice</dt>
              <dd className="tabular-nums">{activeBucket.interviewPrepPractice}</dd>
            </div>
          </dl>
        </div>
      ) : null}
    </div>
  );
}

export function PracticeTrendCard({ snapshot }: { snapshot: AnalyticsSnapshot }) {
  const [groupBy, setGroupBy] = useState<PracticeOverTimeGroup>("month");
  const buckets =
    groupBy === "month"
      ? snapshot.practiceOverTime.monthly
      : snapshot.practiceOverTime.weekly;

  return (
    <section
      data-practice-trend
      className="min-w-0 rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-3">
          <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/60 dark:text-violet-300">
            <TrendingUp className="h-4 w-4" aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
              Practice Trend
            </h2>
            <p className="text-xs text-zinc-500 dark:text-zinc-400">
              Recorded activity over time
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-2">
          <div
            className="inline-grid grid-flow-col rounded-md bg-zinc-100 p-0.5 dark:bg-zinc-800"
            role="group"
            aria-label="Practice Trend grouping"
          >
            {(["week", "month"] as const).map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={groupBy === value}
                onClick={() => setGroupBy(value)}
                className={`rounded px-2.5 py-1.5 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 ${
                  groupBy === value
                    ? "bg-white text-zinc-950 shadow-sm dark:bg-zinc-700 dark:text-zinc-100"
                    : "text-zinc-500 hover:text-zinc-950 dark:text-zinc-400 dark:hover:text-zinc-100"
                }`}
              >
                {value === "week" ? "Week" : "Month"}
              </button>
            ))}
          </div>
          <Link
            href="/analytics"
            className="rounded-md px-2 py-1.5 text-xs font-semibold text-violet-700 transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:text-violet-300 dark:hover:bg-violet-950/50"
          >
            View analytics
          </Link>
        </div>
      </div>

      <div className="mt-2">
        <TrendChart buckets={buckets} />
      </div>
      <p className="mt-1 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
        Includes dated Accepted imports and genuine InterviewPrep practice.
      </p>
    </section>
  );
}
