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
  return (
    <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">
          Ready to review
        </h2>
      </div>

      {dueProblems.length === 0 ? (
        <div className="px-5 py-4">
          <p className="text-sm font-medium text-zinc-600">
            Nothing ready to review — you’re caught up.
          </p>
        </div>
      ) : (
        <ul className="divide-y divide-zinc-200">
          {dueProblems.map((problem) => (
            <li key={problem.id} className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="font-semibold text-zinc-950">
                      {problem.title}
                    </h3>
                    <a
                      href={problem.leetcode_url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Open ${problem.title} on LeetCode`}
                      className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-zinc-200 text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                    >
                      <svg
                        aria-hidden="true"
                        viewBox="0 0 20 20"
                        fill="none"
                        className="h-4 w-4"
                      >
                        <path
                          d="M7.5 5.5h7v7"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                        <path
                          d="M14.5 5.5 6 14"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                        />
                        <path
                          d="M12.5 14.5h-7v-7"
                          stroke="currentColor"
                          strokeWidth="1.7"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </a>
                    <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                      {problem.difficulty}
                    </span>
                    {problem.pattern ? (
                      <span className="rounded-md bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-800">
                        {problem.pattern}
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm text-zinc-600">
                    <DueDateText value={problem.next_review_at} />
                  </p>
                  {problem.notes ? (
                    <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                      {problem.notes}
                    </p>
                  ) : null}
                </div>

                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
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
                        className="inline-flex h-10 w-full items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100 sm:w-auto"
                      >
                        {rating.label}
                      </button>
                    </form>
                  ))}
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
