"use client";

import { useState } from "react";
import { Activity, ChevronDown, ChevronUp } from "lucide-react";
import { DifficultyBadge, ProblemTitleLink } from "@/components/problem-table-primitives";
import type { RecentActivityItem, RecentActivitySnapshot } from "@/lib/recent-activity";

function ActivityRow({ item }: { item: RecentActivityItem }) {
  return (
    <li className="px-5 py-2.5 sm:px-6">
      <div className="flex min-w-0 flex-wrap items-center justify-between gap-x-4 gap-y-1.5">
        <div className="min-w-0 flex-[1_1_18rem] text-sm leading-5">
          <ProblemTitleLink
            title={item.title}
            frontendId={item.frontendId}
            leetcodeUrl={item.leetcodeUrl}
            truncate={false}
          />
        </div>
        <div className="flex w-full min-w-0 flex-wrap items-center gap-1.5 text-xs text-zinc-500 sm:w-auto sm:shrink-0 dark:text-zinc-400">
          <span>{item.reviewedAtLabel}</span>
          <span aria-hidden="true">·</span>
          <span>{item.kind === "new" ? "New" : "Review"}</span>
          {item.difficulty ? (
            <>
              <span aria-hidden="true">·</span>
              <DifficultyBadge difficulty={item.difficulty} className="capitalize" />
            </>
          ) : null}
        </div>
      </div>
    </li>
  );
}

export function RecentActivityCard({ snapshot }: { snapshot: RecentActivitySnapshot }) {
  const [expanded, setExpanded] = useState(false);
  const visibleItems = expanded ? snapshot.items : snapshot.items.slice(0, 3);
  const canExpand = snapshot.items.length > 3;

  return (
    <section
      data-recent-activity
      className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-center gap-3 px-5 py-4 sm:px-6">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300">
          <Activity className="h-4 w-4" aria-hidden="true" />
        </span>
        <div>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">Recent Activity</h2>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">Your latest in-app practice</p>
        </div>
      </div>

      {snapshot.items.length === 0 ? (
        <div className="border-t border-zinc-200 px-5 py-6 sm:px-6 dark:border-zinc-800">
          <p className="text-sm font-semibold text-zinc-900 dark:text-zinc-100">No practice activity yet</p>
          <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
            Complete your first problem to see your activity here.
          </p>
        </div>
      ) : (
        <>
          <ul className="divide-y divide-zinc-200 border-t border-zinc-200 dark:divide-zinc-800 dark:border-zinc-800">
            {visibleItems.map((item) => <ActivityRow key={item.id} item={item} />)}
          </ul>
          {canExpand ? (
            <div className="border-t border-zinc-200 px-5 py-2.5 text-center sm:px-6 dark:border-zinc-800">
              <button
                type="button"
                onClick={() => setExpanded((value) => !value)}
                aria-expanded={expanded}
                className="inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium text-zinc-600 transition hover:bg-zinc-100 hover:text-zinc-950 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500 dark:text-zinc-300 dark:hover:bg-zinc-800 dark:hover:text-white"
              >
                {expanded ? "Show fewer" : "Show more"}
                {expanded ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
              </button>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
