"use client";

import { useEffect, useState } from "react";

type DueDateTextProps = {
  value: string;
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

function getDueText(value: string) {
  const dueDate = new Date(value);
  const dueDay = getLocalDayNumber(dueDate);
  const today = getLocalDayNumber(new Date());
  const diffDays = today - dueDay;
  const formatted = formatLocalDate(value);

  if (diffDays === 0) {
    return `Due today (${formatted})`;
  }

  if (diffDays > 0) {
    return `Overdue by ${diffDays} ${diffDays === 1 ? "day" : "days"} (${formatted})`;
  }

  return `Due ${formatted}`;
}

export function DueDateText({ value }: DueDateTextProps) {
  const [text, setText] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      setText(getDueText(value));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [value]);

  return <span suppressHydrationWarning>{text ?? "..."}</span>;
}
