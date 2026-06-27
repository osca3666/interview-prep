"use client";

import { useEffect, useState } from "react";

type LocalDateProps = {
  value: string | null;
  fallback?: string;
};

function formatLocalDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(value));
}

export function LocalDate({ value, fallback = "" }: LocalDateProps) {
  const [formatted, setFormatted] = useState<string | null>(null);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      if (!value) {
        setFormatted(fallback);
        return;
      }

      setFormatted(formatLocalDate(value));
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, [fallback, value]);

  if (!value) {
    return fallback;
  }

  return (
    <time dateTime={value} suppressHydrationWarning>
      {formatted ?? "..."}
    </time>
  );
}
