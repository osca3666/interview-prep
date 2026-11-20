import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { AnalyticsDashboard } from "@/components/analytics/analytics-dashboard";
import { getAnalyticsSnapshot } from "@/data/analytics";
import {
  createAnalyticsDemoSnapshot,
  isAnalyticsDemoEnabled,
} from "@/lib/analytics-demo-data";
import { createClient } from "@/lib/supabase/server";
import { hasTrustedAnalyticsVisualTestHeader } from "@/lib/visual-test-access";

type SearchParams = Promise<{ demo?: string | string[] }>;

export default async function AnalyticsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const requestHeaders = await headers();
  const isVisualTest = hasTrustedAnalyticsVisualTestHeader(requestHeaders);
  const params = await searchParams;

  if (isVisualTest) {
    return (
      <AnalyticsPageContent
        snapshot={createAnalyticsDemoSnapshot({ timeZone: "America/Denver" })}
        isDemo
      />
    );
  }

  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) redirect("/sign-in");

  const isDemo = isAnalyticsDemoEnabled(params.demo, process.env.NODE_ENV);
  const result = isDemo ? null : await getAnalyticsSnapshot(supabase, userId);
  if (!isDemo && (result?.error || !result?.data)) throw new Error("Failed to load analytics.");
  const snapshot = isDemo
    ? createAnalyticsDemoSnapshot({ timeZone: "America/Denver" })
    : result!.data!;

  return <AnalyticsPageContent snapshot={snapshot} isDemo={isDemo} />;
}

function AnalyticsPageContent({
  snapshot,
  isDemo,
}: {
  snapshot: ReturnType<typeof createAnalyticsDemoSnapshot>;
  isDemo: boolean;
}) {
  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-[90rem] px-5 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-3xl font-semibold text-zinc-950 dark:text-zinc-100">Your progress</h1>
              {isDemo ? <span className="rounded-md bg-violet-100 px-2 py-1 text-xs font-semibold text-violet-700 dark:bg-violet-950 dark:text-violet-300">Demo data</span> : null}
            </div>
            <p className="mt-1 text-base text-zinc-600 dark:text-zinc-400">See how your practice is adding up.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {isDemo ? <Link href="/analytics" className="rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm font-semibold text-zinc-700 transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800">Return to my data</Link> : null}
          </div>
        </div>

        <div className="mt-6">
          <AnalyticsDashboard snapshot={snapshot} />
        </div>
      </section>
    </div>
  );
}
