import { Suspense } from "react";
import { redirect } from "next/navigation";
import { AddProblemDialog } from "@/components/add-problem-dialog";
import { CurrentGoalCard } from "@/components/current-goal-card";
import { ProgressTable } from "@/components/progress-table";
import { ReviewQueueSection } from "@/components/review-queue-section";
import { RoadmapProgressCard } from "@/components/roadmap-progress-card";
import { ToastMessage } from "@/components/toast-message";
import { listPracticeHistory } from "@/data/practice-history";
import { getRoadmapProgress } from "@/data/roadmap-progress";
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
    case "snoozed":
      return "Review snoozed until tomorrow.";
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
    case "not_found":
      return "This problem is no longer available.";
    case "problem_not_active":
      return "This problem is no longer active.";
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

  const [
    { error, message },
    dueProblemsResult,
    progressResult,
    roadmapProgressResult,
  ] =
    await Promise.all([
      searchParams,
      listDueProblems(supabase, userId),
      listPracticeHistory(supabase, userId),
      getRoadmapProgress(supabase, userId),
    ]);

  if (dueProblemsResult.error) {
    throw new Error("Failed to load due reviews.");
  }

  if (progressResult.error) {
    throw new Error("Failed to load progress.");
  }

  if (roadmapProgressResult.error) {
    throw new Error("Failed to load roadmap progress.");
  }

  const pageMessage = getDashboardMessage(message);
  const pageError = pageMessage ? null : getDashboardError(error);
  const dueProblems = dueProblemsResult.data ?? [];
  const progressProblems = progressResult.data ?? [];
  const roadmapProgress = roadmapProgressResult.data;

  if (!roadmapProgress) {
    throw new Error("Failed to load roadmap progress.");
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
              Review workspace
            </h1>
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

        <div className="mt-8">
          <CurrentGoalCard />
        </div>

        <div className="mt-4">
          <RoadmapProgressCard progress={roadmapProgress} />
        </div>

        <div className="mt-8">
          <ReviewQueueSection dueProblems={dueProblems} returnTo="/dashboard" />
        </div>

        <div className="mt-8">
          <ProgressTable
            problems={progressProblems}
            title="Progress"
            headerAction={<AddProblemDialog />}
          />
        </div>
      </section>
    </div>
  );
}
