import { ArrowRight, CalendarClock, CircleAlert } from "lucide-react";
import Link from "next/link";
import type {
  EffectiveStudyPlanSettings,
  SavedStudyPlanSettings,
  StudyRoadmapOption,
} from "@/data/study-settings";
import type { PersistedDailyStudyPlan } from "@/lib/daily-study-plan-view";

type StudyPlanSummaryCardProps = {
  settingsAvailable?: boolean;
  settings: SavedStudyPlanSettings | null;
  effectiveSettings: EffectiveStudyPlanSettings | null;
  currentStudyDate: string | null;
  roadmaps: StudyRoadmapOption[];
  persistedPlan: PersistedDailyStudyPlan | null;
};

function countTasks(
  persistedPlan: PersistedDailyStudyPlan | null,
  category: "new" | "review",
  source?: "generated" | "manual",
) {
  return (persistedPlan?.tasks ?? []).filter((task) => {
    const matchesCategory = category === "new"
      ? task.kind === "new_problem"
      : task.kind !== "new_problem";
    return matchesCategory && (!source || task.assignment_source === source);
  }).length;
}

function formatDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

export function StudyPlanSummaryCard({
  settingsAvailable = true,
  settings,
  effectiveSettings,
  currentStudyDate,
  roadmaps,
  persistedPlan,
}: StudyPlanSummaryCardProps) {
  const roadmapNames = new Map(roadmaps.map((roadmap) => [roadmap.id, roadmap.name]));

  if (!settingsAvailable) {
    return (
      <section
        data-dashboard-card="study-plan"
        className="rounded-lg border border-amber-200 bg-white p-4 shadow-sm dark:border-amber-900 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-amber-50 text-amber-700 dark:bg-amber-950/50 dark:text-amber-300">
            <CircleAlert className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
            My Study Plan
          </h2>
        </div>
        <p className="mt-3 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
          Your daily workspace is available, but V1 Study Plan settings are not installed in this database.
        </p>
      </section>
    );
  }

  if (!settings) {
    return (
      <section
        data-dashboard-card="study-plan"
        className="rounded-lg border border-violet-200 bg-white p-4 shadow-sm dark:border-violet-900 dark:bg-zinc-900"
      >
        <div className="flex items-center gap-2.5">
          <span className="inline-flex h-8 w-8 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <CalendarClock className="h-4 w-4" aria-hidden="true" />
          </span>
          <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
            My Study Plan
          </h2>
        </div>
        <p className="mt-3 text-sm leading-5 text-zinc-600 dark:text-zinc-400">
          Choose your daily workload and where New and Review problems should come from.
        </p>
        <Link
          href="/study-plan/setup"
          className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-violet-700 outline-none transition hover:text-violet-900 focus-visible:ring-2 focus-visible:ring-violet-300 dark:text-violet-300 dark:hover:text-violet-200"
        >
          Set up study plan
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </Link>
      </section>
    );
  }

  const generatedNew = countTasks(persistedPlan, "new", "generated");
  const manualNew = countTasks(persistedPlan, "new", "manual");
  const generatedReviews = countTasks(persistedPlan, "review", "generated");
  const manualReviews = countTasks(persistedPlan, "review", "manual");
  const plan = persistedPlan?.plan ?? null;
  const planUsesEffectiveSettings = Boolean(
    plan?.selection_version === "v1-policy"
    && effectiveSettings
    && plan.settings_revision_id === effectiveSettings.revision_id,
  );
  const scheduled = Boolean(
    currentStudyDate && settings.effectiveStudyDate > currentStudyDate,
  );
  const displayedSettings = scheduled && effectiveSettings
    ? {
        dailyNewTarget: effectiveSettings.daily_new_target,
        dailyReviewTarget: effectiveSettings.daily_review_target,
        followedRoadmapId: effectiveSettings.followed_roadmap_id,
        newSelectionMode: effectiveSettings.new_selection_mode,
        reviewSource: effectiveSettings.review_source,
        reviewRoadmapIds: effectiveSettings.review_roadmap_ids,
      }
    : settings;
  const newSource = displayedSettings.followedRoadmapId
    ? roadmapNames.get(displayedSettings.followedRoadmapId) ?? "Selected roadmap"
    : roadmapNames.get("neetcode-150") ?? "Suggested roadmap";
  const reviewSource = displayedSettings.reviewSource === "all"
    ? "All practiced problems"
    : displayedSettings.reviewRoadmapIds
      .map((id) => roadmapNames.get(id) ?? id)
      .join(", ");

  return (
    <section
      data-dashboard-card="study-plan"
      className="rounded-lg border border-zinc-200 bg-white p-4 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="flex items-start gap-2.5">
        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sky-50 text-sky-700 dark:bg-sky-950/50 dark:text-sky-300">
          <CalendarClock className="h-4 w-4" aria-hidden="true" />
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
              My Study Plan
            </h2>
            {scheduled ? (
              <span className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-semibold text-amber-700 dark:bg-amber-950/40 dark:text-amber-300">
                Starts {formatDate(settings.effectiveStudyDate)}
              </span>
            ) : null}
          </div>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            {displayedSettings.newSelectionMode === "shuffled" ? "Shuffled" : "Sequential"} New problems
          </p>
        </div>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-2">
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <dt className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            New target
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
            {displayedSettings.dailyNewTarget}
          </dd>
          <p className="mt-0.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
            {plan ? `${generatedNew} automatic${manualNew ? ` + ${manualNew} added` : ""}` : "Plan not opened yet"}
          </p>
        </div>
        <div className="rounded-md border border-zinc-200 bg-zinc-50 p-2.5 dark:border-zinc-800 dark:bg-zinc-950/60">
          <dt className="text-[11px] font-semibold uppercase text-zinc-500 dark:text-zinc-400">
            Review target
          </dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
            {displayedSettings.dailyReviewTarget}
          </dd>
          <p className="mt-0.5 text-[11px] leading-4 text-zinc-500 dark:text-zinc-400">
            {plan ? `${generatedReviews} automatic${manualReviews ? ` + ${manualReviews} added` : ""}` : "Plan not opened yet"}
          </p>
        </div>
      </dl>

      {planUsesEffectiveSettings && (plan!.new_problem_shortage_count > 0 || plan!.review_shortage_count > 0) ? (
        <p className="mt-3 flex items-start gap-1.5 text-xs leading-5 text-amber-700 dark:text-amber-300">
          <CircleAlert className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          Fewer problems were assigned today because eligible work ran out
          {plan!.review_shortage_count > 0
            ? ` (${plan!.review_shortage_count} review${plan!.review_shortage_count === 1 ? "" : "s"})`
            : ""}
          {plan!.new_problem_shortage_count > 0
            ? ` (${plan!.new_problem_shortage_count} new)`
            : ""}.
        </p>
      ) : null}

      <div className="mt-3 space-y-1 border-t border-zinc-200 pt-3 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
        <p className="truncate"><span className="font-medium text-zinc-700 dark:text-zinc-300">New:</span> {newSource}</p>
        <p className="truncate"><span className="font-medium text-zinc-700 dark:text-zinc-300">Reviews:</span> {reviewSource || "No roadmaps selected"}</p>
      </div>

      <Link
        href="/study-plan"
        className="mt-3 inline-flex w-full items-center justify-center gap-1.5 border-t border-zinc-200 pt-3 text-sm font-semibold text-violet-700 outline-none transition hover:text-violet-900 focus-visible:ring-2 focus-visible:ring-violet-300 dark:border-zinc-800 dark:text-violet-300 dark:hover:text-violet-200"
      >
        Edit study plan
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  );
}
