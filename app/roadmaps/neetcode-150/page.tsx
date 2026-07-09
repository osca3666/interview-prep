import { Suspense } from "react";
import { redirect } from "next/navigation";
import { RoadmapTable } from "@/components/roadmap-table";
import { ToastMessage } from "@/components/toast-message";
import { listNeetcode150RoadmapRows } from "@/data/roadmap-progress";
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

  const [{ error, message }, roadmapRowsResult] = await Promise.all([
    searchParams,
    listNeetcode150RoadmapRows(supabase, userId),
  ]);

  if (roadmapRowsResult.error) {
    throw new Error("Failed to load roadmap.");
  }

  const roadmapRows = roadmapRowsResult.data ?? [];
  const pageMessage = getRoadmapMessage(message);
  const pageError = pageMessage ? null : getRoadmapError(error);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Roadmap
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            NeetCode 150
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Browse every problem in roadmap order and see which ones are
            already tracked in your review library.
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

        <div className="mt-8">
          <RoadmapTable rows={roadmapRows} />
        </div>
      </section>
    </div>
  );
}
