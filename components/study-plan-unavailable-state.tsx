import { DatabaseZap } from "lucide-react";
import Link from "next/link";

export function StudyPlanUnavailableState() {
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-2xl px-5 py-16 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-amber-200 bg-white p-6 shadow-sm dark:border-amber-900 dark:bg-zinc-900">
          <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <DatabaseZap className="h-4 w-4" aria-hidden="true" />
          </span>
          <h1 className="mt-4 text-xl font-semibold text-zinc-950 dark:text-zinc-100">
            Study Plan settings are unavailable
          </h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            This database has not been upgraded for V1 Study Plan settings yet.
            Your existing daily workspace is still available.
          </p>
          <Link
            href="/dashboard"
            className="mt-5 inline-flex h-9 items-center justify-center rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white outline-none transition hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
          >
            Return to dashboard
          </Link>
        </div>
      </section>
    </div>
  );
}
