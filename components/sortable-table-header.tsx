"use client";

import { ArrowDown, ArrowUp, ArrowUpDown } from "lucide-react";

export type SortDirection = "asc" | "desc";

export function SortableTableHeader({
  label,
  active,
  direction,
  align = "center",
  className,
  onSort,
}: {
  label: string;
  active: boolean;
  direction: SortDirection;
  align?: "left" | "center" | "right";
  className?: string;
  onSort: () => void;
}) {
  const Icon = active
    ? direction === "asc" ? ArrowUp : ArrowDown
    : ArrowUpDown;
  const alignment = align === "left"
    ? "justify-start text-left"
    : align === "right"
      ? "justify-end text-right"
      : "justify-center text-center";

  return (
    <div
      role="columnheader"
      aria-sort={active ? direction === "asc" ? "ascending" : "descending" : "none"}
      className={className}
    >
      <button
        type="button"
        onClick={onSort}
        className={`flex w-full items-center gap-1.5 rounded-sm transition hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:hover:text-zinc-100 ${alignment}`}
        aria-label={`Sort by ${label}`}
      >
        <span>{label}</span>
        <Icon className={`h-3.5 w-3.5 ${active ? "text-violet-600 dark:text-violet-300" : "text-zinc-400 dark:text-zinc-500"}`} aria-hidden="true" />
      </button>
    </div>
  );
}
