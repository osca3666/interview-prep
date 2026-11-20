"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Check, LoaderCircle, Minus, ThumbsDown, ThumbsUp } from "lucide-react";
import type {
  PersistedStudyAttempt,
  StudyTaskRating,
} from "@/lib/daily-study-plan-view";
import { studyRatings } from "@/lib/ratings";

type FinishResult = { completed: boolean; error?: string };
type AttemptResult =
  | { ok: true; attempt: PersistedStudyAttempt }
  | { ok: false; error: string };

type Props = {
  id: string;
  label: string;
  disabled?: boolean;
  onBegin: () => boolean;
  onComplete: () => Promise<AttemptResult>;
  onCorrect: (
    reviewEventId: string,
    rating: StudyTaskRating,
  ) => Promise<AttemptResult>;
  onOptimisticChange?: (completed: boolean) => void;
  onOpenChange?: (open: boolean) => void;
  onFinished: (result: FinishResult) => Promise<void> | void;
};

const icons = { bad: ThumbsDown, ok: Minus, good: ThumbsUp } as const;
const tone = {
  bad: "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/60",
  ok: "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
  good: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
} as const;

export function InstantRatingControl({
  id,
  label,
  disabled = false,
  onBegin,
  onComplete,
  onCorrect,
  onOptimisticChange,
  onOpenChange,
  onFinished,
}: Props) {
  const anchorRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const attemptRef = useRef<PersistedStudyAttempt | null>(null);
  const desiredRatingRef = useRef<StudyTaskRating>("ok");
  const persistedRatingRef = useRef<StudyTaskRating>("ok");
  const requestPendingRef = useRef(false);
  const closeRequestedRef = useRef(false);
  const finishedRef = useRef(false);
  const mountedRef = useRef(true);
  const [open, setOpen] = useState(false);
  const [optimistic, setOptimistic] = useState(false);
  const [saving, setSaving] = useState(false);
  const [selectedRating, setSelectedRating] = useState<StudyTaskRating | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8 });

  const setPopoverOpen = useCallback((next: boolean) => {
    setOpen(next);
    onOpenChange?.(next);
  }, [onOpenChange]);

  useEffect(() => () => { mountedRef.current = false; }, []);

  const finish = useCallback(async (result: FinishResult) => {
    if (finishedRef.current) return;
    finishedRef.current = true;
    requestPendingRef.current = false;
    if (mountedRef.current) setSaving(false);
    await onFinished(result);
  }, [onFinished]);

  const close = useCallback(() => {
    setPopoverOpen(false);
    closeRequestedRef.current = true;
    window.requestAnimationFrame(() => anchorRef.current?.focus());
    if (!requestPendingRef.current) {
      void finish({ completed: Boolean(attemptRef.current) });
    }
  }, [finish, setPopoverOpen]);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const anchor = anchorRef.current?.getBoundingClientRect();
      if (!anchor) return;
      const width = Math.min(288, window.innerWidth - 16);
      const height = popoverRef.current?.offsetHeight ?? 176;
      const left = Math.max(8, Math.min(anchor.left, window.innerWidth - width - 8));
      const below = anchor.bottom + 8;
      const top = below + height <= window.innerHeight - 8
        ? below
        : Math.max(8, anchor.top - height - 8);
      setPosition({ left, top });
    };
    reposition();
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    const frame = window.requestAnimationFrame(() => {
      reposition();
      popoverRef.current?.focus({ preventScroll: true });
    });
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const pointer = (event: PointerEvent) => {
      const target = event.target;
      if (!(target instanceof Node)) return;
      if (anchorRef.current?.contains(target) || popoverRef.current?.contains(target)) return;
      close();
    };
    const keyboard = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      close();
    };
    document.addEventListener("pointerdown", pointer);
    document.addEventListener("keydown", keyboard);
    return () => {
      document.removeEventListener("pointerdown", pointer);
      document.removeEventListener("keydown", keyboard);
    };
  }, [close, open]);

  async function persistDesiredRating(initialAttempt: PersistedStudyAttempt) {
    let attempt = initialAttempt;

    while (desiredRatingRef.current !== persistedRatingRef.current) {
      const desired = desiredRatingRef.current;
      try {
        const result = await onCorrect(attempt.reviewEventId, desired);
        if (!result.ok || result.attempt.rating !== desired) {
          if (mountedRef.current) setMessage("Your attempt was saved as OK, but the rating change was not saved.");
          return false;
        }
        attempt = result.attempt;
        attemptRef.current = result.attempt;
        persistedRatingRef.current = result.attempt.rating;
      } catch {
        if (mountedRef.current) setMessage("Your attempt was saved as OK, but the rating change was not saved.");
        return false;
      }
    }

    return true;
  }

  async function startCompletion() {
    if (disabled || requestPendingRef.current || optimistic || !onBegin()) return;
    desiredRatingRef.current = "ok";
    persistedRatingRef.current = "ok";
    closeRequestedRef.current = false;
    finishedRef.current = false;
    requestPendingRef.current = true;
    setSelectedRating(null);
    setMessage(null);
    setOptimistic(true);
    setPopoverOpen(true);
    setSaving(true);
    onOptimisticChange?.(true);

    try {
      const result = await onComplete();
      if (!result.ok) {
        attemptRef.current = null;
        if (mountedRef.current) {
          setOptimistic(false);
          setPopoverOpen(false);
          setMessage(null);
        }
        onOptimisticChange?.(false);
        await finish({ completed: false, error: result.error });
        return;
      }

      attemptRef.current = result.attempt;
      persistedRatingRef.current = result.attempt.rating;
      const corrected = await persistDesiredRating(result.attempt);
      requestPendingRef.current = false;
      if (mountedRef.current) setSaving(false);
      if (!corrected || closeRequestedRef.current) {
        if (mountedRef.current) setPopoverOpen(false);
        await finish({
          completed: true,
          error: corrected ? undefined : "correction_failed",
        });
      }
    } catch {
      attemptRef.current = null;
      requestPendingRef.current = false;
      if (mountedRef.current) {
        setOptimistic(false);
        setPopoverOpen(false);
        setSaving(false);
      }
      onOptimisticChange?.(false);
      await finish({ completed: false, error: "save_failed" });
    }
  }

  async function selectRating(rating: StudyTaskRating) {
    if (finishedRef.current) return;
    desiredRatingRef.current = rating;
    closeRequestedRef.current = true;
    setSelectedRating(rating);
    setMessage(null);
    // The initial OK attempt or another correction is still in flight. The
    // active request will flush this latest desired rating before finishing.
    if (requestPendingRef.current) return;
    const attempt = attemptRef.current;
    if (!attempt) return;
    requestPendingRef.current = true;
    setSaving(true);
    try {
      const corrected = await persistDesiredRating(attempt);
      if (mountedRef.current) setPopoverOpen(false);
      await finish({ completed: true, error: corrected ? undefined : "correction_failed" });
    } catch {
      if (mountedRef.current) {
        setMessage("Completed with OK, but the rating change was not saved.");
        setPopoverOpen(false);
      }
      await finish({ completed: true, error: "correction_failed" });
    } finally {
      requestPendingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }

  return (
    <div className="relative shrink-0">
      <button
        ref={anchorRef}
        id={`study-task-trigger-${id}`}
        type="button"
        aria-label={`Complete ${label}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        disabled={disabled && !optimistic}
        onClick={() => { if (!optimistic) void startCompletion(); else setPopoverOpen(true); }}
        className="group inline-flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 disabled:cursor-wait disabled:opacity-50 dark:hover:bg-violet-950/60 dark:focus-visible:ring-offset-zinc-900"
      >
        <span
          aria-hidden="true"
          className={`inline-flex h-7 w-7 items-center justify-center rounded-full border transition ${
            optimistic
              ? "border-emerald-500 bg-emerald-500 text-white"
              : "border-zinc-300 bg-white text-zinc-400 group-hover:border-violet-500 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-500 dark:group-hover:border-violet-400"
          }`}
        >
          {saving && !optimistic ? <LoaderCircle className="h-3.5 w-3.5 motion-safe:animate-spin" /> :
            optimistic ? <Check className="h-3.5 w-3.5" /> : null}
        </span>
      </button>

      {open ? (
        <div
          ref={popoverRef}
          role="dialog"
          tabIndex={-1}
          aria-busy={saving}
          aria-labelledby={`study-task-rating-heading-${id}`}
          className="fixed z-50 w-60 max-w-[calc(100vw-1rem)] rounded-lg border border-zinc-200 bg-white p-3 shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/50"
          style={{ left: position.left, top: position.top }}
        >
          <div className="flex items-center justify-between gap-3">
            <p id={`study-task-rating-heading-${id}`} className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">How did it go?</p>
            {saving ? <LoaderCircle className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 motion-safe:animate-spin dark:text-violet-300" aria-label="Saving rating" /> : null}
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2">
            {studyRatings.map((rating) => {
              const Icon = icons[rating.value];
              const selected = selectedRating === rating.value;
              return (
                <button
                  key={rating.value}
                  type="button"
                  data-rating={rating.value}
                  aria-pressed={selected}
                  aria-label={rating.label}
                  title={rating.description}
                  onClick={() => void selectRating(rating.value)}
                  className={`inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-zinc-900 ${tone[rating.value]} ${selected ? "bg-violet-50 dark:bg-violet-950/50" : ""}`}
                >
                  <Icon className="h-4 w-4" aria-hidden="true" />
                  {rating.label}
                </button>
              );
            })}
          </div>
          {message ? <p role="alert" className="mt-2 text-xs leading-5 text-red-700 dark:text-red-300">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
