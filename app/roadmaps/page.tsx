import {
  ArrowRight,
  CheckCircle2,
  Compass,
  Map as MapIcon,
  Shuffle,
} from "lucide-react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { RoadmapFollowControl } from "@/components/roadmap-follow-control";
import { getRoadmapsExperience } from "@/data/roadmaps";
import {
  partitionRoadmapCatalog,
  type RoadmapCatalogItem,
} from "@/lib/roadmaps";
import { createClient } from "@/lib/supabase/server";

function formatStudyDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

function ProgressBar({ roadmap }: { roadmap: RoadmapCatalogItem }) {
  return (
    <div>
      <div className="flex items-center justify-between gap-3 text-sm">
        <span className="font-medium tabular-nums text-zinc-700 dark:text-zinc-300">
          {roadmap.completedProblemCount} / {roadmap.totalProblemCount} completed
        </span>
        <span className="font-semibold tabular-nums text-zinc-950 dark:text-zinc-100">
          {roadmap.progressPercent}%
        </span>
      </div>
      <div
        className="mt-2 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-800"
        role="progressbar"
        aria-label={`${roadmap.name} progress`}
        aria-valuemin={0}
        aria-valuemax={roadmap.totalProblemCount}
        aria-valuenow={roadmap.completedProblemCount}
      >
        <div
          className="h-full rounded-full bg-violet-600 transition-[width] dark:bg-violet-400"
          style={{ width: `${roadmap.progressPercent}%` }}
        />
      </div>
    </div>
  );
}

