import { Suspense } from "react";
import { redirect } from "next/navigation";
import { ConsistencyCard } from "@/components/consistency-card";
import { DashboardWelcomeBanner } from "@/components/dashboard-welcome-banner";
import { PracticeTrendCard } from "@/components/analytics/practice-trend-card";
import { RecentActivityCard } from "@/components/recent-activity-card";
import { TodaysStudyPlan } from "@/components/todays-study-plan";
import { RoadmapProgressCard } from "@/components/roadmap-progress-card";
import { StudyPlanSummaryCard } from "@/components/study-plan-summary-card";
import { ToastMessage } from "@/components/toast-message";
import { getConsistencySnapshot } from "@/data/consistency";
import { getAnalyticsSnapshot } from "@/data/analytics";
import { getRoadmapProgress } from "@/data/roadmap-progress";
import { getRecentActivity } from "@/data/recent-activity";
import { getStudyPlanSettingsOverview } from "@/data/study-settings";
import { getStudyWorkspaceRevision } from "@/lib/daily-study-plan-view";
import { getDailyStudyWorkspace, getTodaysDailyStudyPlan } from "@/data/daily-study-plans";
import { getLeetCodeProblemSearchOptions } from "@/lib/leetcode-catalog";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function getFirstParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getDisplayName(claims: unknown) {
  if (!claims || typeof claims !== "object") return null;
  const metadata = (claims as Record<string, unknown>).user_metadata;
  if (!metadata || typeof metadata !== "object") return null;
  const values = metadata as Record<string, unknown>;

  for (const key of ["display_name", "full_name", "name"]) {
    const value = values[key];
    if (typeof value === "string" && value.trim()) {
      return value.trim().split(/\s+/)[0];
    }
  }

  return null;
}

function getGreeting(claims: unknown, timeZone: string, referenceTime: Date) {
  const displayName = getDisplayName(claims);
  if (displayName) return `Welcome back, ${displayName}!`;

  const hourPart = new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    hourCycle: "h23",
    timeZone,
  }).formatToParts(referenceTime).find((part) => part.type === "hour")?.value;
  const hour = Number(hourPart ?? 12);
  if (hour < 12) return "Good morning!";
  if (hour < 18) return "Good afternoon!";
  return "Good evening!";
}

function getDashboardMessage(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "added":
      return "Problem tracked.";
    case "reviewed":
      return "Review saved.";
    case "snoozed":
      return "Review snoozed until tomorrow.";
    default:
      return null;
  }
}

function getDashboardError(value: string | string[] | undefined) {
  switch (getFirstParam(value)) {
    case "already_added":
      return "You're already tracking this problem.";
    case "invalid_form":
      return "Check the problem details and try again.";
    case "invalid_rating":
      return "Choose a valid rating.";
    case "invalid_date":
      return "Choose a valid date.";
    case "invalid_time_zone":
      return "Could not detect a valid timezone. Please refresh and try again.";
    case "invalid_url":
      return "Enter a valid LeetCode problem URL.";
    case "invalid_problem":
      return "Choose a valid LeetCode problem from the catalog.";
    case "invalid_submission":
      return "Choose a valid review rating.";
    case "problem_not_due":
      return "This problem is no longer available for review.";
    case "not_found":
      return "This problem is no longer available.";
    case "problem_not_active":
      return "This problem is no longer active.";
    case "stale_review":
      return "This problem was already reviewed or changed. Your queue has been refreshed.";
    case "save_failed":
      return "We could not save that change. Please try again.";
    default:
      return null;
  }
}

export default async function Dashboard({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (claimsError || !userId) {
    redirect("/sign-in");
  }

  const referenceTime = new Date();

  const [
    { error, message },
    persistedPlanResult,
    roadmapProgressResult,
    consistencyResult,
    studySettingsResult,
    analyticsResult,
  ] =
    await Promise.all([
      searchParams,
      getTodaysDailyStudyPlan(supabase, userId),
      getRoadmapProgress(supabase, userId),
      getConsistencySnapshot(supabase, userId, referenceTime),
      getStudyPlanSettingsOverview(supabase, userId, referenceTime),
      getAnalyticsSnapshot(supabase, userId, referenceTime),
    ]);

  if (roadmapProgressResult.error) {
    throw new Error("Failed to load roadmap progress.");
  }

  if (consistencyResult.error) {
    throw new Error("Failed to load consistency progress.");
  }

  if (studySettingsResult.error || !studySettingsResult.data) {
    throw new Error("Failed to load study plan settings.");
  }

  if (analyticsResult.error || !analyticsResult.data) {
    throw new Error("Failed to load practice analytics.");
  }

  const pageMessage = getDashboardMessage(message);
  const pageError = pageMessage ? null : getDashboardError(error);
  const workspaceResult = persistedPlanResult.data
    ? await getDailyStudyWorkspace(supabase, userId, persistedPlanResult.data)
    : null;
  const workspace = workspaceResult?.data ?? null;
  const roadmapProgress = roadmapProgressResult.data;
  const consistency = consistencyResult.data;
  const problemOptions = getLeetCodeProblemSearchOptions();

  if (!roadmapProgress || !consistency) {
    throw new Error("Failed to load dashboard progress.");
  }

  const recentActivityResult = await getRecentActivity(
    supabase,
    userId,
    consistency.timeZone,
    referenceTime,
  );
  if (recentActivityResult.error || !recentActivityResult.data) {
    throw new Error("Failed to load recent activity.");
  }

  const greeting = getGreeting(data?.claims, consistency.timeZone, referenceTime);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="dashboard-layout-container mx-auto w-full max-w-[90rem] px-5 py-10 sm:px-6 lg:px-8">
        <DashboardWelcomeBanner greeting={greeting} />

        {pageMessage ? (
          <Suspense fallback={null}>
            <ToastMessage
              key={`message-${getFirstParam(message) ?? pageMessage}`}
              message={pageMessage}
              queryKey={getFirstParam(message) ?? ""}
              tone="success"
            />
          </Suspense>
        ) : null}

        {pageError ? (
          <Suspense fallback={null}>
            <ToastMessage
              key={`error-${getFirstParam(error) ?? pageError}`}
              message={pageError}
              queryKey={getFirstParam(error) ?? ""}
              tone="error"
            />
          </Suspense>
        ) : null}

        <div data-dashboard-layout className="dashboard-workspace mt-6">
          <div data-dashboard-primary className="dashboard-primary-stack">
            <div data-dashboard-today className="dashboard-today">
              <TodaysStudyPlan
                key={getStudyWorkspaceRevision(workspace)}
                initialWorkspace={workspace}
                problemOptions={problemOptions}
              />
            </div>
            <div data-dashboard-trend className="dashboard-trend">
              <PracticeTrendCard snapshot={analyticsResult.data} />
            </div>
            <div data-dashboard-recent className="dashboard-recent">
              <RecentActivityCard snapshot={recentActivityResult.data} />
            </div>
          </div>

          <aside
            data-dashboard-rail
            className="dashboard-supporting-rail"
            aria-label="Dashboard overview"
          >
            <ConsistencyCard snapshot={consistency} />
            <RoadmapProgressCard progress={roadmapProgress} />
            <StudyPlanSummaryCard
              settingsAvailable={studySettingsResult.data.v1Available}
              settings={studySettingsResult.data.latest}
              effectiveSettings={studySettingsResult.data.effective}
              currentStudyDate={studySettingsResult.data.currentStudyDate}
              roadmaps={studySettingsResult.data.roadmaps}
              persistedPlan={persistedPlanResult.data}
            />
          </aside>
        </div>
      </section>
    </div>
  );
}
