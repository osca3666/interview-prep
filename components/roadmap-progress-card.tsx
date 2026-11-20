import Link from "next/link";
import { ArrowRight, Map } from "lucide-react";
import { type RoadmapProgress } from "@/data/roadmap-progress";

type RoadmapProgressCardProps = {
  progress: RoadmapProgress;
};

export function RoadmapProgressCard({ progress }: RoadmapProgressCardProps) {
  const practicedCount = progress.reviewedCount;
  const progressPercent = progress.totalInRoadmap === 0
    ? 0
    : Math.round((practicedCount / progress.totalInRoadmap) * 100);
  const radius = 43;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference * (1 - progressPercent / 100);

  return (
    <section
      data-dashboard-card="roadmap"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-2">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-violet-50 text-violet-700 dark:bg-violet-950/50 dark:text-violet-300">
          <Map className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">{progress.label}</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Roadmap progress</p>
        </div>
      </div>

      <div className="mt-3 flex flex-col items-center text-center">
        <div
          data-roadmap-ring
          className="relative h-32 w-32 shrink-0"
          role="img"
          aria-label={`${practicedCount} of ${progress.totalInRoadmap} problems practiced, ${progressPercent} percent`}
        >
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90" aria-hidden="true">
            <circle cx="50" cy="50" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-zinc-100 dark:text-zinc-800" />
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="none"
              stroke="currentColor"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={circumference}
              strokeDashoffset={offset}
              className="text-violet-600 dark:text-violet-400"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-2xl font-semibold tabular-nums text-zinc-950 dark:text-white">{progressPercent}%</span>
          </div>
        </div>
        <p className="mt-2 text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
          {practicedCount} / {progress.totalInRoadmap} practiced
        </p>
      </div>

      <Link
        href="/roadmaps/neetcode-150"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 border-t border-zinc-200 pt-3 text-sm font-semibold text-violet-700 transition hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 dark:border-zinc-800 dark:text-violet-300 dark:hover:text-violet-200"
      >
        View roadmap
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
