type MasteryBoxesProps = {
  masteryScore: number;
};

export function MasteryBoxes({ masteryScore }: MasteryBoxesProps) {
  const safeScore = Math.max(0, Math.min(10, masteryScore));
  const filledBoxes = Math.floor(safeScore / 2);
  const isComplete = safeScore === 10;
  const label = isComplete
    ? `Mastery ${safeScore}/10, fully mastered`
    : `Mastery ${safeScore}/10`;

  return (
    <div aria-label={label} title={label}>
      <div
        className={[
          "relative inline-flex overflow-hidden rounded-md p-[1px]",
          isComplete
            ? "shadow-[0_0_8px_rgba(16,185,129,0.18)] dark:shadow-[0_0_9px_rgba(110,231,183,0.16)]"
            : "",
        ].join(" ")}
        aria-hidden="true"
      >
        {isComplete ? (
          <span className="absolute -inset-3 bg-[conic-gradient(from_0deg,transparent_0deg,rgba(16,185,129,0.18)_70deg,rgba(245,158,11,0.55)_105deg,rgba(20,184,166,0.25)_140deg,transparent_210deg,transparent_360deg)] motion-safe:animate-[spin_4s_linear_infinite] motion-reduce:animate-none dark:bg-[conic-gradient(from_0deg,transparent_0deg,rgba(110,231,183,0.18)_70deg,rgba(251,191,36,0.5)_105deg,rgba(45,212,191,0.22)_140deg,transparent_210deg,transparent_360deg)]" />
        ) : null}
        <div className="relative flex items-center overflow-hidden rounded-[5px] border border-zinc-300 bg-white p-[1px] dark:border-zinc-700 dark:bg-zinc-900">
          {Array.from({ length: 5 }, (_, index) => {
            const isFilled = index < filledBoxes;

            return (
              <span
                key={index}
                className={[
                  "h-3 w-3 transition",
                  index === 0 ? "rounded-l-[3px]" : "",
                  index === 4 ? "rounded-r-[3px]" : "",
                  index > 0
                    ? "border-l border-white/70 dark:border-zinc-900/70"
                    : "",
                  isFilled
                    ? isComplete
                      ? "bg-emerald-400 dark:bg-emerald-300"
                      : "bg-teal-500 dark:bg-teal-400"
                    : "bg-zinc-100 dark:bg-zinc-800",
                ].join(" ")}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}
