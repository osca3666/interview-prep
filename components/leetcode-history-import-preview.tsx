"use client";

import { useMemo, useState } from "react";
import {
  DifficultyBadge,
  ProblemTitleLink,
} from "@/components/problem-table-primitives";
import {
  parseLeetCodePracticeHistory,
  type LeetCodeHistoryImportProblem,
  type LeetCodeHistoryParseResult,
} from "@/lib/leetcode-history-import";

export type ExistingLibraryProblemForImport = {
  id: string;
  leetcode_slug: string;
  title: string;
  difficulty: string;
};

type LeetCodeHistoryImportPreviewProps = {
  existingProblems: ExistingLibraryProblemForImport[];
};

const samplePlaceholder = `Paste your LeetCode Practice History text here.

Example:
Jul 10, 2026
46. Permutations
Med.
Accepted
3`;

type StatCardProps = {
  label: string;
  value: number;
};

type PreviewProblem = LeetCodeHistoryImportProblem & {
  importStatus: "already_in_library" | "ready_to_import";
  existingProblem: ExistingLibraryProblemForImport | null;
};

function StatCard({ label, value }: StatCardProps) {
  return (
    <div className="rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
      <p className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
        {value}
      </p>
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
        {label}
      </p>
    </div>
  );
}

function getImportStatusBadgeClassName(status: PreviewProblem["importStatus"]) {
  switch (status) {
    case "already_in_library":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
    case "ready_to_import":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
  }
}

function getEmptyResult(): LeetCodeHistoryParseResult | null {
  return null;
}

