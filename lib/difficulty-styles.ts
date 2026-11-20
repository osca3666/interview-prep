export const difficultyStyles = {
  easy: {
    badge:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300",
    chart: "fill-emerald-500 dark:fill-emerald-400",
    marker: "bg-emerald-500 dark:bg-emerald-400",
  },
  medium: {
    badge:
      "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300",
    chart: "fill-amber-500 dark:fill-amber-400",
    marker: "bg-amber-500 dark:bg-amber-400",
  },
  hard: {
    badge:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300",
    chart: "fill-red-500 dark:fill-red-400",
    marker: "bg-red-500 dark:bg-red-400",
  },
} as const;

export type CanonicalDifficulty = keyof typeof difficultyStyles;

export function normalizeDifficulty(value: string): CanonicalDifficulty | null {
  const normalized = value.trim().toLowerCase();
  return normalized === "easy" || normalized === "medium" || normalized === "hard"
    ? normalized
    : null;
}

export function getDifficultyBadgeClassName(difficulty: string) {
  const normalized = normalizeDifficulty(difficulty);
  return normalized
    ? difficultyStyles[normalized].badge
    : "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}
