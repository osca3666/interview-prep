"use client";

import type { ReactNode } from "react";
import {
  AlarmClockOff,
  Check,
  CircleAlert,
  Clock3,
} from "lucide-react";
import {
  DifficultyBadge,
  ProblemTitleLink,
} from "@/components/problem-table-primitives";
import type { StudyPlanDisplayTask } from "@/lib/daily-study-plan-view";

export type StudyTaskRowAction =
  | "resolved"
  | "practice_new"
  | "review"
  | "scheduled"
  | "unavailable";

type StudyTaskRowProps = {
  task: StudyPlanDisplayTask;
  action: StudyTaskRowAction;
  scheduledText?: string;
  actionControl?: ReactNode;
  skipAction?: ReactNode;
  optimisticCompleted?: boolean;
};

function getTaskLabel(task: StudyPlanDisplayTask) {
  if (task.kind === "review" || task.kind === "calibration") return "Review";
  return "New";
}

function TaskControl({
  task,
  action,
  actionControl,
}: Pick<
  StudyTaskRowProps,
  | "task"
  | "action"
  | "actionControl"
>) {
  const interactive = action === "review" || action === "practice_new";

  if (interactive) {
    return actionControl ?? null;
  }

  if (action === "resolved") {
    const completed = task.status === "completed";
    return (
      <span
        className={`inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${
          completed
            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/70 dark:text-emerald-300"
            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
        }`}
      >
        {completed ? (
          <Check className="h-3.5 w-3.5" aria-hidden="true" />
        ) : (
          <AlarmClockOff className="h-3.5 w-3.5" aria-hidden="true" />
        )}
        <span className="sr-only">{completed ? "Completed" : "Deferred"}</span>
      </span>
    );
  }

  return (
    <span
      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
      aria-label={action === "scheduled" ? "Scheduled" : "Unavailable"}
    >
      {action === "scheduled" ? (
        <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <CircleAlert className="h-3.5 w-3.5" aria-hidden="true" />
      )}
    </span>
  );
}

export function StudyTaskRow({
  task,
  action,
  scheduledText,
  actionControl,
  skipAction,
  optimisticCompleted = false,
}: StudyTaskRowProps) {
  const resolved = action === "resolved";
  const completed = task.status === "completed" || optimisticCompleted;
  const statusText =
    action === "scheduled"
          ? scheduledText ?? "Scheduled"
          : action === "unavailable"
            ? "Unavailable"
            : null;

  return (
    <li
      data-study-task-row={task.id}
      className={`min-w-0 ${
        resolved || optimisticCompleted
          ? "bg-zinc-50/70 dark:bg-zinc-950/30"
          : "bg-white dark:bg-zinc-900"
      }`}
    >
      <div className="grid min-w-0 grid-cols-[2.25rem_minmax(0,1fr)] items-center gap-x-3 gap-y-1 px-4 py-3 sm:grid-cols-[2.25rem_minmax(0,1fr)_auto] sm:px-5">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center">
          <TaskControl
            task={task}
            action={action}
            actionControl={actionControl}
          />
        </div>

        <div
          className={`min-w-0 flex-1 text-left text-sm leading-5 [&_a]:line-clamp-2 ${
            completed ? "[&_a]:line-through [&_a]:decoration-1 [&_a]:decoration-zinc-400 dark:[&_a]:decoration-zinc-500" : ""
          }`}
        >
          <ProblemTitleLink
            title={task.title}
            frontendId={task.leetcode_frontend_id}
            leetcodeUrl={task.leetcode_url}
            truncate={false}
          />
        </div>

        <div className="col-start-2 row-start-2 flex shrink-0 items-center justify-start gap-2 whitespace-nowrap sm:col-start-3 sm:row-start-1 sm:justify-end">
          <span
            className={`text-xs font-medium ${
              task.kind === "review"
                ? "text-zinc-500 dark:text-zinc-400"
                : "text-violet-700 dark:text-violet-300"
            }`}
          >
            {getTaskLabel(task)}
          </span>
          <DifficultyBadge difficulty={task.difficulty} className="py-0.5" />
          {statusText ? (
            <span
              className={`text-xs font-medium ${
                task.status === "completed"
                  ? "text-emerald-700 dark:text-emerald-300"
                  : "text-zinc-500 dark:text-zinc-400"
              }`}
            >
              {statusText}
            </span>
          ) : null}
          {skipAction}
        </div>
      </div>

    </li>
  );
}
