"use client";

import { CalendarDays, Check, Shuffle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { saveStudyPlanSettingsAction } from "@/app/study-settings/actions";
import type {
  SavedStudyPlanSettings,
  StudyRoadmapOption,
} from "@/data/study-settings";
import {
  MAX_DAILY_NEW_PROBLEMS,
  MAX_DAILY_REVIEWS,
  validateStudyPlanSettingsInput,
  type StudyPlanApplyWhen,
  type StudyPlanReviewSource,
  type StudyPlanSelectionMode,
} from "@/lib/study-plan-settings";

type StudyPlanSettingsFormProps = {
  mode: "setup" | "edit";
  roadmaps: StudyRoadmapOption[];
  initialSettings: SavedStudyPlanSettings | null;
  savedTimeZone: string | null;
  currentStudyDate: string | null;
};

const inputClass =
  "h-10 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-violet-400 dark:focus:ring-violet-950";

const errorMessages: Record<string, string> = {
  invalid_new_target: `Choose between 0 and ${MAX_DAILY_NEW_PROBLEMS} new problems.`,
  invalid_review_target: `Choose between 0 and ${MAX_DAILY_REVIEWS} reviews.`,
  invalid_new_source: "Choose an available roadmap for new problems.",
  invalid_selection_mode: "Choose sequential or shuffled selection.",
  invalid_review_source: "Choose at least one roadmap, or review all practiced problems.",
  invalid_apply_when: "Choose whether these settings start today or tomorrow.",
  invalid_time_zone: "We could not detect a valid timezone. Refresh and try again.",
  invalid_settings: "Check your study plan choices and try again.",
  invalid_roadmap: "One of those roadmaps is no longer available. Refresh and try again.",
  existing_plan_not_v1: "Today's plan uses the previous planner. Choose Start tomorrow to keep it unchanged.",
  not_authenticated: "Your session expired. Sign in and try again.",
  save_failed: "We could not save your study plan. Please try again.",
};

function detectTimeZone() {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
}

function ChoiceCard({
  checked,
  title,
  description,
  name,
  value,
  onChange,
}: {
  checked: boolean;
  title: string;
  description: string;
  name: string;
  value: string;
  onChange: () => void;
}) {
  return (
    <label
      className={`flex cursor-pointer gap-3 rounded-md border p-3 transition focus-within:ring-2 focus-within:ring-violet-300 ${
        checked
          ? "border-violet-500 bg-violet-50 dark:border-violet-400 dark:bg-violet-950/30"
          : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-950 dark:hover:border-zinc-700"
      }`}
    >
      <input
        type="radio"
        name={name}
        value={value}
        checked={checked}
        onChange={onChange}
        className="mt-0.5 h-4 w-4 accent-violet-600"
      />
      <span className="min-w-0">
        <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-100">
          {title}
        </span>
        <span className="mt-1 block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          {description}
        </span>
      </span>
    </label>
  );
}

export function StudyPlanSettingsForm({
  mode,
  roadmaps,
  initialSettings,
  savedTimeZone,
  currentStudyDate,
}: StudyPlanSettingsFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const submissionRef = useRef(false);
  const [dailyNewTarget, setDailyNewTarget] = useState(
    initialSettings?.dailyNewTarget ?? 1,
  );
  const [dailyReviewTarget, setDailyReviewTarget] = useState(
    initialSettings?.dailyReviewTarget ?? 3,
  );
  const [followedRoadmapId, setFollowedRoadmapId] = useState(
    initialSettings?.followedRoadmapId ?? "",
  );
  const [newSelectionMode, setNewSelectionMode] = useState<StudyPlanSelectionMode>(
    initialSettings?.newSelectionMode ?? "sequential",
  );
  const [reviewSource, setReviewSource] = useState<StudyPlanReviewSource>(
    initialSettings?.reviewSource ?? "all",
  );
  const [reviewRoadmapIds, setReviewRoadmapIds] = useState<string[]>(
    initialSettings?.reviewRoadmapIds ?? [],
  );
  const [applyWhen, setApplyWhen] = useState<StudyPlanApplyWhen>("today");
  const [timeZone, setTimeZone] = useState(savedTimeZone ?? "");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    if (savedTimeZone) return;
    const timeoutId = window.setTimeout(() => setTimeZone(detectTimeZone()), 0);
    return () => window.clearTimeout(timeoutId);
  }, [savedTimeZone]);

  const suggestedRoadmap = roadmaps.find((roadmap) => roadmap.id === "neetcode-150")
    ?? roadmaps[0]
    ?? null;
  const zeroPlan = dailyNewTarget === 0 && dailyReviewTarget === 0;

  function toggleReviewRoadmap(roadmapId: string) {
    setReviewRoadmapIds((current) =>
      current.includes(roadmapId)
        ? current.filter((id) => id !== roadmapId)
        : [...current, roadmapId],
    );
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submissionRef.current) return;
    const input = {
      dailyNewTarget,
      dailyReviewTarget,
      followedRoadmapId: followedRoadmapId || null,
      newSelectionMode,
      reviewSource,
      reviewRoadmapIds: reviewSource === "all" ? [] : reviewRoadmapIds,
      applyWhen,
      timeZone,
    };
    const validationError = validateStudyPlanSettingsInput(input);
    if (validationError) {
      setError(errorMessages[validationError]);
      return;
    }

    submissionRef.current = true;
    setError(null);
    setSuccess(null);
    startTransition(async () => {
      try {
        const result = await saveStudyPlanSettingsAction(input);
        if (!result.ok) {
          setError(errorMessages[result.error] ?? errorMessages.save_failed);
          return;
        }
        if (mode === "setup") {
          router.replace("/dashboard");
          return;
        }
        setSuccess(
          result.applyWhen === "today"
            ? "Your changes are active today."
            : "Your changes will start tomorrow.",
        );
        router.refresh();
      } finally {
        submissionRef.current = false;
      }
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="overflow-hidden rounded-lg border border-zinc-200 bg-white shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
    >
      <div className="border-b border-zinc-200 px-5 py-5 sm:px-6 dark:border-zinc-800">
        <div className="flex items-start gap-3">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-500/15 dark:text-violet-300">
            <CalendarDays className="h-4 w-4" aria-hidden="true" />
          </span>
          <div>
            <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
              {mode === "setup" ? "Build your daily plan" : "Plan settings"}
            </h2>
            <p className="mt-1 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
              Set a realistic workload. The planner only assigns problems that are actually available.
            </p>
          </div>
        </div>
      </div>

      <fieldset className="border-b border-zinc-200 px-5 py-5 sm:px-6 dark:border-zinc-800">
        <legend className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
          Daily workload
        </legend>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          These are targets, not quotas. Short plans stay short when there is less eligible work.
        </p>
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            New problems per day
            <input
              type="number"
              min={0}
              max={MAX_DAILY_NEW_PROBLEMS}
              step={1}
              value={dailyNewTarget}
              onChange={(event) => setDailyNewTarget(Number(event.target.value))}
              className={`${inputClass} mt-2`}
            />
            <span className="mt-1.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
              0-{MAX_DAILY_NEW_PROBLEMS}
            </span>
          </label>
          <label className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Reviews per day
            <input
              type="number"
              min={0}
              max={MAX_DAILY_REVIEWS}
              step={1}
              value={dailyReviewTarget}
              onChange={(event) => setDailyReviewTarget(Number(event.target.value))}
              className={`${inputClass} mt-2`}
            />
            <span className="mt-1.5 block text-xs font-normal text-zinc-500 dark:text-zinc-400">
              Reviews appear after you practice or import accepted problems.
            </span>
          </label>
        </div>
        {zeroPlan ? (
          <p className="mt-4 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs leading-5 text-amber-800 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-200">
            With both targets at zero, your automatic daily plan will be empty. You can still add problems manually.
          </p>
        ) : null}
      </fieldset>

      <fieldset className="border-b border-zinc-200 px-5 py-5 sm:px-6 dark:border-zinc-800">
        <legend className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
          New problems
        </legend>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          Choose where the next unseen problems should come from.
        </p>
        <label className="mt-4 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
          Roadmap source
          <select
            value={followedRoadmapId}
            onChange={(event) => setFollowedRoadmapId(event.target.value)}
            className={`${inputClass} mt-2`}
          >
            <option value="">
              {suggestedRoadmap
                ? `Suggested default: ${suggestedRoadmap.name}`
                : "Suggested roadmap unavailable"}
            </option>
            {roadmaps.map((roadmap) => (
              <option key={roadmap.id} value={roadmap.id}>
                Follow {roadmap.name} ({roadmap.problemCount} problems)
              </option>
            ))}
          </select>
        </label>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            checked={newSelectionMode === "sequential"}
            title="Sequential"
            description="Follow the roadmap's intended order."
            name="new-selection-mode"
            value="sequential"
            onChange={() => setNewSelectionMode("sequential")}
          />
          <ChoiceCard
            checked={newSelectionMode === "shuffled"}
            title="Shuffled"
            description="Vary the order while keeping selections repeatable."
            name="new-selection-mode"
            value="shuffled"
            onChange={() => setNewSelectionMode("shuffled")}
          />
        </div>
      </fieldset>

      <fieldset className="border-b border-zinc-200 px-5 py-5 sm:px-6 dark:border-zinc-800">
        <legend className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
          Review problems
        </legend>
        <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
          This choice is independent from your New problem roadmap.
        </p>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            checked={reviewSource === "all"}
            title="All practiced problems"
            description="Review every eligible problem in your Library."
            name="review-source"
            value="all"
            onChange={() => setReviewSource("all")}
          />
          <ChoiceCard
            checked={reviewSource === "selected_roadmaps"}
            title="Selected roadmaps only"
            description="Review eligible problems from specific roadmaps."
            name="review-source"
            value="selected_roadmaps"
            onChange={() => setReviewSource("selected_roadmaps")}
          />
        </div>
        {reviewSource === "selected_roadmaps" ? (
          <div className="mt-4 rounded-md border border-zinc-200 p-3 dark:border-zinc-800">
            <p className="text-xs font-semibold uppercase text-zinc-500 dark:text-zinc-400">
              Review roadmaps
            </p>
            {roadmaps.length ? (
              <div className="mt-3 grid gap-2 sm:grid-cols-2">
                {roadmaps.map((roadmap) => (
                  <label
                    key={roadmap.id}
                    className="flex items-center gap-2 rounded-md px-2 py-2 text-sm text-zinc-700 hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    <input
                      type="checkbox"
                      checked={reviewRoadmapIds.includes(roadmap.id)}
                      onChange={() => toggleReviewRoadmap(roadmap.id)}
                      className="h-4 w-4 rounded accent-violet-600"
                    />
                    <span className="min-w-0 flex-1 truncate">{roadmap.name}</span>
                    <span className="text-xs tabular-nums text-zinc-400">
                      {roadmap.problemCount}
                    </span>
                  </label>
                ))}
              </div>
            ) : (
              <p className="mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                No roadmaps are available yet.
              </p>
            )}
          </div>
        ) : null}
      </fieldset>

      <fieldset className="px-5 py-5 sm:px-6">
        <legend className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
          When should these settings start?
        </legend>
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <ChoiceCard
            checked={applyWhen === "today"}
            title="Apply today"
            description="Keep completed and manually added tasks; refresh pending automatic assignments."
            name="apply-when"
            value="today"
            onChange={() => setApplyWhen("today")}
          />
          <ChoiceCard
            checked={applyWhen === "tomorrow"}
            title="Start tomorrow"
            description="Leave today's plan unchanged and use these settings next study day."
            name="apply-when"
            value="tomorrow"
            onChange={() => setApplyWhen("tomorrow")}
          />
        </div>

        {initialSettings && currentStudyDate ? (
          <p className="mt-4 text-xs text-zinc-500 dark:text-zinc-400">
            Saved version {initialSettings.version} starts {initialSettings.effectiveStudyDate === currentStudyDate ? "today" : initialSettings.effectiveStudyDate}.
          </p>
        ) : null}

        <div aria-live="polite" className="mt-4 min-h-5 text-sm">
          {error ? <p className="text-red-700 dark:text-red-300">{error}</p> : null}
          {success ? (
            <p className="inline-flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <Check className="h-4 w-4" aria-hidden="true" />
              {success}
            </p>
          ) : null}
        </div>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-800">
          <p className="inline-flex items-center gap-1.5 text-xs text-zinc-500 dark:text-zinc-400">
            {newSelectionMode === "shuffled" ? (
              <Shuffle className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            Times follow {timeZone || "your detected timezone"}.
          </p>
          <button
            type="submit"
            disabled={pending || !timeZone}
            className="inline-flex h-10 items-center justify-center rounded-md bg-violet-600 px-4 text-sm font-semibold text-white transition hover:bg-violet-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-60 dark:focus-visible:ring-offset-zinc-900"
          >
            {pending
              ? "Saving..."
              : mode === "setup"
                ? "Create my study plan"
                : "Save study plan"}
          </button>
        </div>
      </fieldset>
    </form>
  );
}