export function LeetCodeHistoryImportPreview({
  existingProblems,
}: LeetCodeHistoryImportPreviewProps) {
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<LeetCodeHistoryParseResult | null>(
    getEmptyResult,
  );
  const skippedRows = result?.skippedRows ?? [];
  const nonAcceptedSkippedRows = skippedRows.filter(
    (row) => row.reason === "not_accepted",
  );
  const duplicateAcceptedRows = skippedRows.filter(
    (row) => row.reason === "duplicate_accepted",
  );
  const stats = result?.stats;
  const hasPreview = result !== null;
  const existingProblemsBySlug = useMemo(
    () =>
      new Map(
        existingProblems.map((problem) => [problem.leetcode_slug, problem]),
      ),
    [existingProblems],
  );
  const previewProblems = useMemo<PreviewProblem[]>(() => {
    return (result?.acceptedProblems ?? []).map((problem) => {
      const existingProblem = existingProblemsBySlug.get(problem.slug) ?? null;

      return {
        ...problem,
        importStatus: existingProblem
          ? "already_in_library"
          : "ready_to_import",
        existingProblem,
      };
    });
  }, [existingProblemsBySlug, result]);
  const alreadyInLibraryCount = previewProblems.filter(
    (problem) => problem.importStatus === "already_in_library",
  ).length;
  const alreadyInLibraryProblems = previewProblems.filter(
    (problem) => problem.importStatus === "already_in_library",
  );
  const readyToImportCount = previewProblems.filter(
    (problem) => problem.importStatus === "ready_to_import",
  ).length;
  const readyToImportProblems = previewProblems.filter(
    (problem) => problem.importStatus === "ready_to_import",
  );
  const statCards = useMemo(
    () =>
      stats
        ? [
            { label: "Accepted found", value: stats.acceptedCount },
            { label: "Already in Library", value: alreadyInLibraryCount },
            { label: "Ready to import", value: readyToImportCount },
            {
              label: "Skipped attempts",
              value: stats.skippedNonAcceptedCount,
            },
            { label: "Duplicates removed", value: stats.duplicateCount },
          ]
        : [],
    [alreadyInLibraryCount, readyToImportCount, stats],
  );

  function handlePreview() {
    setResult(parseLeetCodePracticeHistory(rawText));
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,440px)_1fr]">
      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
            Paste history
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Open your{" "}
            <a
              href="https://leetcode.com/progress/"
              target="_blank"
              rel="noreferrer"
              className="font-medium text-sky-700 underline-offset-4 hover:underline dark:text-sky-300"
            >
              LeetCode Practice History
            </a>
            , copy the whole page, and paste it here. We&apos;ll ignore headers,
            navigation, footers, and other page clutter. Nothing is saved during
            preview.
          </p>
        </div>
        <div className="p-5">
          <label htmlFor="leetcode-history-text" className="sr-only">
            LeetCode Practice History text
          </label>
          <textarea
            id="leetcode-history-text"
            value={rawText}
            onChange={(event) => setRawText(event.target.value)}
            placeholder={samplePlaceholder}
            rows={18}
            className="block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm leading-6 text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
          />
          <button
            type="button"
            onClick={handlePreview}
            className="mt-4 inline-flex h-10 w-full items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:focus-visible:ring-zinc-700"
          >
            Preview import
          </button>
          <button
            type="button"
            disabled
            className="mt-3 inline-flex h-10 w-full cursor-not-allowed items-center justify-center rounded-md border border-dashed border-zinc-300 px-4 text-sm font-semibold text-zinc-400 dark:border-zinc-700 dark:text-zinc-500"
          >
            Confirm import coming next
          </button>
        </div>
      </section>

      <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-4 dark:border-zinc-800">
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
            Import preview
          </h2>
          <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Accepted rows are ready for a future import step. Nothing is saved
            yet.
          </p>
        </div>

        {!hasPreview ? (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
              Paste history to see a preview.
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              The parser will ignore page clutter, skip non-accepted attempts,
              and remove duplicate accepted rows.
            </p>
          </div>
        ) : (
          <div className="p-5">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-5">
              {statCards.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                />
              ))}
            </div>

            <div className="mt-5">
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                Ready to import
              </h3>
              {readyToImportProblems.length === 0 ? (
                <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
                  No new accepted problem rows are ready to import.
                </p>
              ) : (
                <div className="scrollbar-app mt-3 overflow-x-auto">
                  <div className="min-w-[36rem] divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
                    <div className="grid grid-cols-[minmax(14rem,1fr)_8rem_7rem_10rem] bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
                      <div className="px-3 py-2">Problem</div>
                      <div className="px-3 py-2 text-center">Difficulty</div>
                      <div className="px-3 py-2 text-center">Submissions</div>
                      <div className="px-3 py-2">Date</div>
                    </div>
                    {readyToImportProblems.map((problem) => (
                      <div
                        key={problem.frontendId}
                        className="grid grid-cols-[minmax(14rem,1fr)_8rem_7rem_10rem] bg-white text-sm dark:bg-zinc-900"
                      >
                        <div className="min-w-0 px-3 py-3">
                          <ProblemTitleLink
                            title={`${problem.frontendId}. ${problem.title}`}
                            leetcodeUrl={problem.leetcodeUrl}
                          />
                        </div>
                        <div className="flex items-center justify-center px-3 py-3">
                          <DifficultyBadge difficulty={problem.difficulty} />
                        </div>
                        <div className="flex items-center justify-center px-3 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                          {problem.submissionCount}
                        </div>
                        <div className="min-w-0 px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">
                          {problem.acceptedDate ? (
                            <div
                              className="truncate"
                              title={problem.dateText ?? undefined}
                            >
                              {problem.acceptedDate}
                            </div>
                          ) : problem.dateText ? (
                            <div
                              className="truncate font-medium text-red-700 dark:text-red-300"
                              title="This date could not be normalized"
                            >
                              Invalid date: {problem.dateText}
                            </div>
                          ) : (
                            <div className="truncate text-zinc-400 dark:text-zinc-500">
                              No date found
                            </div>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Already in Library ({alreadyInLibraryProblems.length})
              </summary>
              {alreadyInLibraryProblems.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No parsed accepted rows matched your Library.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {alreadyInLibraryProblems.map((problem) => (
                    <li
                      key={problem.frontendId}
                      className="flex flex-col gap-1 text-sm text-zinc-600 sm:flex-row sm:items-center sm:justify-between dark:text-zinc-400"
                    >
                      <span className="min-w-0">
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {problem.frontendId}. {problem.title}
                        </span>
                        {problem.existingProblem ? (
                          <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                            matched {problem.existingProblem.title}
                          </span>
                        ) : null}
                      </span>
                      <span
                        className={[
                          "w-fit rounded-md border px-2 py-1 text-xs font-medium",
                          getImportStatusBadgeClassName("already_in_library"),
                        ].join(" ")}
                      >
                        Already in Library
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Duplicate accepted rows ({duplicateAcceptedRows.length})
              </summary>
              {duplicateAcceptedRows.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No duplicate accepted rows removed.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {duplicateAcceptedRows.map((row, index) => (
                    <li
                      key={`${row.frontendId}-${row.reason}-${index}`}
                      className="text-sm text-zinc-600 dark:text-zinc-400"
                    >
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {row.frontendId}. {row.title}
                      </span>{" "}
                      - duplicate accepted row
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Skipped non-accepted attempts ({nonAcceptedSkippedRows.length})
              </summary>
              {nonAcceptedSkippedRows.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Nothing skipped.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {nonAcceptedSkippedRows.map((row, index) => (
                    <li
                      key={`${row.frontendId}-${row.reason}-${index}`}
                      className="text-sm text-zinc-600 dark:text-zinc-400"
                    >
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {row.frontendId}. {row.title}
                      </span>{" "}
                      - {row.result} ({row.reason.replace(/_/g, " ")})
                    </li>
                  ))}
                </ul>
              )}
            </details>
          </div>
        )}
      </section>
    </div>
  );
}
