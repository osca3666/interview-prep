"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LocalDate } from "@/components/local-date";
import { MasteryBoxes } from "@/components/mastery-boxes";
import {
  DifficultyBadge,
  ProblemTitleLink,
} from "@/components/problem-table-primitives";
import { type PracticeHistoryProblem } from "@/data/practice-history";

type ProgressTableProps = {
  problems: PracticeHistoryProblem[];
  title: string;
  headerAction?: ReactNode;
  headerContent?: ReactNode;
  emptyTitle?: string;
  emptyDescription?: string;
  layout?: "fixed" | "auto";
  searchPlaceholder?: string;
};

export function ProgressTable({
  problems,
  title,
  headerAction,
  headerContent,
  emptyTitle = "No practice history yet",
  emptyDescription = "Track problems and complete reviews to build your history.",
  layout = "fixed",
  searchPlaceholder = "Search problems",
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
        problem.leetcode_frontend_id ?? "",
        problem.title,
        problem.difficulty,
        ...problem.leetcode_topics,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, problems]);
  const hasHeaderControls = problems.length > 0 || headerAction;
  const gridWidthClassName = "min-w-[60rem]";
  const gridTemplateClassName =
    "grid grid-cols-[minmax(14rem,1fr)_8rem_8rem_10rem_10rem_8rem]";
  const problemHeaderCellClassName = "px-5 py-3";
  const centeredHeaderCellClassName =
    "flex items-center justify-center px-5 py-3 text-center whitespace-nowrap";
  const problemBodyCellClassName = "min-w-0 px-5 py-4";
  const centeredBodyCellClassName =
    "flex items-center justify-center px-5 py-4 text-center whitespace-nowrap";
  const verticalScrollClassName =
    layout === "auto"
      ? "scrollbar-app max-h-[420px] overflow-y-auto"
      : "scrollbar-app min-h-[320px] max-h-[420px] overflow-y-auto";

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        {headerContent ?? (
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
            {title}
          </h2>
        )}
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
                  placeholder={searchPlaceholder}
                  className="block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
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
          <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
            {emptyTitle}
          </h3>
          <p className="mt-2 max-w-xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {emptyDescription}
          </p>
        </div>
      ) : (
        <div className="scrollbar-app overflow-x-auto">
          <div className={verticalScrollClassName}>
            <div
              className={`${gridWidthClassName} ${gridTemplateClassName} sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400`}
              role="row"
            >
              <div className={problemHeaderCellClassName} role="columnheader">
                Problem
              </div>
              <div className={centeredHeaderCellClassName} role="columnheader">
                Difficulty
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
                Reviews
              </div>
            </div>
            {filteredProblems.length === 0 ? (
              <div className={`${gridWidthClassName} p-6`}>
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  No problems match your search.
                </h3>
              </div>
            ) : (
              <div
                className={`${gridWidthClassName} divide-y divide-zinc-200 bg-white text-left text-sm dark:divide-zinc-800 dark:bg-zinc-900`}
                role="rowgroup"
              >
                {filteredProblems.map((problem) => (
                  <div
                    key={problem.id}
                    className={`${gridTemplateClassName} dark:hover:bg-zinc-800/40`}
                    role="row"
                  >
                    <div className={problemBodyCellClassName} role="cell">
                      <div className="min-w-0">
                        <ProblemTitleLink
                          title={problem.title}
                          frontendId={problem.leetcode_frontend_id}
                          leetcodeUrl={problem.leetcode_url}
                        />
                      </div>
                    </div>
                    <div className={centeredBodyCellClassName} role="cell">
                      <DifficultyBadge difficulty={problem.difficulty} />
                    </div>
                    <div className={centeredBodyCellClassName} role="cell">
                      <div className="inline-flex">
                        <MasteryBoxes masteryScore={problem.mastery_score} />
                      </div>
                    </div>
                    <div
                      className={`${centeredBodyCellClassName} text-zinc-600 dark:text-zinc-400`}
                      role="cell"
                    >
                      <LocalDate
                        value={problem.last_reviewed_at}
                        fallback="Never"
                      />
                    </div>
                    <div
                      className={`${centeredBodyCellClassName} text-zinc-600 dark:text-zinc-400`}
                      role="cell"
                    >
                      <LocalDate value={problem.next_review_at} fallback="-" />
                    </div>
                    <div
                      className={`${centeredBodyCellClassName} font-medium text-zinc-800 dark:text-zinc-200`}
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
