import { redirect } from "next/navigation";
import { addProblemAction } from "@/app/problems/actions";
import { LocalDate } from "@/components/local-date";
import { ProblemStartingStatusFields } from "@/components/problem-starting-status-fields";
import { listUserProblems } from "@/data/problems";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getProblemMessage(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "added":
      return "Problem added.";
    default:
      return null;
  }
}

function getProblemError(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "already_added":
      return "You already added this problem.";
    case "invalid_form":
      return "Check the problem details and try again.";
    case "invalid_date":
      return "Choose a valid date.";
    case "invalid_rating":
      return "Choose a valid starting rating.";
    case "invalid_time_zone":
      return "Could not detect a valid timezone. Please refresh and try again.";
    case "invalid_url":
      return "Enter a valid LeetCode problem URL.";
    case "save_failed":
      return "We could not save that problem. Please try again.";
    default:
      return null;
  }
}

export default async function ProblemsPage({
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

  const [{ error, message }, problemsResult] = await Promise.all([
    searchParams,
    listUserProblems(supabase, userId),
  ]);

  const pageMessage = getProblemMessage(message);
  const pageError = pageMessage ? null : getProblemError(error);
  const problems = problemsResult.data ?? [];

  if (problemsResult.error) {
    throw new Error("Failed to load problems.");
  }

  return (
    <div className="bg-zinc-50">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Problems
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Add and track LeetCode problems
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600">
            Start with manual entries. Reviews, scheduling actions, and filters
            come in later slices.
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

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
          <form
            action={addProblemAction}
            className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
          >
            <h2 className="text-base font-semibold text-zinc-950">
              Add problem
            </h2>
            <div className="mt-5 space-y-5">
              <div>
                <label
                  htmlFor="leetcode_url"
                  className="block text-sm font-medium text-zinc-700"
                >
                  LeetCode URL
                </label>
                <input
                  id="leetcode_url"
                  name="leetcode_url"
                  type="url"
                  required
                  placeholder="https://leetcode.com/problems/two-sum/"
                  className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label
                  htmlFor="title"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Title
                </label>
                <input
                  id="title"
                  name="title"
                  type="text"
                  required
                  maxLength={160}
                  className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label
                  htmlFor="difficulty"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Difficulty
                </label>
                <select
                  id="difficulty"
                  name="difficulty"
                  required
                  defaultValue="medium"
                  className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                >
                  <option value="easy">Easy</option>
                  <option value="medium">Medium</option>
                  <option value="hard">Hard</option>
                </select>
              </div>

              <div>
                <label
                  htmlFor="pattern"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Pattern
                </label>
                <input
                  id="pattern"
                  name="pattern"
                  type="text"
                  maxLength={80}
                  placeholder="Two pointers"
                  className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <div>
                <label
                  htmlFor="notes"
                  className="block text-sm font-medium text-zinc-700"
                >
                  Notes
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  maxLength={4000}
                  rows={5}
                  className="mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>

              <ProblemStartingStatusFields />

              <button
                type="submit"
                className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
              >
                Add problem
              </button>
            </div>
          </form>

          <div className="rounded-lg border border-zinc-200 bg-white shadow-sm">
            <div className="border-b border-zinc-200 px-5 py-4">
              <h2 className="text-base font-semibold text-zinc-950">
                Saved problems
              </h2>
            </div>

            {problems.length === 0 ? (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-zinc-950">
                  No problems yet
                </h3>
                <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                  Add your first LeetCode problem to start building a review
                  list. The next review date will use the database default for
                  now.
                </p>
              </div>
            ) : (
              <ul className="divide-y divide-zinc-200">
                {problems.map((problem) => (
                  <li key={problem.id} className="p-5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div>
                        <h3 className="font-semibold text-zinc-950">
                          {problem.title}
                        </h3>
                        <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                          <span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-700">
                            {problem.difficulty}
                          </span>
                          {problem.pattern ? (
                            <span className="rounded-md bg-emerald-50 px-2 py-1 text-emerald-800">
                              {problem.pattern}
                            </span>
                          ) : null}
                          <span className="rounded-md bg-zinc-100 px-2 py-1 text-zinc-700">
                            {problem.lifecycle_state}
                          </span>
                        </div>
                      </div>
                      <a
                        href={problem.leetcode_url}
                        target="_blank"
                        rel="noreferrer"
                        className="text-sm font-semibold text-zinc-950 underline-offset-4 hover:underline"
                      >
                        Open on LeetCode
                      </a>
                    </div>
                    <p className="mt-3 text-sm text-zinc-600">
                      Next review: <LocalDate value={problem.next_review_at} />
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
