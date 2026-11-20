"use client";

import { AlertTriangle } from "lucide-react";

export default function AnalyticsError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="rounded-lg border border-red-200 bg-white p-6 dark:border-red-900 dark:bg-zinc-900">
          <div className="flex h-10 w-10 items-center justify-center rounded-md bg-red-50 text-red-700 dark:bg-red-950/60 dark:text-red-300">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </div>
          <h1 className="mt-4 text-xl font-semibold text-zinc-950 dark:text-zinc-100">Analytics could not load</h1>
          <p className="mt-2 text-sm leading-6 text-zinc-600 dark:text-zinc-400">Your practice data is unchanged. Try loading the page again.</p>
          <button type="button" onClick={reset} className="mt-5 inline-flex h-10 items-center justify-center rounded-md bg-zinc-950 px-4 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white">
            Try again
          </button>
        </div>
      </section>
    </div>
  );
}
