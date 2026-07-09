import Link from "next/link";
import { DifficultyBadge } from "@/components/problem-table-primitives";
import { type RoadmapProgress } from "@/data/roadmap-progress";

type RoadmapProgressCardProps = {
  progress: RoadmapProgress;
};

const stats: Array<{
  key: keyof Pick<
    RoadmapProgress,
    | "totalInRoadmap"
    | "trackedCount"
    | "unseenCount"
    | "reviewedCount"
    | "strongCount"
  >;
  label: string;
}> = [
  { key: "totalInRoadmap", label: "Total" },
  { key: "trackedCount", label: "Tracked" },
  { key: "unseenCount", label: "Unseen" },
  { key: "reviewedCount", label: "Reviewed" },
  { key: "strongCount", label: "Strong" },
];

export function RoadmapProgressCard({ progress }: RoadmapProgressCardProps) {
  const progressPercent =
    progress.totalInRoadmap === 0
      ? 0
      : Math.round((progress.trackedCount / progress.totalInRoadmap) * 100);
  const suggestedProblems = progress.nextSuggestedProblems.slice(0, 3);

  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-2 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {progress.isPreview ? "Roadmap preview" : "Roadmap"}
          </p>
          <h2 className="mt-1 text-base font-semibold text-zinc-950 dark:text-zinc-100">
            {progress.label}
          </h2>
        </div>
        <div className="flex flex-col gap-2 sm:items-end">
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {progress.trackedCount}/{progress.totalInRoadmap} tracked
          </p>
          <Link
            href="/roadmaps/neetcode-150"
            className="text-sm font-semibold text-sky-700 underline-offset-4 transition hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 dark:text-sky-300 dark:hover:text-sky-200 dark:focus-visible:ring-sky-800"
          >
            View roadmap
          </Link>
        </div>
      </div>

      <div className="px-5 py-4">
        <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]">
          <div>
            <div className="flex items-end justify-between gap-4">
              <div>
                <p className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
                  {progressPercent}%
                </p>
                <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                  {progress.isPreview
                    ? "Coverage of the current preview set."
                    : "Coverage of NeetCode 150."}
                </p>
              </div>
              {progress.isPreview ? (
                <span className="rounded-md border border-dashed border-zinc-300 px-2 py-1 text-xs font-semibold text-zinc-500 dark:border-zinc-700 dark:text-zinc-400">
                  Preview set
                </span>
              ) : null}
            </div>

            <div className="mt-4 h-2 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
              <div
                className="h-full rounded-full bg-emerald-500 dark:bg-emerald-400"
                style={{ width: `${progressPercent}%` }}
              />
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-5">
              {stats.map((stat) => (
                <div
                  key={stat.key}
                  className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
                >
                  <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                    {progress[stat.key]}
                  </p>
                  <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                    {stat.label}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
              Next suggested unseen
            </h3>
            {suggestedProblems.length > 0 ? (
              <ol className="mt-3 space-y-2">
                {suggestedProblems.map((problem) => (
                  <li
                    key={problem.slug}
                    className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                          {problem.title}
                        </p>
                        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                          {problem.pattern}
                        </p>
                      </div>
                      <DifficultyBadge
                        difficulty={problem.difficulty}
                        className="shrink-0"
                      />
                    </div>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                {progress.isPreview
                  ? "Everything in this preview set is already tracked."
                  : "Everything in NeetCode 150 is already tracked."}
              </p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
