const futureFields = [
  "Target date",
  "Roadmap",
  "Weekly commitment",
  "Readiness",
];

export function CurrentGoalCard() {
  return (
    <section className="rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
      <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
          Current goal
        </h2>
      </div>

      <div className="px-5 py-3">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="max-w-2xl">
            <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
              No active prep goal yet
            </p>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Set a target date, roadmap, and weekly commitment when goal
              planning launches.
            </p>
          </div>

          <div className="grid gap-2 sm:grid-cols-2 lg:w-[28rem]">
            {futureFields.map((field) => (
              <div
                key={field}
                className="rounded-md border border-dashed border-zinc-200 bg-zinc-50/70 px-3 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/50"
              >
                <p className="text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-500">
                  {field}
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-500 dark:text-zinc-400">
                  Coming soon
                </p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
