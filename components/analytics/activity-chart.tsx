"use client";

import { useState } from "react";
import type {
  PracticeOverTimeBreakdown,
  PracticeOverTimeBucket,
} from "@/lib/analytics";
import { useResponsiveChartSize } from "@/components/analytics/use-responsive-chart-size";

const DEFAULT_WIDTH = 760;
const DESKTOP_HEIGHT = 260;
const MOBILE_HEIGHT = 220;
const PLOT_LEFT = 38;
const PLOT_TOP = 12;

export type ActivityChartSeries = {
  key: string;
  label: string;
  fillClassName: string;
  markerClassName: string;
};

function roundedStackTopPath(
  x: number,
  y: number,
  width: number,
  height: number,
) {
  const radius = Math.min(4, width / 2, height / 2);
  return [
    `M ${x} ${y + height}`,
    `V ${y + radius}`,
    `Q ${x} ${y} ${x + radius} ${y}`,
    `H ${x + width - radius}`,
    `Q ${x + width} ${y} ${x + width} ${y + radius}`,
    `V ${y + height}`,
    "Z",
  ].join(" ");
}

function getValue(
  bucket: PracticeOverTimeBucket,
  breakdown: PracticeOverTimeBreakdown,
  key: string,
) {
  const values = breakdown === "difficulty" ? bucket.difficulty : bucket.activity;
  return values[key as keyof typeof values] ?? 0;
}

function sourceNote(bucket: PracticeOverTimeBucket) {
  if (bucket.importedAccepted === 0) return null;
  return bucket.interviewPrepPractice > 0
    ? "Includes historical Accepted imports and InterviewPrep practice"
    : "Historical Accepted imports";
}

