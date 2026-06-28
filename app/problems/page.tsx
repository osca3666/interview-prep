import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AddProblemForm } from "@/components/add-problem-form";
import { LocalDate } from "@/components/local-date";
import { ToastMessage } from "@/components/toast-message";
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

function getDifficultyBadgeClassName(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "hard":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
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
          <Suspense fallback={null}>
            <ToastMessage
              key={`message-${getFirstParam(message) ?? pageMessage}`}
              message={pageMessage}
              queryKey={getFirstParam(message) ?? ""}
              tone="success"
            />
          </Suspense>
        ) : null}

        {pageError ? (
          <Suspense fallback={null}>
            <ToastMessage
              key={`error-${getFirstParam(error) ?? pageError}`}
              message={pageError}
              queryKey={getFirstParam(error) ?? ""}
              tone="error"
            />
          </Suspense>
        ) : null}

        <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,400px)_1fr]">
          <AddProblemForm returnTo="/problems" />

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
                          <span
                            className={[
                              "rounded-md border px-2 py-1",
                              getDifficultyBadgeClassName(problem.difficulty),
                            ].join(" ")}
                          >
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
