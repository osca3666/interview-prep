import { redirect } from "next/navigation";
import { LocalDate } from "@/components/local-date";
import { MasteryBoxes } from "@/components/mastery-boxes";
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
    <div className="bg-zinc-50">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            History
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Practice history
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600">
            Review your saved problems, mastery progress, and recent practice
            activity.
          </p>
        </div>

        <div className="mt-8 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
          <div className="border-b border-zinc-200 px-5 py-4">
            <h2 className="text-base font-semibold text-zinc-950">
              Reviewed problems
            </h2>
          </div>

          {problems.length === 0 ? (
            <div className="p-6">
              <h3 className="text-sm font-semibold text-zinc-950">
                No practice history yet
              </h3>
              <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
                Add problems and complete reviews to build your history.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500">
                  <tr>
                    <th scope="col" className="px-5 py-3">
                      Problem
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Mastery
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Last submitted
                    </th>
                    <th scope="col" className="px-5 py-3">
                      Total reviews
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-200 bg-white">
                  {problems.map((problem) => (
                    <tr key={problem.id}>
                      <td className="px-5 py-4">
                        <div className="font-semibold text-zinc-950">
                          {problem.title}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          <span className="rounded-md bg-zinc-100 px-2 py-1 text-xs font-medium text-zinc-700">
                            {problem.difficulty}
                          </span>
                          <a
                            href={problem.leetcode_url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xs font-semibold text-zinc-950 underline-offset-4 hover:underline"
                          >
                            Open on LeetCode
                          </a>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <MasteryBoxes masteryScore={problem.mastery_score} />
                      </td>
                      <td className="px-5 py-4 text-zinc-600">
                        <LocalDate
                          value={problem.last_reviewed_at}
                          fallback="Never"
                        />
                      </td>
                      <td className="px-5 py-4 font-medium text-zinc-800">
                        {problem.total_reviews}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