export default async function RoadmapsPage() {
  const client = await createClient();
  const { data: claims, error: claimsError } = await client.auth.getClaims();
  const userId = claims?.claims?.sub;
  if (claimsError || !userId) redirect("/sign-in?next=/roadmaps");

  const result = await getRoadmapsExperience(client, userId);
  if (result.error || !result.data) {
    throw new Error("Failed to load roadmaps.");
  }

  const experience = result.data;
  const { featured, isSuggested, otherRoadmaps } = partitionRoadmapCatalog(
    experience.roadmaps,
    experience.effectiveFollowedRoadmapId,
  );
  const roadmapNames = new Map(
    experience.roadmaps.map((roadmap) => [roadmap.id, roadmap.name]),
  );
  const upcomingDescription = experience.upcomingEffectiveDate
    ? experience.upcomingFollowedRoadmapId
      ? `${roadmapNames.get(experience.upcomingFollowedRoadmapId) ?? "Your selected roadmap"} starts ${formatStudyDate(experience.upcomingEffectiveDate)}.`
      : `You will stop following a roadmap on ${formatStudyDate(experience.upcomingEffectiveDate)}.`
    : null;

  return (
    <div className="min-h-full bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="max-w-2xl">
          <p className="text-xs font-semibold uppercase text-violet-700 dark:text-violet-300">
            Roadmaps
          </p>
          <h1 className="mt-2 text-3xl font-semibold tracking-tight text-zinc-950 dark:text-white">
            Choose your path
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Follow one roadmap for automatic New-problem recommendations. Your progress is measured across every roadmap you practice.
          </p>
        </div>

        {upcomingDescription ? (
          <div className="mt-6 flex items-start gap-2 rounded-md border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800 dark:border-amber-900 dark:bg-amber-950/35 dark:text-amber-200">
            <Compass className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            <p>
              <span className="font-semibold">Upcoming change:</span>{" "}
              {upcomingDescription}
            </p>
          </div>
        ) : null}

        <section className="mt-8" aria-labelledby="current-roadmap-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <h2
                id="current-roadmap-heading"
                className="text-lg font-semibold text-zinc-950 dark:text-zinc-100"
              >
                {isSuggested ? "Suggested starting point" : "Currently following"}
              </h2>
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {isSuggested
                  ? "Start here, or explore any available roadmap below."
                  : "This roadmap supplies automatic New problems for your daily plan."}
              </p>
            </div>
          </div>

          {featured ? (
            <article className="mt-4 overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900">
              <div className="grid gap-6 p-5 md:grid-cols-[minmax(0,1fr)_18rem] md:p-6">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
                      <MapIcon className="h-4 w-4" aria-hidden="true" />
                    </span>
                    <span
                      className={`rounded-md px-2 py-1 text-xs font-semibold ${
                        isSuggested
                          ? "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300"
                          : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300"
                      }`}
                    >
                      {isSuggested ? "Suggested" : "Following"}
                    </span>
                    {!isSuggested ? (
                      <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 dark:text-zinc-400">
                        {experience.newSelectionMode === "shuffled" ? (
                          <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
                        ) : null}
                        {experience.newSelectionMode === "shuffled"
                          ? "Shuffled selection"
                          : "Sequential selection"}
                      </span>
                    ) : null}
                  </div>
                  <h3 className="mt-4 text-2xl font-semibold text-zinc-950 dark:text-white">
                    {featured.name}
                  </h3>
                  <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {featured.description}
                  </p>
                  {featured.isComplete ? (
                    <p className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                      <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                      Roadmap completed
                    </p>
                  ) : null}
                </div>

                <div className="flex flex-col justify-between gap-5 rounded-md border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-800 dark:bg-zinc-950/60">
                  <ProgressBar roadmap={featured} />
                  <div className="flex flex-wrap gap-2">
                    <Link
                      href={featured.href}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-zinc-950 px-3 text-sm font-semibold text-white outline-none transition hover:bg-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-400 dark:bg-white dark:text-zinc-950 dark:hover:bg-zinc-200"
                    >
                      {featured.isComplete ? "View roadmap" : "Continue roadmap"}
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <RoadmapFollowControl
                      roadmapId={featured.id}
                      roadmapName={featured.name}
                      desiredRoadmapId={isSuggested ? featured.id : null}
                      triggerLabel={isSuggested ? "Follow roadmap" : "Stop following"}
                      hasStudyPlanSettings={experience.hasStudyPlanSettings}
                      variant={isSuggested ? "primary" : "secondary"}
                    />
                  </div>
                </div>
              </div>
            </article>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
              No roadmap datasets are registered yet.
            </div>
          )}
        </section>

        <section className="mt-10" aria-labelledby="other-roadmaps-heading">
          <h2
            id="other-roadmaps-heading"
            className="text-lg font-semibold text-zinc-950 dark:text-zinc-100"
          >
            Other roadmaps
          </h2>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Browse any roadmap without changing what your daily plan follows.
          </p>

          {otherRoadmaps.length > 0 ? (
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              {otherRoadmaps.map((roadmap) => (
                <article
                  key={roadmap.id}
                  className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <h3 className="text-lg font-semibold text-zinc-950 dark:text-zinc-100">
                    {roadmap.name}
                  </h3>
                  <p className="mt-2 min-h-12 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
                    {roadmap.description}
                  </p>
                  <div className="mt-5">
                    <ProgressBar roadmap={roadmap} />
                  </div>
                  <div className="mt-5 flex flex-wrap gap-2">
                    <Link
                      href={roadmap.href}
                      className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:bg-zinc-800"
                    >
                      View roadmap
                      <ArrowRight className="h-4 w-4" aria-hidden="true" />
                    </Link>
                    <RoadmapFollowControl
                      roadmapId={roadmap.id}
                      roadmapName={roadmap.name}
                      desiredRoadmapId={roadmap.id}
                      triggerLabel="Follow"
                      hasStudyPlanSettings={experience.hasStudyPlanSettings}
                      variant="primary"
                    />
                  </div>
                </article>
              ))}
            </div>
          ) : (
            <div className="mt-4 rounded-lg border border-dashed border-zinc-300 bg-white p-6 dark:border-zinc-700 dark:bg-zinc-900">
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                More curated roadmaps are planned.
              </p>
              <p className="mt-1 text-sm leading-6 text-zinc-500 dark:text-zinc-400">
                NeetCode 150 is the only complete roadmap dataset currently registered. No placeholder memberships are shown.
              </p>
            </div>
          )}
        </section>
      </section>
    </div>
  );
}
