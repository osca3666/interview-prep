function Skeleton({ className }: { className: string }) {
  return <div className={`motion-safe:animate-pulse rounded-md bg-zinc-200 dark:bg-zinc-800 ${className}`} />;
}

export default function AnalyticsLoading() {
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <section
        className="mx-auto w-full max-w-6xl px-5 py-8 sm:px-6 lg:px-8"
        aria-label="Loading analytics"
      >
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <Skeleton className="h-9 w-52" />
            <Skeleton className="mt-2 h-5 w-64 max-w-full" />
          </div>
          <Skeleton className="h-5 w-24" />
        </div>

        <div className="mt-6 grid gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <Skeleton key={index} className="h-28" />
          ))}
        </div>
        <Skeleton className="mt-4 h-[22rem]" />
        <Skeleton className="mt-4 h-48" />
        <Skeleton className="mt-4 h-16" />
      </section>
    </div>
  );
}
