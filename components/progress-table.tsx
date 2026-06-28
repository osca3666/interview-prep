import { LocalDate } from "@/components/local-date";
import { MasteryBoxes } from "@/components/mastery-boxes";
import { type PracticeHistoryProblem } from "@/data/practice-history";

type ProgressTableProps = {
  problems: PracticeHistoryProblem[];
  title: string;
  emptyTitle?: string;
  emptyDescription?: string;
};

export function ProgressTable({
  problems,
  title,
  emptyTitle = "No practice history yet",
  emptyDescription = "Add problems and complete reviews to build your history.",
}: ProgressTableProps) {
  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 px-5 py-4">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
      </div>

      {problems.length === 0 ? (
        <div className="p-6">
          <h3 className="text-sm font-semibold text-zinc-950">{emptyTitle}</h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600">
            {emptyDescription}
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
  );
}
