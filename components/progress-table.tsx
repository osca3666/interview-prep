"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LocalDate } from "@/components/local-date";
import { MasteryBoxes } from "@/components/mastery-boxes";
import { type PracticeHistoryProblem } from "@/data/practice-history";

type ProgressTableProps = {
  problems: PracticeHistoryProblem[];
  title: string;
  headerAction?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
};

function getDifficultyBadgeClassName(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800";
    case "hard":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-700";
  }
}

export function ProgressTable({
  problems,
  title,
  headerAction,
  emptyTitle = "No practice history yet",
  emptyDescription = "Add problems and complete reviews to build your history.",
}: ProgressTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const searchInputId = `progress-search-${title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")}`;
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredProblems = useMemo(() => {
    if (!normalizedQuery) {
      return problems;
    }

    return problems.filter((problem) => {
      const searchableText = [
        problem.title,
        problem.pattern ?? "",
        problem.difficulty,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, problems]);
  const hasHeaderControls = problems.length > 0 || headerAction;
  const gridWidthClassName = "min-w-[60rem]";
  const gridTemplateClassName =
    "grid grid-cols-[minmax(14rem,1fr)_8rem_10rem_10rem_8rem]";
  const problemHeaderCellClassName = "px-5 py-3";
  const centeredHeaderCellClassName =
    "flex items-center justify-center px-5 py-3 text-center whitespace-nowrap";
  const problemBodyCellClassName = "min-w-0 px-5 py-4";
  const centeredBodyCellClassName =
    "flex items-center justify-center px-5 py-4 text-center whitespace-nowrap";

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-base font-semibold text-zinc-950">{title}</h2>
        {hasHeaderControls ? (
          <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
            {problems.length > 0 ? (
              <div className="w-full sm:w-72">
                <label htmlFor={searchInputId} className="sr-only">
                  Search progress
                </label>
                <input
                  id={searchInputId}
                  type="search"
                  value={searchQuery}
                  onChange={(event) => setSearchQuery(event.target.value)}
                  placeholder="Search problems"
                  className="block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
                />
              </div>
            ) : null}
            {headerAction ? (
              <div key="header-action" className="w-full sm:w-auto">
                {headerAction}
              </div>
            ) : null}
          </div>
        ) : null}
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
          <div className="min-h-[320px] max-h-[420px] overflow-y-auto">
            <div
              className={`${gridWidthClassName} ${gridTemplateClassName} sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500`}
              role="row"
            >
              <div className={problemHeaderCellClassName} role="columnheader">
                Problem
              </div>
              <div className={centeredHeaderCellClassName} role="columnheader">
                Mastery
              </div>
              <div className={centeredHeaderCellClassName} role="columnheader">
                Last reviewed
              </div>
              <div className={centeredHeaderCellClassName} role="columnheader">
                Next review
              </div>
              <div className={centeredHeaderCellClassName} role="columnheader">
                Total reviews
              </div>
            </div>
            {filteredProblems.length === 0 ? (
              <div className={`${gridWidthClassName} p-6`}>
                <h3 className="text-sm font-semibold text-zinc-950">
                  No problems match your search.
                </h3>
              </div>
            ) : (
              <div
                className={`${gridWidthClassName} divide-y divide-zinc-200 bg-white text-left text-sm`}
                role="rowgroup"
              >
                {filteredProblems.map((problem) => (
                  <div
                    key={problem.id}
                    className={gridTemplateClassName}
                    role="row"
                  >
                    <div className={problemBodyCellClassName} role="cell">
                      <div className="min-w-0">
                        {problem.leetcode_url ? (
                          <a
                            href={problem.leetcode_url}
                            target="_blank"
                            rel="noreferrer"
                            title={problem.title}
                            className="block truncate font-semibold text-zinc-950 underline-offset-4 transition hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200"
                          >
                            {problem.title}
                          </a>
                        ) : (
                          <div
                            className="truncate font-semibold text-zinc-950"
                            title={problem.title}
                          >
                            {problem.title}
                          </div>
                        )}
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-xs">
                        <span
                          className={[
                            "rounded-md border px-2 py-1 font-medium",
                            getDifficultyBadgeClassName(problem.difficulty),
                          ].join(" ")}
                        >
                          {problem.difficulty}
                        </span>
                      </div>
                    </div>
                    <div className={centeredBodyCellClassName} role="cell">
                      <div className="inline-flex">
                        <MasteryBoxes masteryScore={problem.mastery_score} />
                      </div>
                    </div>
                    <div
                      className={`${centeredBodyCellClassName} text-zinc-600`}
                      role="cell"
                    >
                      <LocalDate
                        value={problem.last_reviewed_at}
                        fallback="Never"
                      />
                    </div>
                    <div
                      className={`${centeredBodyCellClassName} text-zinc-600`}
                      role="cell"
                    >
                      <LocalDate value={problem.next_review_at} fallback="-" />
                    </div>
                    <div
                      className={`${centeredBodyCellClassName} font-medium text-zinc-800`}
                      role="cell"
                    >
                      {problem.total_reviews}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
