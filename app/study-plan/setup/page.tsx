import { ArrowRight, Upload } from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { StudyPlanSettingsForm } from "@/components/study-plan-settings-form";
import { StudyPlanUnavailableState } from "@/components/study-plan-unavailable-state";
import { getStudyPlanSettingsOverview } from "@/data/study-settings";
import { createClient } from "@/lib/supabase/server";

export default async function StudyPlanSetupPage() {
  const client = await createClient();
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/sign-in?next=/study-plan/setup");

  const result = await getStudyPlanSettingsOverview(client, userId);
  if (result.error || !result.data) {
    throw new Error("Failed to load study plan setup.");
  }
  if (!result.data.v1Available) return <StudyPlanUnavailableState />;
  if (result.data.latest) redirect("/dashboard");

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-5xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
            Study plan setup
          </p>
          <h1 className="mt-2 text-3xl font-semibold text-zinc-950 dark:text-white">
            Make each study day manageable
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Choose a daily workload and where problems should come from. You can change everything later.
          </p>
        </div>

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_17rem]">
          <StudyPlanSettingsForm
            mode="setup"
            roadmaps={result.data.roadmaps}
            initialSettings={null}
            savedTimeZone={result.data.savedTimeZone}
            currentStudyDate={result.data.currentStudyDate}
          />

          <aside className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
              <Upload className="h-4 w-4" aria-hidden="true" />
            </span>
            <h2 className="mt-3 text-sm font-semibold text-zinc-950 dark:text-zinc-100">
              Already practiced on LeetCode?
            </h2>
            <p className="mt-2 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Importing your history is optional. You can finish setup now and import whenever you are ready.
            </p>
            <Link
              href="/problems/import"
              className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 outline-none transition hover:text-violet-900 focus-visible:ring-2 focus-visible:ring-violet-300 dark:text-violet-300 dark:hover:text-violet-200"
            >
              Import LeetCode history
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </aside>
        </div>
      </section>
    </div>
  );
}
