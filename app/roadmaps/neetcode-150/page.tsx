import { Suspense } from "react";
import { ArrowLeft, CheckCircle2, Shuffle } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoadmapFollowControl } from "@/components/roadmap-follow-control";
import { RoadmapTable } from "@/components/roadmap-table";
import { ToastMessage } from "@/components/toast-message";
import { listNeetcode150RoadmapRows } from "@/data/roadmap-progress";
import { getRoadmapsExperience } from "@/data/roadmaps";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getRoadmapMessage(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "roadmap_added":
      return "Problem added to your plan.";
    default:
      return null;
  }
}

function getRoadmapError(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "already_added":
      return "You already added this problem.";
    case "invalid_time_zone":
      return "Could not detect a valid timezone. Please refresh and try again.";
    case "invalid_date":
      return "Could not schedule that problem. Please refresh and try again.";
    case "invalid_roadmap_problem":
      return "That roadmap problem is no longer available.";
    case "save_failed":
      return "We could not add that problem. Please try again.";
    default:
      return null;
  }
}

export default async function Neetcode150RoadmapPage({
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

  const [{ error, message }, roadmapRowsResult, roadmapsResult] = await Promise.all([
    searchParams,
    listNeetcode150RoadmapRows(supabase, userId),
    getRoadmapsExperience(supabase, userId),
  ]);

  if (roadmapRowsResult.error || roadmapsResult.error || !roadmapsResult.data) {
    throw new Error("Failed to load roadmap.");
  }

  const roadmapRows = roadmapRowsResult.data ?? [];
  const pageMessage = getRoadmapMessage(message);
  const pageError = pageMessage ? null : getRoadmapError(error);
  const experience = roadmapsResult.data;
  const roadmap = experience.roadmaps.find((item) => item.id === "neetcode-150");

  if (!roadmap) {
    throw new Error("NeetCode 150 is not registered.");
  }

  const isFollowing = experience.effectiveFollowedRoadmapId === roadmap.id;
  const isSuggested = !experience.effectiveFollowedRoadmapId;

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <Link
          href="/roadmaps"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-zinc-500 outline-none transition hover:text-zinc-900 focus-visible:ring-2 focus-visible:ring-violet-300 dark:text-zinc-400 dark:hover:text-zinc-100"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          All roadmaps
        </Link>

        <div className="mt-5 grid gap-6 rounded-lg border border-zinc-200 bg-white p-5 shadow-sm md:grid-cols-[minmax(0,1fr)_18rem] md:p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            {isFollowing ? "Following" : isSuggested ? "Suggested roadmap" : "Roadmap"}
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            NeetCode 150
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Browse every problem in roadmap order and see which ones are
            already tracked in your review library.
          </p>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {isFollowing ? (
                <span className="inline-flex items-center gap-1">
                  {experience.newSelectionMode === "shuffled" ? (
                    <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                  ) : null}
                  {experience.newSelectionMode === "shuffled"
                    ? "Shuffled New selection"
                    : "Sequential New selection"}
                </span>
              ) : null}
              {roadmap.isComplete ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-300">
                  <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" />
                  Completed
                </span>
              ) : null}
            </div>
          </div>

          <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
            <div className="flex items-center justify-between gap-3 text-sm">
              <span className="font-medium text-zinc-700 dark:text-zinc-300">
                {roadmap.completedProblemCount} / {roadmap.totalProblemCount} completed
              </span>
              <span className="font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
                {roadmap.progressPercent}%
              </span>
            </div>
            <div
              className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
              role="progressbar"
              aria-label="NeetCode 150 progress"
              aria-valuemin={0}
              aria-valuemax={roadmap.totalProblemCount}
              aria-valuenow={roadmap.completedProblemCount}
            >
              <div
                className="h-full rounded-full bg-violet-600 dark:bg-violet-400"
                style={{ width: `${roadmap.progressPercent}%` }}
              />
            </div>
            <div className="mt-4">
              <RoadmapFollowControl
                roadmapId={roadmap.id}
                roadmapName={roadmap.name}
                desiredRoadmapId={isFollowing ? null : roadmap.id}
                triggerLabel={isFollowing ? "Stop following" : "Follow roadmap"}
                hasStudyPlanSettings={experience.hasStudyPlanSettings}
                variant={isFollowing ? "secondary" : "primary"}
              />
            </div>
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
          <RoadmapTable rows={roadmapRows} />
        </div>
      </section>
    </div>
  );
}
