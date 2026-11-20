import { Upload } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudyPlanSettingsForm } from "@/components/study-plan-settings-form";
import { StudyPlanUnavailableState } from "@/components/study-plan-unavailable-state";
import { getStudyPlanSettingsOverview } from "@/data/study-settings";
import { createClient } from "@/lib/supabase/server";

export default async function StudyPlanSettingsPage() {
  const client = await createClient();
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/sign-in?next=/study-plan");

  const result = await getStudyPlanSettingsOverview(client, userId);
  if (result.error || !result.data) {
    throw new Error("Failed to load study plan settings.");
  }
  if (!result.data.v1Available) return <StudyPlanUnavailableState />;
  if (!result.data.latest) redirect("/study-plan/setup");

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-4xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
              My Study Plan
            </p>
            <h1 className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-white">
              Shape your daily workload
            </h1>
            <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Update future plans, or reconcile today&apos;s pending automatic assignments without touching completed work.
            </p>
          </div>
          <Link
            href="/problems/import"
            className="inline-flex h-10 shrink-0 items-center justify-center gap-2 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            <Upload className="h-4 w-4" aria-hidden="true" />
            Import history
          </Link>
        </div>

        <div className="mt-8">
          <StudyPlanSettingsForm
            mode="edit"
            roadmaps={result.data.roadmaps}
            initialSettings={result.data.latest}
            savedTimeZone={result.data.savedTimeZone}
            currentStudyDate={result.data.currentStudyDate}
          />
        </div>
      </section>
    </div>
  );
}
