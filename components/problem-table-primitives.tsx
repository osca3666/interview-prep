type DifficultyBadgeProps = {
  difficulty: string;
  className?: string;
};

type ProblemTitleLinkProps = {
  title: string;
  leetcodeUrl?: string | null;
};

function getDifficultyBadgeClassName(difficulty: string) {
  switch (difficulty.toLowerCase()) {
    case "easy":
      return "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300";
    case "medium":
      return "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300";
    case "hard":
      return "border-red-200 bg-red-50 text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-300";
    default:
      return "border-zinc-200 bg-zinc-100 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
  }
}

export function DifficultyBadge({
  difficulty,
  className,
}: DifficultyBadgeProps) {
  return (
    <span
      className={[
        "rounded-md border px-2 py-1 text-xs font-medium",
        getDifficultyBadgeClassName(difficulty),
        className,
      ]
        .filter(Boolean)
        .join(" ")}
    >
      {difficulty}
    </span>
  );
}

export function ProblemTitleLink({
  title,
  leetcodeUrl,
}: ProblemTitleLinkProps) {
  if (leetcodeUrl) {
    return (
      <a
        href={leetcodeUrl}
        target="_blank"
        rel="noreferrer"
        title={title}
        className="block truncate font-semibold text-zinc-950 underline-offset-4 transition hover:text-sky-800 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 dark:text-zinc-100 dark:hover:text-sky-300 dark:focus-visible:ring-sky-800"
      >
        {title}
      </a>
    );
  }

  return (
    <div
      className="truncate font-semibold text-zinc-950 dark:text-zinc-100"
      title={title}
    >
      {title}
    </div>
  );
}
