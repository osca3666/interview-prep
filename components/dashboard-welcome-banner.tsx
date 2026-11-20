export function DashboardWelcomeBanner({
  greeting,
}: {
  greeting: string;
}) {
  return (
    <section
      data-dashboard-welcome
      className="relative isolate min-h-32 overflow-hidden rounded-lg border border-violet-200/80 bg-[linear-gradient(110deg,#f5f3ff_0%,#fafafa_58%,#ecfeff_100%)] px-5 py-5 shadow-sm sm:px-7 dark:border-violet-900/70 dark:bg-[linear-gradient(110deg,#2e1065_0%,#18181b_58%,#083344_100%)]"
    >
      <div aria-hidden="true" className="pointer-events-none absolute -right-10 -top-20 h-56 w-56 rounded-full border-[28px] border-violet-300/20 dark:border-violet-500/10" />
      <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 right-32 hidden h-48 w-48 rounded-full border-[24px] border-cyan-300/15 sm:block dark:border-cyan-500/10" />

      <div className="relative z-10 flex min-h-20 flex-col justify-center gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="max-w-xl">
          <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
            Dashboard
          </p>
          <h1 className="mt-2 text-2xl font-semibold text-zinc-950 sm:text-3xl dark:text-white">
            {greeting}
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-700 dark:text-zinc-300">
            Keep building your momentum.
          </p>
        </div>

      </div>
    </section>
  );
}