export function ActivityChart({
  buckets,
  breakdown,
  series,
}: {
  buckets: PracticeOverTimeBucket[];
  breakdown: PracticeOverTimeBreakdown;
  series: ActivityChartSeries[];
}) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const { containerRef: chartContainerRef, size: chartSize } =
    useResponsiveChartSize({
      defaultWidth: DEFAULT_WIDTH,
      desktopHeight: DESKTOP_HEIGHT,
      mobileHeight: MOBILE_HEIGHT,
    });
  const dataMaximum = Math.max(0, ...buckets.map((bucket) => bucket.total));
  const tickStep = Math.max(1, Math.ceil((dataMaximum * 1.15) / 4));
  const maximum = tickStep * 4;
  const plotRight = chartSize.width - 12;
  const plotBottom = chartSize.height - 48;
  const plotHeight = plotBottom - PLOT_TOP;
  const slotWidth = (plotRight - PLOT_LEFT) / Math.max(1, buckets.length);
  const barWidth = Math.max(10, Math.min(28, slotWidth * 0.38));
  const labelStep = chartSize.width < 520 ? 3 : buckets.length >= 18 ? 2 : 1;
  const activeBucket = activeIndex === null ? null : buckets[activeIndex];
  const activeLeft =
    activeIndex === null
      ? 50
      : Math.min(88, Math.max(12, ((activeIndex + 0.5) / buckets.length) * 100));

  return (
    <div>
      <div
        ref={chartContainerRef}
        className="relative min-w-0"
        onMouseLeave={() => setActiveIndex(null)}
      >
        <svg
          viewBox={`0 0 ${chartSize.width} ${chartSize.height}`}
          className="w-full text-zinc-500 dark:text-zinc-500"
          style={{ height: chartSize.height }}
          role="img"
          aria-label="Practice Over Time stacked bar chart"
        >
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = plotBottom - ratio * plotHeight;
            return (
              <g key={ratio}>
                <line
                  x1={PLOT_LEFT}
                  x2={plotRight}
                  y1={y}
                  y2={y}
                  className="stroke-zinc-200/80 dark:stroke-zinc-800"
                  strokeDasharray={ratio === 0 ? undefined : "3 5"}
                />
                <text
                  x={PLOT_LEFT - 8}
                  y={y + 4}
                  textAnchor="end"
                  className="fill-zinc-400 text-[10px] dark:fill-zinc-600"
                >
                  {Math.round(maximum * ratio)}
                </text>
              </g>
            );
          })}
          {buckets.map((bucket, index) => {
            const x = PLOT_LEFT + index * slotWidth + (slotWidth - barWidth) / 2;
            const showLabel = index % labelStep === 0 || index === buckets.length - 1;
            const nonzeroSeries = series.filter(
              (item) => getValue(bucket, breakdown, item.key) > 0,
            );
            const topSeriesKey = nonzeroSeries.at(-1)?.key;
            let accumulatedHeight = 0;
            const description = series
              .map((item) => `${item.label}: ${getValue(bucket, breakdown, item.key)}`)
              .join(", ");

            return (
              <g
                key={bucket.key}
                tabIndex={0}
                aria-label={`${bucket.label}. ${description}. Total: ${bucket.total}`}
                onMouseEnter={() => setActiveIndex(index)}
                onFocus={() => setActiveIndex(index)}
                onBlur={() => setActiveIndex(null)}
                className="outline-none"
              >
                <title>{`${bucket.label}\n${description}\nTotal: ${bucket.total}`}</title>
                {series.map((item) => {
                  const value = getValue(bucket, breakdown, item.key);
                  if (value === 0) return null;
                  const height = (value / maximum) * plotHeight;
                  const y = plotBottom - accumulatedHeight - height;
                  accumulatedHeight += height;
                  return item.key === topSeriesKey ? (
                    <path
                      key={item.key}
                      data-chart-bar={item.key}
                      d={roundedStackTopPath(x, y, barWidth, height)}
                      className={item.fillClassName}
                    />
                  ) : (
                    <rect
                      key={item.key}
                      data-chart-bar={item.key}
                      x={x}
                      y={y}
                      width={barWidth}
                      height={height}
                      className={item.fillClassName}
                    />
                  );
                })}
                {bucket.total > 0 ? (
                  <text
                    data-chart-total-label="true"
                    x={x + barWidth / 2}
                    y={Math.max(PLOT_TOP + 9, plotBottom - accumulatedHeight - 7)}
                    textAnchor="middle"
                    className="fill-zinc-600 text-[10px] font-semibold tabular-nums dark:fill-zinc-300"
                  >
                    {bucket.total}
                  </text>
                ) : null}
                {showLabel ? (
                  <text
                    x={x + barWidth / 2}
                    y={chartSize.height - 20}
                    textAnchor="middle"
                    className="fill-zinc-500 text-[10px] dark:fill-zinc-500"
                  >
                    {bucket.label}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {activeBucket ? (
          <div
            role="tooltip"
            className="pointer-events-none absolute top-2 z-10 w-56 -translate-x-1/2 rounded-md border border-zinc-200 bg-white p-3 text-xs shadow-lg dark:border-zinc-700 dark:bg-zinc-900"
            style={{ left: `${activeLeft}%` }}
          >
            <p className="font-semibold text-zinc-950 dark:text-zinc-100">
              {activeBucket.label}
            </p>
            <div className="mt-2 space-y-1.5">
              {series.map((item) => (
                <div key={item.key} className="flex items-center justify-between gap-3">
                  <span className="inline-flex items-center gap-2 text-zinc-600 dark:text-zinc-300">
                    <span className={`h-2 w-2 rounded-sm ${item.markerClassName}`} aria-hidden="true" />
                    {item.label}
                  </span>
                  <span className="font-medium tabular-nums text-zinc-950 dark:text-zinc-100">
                    {getValue(activeBucket, breakdown, item.key)}
                  </span>
                </div>
              ))}
              <div className="flex items-center justify-between border-t border-zinc-200 pt-1.5 font-semibold text-zinc-950 dark:border-zinc-700 dark:text-zinc-100">
                <span>Total</span>
                <span className="tabular-nums">{activeBucket.total}</span>
              </div>
            </div>
            {breakdown === "difficulty" && sourceNote(activeBucket) ? (
              <p className="mt-2 border-t border-zinc-200 pt-2 leading-4 text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                {sourceNote(activeBucket)}
              </p>
            ) : null}
          </div>
        ) : null}
      </div>

      <div className="mt-1 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
        {series.map((item) => (
          <span key={item.key} className="inline-flex items-center gap-2">
            <span
              className={`h-2.5 w-2.5 rounded-sm ${item.markerClassName}`}
              aria-hidden="true"
            />
            {item.label}
          </span>
        ))}
      </div>
    </div>
  );
}
