"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { CheckCircle2, ChevronDown, ChevronUp, ListChecks, LoaderCircle, RefreshCw } from "lucide-react";
import { addRecommendedProblemToTodayAction, completeStudyTaskAction, correctStudyAttemptAction, deferStudyTaskAction, ensureTodayStudyPlanAction, rateNewStudyTaskAction } from "@/app/study-plan/actions";
import { ReviewTaskActions } from "@/components/review-task-actions";
import { InstantRatingControl } from "@/components/instant-rating-control";
import { StudyTaskRow } from "@/components/study-task-row";
import { TodayProblemQuickAdd } from "@/components/today-problem-quick-add";
import {
  getStudyPlanSummary, getStudyTaskAction, orderStudyPlanTasks,
  type DailyStudyWorkspace, type StudyTaskRating,
} from "@/lib/daily-study-plan-view";
import type { LeetCodeProblemSearchOption } from "@/lib/leetcode-catalog-types";
import type { ExtraStudyMode } from "@/lib/keep-studying";

const commandClass = "inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 text-sm font-semibold text-zinc-800 hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400 disabled:cursor-wait disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800";
const collapsedTaskLimit = 4;

function formatStudyDate(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) return value;
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day, 12)));
}

type TaskOperation = () => Promise<{ ok: boolean; error?: string }>;

function StudyTaskChecklist({
  workspace,
  tasks,
  optimisticTaskIds,
  submittingTaskId,
  disabled,
  onSubmissionStart,
  onSubmissionEnd,
  onRunTaskAction,
  onOptimisticChange,
  onRatingOpenChange,
  onAttemptFinished,
}: {
  workspace: DailyStudyWorkspace;
  tasks: DailyStudyWorkspace["tasks"];
  optimisticTaskIds: ReadonlySet<string>;
  submittingTaskId: string | null;
  disabled: boolean;
  onSubmissionStart: (taskId: string) => boolean;
  onSubmissionEnd: () => void;
  onRunTaskAction: (operation: TaskOperation) => Promise<void>;
  onOptimisticChange: (taskId: string, completed: boolean) => void;
  onRatingOpenChange: (taskId: string, open: boolean) => void;
  onAttemptFinished: (taskId: string, result: { completed: boolean; error?: string }) => Promise<void>;
}) {
  const liveProblems = new Map(
    workspace.liveProblems.map((problem) => [problem.id, problem]),
  );

  return (
    <ul className="-mx-4 mt-4 divide-y divide-zinc-200 border-y border-zinc-200 sm:-mx-5 dark:divide-zinc-800 dark:border-zinc-800">
      {tasks.map((task) => {
        const live = task.user_problem_id
          ? liveProblems.get(task.user_problem_id)
          : undefined;
        const action = getStudyTaskAction(task, live, workspace.asOf);
        const startSubmission = () => onSubmissionStart(task.id);
        const newTask = action === "practice_new" ? {
          id: task.id,
          rate: (rating: StudyTaskRating) =>
            onRunTaskAction(() => rateNewStudyTaskAction(task.id, rating)),
          skip: () =>
            onRunTaskAction(() => deferStudyTaskAction(task.id)),
        } : null;
        const interactive = action === "review" || action === "practice_new";
        const displayTitle = task.leetcode_frontend_id
          ? `${task.leetcode_frontend_id}. ${task.title}`
          : task.title;
        const actionControl = interactive ? (
          <InstantRatingControl
            id={task.id}
            label={displayTitle}
            disabled={disabled && submittingTaskId !== task.id}
            onBegin={startSubmission}
            onComplete={() => completeStudyTaskAction(task.id)}
            onCorrect={correctStudyAttemptAction}
            onOptimisticChange={(completed) => onOptimisticChange(task.id, completed)}
            onOpenChange={(open) => onRatingOpenChange(task.id, open)}
            onFinished={(result) => onAttemptFinished(task.id, result)}
          />
        ) : undefined;
        const skipAction = action === "review" && live ? (
          <ReviewTaskActions
            problem={live}
            returnTo="/dashboard"
            timeZone={workspace.plan.time_zone}
            display="skip"
            disabled={disabled}
            onSubmissionStart={startSubmission}
            onSubmissionEnd={onSubmissionEnd}
          />
        ) : newTask ? (
          <ReviewTaskActions
            newTask={newTask}
            display="skip"
            disabled={disabled}
            onSubmissionStart={startSubmission}
            onSubmissionEnd={onSubmissionEnd}
          />
        ) : undefined;
        const scheduledText = action === "scheduled" && live
          ? `Scheduled for ${new Intl.DateTimeFormat("en-US", {
              timeZone: workspace.plan.time_zone,
              month: "short",
              day: "numeric",
            }).format(new Date(live.next_review_at))}`
          : undefined;

        return (
          <StudyTaskRow
            key={task.id}
            task={task}
            action={action}
            scheduledText={scheduledText}
            actionControl={actionControl}
            skipAction={skipAction}
            optimisticCompleted={optimisticTaskIds.has(task.id)}
          />
        );
      })}
    </ul>
  );
}

