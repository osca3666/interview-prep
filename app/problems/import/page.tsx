import Link from "next/link";
import { redirect } from "next/navigation";
import { LeetCodeHistoryImportPreview } from "@/components/leetcode-history-import-preview";
import { getLeetCodeProblemLibraryOptions } from "@/lib/leetcode-catalog";
import { createClient } from "@/lib/supabase/server";

export default async function ProblemImportPage() {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const existingProblemsResult = await supabase
    .from("user_problems")
    .select("id,leetcode_frontend_id,leetcode_slug,title,difficulty")
    .eq("user_id", userId);

  if (existingProblemsResult.error) {
    throw new Error("Failed to load existing problems.");
  }

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
              Library import
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
              Preview LeetCode history
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-600 dark:text-zinc-400">
              Paste your LeetCode Practice History text to see which accepted
              problems the parser can extract. This preview does not save
              anything yet.
            </p>
          </div>
          <Link
            href="/problems"
            className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Back to Library
          </Link>
        </div>

        <div className="mt-8">
          <LeetCodeHistoryImportPreview
            catalogProblems={getLeetCodeProblemLibraryOptions()}
            existingProblems={existingProblemsResult.data ?? []}
          />
        </div>
      </section>
    </div>
  );
}
