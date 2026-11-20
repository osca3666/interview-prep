"use client";

import { useRef, useState } from "react";
import { AlarmClockOff, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import { snoozeReviewAction, submitReviewAction } from "@/app/review/actions";
import { TimeZoneHiddenField } from "@/components/time-zone-hidden-field";
import type { StudyTaskRating } from "@/lib/daily-study-plan-view";

const ratings = [
  { value: "bad", label: "Bad", Icon: ThumbsDown },
  { value: "ok", label: "OK", Icon: Minus },
  { value: "good", label: "Good", Icon: ThumbsUp },
] as const;

type Props = { disabled?: boolean } & ({
  problem: { id: string; schedule_version: number };
  returnTo: "/dashboard";
  timeZone?: string;
  newTask?: never;
  onRate?: never;
} | {
  newTask: { id: string; rate: (rating: StudyTaskRating) => Promise<void>; skip: () => Promise<void> };
  problem?: never;
  returnTo?: never;
  timeZone?: never;
  onRate?: never;
} | {
  onRate: (rating: StudyTaskRating) => Promise<void>;
  problem?: never;
  returnTo?: never;
  timeZone?: never;
  newTask?: never;
}) & {
  display?: "all" | "ratings" | "skip";
  onSubmissionStart?: () => boolean;
  onSubmissionEnd?: () => void;
};

export function ReviewTaskActions({
  problem,
  returnTo,
  timeZone,
  newTask,
  onRate,
  disabled = false,
  display = "all",
  onSubmissionStart,
  onSubmissionEnd,
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const submissionLock = useRef(false);

  async function submit(action: (data: FormData) => Promise<void>, data: FormData) {
    if (submissionLock.current || disabled) return;
    if (onSubmissionStart && !onSubmissionStart()) return;
    submissionLock.current = true;
    setSubmitting(true);
    try {
      // Use the existing Server Actions, including their redirects and error mapping.
      await action(data);
    } finally {
      submissionLock.current = false;
      setSubmitting(false);
      onSubmissionEnd?.();
    }
  }

  const fields = onRate ? null : newTask ? <input type="hidden" name="task_id" value={newTask.id} /> : <>
    <input type="hidden" name="return_to" value={returnTo} />
    <input type="hidden" name="user_problem_id" value={problem.id} />
    <input type="hidden" name="expected_schedule_version" value={problem.schedule_version} />
  </>;
  const showRatings = display !== "skip";
  const showSkip = !onRate && display !== "ratings";

  return (
    <div aria-busy={submitting}>
      {showRatings ? <div className="flex gap-2">
        {ratings.map(({ value, label, Icon }) => (
          <form key={value} action={(data) => submit(onRate ? () => onRate(value) : newTask ? () => newTask.rate(value) : submitReviewAction, data)} className="min-w-0 flex-1">
            {fields}
            <button type="submit" name="rating" value={value} disabled={disabled || submitting}
              className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-2 text-xs font-semibold text-zinc-700 transition hover:border-violet-400 hover:bg-violet-50 hover:text-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:border-violet-500 dark:hover:bg-violet-950 dark:hover:text-violet-200">
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />{label}
            </button>
          </form>
        ))}
      </div> : null}
      {showSkip ? <form action={(data) => submit(newTask ? newTask.skip : snoozeReviewAction, data)} className={showRatings ? "mt-2" : undefined}>
        {fields}
        {!newTask ? (timeZone ? <input type="hidden" name="time_zone" value={timeZone} /> : <TimeZoneHiddenField />) : null}
        <button type="submit" disabled={disabled || submitting}
          aria-label={display === "skip" ? "Skip today" : undefined}
          title={display === "skip" ? "Skip today" : undefined}
          className={`inline-flex h-8 items-center justify-center rounded-md text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-wait disabled:opacity-50 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-200 ${display === "skip" ? "w-8" : "w-full gap-1.5 px-2"}`}>
          <AlarmClockOff className="h-3.5 w-3.5" aria-hidden="true" />
          {display === "skip" ? <span className="sr-only">Skip today</span> : "Skip today"}
        </button>
      </form> : null}
    </div>
  );
}
