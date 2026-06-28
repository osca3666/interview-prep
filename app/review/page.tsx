import { redirect } from "next/navigation";
import { ReviewQueueSection } from "@/components/review-queue-section";
import { listDueProblems } from "@/data/reviews";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

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

        <div className="mt-8">
          <ReviewQueueSection dueProblems={dueProblems} returnTo="/review" />
        </div>
      </section>
    </div>
  );
}
