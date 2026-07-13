"use client";

import { useMemo, useState } from "react";
import {
  DifficultyBadge,
  ProblemTitleLink,
} from "@/components/problem-table-primitives";
import {
  parseLeetCodePracticeHistory,
  type LeetCodeHistoryParseResult,
} from "@/lib/leetcode-history-import";
import {
  classifyLeetCodeHistoryImport,
  type ReadyToImportPreviewRow,
  type ExistingLibraryProblemForImport,
} from "@/lib/leetcode-history-import-matching";
import { type LeetCodeProblemLibraryOption } from "@/lib/leetcode-catalog-types";

type LeetCodeHistoryImportPreviewProps = {
  catalogProblems: LeetCodeProblemLibraryOption[];
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

type ImportDateCellProps = {
  acceptedDate: string | null;
  dateText?: string;
};

type PreviewProblemTableProps = {
  rows: ReadyToImportPreviewRow[];
  emptyCopy: string;
  showResult?: boolean;
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

function ImportDateCell({ acceptedDate, dateText }: ImportDateCellProps) {
  if (acceptedDate) {
    return (
      <div className="truncate" title={dateText ?? undefined}>
        {acceptedDate}
      </div>
    );
  }

  if (dateText) {
    return (
      <div
        className="truncate font-medium text-red-700 dark:text-red-300"
        title="This date could not be normalized"
      >
        Invalid date: {dateText}
      </div>
    );
  }

  return (
    <div className="truncate text-zinc-400 dark:text-zinc-500">
      No date found
    </div>
  );
}

function TopicSummary({ topics }: { topics: string[] }) {
  const visibleTopics = topics.slice(0, 2);
  const hiddenCount = topics.length - visibleTopics.length;

  if (topics.length === 0) {
    return null;
  }

  return (
    <div className="mt-1 flex min-w-0 flex-wrap items-center gap-1.5">
      {visibleTopics.map((topic) => (
        <span
          key={topic}
          className="rounded-md border border-zinc-200 bg-zinc-50 px-1.5 py-0.5 text-[11px] font-medium text-zinc-500 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-400"
        >
          {topic}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="text-[11px] font-medium text-zinc-500 dark:text-zinc-400">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function PreviewProblemTable({
  rows,
  emptyCopy,
  showResult = false,
}: PreviewProblemTableProps) {
  if (rows.length === 0) {
    return (
      <p className="mt-3 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950/50 dark:text-zinc-400">
        {emptyCopy}
      </p>
    );
  }

  return (
    <div className="scrollbar-app mt-3 overflow-x-auto">
      <div className="min-w-[36rem] divide-y divide-zinc-200 rounded-md border border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
        <div className="grid grid-cols-[minmax(14rem,1fr)_8rem_7rem_10rem] bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:bg-zinc-950/60 dark:text-zinc-400">
          <div className="px-3 py-2">Problem</div>
          <div className="px-3 py-2 text-center">Difficulty</div>
          <div className="px-3 py-2 text-center">Submissions</div>
          <div className="px-3 py-2">Date</div>
        </div>
        {rows.map(({ problem }) => (
          <div
            key={problem.frontendId}
            className="grid grid-cols-[minmax(14rem,1fr)_8rem_7rem_10rem] bg-white text-sm dark:bg-zinc-900"
          >
            <div className="min-w-0 px-3 py-3">
              <ProblemTitleLink
                title={problem.title}
                frontendId={problem.frontendId}
                leetcodeUrl={problem.leetcodeUrl}
              />
              <TopicSummary topics={problem.topics} />
              {showResult ? (
                <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
                  No Accepted row found in pasted history. Last result:{" "}
                  {problem.result}.
                </p>
              ) : null}
            </div>
            <div className="flex items-center justify-center px-3 py-3">
              <DifficultyBadge difficulty={problem.difficulty} />
            </div>
            <div className="flex items-center justify-center px-3 py-3 font-medium text-zinc-800 dark:text-zinc-200">
              {problem.submissionCount}
            </div>
            <div className="min-w-0 px-3 py-3 text-sm text-zinc-600 dark:text-zinc-400">
              <ImportDateCell
                acceptedDate={problem.acceptedDate}
                dateText={problem.dateText}
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function getEmptyResult(): LeetCodeHistoryParseResult | null {
  return null;
}

export function LeetCodeHistoryImportPreview({
  catalogProblems,
  existingProblems,
}: LeetCodeHistoryImportPreviewProps) {
  const [rawText, setRawText] = useState("");
  const [result, setResult] = useState<LeetCodeHistoryParseResult | null>(
    getEmptyResult,
  );
  const duplicateRows = result?.skippedRows ?? [];
  const stats = result?.stats;
  const hasPreview = result !== null;
  const classification = useMemo(
    () =>
      classifyLeetCodeHistoryImport({
        importProblems: result?.importProblems ?? [],
        catalogProblems,
        existingProblems,
      }),
    [catalogProblems, existingProblems, result],
  );
  const alreadyInLibraryProblems = classification.alreadyInLibrary;
  const readyAsPracticedProblems = classification.readyAsPracticed;
  const readyToScheduleProblems = classification.readyToSchedule;
  const unmatchedProblems = classification.unmatched;
  const statCards = useMemo(
    () =>
      stats
        ? [
            { label: "Problems found", value: stats.problemCount },
            {
              label: "Ready as practiced",
              value: readyAsPracticedProblems.length,
            },
            {
              label: "Ready to schedule",
              value: readyToScheduleProblems.length,
            },
            {
              label: "Already in Library",
              value: alreadyInLibraryProblems.length,
            },
            { label: "Unmatched", value: unmatchedProblems.length },
            { label: "Duplicates removed", value: stats.duplicateCount },
          ]
        : [],
    [
      alreadyInLibraryProblems.length,
      readyAsPracticedProblems.length,
      readyToScheduleProblems.length,
      stats,
      unmatchedProblems.length,
    ],
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
            Parsed problems are staged for a future import step. Nothing is
            saved yet.
          </p>
        </div>

        {!hasPreview ? (
          <div className="p-6">
            <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
              Paste history to see a preview.
            </h3>
            <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              The parser will ignore page clutter, keep attempted problems, and
              remove duplicate rows.
            </p>
          </div>
        ) : (
          <div className="p-5">
            <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-6">
              {statCards.map((stat) => (
                <StatCard
                  key={stat.label}
                  label={stat.label}
                  value={stat.value}
                />
              ))}
            </div>

            <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Ready to import as practiced ({readyAsPracticedProblems.length})
              </summary>
              <PreviewProblemTable
                rows={readyAsPracticedProblems}
                emptyCopy="No accepted problem rows are ready to import as practiced."
              />
            </details>

            <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Ready to schedule ({readyToScheduleProblems.length})
              </summary>
              <PreviewProblemTable
                rows={readyToScheduleProblems}
                emptyCopy="No attempted-only problem rows are ready to schedule."
                showResult
              />
            </details>

            <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Already in Library ({alreadyInLibraryProblems.length})
              </summary>
              {alreadyInLibraryProblems.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No parsed problem rows matched your Library.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {alreadyInLibraryProblems.map(
                    ({ problem, existingProblem }) => (
                      <li
                        key={problem.frontendId}
                        className="text-sm text-zinc-600 dark:text-zinc-400"
                      >
                        <span className="font-medium text-zinc-800 dark:text-zinc-200">
                          {problem.frontendId}. {problem.title}
                        </span>
                        <span className="ml-1 text-xs text-zinc-500 dark:text-zinc-500">
                          already tracked as {existingProblem.title}; parsed as{" "}
                          {problem.importKind}
                        </span>
                      </li>
                    ),
                  )}
                </ul>
              )}
            </details>

            <details
              className="mt-5 rounded-md border border-amber-200 bg-amber-50/70 px-3 py-2 dark:border-amber-800 dark:bg-amber-950/30"
              open={unmatchedProblems.length > 0}
            >
              <summary className="cursor-pointer text-sm font-semibold text-amber-900 dark:text-amber-200">
                Unmatched rows ({unmatchedProblems.length})
              </summary>
              {unmatchedProblems.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  Every parsed problem matched the current LeetCode catalog.
                </p>
              ) : (
                <ul className="mt-3 space-y-3">
                  {unmatchedProblems.map((problem) => (
                    <li
                      key={problem.frontendId}
                      className="text-sm text-zinc-700 dark:text-zinc-300"
                    >
                      <div className="font-medium text-zinc-900 dark:text-zinc-100">
                        {problem.frontendId}. {problem.parsedTitle}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-zinc-600 dark:text-zinc-400">
                        <DifficultyBadge
                          difficulty={problem.parsedDifficulty}
                        />
                        <span>{problem.importKind}</span>
                        <span>{problem.submissionCount} submissions</span>
                        <span>last result: {problem.result}</span>
                        <span className="min-w-0">
                          <ImportDateCell
                            acceptedDate={problem.acceptedDate}
                            dateText={problem.dateText}
                          />
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-amber-800 dark:text-amber-300">
                        Not found in the current LeetCode catalog.
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </details>

            <details className="mt-5 rounded-md border border-zinc-200 bg-zinc-50/70 px-3 py-2 dark:border-zinc-800 dark:bg-zinc-950/50">
              <summary className="cursor-pointer text-sm font-semibold text-zinc-800 dark:text-zinc-200">
                Duplicate rows removed ({duplicateRows.length})
              </summary>
              {duplicateRows.length === 0 ? (
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  No duplicate rows removed.
                </p>
              ) : (
                <ul className="mt-3 space-y-2">
                  {duplicateRows.map((row, index) => (
                    <li
                      key={`${row.frontendId}-${row.reason}-${index}`}
                      className="text-sm text-zinc-600 dark:text-zinc-400"
                    >
                      <span className="font-medium text-zinc-800 dark:text-zinc-200">
                        {row.frontendId}. {row.title}
                      </span>{" "}
                      - duplicate row ({row.result})
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
