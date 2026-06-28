type MasteryBoxesProps = {
  masteryScore: number;
};

export function MasteryBoxes({ masteryScore }: MasteryBoxesProps) {
  const safeScore = Math.max(0, Math.min(10, masteryScore));
  const filledBoxes = Math.floor(safeScore / 2);
  const isComplete = safeScore === 10;

  return (
    <div aria-label={`Mastery ${safeScore}/10`}>
      <div className="flex gap-1" aria-hidden="true">
        {Array.from({ length: 5 }, (_, index) => {
          const isFilled = index < filledBoxes;

          return (
            <span
              key={index}
              className={[
                "h-3 w-3 rounded-sm border transition",
                isFilled
                  ? "border-emerald-600 bg-emerald-500"
                  : "border-zinc-300 bg-white",
                isComplete && isFilled ? "shadow-[0_0_8px_rgba(16,185,129,0.45)]" : "",
              ].join(" ")}
            />
          );
        })}
      </div>
    </div>
  );
}
