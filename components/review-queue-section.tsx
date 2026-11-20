import { DueDateText } from "@/components/due-date-text";
import { DifficultyBadge } from "@/components/problem-table-primitives";
import { ReviewTaskActions } from "@/components/review-task-actions";
import { type DueProblem } from "@/data/reviews";

type ReviewQueueSectionProps = {
  dueProblems: DueProblem[];
  returnTo: "/dashboard";
};

export function ReviewQueueSection({
  dueProblems,
  returnTo,
}: ReviewQueueSectionProps) {
  const readyCountLabel =
    dueProblems.length === 1 ? "1 ready" : `${dueProblems.length} ready`;

  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
          Ready to review
        </h2>
        {dueProblems.length > 0 ? (
          <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400">
            {readyCountLabel}
          </span>
        ) : null}
      </div>

      {dueProblems.length === 0 ? (
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-zinc-800 dark:text-zinc-100">
            All clear — you&apos;re caught up.
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Nothing ready to review right now.
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 p-3 md:grid-cols-2 lg:grid-cols-3">
          {dueProblems.map((problem) => (
            <li
              key={problem.id}
              className="flex h-full flex-col rounded-lg border border-zinc-200 bg-zinc-50/60 p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40"
            >
              <div className="flex items-start justify-between gap-3">
                <h3
                  className="min-w-0 flex-1 text-sm font-semibold leading-6 text-zinc-950 dark:text-zinc-100"
                  title={problem.title}
                >
                  {problem.leetcode_url ? (
                    <a
                      href={problem.leetcode_url}
                      target="_blank"
                      rel="noreferrer"
                      className="line-clamp-2 transition hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 dark:hover:text-sky-300 dark:focus-visible:ring-sky-800"
                    >
                      {problem.title}
                    </a>
                  ) : (
                    <span className="line-clamp-2">{problem.title}</span>
                  )}
                </h3>

                <div className="flex shrink-0 flex-col items-end gap-2">
                  <DueDateText value={problem.next_review_at} variant="badge" />
                  <DifficultyBadge difficulty={problem.difficulty} />
                </div>
              </div>

              <div className="mt-auto pt-5">
                <ReviewTaskActions problem={problem} returnTo={returnTo} />
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
