import { getDifficultyBadgeClassName } from "@/lib/difficulty-styles";

type DifficultyBadgeProps = {
  difficulty: string;
  className?: string;
};

type ProblemTitleLinkProps = {
  title: string;
  leetcodeUrl?: string | null;
  frontendId?: string | null;
  truncate?: boolean;
};

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
  frontendId,
  truncate = true,
}: ProblemTitleLinkProps) {
  const displayTitle = frontendId ? `${frontendId}. ${title}` : title;
  const content = frontendId ? (
    <>
      <span className="text-zinc-500 dark:text-zinc-400">{frontendId}.</span>{" "}
      <span>{title}</span>
    </>
  ) : (
    title
  );
  const titleClassName = [
    "font-semibold text-zinc-950 dark:text-zinc-100",
    truncate ? "block truncate" : "block min-w-0",
  ].join(" ");

  if (leetcodeUrl) {
    return (
      <a
        href={leetcodeUrl}
        target="_blank"
        rel="noreferrer"
        title={displayTitle}
        className={`${titleClassName} transition hover:text-sky-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-200 dark:hover:text-sky-300 dark:focus-visible:ring-sky-800`}
      >
        {content}
      </a>
    );
  }

  return (
    <div
      className={titleClassName}
      title={displayTitle}
    >
      {content}
    </div>
  );
}
