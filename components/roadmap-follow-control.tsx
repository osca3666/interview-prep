"use client";

import { CalendarClock, LoaderCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { changeFollowedRoadmapAction } from "@/app/roadmaps/actions";

type RoadmapFollowControlProps = {
  roadmapId: string;
  roadmapName: string;
  desiredRoadmapId: string | null;
  triggerLabel: string;
  hasStudyPlanSettings: boolean;
  variant?: "primary" | "secondary";
};

const errorMessages: Record<string, string> = {
  invalid_roadmap: "That roadmap is no longer available. Refresh and try again.",
  invalid_settings: "Check your study plan settings and try again.",
  existing_plan_not_v1:
    "Today uses the previous planner. Choose Start tomorrow instead.",
  not_authenticated: "Your session expired. Sign in and try again.",
  settings_required: "Set up your study plan before following a roadmap.",
  save_failed: "We could not update your roadmap. Please try again.",
};

export function RoadmapFollowControl({
  roadmapId,
  roadmapName,
  desiredRoadmapId,
  triggerLabel,
  hasStudyPlanSettings,
  variant = "secondary",
}: RoadmapFollowControlProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const panelId = `roadmap-follow-${roadmapId}`;
  const isStopping = desiredRoadmapId === null;

  if (!hasStudyPlanSettings) {
    return (
      <Link
        href="/study-plan/setup"
        className="inline-flex h-9 items-center justify-center rounded-md bg-violet-600 px-3 text-sm font-semibold text-white outline-none transition hover:bg-violet-700 focus-visible:ring-2 focus-visible:ring-violet-300"
      >
        Set up study plan
      </Link>
    );
  }

  function submit(applyWhen: "today" | "tomorrow") {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await changeFollowedRoadmapAction({
        roadmapId: desiredRoadmapId,
        applyWhen,
      });

      if (!result.ok) {
        setError(errorMessages[result.error] ?? errorMessages.save_failed);
        return;
      }

      setMessage(
        applyWhen === "today"
          ? isStopping
            ? "You stopped following this roadmap."
            : `You are now following ${roadmapName}.`
          : isStopping
            ? "The roadmap change will start tomorrow."
            : `${roadmapName} will become your roadmap tomorrow.`,
      );
      setOpen(false);
      router.refresh();
    });
  }

  const triggerClassName =
    variant === "primary"
      ? "bg-violet-600 text-white hover:bg-violet-700 focus-visible:ring-violet-300"
      : "border border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400 hover:bg-zinc-50 focus-visible:ring-zinc-300 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-200 dark:hover:border-zinc-600 dark:hover:bg-zinc-800 dark:focus-visible:ring-zinc-700";

  return (
    <div className="min-w-0">
      <button
        type="button"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => {
          setOpen((current) => !current);
          setError(null);
          setMessage(null);
        }}
        className={`inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-semibold outline-none transition focus-visible:ring-2 ${triggerClassName}`}
      >
        {triggerLabel}
      </button>

      {open ? (
        <div
          id={panelId}
          className="mt-3 max-w-md rounded-md border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-700 dark:bg-zinc-950/70"
        >
          <div className="flex items-start gap-2">
            <CalendarClock
              className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-300"
              aria-hidden="true"
            />
            <div>
              <p className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                {isStopping ? "When should this change start?" : `Follow ${roadmapName}`}
              </p>
              <p className="mt-1 text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                Apply today reconciles only pending automatic assignments. Completed and manually added work stays intact.
              </p>
            </div>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("today")}
              className="inline-flex h-9 items-center justify-center rounded-md bg-violet-600 px-3 text-sm font-semibold text-white outline-none transition hover:bg-violet-700 focus-visible:ring-2 focus-visible:ring-violet-300 disabled:cursor-wait disabled:opacity-60"
            >
              {pending ? (
                <LoaderCircle className="mr-1.5 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              Apply today
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => submit("tomorrow")}
              className="inline-flex h-9 items-center justify-center rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-700 outline-none transition hover:bg-zinc-50 focus-visible:ring-2 focus-visible:ring-zinc-300 disabled:cursor-wait disabled:opacity-60 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
            >
              Start tomorrow
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={() => setOpen(false)}
              className="h-9 px-2 text-sm font-medium text-zinc-500 outline-none hover:text-zinc-800 focus-visible:ring-2 focus-visible:ring-zinc-300 dark:text-zinc-400 dark:hover:text-zinc-200"
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="mt-2 text-xs text-red-700 dark:text-red-300" role="alert">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="mt-2 text-xs text-emerald-700 dark:text-emerald-300" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
