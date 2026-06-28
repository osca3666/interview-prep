import { submitReviewAction } from "@/app/review/actions";
import { DueDateText } from "@/components/due-date-text";
import { type DueProblem, type ReviewRating } from "@/data/reviews";

const ratings: Array<{ value: ReviewRating; label: string }> = [
  { value: "again", label: "Redo" },
  { value: "good", label: "OK" },
  { value: "easy", label: "Great" },
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
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex items-center justify-between gap-4 border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">
          Ready to review
        </h2>
        {dueProblems.length > 0 ? (
          <span className="text-sm font-medium text-zinc-500">
            {readyCountLabel}
          </span>
        ) : null}
      </div>

      {dueProblems.length === 0 ? (
        <div className="px-5 py-4">
          <p className="text-sm font-semibold text-zinc-800">
            All clear — you’re caught up.
          </p>
          <p className="mt-1 text-sm text-zinc-500">
            Nothing ready to review right now.
          </p>
        </div>
      ) : (
        <ul className="flex gap-4 overflow-x-auto p-5">
          {dueProblems.map((problem) => (
            <li
              key={problem.id}
              className="w-[19rem] flex-none rounded-lg border border-zinc-200 bg-white p-4 shadow-sm"
            >
              <div className="min-w-0">
                <h3
                  className="line-clamp-2 text-lg font-semibold leading-6 text-zinc-950"
                  title={problem.title}
                >
                  {problem.leetcode_url ? (
                    <a
                      href={problem.leetcode_url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline-offset-4 transition hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                    >
                      {problem.title}
                    </a>
                  ) : (
                    problem.title
                  )}
                </h3>
                <div className="mt-3">
                  <DueDateText value={problem.next_review_at} variant="badge" />
                </div>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                {ratings.map((rating) => (
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
                      className="inline-flex h-9 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-2 text-sm font-medium text-zinc-800 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-200"
                    >
                      {rating.label}
                    </button>
                  </form>
                ))}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
