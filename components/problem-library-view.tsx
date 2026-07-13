"use client";

import { useMemo, useState } from "react";
import { Check, ListPlus } from "lucide-react";
import { AddProblemDialog } from "@/components/add-problem-dialog";
import { MasteryBoxes } from "@/components/mastery-boxes";
import { ProgressTable } from "@/components/progress-table";
import {
  DifficultyBadge,
  ProblemTitleLink,
} from "@/components/problem-table-primitives";
import {
  type LeetCodeProblemLibraryOption,
  type LeetCodeProblemSearchOption,
} from "@/lib/leetcode-catalog-types";

type TrackedProblem = {
  id: string;
  leetcode_frontend_id: string | null;
  leetcode_slug: string;
  title: string;
  difficulty: string;
  leetcode_url: string;
  leetcode_topics: string[];
  mastery_score: number;
  last_reviewed_at: string | null;
  next_review_at: string;
  total_reviews: number;
};

type ProblemLibraryViewProps = {
  trackedProblems: TrackedProblem[];
  catalogProblems: LeetCodeProblemLibraryOption[];
  problemOptions: LeetCodeProblemSearchOption[];
};

const catalogResultsPerPage = 25;

const tabButtonClassName =
  "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:focus-visible:ring-zinc-700";

function getTabButtonClassName(isSelected: boolean) {
  return isSelected
    ? `${tabButtonClassName} bg-zinc-950 text-white dark:bg-zinc-100 dark:text-zinc-950`
    : `${tabButtonClassName} text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800`;
}

function CatalogTopicChips({ topics }: { topics: string[] }) {
  const visibleTopics = topics.slice(0, 2);
  const hiddenCount = topics.length - visibleTopics.length;

  if (topics.length === 0) {
    return <span className="text-xs text-zinc-500 dark:text-zinc-500">No topics</span>;
  }

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-1.5">
      {visibleTopics.map((topic) => (
        <span
          key={topic}
          className="rounded-md border border-zinc-200 bg-zinc-50 px-2 py-1 text-xs font-medium text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300"
        >
          {topic}
        </span>
      ))}
      {hiddenCount > 0 ? (
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          +{hiddenCount}
        </span>
      ) : null}
    </div>
  );
}

function TrackedBadge() {
  return (
    <span
      className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
      aria-label="Already in library"
      title="Already in library"
    >
      <Check className="h-3.5 w-3.5" aria-hidden="true" />
    </span>
  );
}

