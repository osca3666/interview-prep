import { redirect } from "next/navigation";
import { ProgressTable } from "@/components/progress-table";
import { listPracticeHistory } from "@/data/practice-history";
import { createClient } from "@/lib/supabase/server";

export default async function PracticeHistoryPage() {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const historyResult = await listPracticeHistory(supabase, userId);

  if (historyResult.error) {
    throw new Error("Failed to load practice history.");
  }

  const problems = historyResult.data ?? [];

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            History
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            Practice history
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
            Review your saved problems, mastery progress, and recent practice
            activity.
          </p>
        </div>

        <div className="mt-8">
          <ProgressTable problems={problems} title="Reviewed problems" />
        </div>
      </section>
    </div>
  );
}
