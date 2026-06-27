import { redirect } from "next/navigation";
import { submitReviewAction } from "@/app/review/actions";
import { MasteryBoxes } from "@/components/mastery-boxes";
import { listDueProblems, type ReviewRating } from "@/data/reviews";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

const ratings: Array<{ value: ReviewRating; label: string }> = [
  { value: "again", label: "Again" },
  { value: "hard", label: "Hard" },
  { value: "good", label: "Good" },
  { value: "easy", label: "Easy" },
];

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getReviewMessage(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "reviewed":
      return "Review saved.";
    default:
      return null;
  }
}

function getReviewError(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "invalid_rating":
    case "invalid_submission":
      return "Choose a valid review rating.";
    case "problem_not_due":
      return "This problem is no longer available for review.";
    case "stale_review":
      return "This problem was already reviewed or changed. Your queue has been refreshed.";
    case "save_failed":
      return "We could not save that review. Please try again.";
    default:
      return null;
  }
}

function formatDueText(value: string) {
  const dueDate = new Date(value);
  const now = Date.now();
  const diffMs = now - dueDate.getTime();
  const formatted = new Intl.DateTimeFormat("en", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(dueDate);

  if (diffMs < 60_000) {
    return `Due now (${formatted})`;
  }

  const days = Math.floor(diffMs / 86_400_000);

  if (days >= 1) {
    return `Overdue by ${days} ${days === 1 ? "day" : "days"} (${formatted})`;
  }

  const hours = Math.floor(diffMs / 3_600_000);

  if (hours >= 1) {
    return `Overdue by ${hours} ${hours === 1 ? "hour" : "hours"} (${formatted})`;
  }

  const minutes = Math.max(1, Math.floor(diffMs / 60_000));
  return `Overdue by ${minutes} ${minutes === 1 ? "minute" : "minutes"} (${formatted})`;
}

export default async function ReviewPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const [{ error, message }, dueProblemsResult] = await Promise.all([
    searchParams,
    listDueProblems(supabase, userId),
  ]);

  if (dueProblemsResult.error) {
    throw new Error("Failed to load due reviews.");
  }

  const pageMessage = getReviewMessage(message);
  const pageError = pageMessage ? null : getReviewError(error);
  const dueProblems = dueProblemsResult.data ?? [];

  return (
    <div className="bg-zinc-50">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Review
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Due review queue
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600">
            Review active problems that are due now. The database calculates
            the next review date after you rate each item.
          </p>
        </div>

        {pageMessage ? (
          <div className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
            {pageMessage}
          </div>
        ) : null}

        {pageError ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {pageError}
          </div>
        ) : null}

        <div className="mt-8 rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-950">
              Problems due now
            </h2>
          </div>

          {dueProblems.length === 0 ? (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-zinc-950">
                Nothing due right now
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                You are caught up. Add more problems or come back when the next
                review date arrives.
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
                        {formatDueText(problem.next_review_at)}
                      </p>
                      <div className="mt-3">
                        <MasteryBoxes masteryScore={problem.mastery_score} />
                      </div>
                      {problem.notes ? (
                        <p className="mt-3 max-w-3xl whitespace-pre-wrap text-sm leading-6 text-zinc-700">
                          {problem.notes}
                        </p>
                      ) : null}
                      <a
                        href={problem.leetcode_url}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-3 inline-flex text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline"
                      >
                        Open on LeetCode
                      </a>
                    </div>

                    <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap lg:justify-end">
                      {ratings.map((rating) => (
                        <form key={rating.value} action={submitReviewAction}>
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
      </section>
    </div>
  );
}
