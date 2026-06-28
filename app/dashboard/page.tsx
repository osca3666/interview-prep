import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { AddProblemDialog } from "@/components/add-problem-dialog";
import { ProgressTable } from "@/components/progress-table";
import { ReviewQueueSection } from "@/components/review-queue-section";
import { listPracticeHistory } from "@/data/practice-history";
import { listDueProblems } from "@/data/reviews";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getDashboardMessage(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "added":
      return "Problem added.";
    case "reviewed":
      return "Review saved.";
    default:
      return null;
  }
}

function getDashboardError(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "already_added":
      return "You already added this problem.";
    case "invalid_form":
      return "Check the problem details and try again.";
    case "invalid_rating":
      return "Choose a valid rating.";
    case "invalid_date":
      return "Choose a valid date.";
    case "invalid_time_zone":
      return "Could not detect a valid timezone. Please refresh and try again.";
    case "invalid_url":
      return "Enter a valid LeetCode problem URL.";
    case "invalid_submission":
      return "Choose a valid review rating.";
    case "problem_not_due":
      return "This problem is no longer available for review.";
    case "stale_review":
      return "This problem was already reviewed or changed. Your queue has been refreshed.";
    case "save_failed":
      return "We could not save that change. Please try again.";
    default:
      return null;
  }
}

export default async function Dashboard({
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

  const [{ error, message }, dueProblemsResult, progressResult] =
    await Promise.all([
      searchParams,
      listDueProblems(supabase, userId),
      listPracticeHistory(supabase, userId),
    ]);

  if (dueProblemsResult.error) {
    throw new Error("Failed to load due reviews.");
  }

  if (progressResult.error) {
    throw new Error("Failed to load progress.");
  }

  const pageMessage = getDashboardMessage(message);
  const pageError = pageMessage ? null : getDashboardError(error);
  const dueProblems = dueProblemsResult.data ?? [];
  const progressProblems = progressResult.data ?? [];

  return (
    <div className="bg-zinc-50">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              Review workspace
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-600">
              Review due problems, add new practice, and track progress from
              one place.
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
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

        <div className="mt-8">
          <ReviewQueueSection dueProblems={dueProblems} returnTo="/dashboard" />
        </div>

        <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-h-11 flex-1" aria-hidden="true" />
          <AddProblemDialog />
        </div>

        <div className="mt-8">
          <ProgressTable problems={progressProblems} title="Progress" />
        </div>
      </section>
    </div>
  );
}
