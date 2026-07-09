"use client";

import { useMemo, useState } from "react";
import { addRoadmapProblemAction } from "@/app/roadmaps/actions";
import {
  DifficultyBadge,
  ProblemTitleLink,
} from "@/components/problem-table-primitives";
import { TimeZoneHiddenField } from "@/components/time-zone-hidden-field";
import {
  type RoadmapProblemRow,
  type RoadmapProblemStatus,
} from "@/data/roadmap-progress";

type RoadmapTableProps = {
  rows: RoadmapProblemRow[];
};

const nextStepLabels: Record<Exclude<RoadmapProblemStatus, "untracked">, string> = {
  planned: "Scheduled",
  reviewed: "Reviewed",
  strong: "Strong",
};

function getNextStepBadgeClassName(
  status: Exclude<RoadmapProblemStatus, "untracked">,
) {
  switch (status) {
    case "strong":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "reviewed":
      return "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300";
    case "planned":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
  }
}

export function RoadmapTable({ rows }: RoadmapTableProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const normalizedQuery = searchQuery.trim().toLowerCase();
  const filteredRows = useMemo(() => {
    if (!normalizedQuery) {
      return rows;
    }

    return rows.filter((row) => {
      const searchableText = [
        row.title,
        row.pattern,
        row.difficulty,
        row.status,
        row.status === "untracked" ? "Start today" : nextStepLabels[row.status],
      ]
        .join(" ")
        .toLowerCase();

      return searchableText.includes(normalizedQuery);
    });
  }, [normalizedQuery, rows]);
  const gridWidthClassName = "min-w-[64rem]";
  const gridTemplateClassName =
    "grid grid-cols-[4rem_minmax(18rem,1fr)_14rem_8rem_10rem]";
  const headerCellClassName =
    "flex items-center justify-center px-5 py-3 text-center whitespace-nowrap";
  const bodyCellClassName =
    "flex items-center justify-center px-5 py-4 text-center whitespace-nowrap";

  return (
    <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-col gap-4 border-b border-zinc-200 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-zinc-800">
        <div>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
            Roadmap problems
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            {rows.length} problems in roadmap order
          </p>
        </div>
        <div className="w-full sm:w-72">
          <label htmlFor="roadmap-search-neetcode-150" className="sr-only">
            Search roadmap
          </label>
          <input
            id="roadmap-search-neetcode-150"
            type="search"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search roadmap"
            className="block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
          />
        </div>
      </div>

      <div className="scrollbar-app overflow-x-auto">
        <div className="scrollbar-app min-h-[320px] max-h-[620px] overflow-y-auto">
          <div
            className={`${gridWidthClassName} ${gridTemplateClassName} sticky top-0 z-10 border-b border-zinc-200 bg-zinc-50 text-left text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400`}
            role="row"
          >
            <div className={headerCellClassName} role="columnheader">
              #
            </div>
            <div className="px-5 py-3" role="columnheader">
              Problem
            </div>
            <div className="px-5 py-3" role="columnheader">
              Pattern
            </div>
            <div className={headerCellClassName} role="columnheader">
              Difficulty
            </div>
            <div className={headerCellClassName} role="columnheader">
              Next step
            </div>
          </div>

          {filteredRows.length === 0 ? (
            <div className={`${gridWidthClassName} p-6`}>
              <h3 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                No roadmap problems match your search.
              </h3>
            </div>
          ) : (
            <div
              className={`${gridWidthClassName} divide-y divide-zinc-200 bg-white text-left text-sm dark:divide-zinc-800 dark:bg-zinc-900`}
              role="rowgroup"
            >
              {filteredRows.map((row) => (
                <div
                  key={row.slug}
                  className={`${gridTemplateClassName} hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40`}
                  role="row"
                >
                  <div
                    className={`${bodyCellClassName} font-medium text-zinc-500 dark:text-zinc-400`}
                    role="cell"
                  >
                    {row.order}
                  </div>
                  <div className="min-w-0 px-5 py-4" role="cell">
                    <ProblemTitleLink
                      title={row.title}
                      leetcodeUrl={row.leetcode_url}
                    />
                  </div>
                  <div
                    className="min-w-0 px-5 py-4 text-zinc-600 dark:text-zinc-400"
                    role="cell"
                  >
                    <div className="truncate" title={row.pattern}>
                      {row.pattern}
                    </div>
                  </div>
                  <div className={bodyCellClassName} role="cell">
                    <DifficultyBadge difficulty={row.difficulty} />
                  </div>
                  <div className={bodyCellClassName} role="cell">
                    {row.status === "untracked" ? (
                      <form action={addRoadmapProblemAction}>
                        <input
                          type="hidden"
                          name="roadmap_slug"
                          value={row.slug}
                        />
                        <input
                          type="hidden"
                          name="return_to"
                          value="/roadmaps/neetcode-150"
                        />
                        <TimeZoneHiddenField />
                        <button
                          type="submit"
                          className="inline-flex h-8 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-xs font-semibold text-zinc-700 transition hover:border-zinc-400 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-700"
                        >
                          Start today
                        </button>
                      </form>
                    ) : (
                      <span
                        className={[
                          "rounded-md border px-2 py-1 text-xs font-medium",
                          getNextStepBadgeClassName(row.status),
                        ].join(" ")}
                      >
                        {nextStepLabels[row.status]}
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
