"use client";

import { useEffect, useState } from "react";

type DueDateTextProps = {
  value: string;
  variant?: "plain" | "badge";
};

type DueDateInfo = {
  text: string;
  state: "today" | "overdue" | "future";
};

function formatLocalDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

function getLocalDateParts(date: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const year = Number(parts.find((part) => part.type === "year")?.value);
  const month = Number(parts.find((part) => part.type === "month")?.value);
  const day = Number(parts.find((part) => part.type === "day")?.value);

  return { year, month, day };
}

function getLocalDayNumber(date: Date) {
  const { year, month, day } = getLocalDateParts(date);
  return Date.UTC(year, month - 1, day) / 86_400_000;
}

function getDueInfo(value: string): DueDateInfo {
  const dueDate = new Date(value);
  const dueDay = getLocalDayNumber(dueDate);
  const today = getLocalDayNumber(new Date());
  const diffDays = today - dueDay;
  const formatted = formatLocalDate(value);

  if (diffDays === 0) {
    return { text: `Due today (${formatted})`, state: "today" };
  }

  if (diffDays > 0) {
    return {
      text: `Overdue by ${diffDays} ${diffDays === 1 ? "day" : "days"} (${formatted})`,
      state: "overdue",
    };
  }

  return { text: `Due ${formatted}`, state: "future" };
}

function getBadgeClassName(state: DueDateInfo["state"]) {
  if (state === "overdue") {
    return "border-amber-200 bg-amber-50 text-amber-800";
  }

  if (state === "today") {
    return "border-zinc-200 bg-zinc-50 text-zinc-700";
  }

  return "border-sky-200 bg-sky-50 text-sky-800";
}

export function DueDateText({ value, variant = "plain" }: DueDateTextProps) {
  const [dueInfo, setDueInfo] = useState<DueDateInfo | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setDueInfo(getDueInfo(value));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  if (variant === "badge") {
    return (
      <span
        className={[
          "inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold",
          dueInfo ? getBadgeClassName(dueInfo.state) : "border-zinc-200 bg-zinc-50 text-zinc-500",
        ].join(" ")}
        suppressHydrationWarning
      >
        {dueInfo?.text ?? "..."}
      </span>
    );
  }

  return <span suppressHydrationWarning>{dueInfo?.text ?? "..."}</span>;
}
