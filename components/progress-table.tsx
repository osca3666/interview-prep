"use client";

import { useMemo, useState, type ReactNode } from "react";
import { LocalDate } from "@/components/local-date";
import { MasteryBoxes } from "@/components/mastery-boxes";
import {
  DifficultyBadge,
  ProblemTitleLink,
} from "@/components/problem-table-primitives";
import {
  SortableTableHeader,
  type SortDirection,
} from "@/components/sortable-table-header";
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
  limit?: number;
  showSearch?: boolean;
  showReviews?: boolean;
  sortable?: boolean;
};

type ProgressSortKey =
  | "problem"
  | "difficulty"
  | "mastery"
  | "lastReviewed"
  | "nextReview"
  | "reviews";

const problemCollator = new Intl.Collator("en", {
  numeric: true,
  sensitivity: "base",
});
const difficultyRank: Record<string, number> = { easy: 0, medium: 1, hard: 2 };

function dateSortValue(value: string | null) {
  const parsed = value ? Date.parse(value) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Number.NEGATIVE_INFINITY;
}

function compareProgressProblems(
  left: PracticeHistoryProblem,
  right: PracticeHistoryProblem,
  key: ProgressSortKey,
) {
  switch (key) {
    case "problem":
      return problemCollator.compare(
        left.leetcode_frontend_id ?? left.title,
        right.leetcode_frontend_id ?? right.title,
      ) || problemCollator.compare(left.title, right.title);
    case "difficulty":
      return (difficultyRank[left.difficulty.toLowerCase()] ?? 3)
        - (difficultyRank[right.difficulty.toLowerCase()] ?? 3);
    case "mastery":
      return left.mastery_score - right.mastery_score;
    case "lastReviewed":
      return dateSortValue(left.last_reviewed_at) - dateSortValue(right.last_reviewed_at);
    case "nextReview":
      return dateSortValue(left.next_review_at) - dateSortValue(right.next_review_at);
    case "reviews":
      return left.total_reviews - right.total_reviews;
  }
}

export function ProgressTable({
  problems,
  title,
  headerAction,
  headerContent,
  emptyTitle = "No practice history yet",
  emptyDescription = "Track problems and complete reviews to build your history.",
  layout = "fixed",
  searchPlaceholder = "Search problems",
  limit,
  showSearch = true,
  showReviews = true,
  sortable = false,
}: ProgressTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [sort, setSort] = useState<{
    key: ProgressSortKey;
    direction: SortDirection;
  } | null>(null);
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
  const sortedProblems = useMemo(() => {
    if (!sortable || !sort) return filteredProblems;
    const direction = sort.direction === "asc" ? 1 : -1;
    return filteredProblems
      .map((problem, index) => ({ problem, index }))
      .sort((left, right) =>
        direction * compareProgressProblems(left.problem, right.problem, sort.key)
        || left.index - right.index)
      .map(({ problem }) => problem);
  }, [filteredProblems, sort, sortable]);
  const visibleProblems = useMemo(
    () =>
      typeof limit === "number"
        ? sortedProblems.slice(0, limit)
        : sortedProblems,
    [limit, sortedProblems],
  );
  const hasHeaderControls =
    (showSearch && problems.length > 0) || Boolean(headerAction);
  const gridWidthClassName = showReviews ? "min-w-[60rem]" : "min-w-[52rem]";
  const gridTemplateClassName = showReviews
    ? "grid grid-cols-[minmax(14rem,1fr)_8rem_8rem_10rem_10rem_8rem]"
    : "grid grid-cols-[minmax(14rem,1fr)_8rem_8rem_10rem_10rem]";
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

  function updateSort(key: ProgressSortKey) {
    setSort((current) => current?.key === key
      ? { key, direction: current.direction === "asc" ? "desc" : "asc" }
      : { key, direction: "asc" });
  }

  function header(
    key: ProgressSortKey,
    label: string,
    className: string,
    align: "left" | "center" = "center",
  ) {
    if (!sortable) {
      return <div className={className} role="columnheader">{label}</div>;
    }
    return (
      <SortableTableHeader
        label={label}
        active={sort?.key === key}
        direction={sort?.key === key ? sort.direction : "asc"}
        align={align}
        className={className}
        onSort={() => updateSort(key)}
      />
    );
  }

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
            {showSearch && problems.length > 0 ? (
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
              {header("problem", "Problem", problemHeaderCellClassName, "left")}
              {header("difficulty", "Difficulty", centeredHeaderCellClassName)}
              {header("mastery", "Mastery", centeredHeaderCellClassName)}
              {header("lastReviewed", "Last reviewed", centeredHeaderCellClassName)}
              {header("nextReview", "Next review", centeredHeaderCellClassName)}
              {showReviews ? header("reviews", "Reviews", centeredHeaderCellClassName) : null}
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
                {visibleProblems.map((problem) => (
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
                    {showReviews ? (
                      <div
                        className={`${centeredBodyCellClassName} font-medium text-zinc-800 dark:text-zinc-200`}
                        role="cell"
                      >
                        {problem.total_reviews}
                      </div>
                    ) : null}
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