export function TodaysStudyPlan({ initialWorkspace, problemOptions = [] }: {
  initialWorkspace: DailyStudyWorkspace | null;
  problemOptions?: LeetCodeProblemSearchOption[];
}) {
  const router = useRouter();
  const [workspace, setWorkspace] = useState(initialWorkspace);
  const [loading, setLoading] = useState(!initialWorkspace);
  const [error, setError] = useState<string | null>(null);
  const [signedOut, setSignedOut] = useState(false);
  const [submittingTaskId, setSubmittingTaskId] = useState<string | null>(null);
  const [optimisticTaskIds, setOptimisticTaskIds] = useState<Set<string>>(() => new Set());
  const [openRatingTaskId, setOpenRatingTaskId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [addingRecommendation, setAddingRecommendation] = useState(false);
  const [unavailableExtraModes, setUnavailableExtraModes] = useState<Set<ExtraStudyMode>>(() => new Set());
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [refreshingServerState, startServerRefresh] = useTransition();
  const mounted = useRef(false);
  const reloadPromise = useRef<Promise<void> | null>(null);
  const taskMutationLock = useRef(false);
  const currentPlanId = useRef(initialWorkspace?.plan.id ?? null);
  const refreshAfterInitialization = useRef(!initialWorkspace);

  const reload = useCallback(async (afterCurrent = false) => {
    if (reloadPromise.current) {
      await reloadPromise.current;
      if (!afterCurrent) return;
    }

    const request = (async () => {
      setLoading(true);
      try {
        let timeZone = "";
        try { timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone ?? ""; } catch { /* The saved timezone can still be reused. */ }
        const result = await ensureTodayStudyPlanAction(timeZone);
        if (!mounted.current) return;
        if (result.ok) {
          if (currentPlanId.current !== result.workspace.plan.id) {
            currentPlanId.current = result.workspace.plan.id;
            setUnavailableExtraModes(new Set());
          }
          setWorkspace(result.workspace);
          setError(null);
          setSignedOut(false);
          if (refreshAfterInitialization.current) {
            refreshAfterInitialization.current = false;
            startServerRefresh(() => router.refresh());
          }
        } else {
          setSignedOut(result.error === "not_authenticated");
          setError(result.error === "invalid_time_zone"
            ? "We couldn't detect your timezone. Refresh your browser and try again."
            : "We couldn't load your plan. Please try again.");
        }
      } catch {
        if (mounted.current) setError("We couldn't load your plan. Please try again.");
      } finally {
        if (mounted.current) setLoading(false);
      }
    })();

    reloadPromise.current = request;
    try {
      await request;
    } finally {
      if (reloadPromise.current === request) reloadPromise.current = null;
    }
  }, [router, startServerRefresh]);

  useEffect(() => {
    mounted.current = true;
    // Defer the initial request so Strict Mode cleanup cannot strand initialization.
    const initialization = window.setTimeout(() => { if (!initialWorkspace) void reload(); }, 0);
    const refreshVisible = () => {
      if (document.visibilityState === "visible" && !taskMutationLock.current) void reload();
    };
    window.addEventListener("focus", refreshVisible);
    document.addEventListener("visibilitychange", refreshVisible);
    const interval = window.setInterval(refreshVisible, 60_000);
    return () => {
      mounted.current = false;
      window.clearTimeout(initialization);
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshVisible);
      document.removeEventListener("visibilitychange", refreshVisible);
    };
  }, [initialWorkspace, reload]);

  useEffect(() => {
    if (!workspace) return;
    // Use the server clock interval, not the device timezone or a hardcoded 24-hour day.
    const remaining = Date.parse(workspace.plan.day_ends_at) - Date.parse(workspace.asOf);
    const timeout = window.setTimeout(() => { void reload(); }, Math.max(1000, remaining + 250));
    return () => window.clearTimeout(timeout);
  }, [workspace, reload]);

  function toggleTaskList() {
    if (!workspace) return;
    setExpandedPlanId((current) => current === workspace.plan.id ? null : workspace.plan.id);
  }

  function beginTaskSubmission(taskId: string) {
    if (taskMutationLock.current || loading || Boolean(error)) return false;
    taskMutationLock.current = true;
    setSubmittingTaskId(taskId);
    setNotice(null);
    return true;
  }

  function endTaskSubmission() {
    taskMutationLock.current = false;
    setSubmittingTaskId(null);
  }

  async function runTaskAction(operation: () => Promise<{ ok: boolean; error?: string }>) {
    try {
      const result = await operation();
      // Refresh on conflicts too; never retry a stale first rating as another review.
      await reload(true);
      router.refresh();
      if (!result.ok) setNotice(result.error === "task_changed"
        ? "This task changed in another tab. Your plan has been refreshed."
        : "We couldn't save that change. Your plan has been refreshed; please check it before trying again.");
    } catch {
      await reload(true);
      router.refresh();
      setNotice("We couldn't confirm that change. Please check the refreshed plan before trying again.");
    } finally { /* ReviewTaskActions releases the shared submission gate. */ }
  }

  function setOptimisticTask(taskId: string, completed: boolean) {
    setOptimisticTaskIds((current) => {
      const next = new Set(current);
      if (completed) next.add(taskId);
      else next.delete(taskId);
      return next;
    });
  }

  function setRatingOpen(taskId: string, open: boolean) {
    setOpenRatingTaskId((current) => open ? taskId : current === taskId ? null : current);
  }

  async function finishAttempt(
    taskId: string,
    result: { completed: boolean; error?: string },
  ) {
    try {
      await reload(true);
      router.refresh();
      if (result.error) {
        setNotice(result.completed
          ? "Your attempt was saved as OK, but the rating change could not be saved."
          : result.error === "task_changed"
            ? "This task changed in another tab. Your plan has been refreshed."
            : "We couldn't save that attempt. Your plan has been refreshed.");
      }
    } finally {
      setOptimisticTask(taskId, false);
      endTaskSubmission();
    }
  }

  async function handleProblemAdded() {
    setNotice(null);
    await reload();
  }

  async function requestExtraStudy(mode: ExtraStudyMode) {
    if (!workspace || addingRecommendation || taskMutationLock.current) return;
    setAddingRecommendation(true);
    setNotice(null);
    try {
      const result = await addRecommendedProblemToTodayAction(workspace.plan.id, mode);
      if (!result.ok) {
        if (result.error === "candidate_changed" || result.error === "plan_changed") {
          await reload();
          setNotice("Today's plan changed. It has been refreshed; choose another problem.");
        } else {
          setNotice(result.error === "not_authenticated"
            ? "Your session ended. Sign in again to continue."
            : "We couldn't add that recommendation. Please try again.");
        }
        return;
      }
      if (!result.added) {
        setUnavailableExtraModes((current) => new Set(current).add(mode));
        setNotice(mode === "review"
          ? "No additional practiced problems are available outside today's plan."
          : "Every NeetCode 150 problem is already practiced or assigned today.");
        return;
      }
      await reload();
      router.refresh();
    } catch {
      setNotice("We couldn't add that recommendation. Please try again.");
    } finally {
      setAddingRecommendation(false);
    }
  }

  const summary = workspace ? getStudyPlanSummary({
    plan: workspace.plan,
    tasks: workspace.tasks.map((task) => optimisticTaskIds.has(task.id)
      ? { ...task, status: "completed" }
      : task),
  }) : null;
  const reviewCount = workspace?.tasks.filter((task) => task.kind === "review").length ?? 0;
  const newCount = workspace?.tasks.filter((task) => task.kind === "new_problem").length ?? 0;
  const calibrationCount = workspace?.tasks.filter((task) => task.kind === "calibration").length ?? 0;
  const displayedReviewCount = reviewCount + calibrationCount;
  const resolved = summary?.state === "completed" || summary?.state === "resolved";
  const canKeepStudying = Boolean(workspace) && !addingRecommendation && submittingTaskId === null;
  const disabled = loading || refreshingServerState || addingRecommendation || Boolean(error) || submittingTaskId !== null;
  const reorderableOptimisticTaskIds = openRatingTaskId
    ? new Set([...optimisticTaskIds].filter((taskId) => taskId !== openRatingTaskId))
    : optimisticTaskIds;
  const orderedTasks = workspace
    ? orderStudyPlanTasks(workspace.tasks, reorderableOptimisticTaskIds)
    : [];
  const hasHiddenTasks = (workspace?.tasks.length ?? 0) > collapsedTaskLimit;
  const showAllTasks = Boolean(workspace && expandedPlanId === workspace.plan.id);
  const visibleTasks = showAllTasks || optimisticTaskIds.size > 0
    ? orderedTasks
    : orderedTasks.slice(0, collapsedTaskLimit);

  return (
    <section aria-labelledby="daily-study-heading" className="space-y-5">
      <h2 id="daily-study-heading" className="sr-only">Today&apos;s study plan</h2>

      {error ? (
        <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/30 dark:text-red-300">
          <p>{signedOut ? "Your session has ended. Sign in to see your plan." : error}</p>
          {signedOut ? <Link href="/sign-in" className={commandClass}>Sign in</Link> :
            <button type="button" onClick={() => { void reload(); }} disabled={loading} className={commandClass}><RefreshCw className="h-4 w-4" aria-hidden="true" />Retry</button>}
        </div>
      ) : null}
      {notice ? <p role="status" className="rounded-md border border-zinc-200 bg-white p-3 text-sm text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200">{notice}</p> : null}

      {!workspace ? (
        <div role="status" aria-live="polite" className="flex min-h-32 items-center justify-center gap-3 rounded-lg border border-zinc-200 bg-white p-6 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
          {loading ? <><LoaderCircle className="h-5 w-5 motion-safe:animate-spin" aria-hidden="true" />Preparing today&apos;s plan...</> : "Your plan is unavailable right now."}
        </div>
      ) : summary ? (
        <div className="overflow-hidden rounded-lg border border-zinc-200 bg-white p-4 shadow-sm sm:p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h3 className="flex items-center gap-2 text-base font-semibold text-zinc-950 dark:text-zinc-100"><ListChecks className="h-4 w-4 text-violet-700 dark:text-violet-300" aria-hidden="true" />Today&apos;s plan</h3>
            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <TodayProblemQuickAdd
                problemOptions={problemOptions}
                disabled={disabled}
                extraStudyAvailable={canKeepStudying}
                unavailableExtraModes={unavailableExtraModes}
                onRequestExtra={requestExtraStudy}
                onSaved={handleProblemAdded}
                onSettled={() => router.refresh()}
              />
              {loading ? <LoaderCircle aria-label="Refreshing plan" className="h-4 w-4 text-zinc-500 motion-safe:animate-spin" /> : <time dateTime={workspace.plan.study_date} className="text-xs text-zinc-500 dark:text-zinc-400">{formatStudyDate(workspace.plan.study_date)}</time>}
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-start justify-between gap-x-5 gap-y-2">
            {resolved ? (
              <div role="status" aria-live="polite" className="flex min-w-0 items-start gap-2">
                <CheckCircle2 className={`mt-0.5 h-4 w-4 shrink-0 ${summary.state === "completed" ? "text-emerald-600 dark:text-emerald-400" : "text-amber-600 dark:text-amber-400"}`} aria-hidden="true" />
                <div className="min-w-0">
                  <h4 className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">{summary.state === "completed" ? "All done for today!" : "You're done for today"}</h4>
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {summary.state === "completed" ? "Great work showing up." : "Your progress is saved. You can pick up tomorrow."}
                  </p>
                </div>
              </div>
            ) : (
              <p className="text-xs leading-5 text-zinc-500 dark:text-zinc-400">
                {summary.total === 0 ? "Nothing assigned" : <>{displayedReviewCount} {displayedReviewCount === 1 ? "review" : "reviews"}{newCount > 0 ? <>{` \u00b7 `}{newCount} new {newCount === 1 ? "problem" : "problems"}</> : null}</>}
              </p>
            )}
            {summary.total > 0 ? (
              <p role="status" aria-live="polite" className="ml-auto text-right text-sm font-semibold tabular-nums text-zinc-800 dark:text-zinc-200">
                {summary.completed}/{summary.total} completed{summary.deferred > 0 ? ` \u00b7 ${summary.deferred} deferred` : ""}
              </p>
            ) : null}
          </div>
          {summary.total > 0 ? <div role="progressbar" aria-label="Today's study plan completion" aria-valuemin={0} aria-valuemax={summary.total} aria-valuenow={summary.completed}
            aria-valuetext={`${summary.completed} of ${summary.total} completed${summary.deferred ? `, ${summary.deferred} deferred` : ""}`}
            className="mt-3 h-2 overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div className="h-full rounded-full bg-violet-600 motion-safe:transition-[width] motion-safe:duration-500 dark:bg-violet-400" style={{ width: `${summary.percent}%` }} />
          </div> : null}
          {summary.state === "empty" ? (
            <div className="mt-6 border-t border-zinc-200 pt-5 dark:border-zinc-800">
              <h3 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">No tasks assigned today</h3>
              <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">You can browse your Library or roadmap. A fresh plan will be ready on your next study day.</p>
              <Link href="/problems" className={`${commandClass} mt-4`}>View Library</Link>
            </div>
          ) : <>
            <StudyTaskChecklist
              workspace={workspace}
              tasks={visibleTasks}
              optimisticTaskIds={optimisticTaskIds}
              submittingTaskId={submittingTaskId}
              disabled={disabled}
              onSubmissionStart={beginTaskSubmission}
              onSubmissionEnd={endTaskSubmission}
              onRunTaskAction={runTaskAction}
              onOptimisticChange={setOptimisticTask}
              onRatingOpenChange={setRatingOpen}
              onAttemptFinished={finishAttempt}
            />
            {hasHiddenTasks ? (
              <button
                type="button"
                onClick={toggleTaskList}
                className="mt-3 inline-flex h-9 items-center gap-1.5 rounded-md px-2 text-sm font-semibold text-violet-700 transition hover:bg-violet-50 hover:text-violet-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-300 dark:text-violet-300 dark:hover:bg-violet-950/40 dark:hover:text-violet-200"
                aria-expanded={showAllTasks}
              >
                {showAllTasks ? <ChevronUp className="h-4 w-4" aria-hidden="true" /> : <ChevronDown className="h-4 w-4" aria-hidden="true" />}
                {showAllTasks ? "Show fewer" : `Show all ${workspace.tasks.length} problems`}
              </button>
            ) : null}
          </>}
        </div>
      ) : null}
    </section>
  );
}
