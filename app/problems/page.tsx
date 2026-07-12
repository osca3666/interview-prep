import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Upload } from "lucide-react";
import { AddProblemDialog } from "@/components/add-problem-dialog";
import { ProblemLibraryView } from "@/components/problem-library-view";
import { ToastMessage } from "@/components/toast-message";
import { listPracticeHistory } from "@/data/practice-history";
import {
  getLeetCodeProblemLibraryOptions,
  getLeetCodeProblemSearchOptions,
} from "@/lib/leetcode-catalog";
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
      return "Problem tracked.";
    default:
      return null;
  }
}

function getProblemError(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "already_added":
      return "You're already tracking this problem.";
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
    case "invalid_problem":
      return "Choose a valid LeetCode problem from the catalog.";
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
    listPracticeHistory(supabase, userId),
  ]);

  const pageMessage = getProblemMessage(message);
  const pageError = pageMessage ? null : getProblemError(error);
  const problems = problemsResult.data ?? [];
  const catalogProblems = getLeetCodeProblemLibraryOptions();
  const problemOptions = getLeetCodeProblemSearchOptions();

  if (problemsResult.error) {
    throw new Error("Failed to load problems.");
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Library
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
              Problem library
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Track LeetCode problems and manage your review library.
            </p>
          </div>
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            <AddProblemDialog
              problemOptions={problemOptions}
              returnTo="/problems"
            />
            <Link
              href="/problems/import"
              className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              <Upload className="h-4 w-4" aria-hidden="true" />
              Import from LeetCode
            </Link>
          </div>
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

        <ProblemLibraryView
          trackedProblems={problems}
          catalogProblems={catalogProblems}
          problemOptions={problemOptions}
        />
      </section>
    </div>
  );
}
