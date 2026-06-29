import { Check, RotateCcw, Trophy, type LucideIcon } from "lucide-react";
import { submitReviewAction } from "@/app/review/actions";
import { DueDateText } from "@/components/due-date-text";
import { type DueProblem, type ReviewRating } from "@/data/reviews";

const ratings: Array<{
  value: ReviewRating;
  label: string;
  Icon: LucideIcon;
}> = [
  { value: "again", label: "Redo", Icon: RotateCcw },
  { value: "good", label: "OK", Icon: Check },
  { value: "easy", label: "Great", Icon: Trophy },
];

type ReviewQueueSectionProps = {
  dueProblems: DueProblem[];
  returnTo: "/dashboard" | "/review";
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
            All clear — you’re caught up.
          </p>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Nothing ready to review right now.
          </p>
        </div>
      ) : (
        <ul className="space-y-2 p-3">
          {dueProblems.map((problem) => (
            <li
              key={problem.id}
              className="rounded-lg border border-zinc-200 bg-zinc-50/60 px-4 py-2.5 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-950/50 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/40"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
                <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                  <h3
                    className="min-w-0 truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100"
                    title={problem.title}
                  >
                    {problem.leetcode_url ? (
                      <a
                        href={problem.leetcode_url}
                        target="_blank"
                        rel="noreferrer"
                        className="underline-offset-4 transition hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 dark:hover:text-sky-300 dark:focus-visible:ring-sky-800"
                      >
                        {problem.title}
                      </a>
                    ) : (
                      problem.title
                    )}
                  </h3>

                  <div className="shrink-0">
                    <DueDateText
                      value={problem.next_review_at}
                      variant="badge"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 sm:w-64 sm:shrink-0">
                  {ratings.map((rating) => {
                    const Icon = rating.Icon;

                    return (
                      <form key={rating.value} action={submitReviewAction}>
                        <input type="hidden" name="return_to" value={returnTo} />
                        <input
                          type="hidden"
                          name="user_problem_id"
                          value={problem.id}
                        />
                        <input
                          type="hidden"
                          name="expected_schedule_version"
                          value={problem.schedule_version}
                        />
                        <button
                          type="submit"
                          name="rating"
                          value={rating.value}
                          className="inline-flex h-8 w-full items-center justify-center gap-1 rounded-md border border-zinc-300 bg-white px-1.5 text-xs font-semibold text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-700"
                        >
                          <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                          {rating.label}
                        </button>
                      </form>
                    );
                  })}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