export function ProblemLibraryView({
  trackedProblems,
  catalogProblems,
  problemOptions,
}: ProblemLibraryViewProps) {
  const [activeView, setActiveView] = useState<"tracked" | "all">("tracked");
  const [catalogSearchQuery, setCatalogSearchQuery] = useState("");
  const [catalogPage, setCatalogPage] = useState(1);
  const [selectedFrontendId, setSelectedFrontendId] = useState<string | null>(
    null,
  );
  const [rowDialogOpen, setRowDialogOpen] = useState(false);
  const normalizedCatalogSearchQuery = useMemo(
    () => catalogSearchQuery.trim().toLowerCase(),
    [catalogSearchQuery],
  );
  const trackedFrontendIds = useMemo(
    () =>
      new Set(
        trackedProblems
          .map((problem) => problem.leetcode_frontend_id)
          .filter((frontendId): frontendId is string => Boolean(frontendId)),
      ),
    [trackedProblems],
  );
  const trackedSlugs = useMemo(
    () => new Set(trackedProblems.map((problem) => problem.leetcode_slug)),
    [trackedProblems],
  );
  const trackedProblemsByFrontendId = useMemo(
    () =>
      new Map(
        trackedProblems
          .filter((problem) => problem.leetcode_frontend_id)
          .map((problem) => [problem.leetcode_frontend_id, problem]),
      ),
    [trackedProblems],
  );
  const trackedProblemsBySlug = useMemo(
    () =>
      new Map(
        trackedProblems.map((problem) => [problem.leetcode_slug, problem]),
      ),
    [trackedProblems],
  );
  const filteredCatalogProblems = useMemo(() => {
    if (!normalizedCatalogSearchQuery) {
      return catalogProblems;
    }

    return catalogProblems.filter((problem) => {
      const searchableText = [
        problem.frontendId,
        problem.title,
        problem.difficulty,
        problem.category,
        ...problem.topics,
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedCatalogSearchQuery);
    });
  }, [catalogProblems, normalizedCatalogSearchQuery]);
  const totalCatalogPages = Math.max(
    1,
    Math.ceil(filteredCatalogProblems.length / catalogResultsPerPage),
  );
  const effectiveCatalogPage = Math.min(catalogPage, totalCatalogPages);
  const visibleCatalogProblems = useMemo(
    () =>
      filteredCatalogProblems.slice(
        (effectiveCatalogPage - 1) * catalogResultsPerPage,
        effectiveCatalogPage * catalogResultsPerPage,
      ),
    [effectiveCatalogPage, filteredCatalogProblems],
  );
  const firstVisibleCatalogResult =
    filteredCatalogProblems.length === 0
      ? 0
      : (effectiveCatalogPage - 1) * catalogResultsPerPage + 1;
  const lastVisibleCatalogResult =
    visibleCatalogProblems.length === 0
      ? 0
      : firstVisibleCatalogResult + visibleCatalogProblems.length - 1;
  const viewToggle = (
    <div
      className="inline-flex w-full rounded-lg border border-zinc-200 bg-white p-1 shadow-sm sm:w-auto dark:border-zinc-800 dark:bg-zinc-950"
      aria-label="Library view"
    >
      <button
        type="button"
        aria-pressed={activeView === "tracked"}
        className={getTabButtonClassName(activeView === "tracked")}
        onClick={() => setActiveView("tracked")}
      >
        Tracked
      </button>
      <button
        type="button"
        aria-pressed={activeView === "all"}
        className={getTabButtonClassName(activeView === "all")}
        onClick={() => setActiveView("all")}
      >
        All LeetCode
      </button>
    </div>
  );

  function openTrackDialog(frontendId: string) {
    setSelectedFrontendId(frontendId);
    setRowDialogOpen(true);
  }

  return (
    <div className="mt-8">
      <div className="min-w-0">
        {activeView === "tracked" ? (
          <ProgressTable
            problems={trackedProblems}
            title="Tracked problems"
            headerContent={viewToggle}
            layout="auto"
            searchPlaceholder="Search tracked problems"
            emptyTitle="No problems yet"
            emptyDescription="Track your first LeetCode problem to start building your review library."
          />
        ) : (
          <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
            <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              {viewToggle}
              <div className="w-full sm:w-80">
                <label htmlFor="catalog-search" className="sr-only">
                  Search LeetCode catalog
                </label>
                <input
                  id="catalog-search"
                  type="search"
                  value={catalogSearchQuery}
                  onChange={(event) => {
                    setCatalogSearchQuery(event.target.value);
                    setCatalogPage(1);
                  }}
                  placeholder="Search by number, title, difficulty, or topic"
                  className="block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
                />
              </div>
            </div>

            {visibleCatalogProblems.length === 0 ? (
              <div className="p-6">
                <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                  No catalog problems match your search.
                </h3>
              </div>
            ) : (
              <div className="scrollbar-app overflow-x-auto">
                <div className="min-w-[62rem]">
                  <div
                    className="grid grid-cols-[minmax(20rem,1fr)_8rem_minmax(14rem,22rem)_8rem_7rem] border-b border-zinc-200 bg-zinc-50 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
                    role="row"
                  >
                    <div className="px-5 py-3" role="columnheader">
                      Problem
                    </div>
                    <div
                      className="flex items-center justify-center px-5 py-3 text-center"
                      role="columnheader"
                    >
                      Difficulty
                    </div>
                    <div
                      className="flex items-center justify-center px-5 py-3 text-center"
                      role="columnheader"
                    >
                      Topics
                    </div>
                    <div
                      className="flex items-center justify-center px-5 py-3 text-center"
                      role="columnheader"
                    >
                      Mastery
                    </div>
                    <div
                      className="flex items-center justify-end px-5 py-3 text-right"
                      role="columnheader"
                    >
                      Action
                    </div>
                  </div>
                  <div className="divide-y divide-zinc-200 bg-white text-sm dark:divide-zinc-800 dark:bg-zinc-900">
                  {visibleCatalogProblems.map((problem) => {
                    const isTracked =
                      trackedFrontendIds.has(problem.frontendId) ||
                      trackedSlugs.has(problem.slug);
                    const trackedProblem =
                      trackedProblemsByFrontendId.get(problem.frontendId) ??
                      trackedProblemsBySlug.get(problem.slug);

                    return (
                      <div
                        key={problem.frontendId}
                        className="grid grid-cols-[minmax(20rem,1fr)_8rem_minmax(14rem,22rem)_8rem_7rem] items-center hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40"
                      >
                        <div className="min-w-0 px-5 py-4">
                          <ProblemTitleLink
                            title={problem.title}
                            frontendId={problem.frontendId}
                            leetcodeUrl={problem.leetcodeUrl}
                            truncate={false}
                          />
                        </div>
                        <div className="flex items-center justify-center px-5 py-4">
                          <DifficultyBadge difficulty={problem.difficulty} />
                        </div>
                        <div className="px-5 py-4">
                          <CatalogTopicChips topics={problem.topics} />
                        </div>
                        <div className="flex items-center justify-center px-5 py-4">
                          {trackedProblem ? (
                            <MasteryBoxes
                              masteryScore={trackedProblem.mastery_score}
                            />
                          ) : (
                            <span className="text-sm text-zinc-400 dark:text-zinc-600">
                              -
                            </span>
                          )}
                        </div>
                        <div className="flex justify-end px-5 py-4">
                          {isTracked ? (
                            <TrackedBadge />
                          ) : (
                            <button
                              type="button"
                              onClick={() => openTrackDialog(problem.frontendId)}
                              className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-300 bg-white text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-700"
                              aria-label={`Add ${problem.title} to your library`}
                              title="Add to library"
                            >
                              <ListPlus
                                className="h-3.5 w-3.5"
                                aria-hidden="true"
                              />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                  </div>
                </div>
              </div>
            )}

            <div className="flex flex-col gap-3 border-t border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                Showing {firstVisibleCatalogResult}&ndash;{lastVisibleCatalogResult}{" "}
                of {filteredCatalogProblems.length}
              </p>
              <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                <button
                  type="button"
                  disabled={effectiveCatalogPage <= 1}
                  onClick={() => setCatalogPage((page) => Math.max(1, page - 1))}
                  className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Previous
                </button>
                <span className="px-2 text-sm font-medium text-zinc-600 dark:text-zinc-400">
                  Page {effectiveCatalogPage} of {totalCatalogPages}
                </span>
                <button
                  type="button"
                  disabled={effectiveCatalogPage >= totalCatalogPages}
                  onClick={() =>
                    setCatalogPage((page) =>
                      Math.min(totalCatalogPages, page + 1),
                    )
                  }
                  className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}
        <AddProblemDialog
          problemOptions={problemOptions}
          returnTo="/problems"
          initialFrontendId={selectedFrontendId}
          open={rowDialogOpen}
          onOpenChange={(isOpen) => {
            setRowDialogOpen(isOpen);

            if (!isOpen) {
              setSelectedFrontendId(null);
            }
          }}
          showTrigger={false}
        />
      </div>
    </div>
  );
}
