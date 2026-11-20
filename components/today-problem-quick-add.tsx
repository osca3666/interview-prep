"use client";

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  Layers3,
  LoaderCircle,
  Minus,
  Plus,
  RefreshCw,
  Search,
  ThumbsDown,
  ThumbsUp,
  X,
} from "lucide-react";
import {
  addProblemToTodayAction,
  correctStudyAttemptAction,
} from "@/app/study-plan/actions";
import { filterLeetCodeProblemOptions } from "@/components/leetcode-problem-combobox";
import { DifficultyBadge } from "@/components/problem-table-primitives";
import type {
  AddProblemToTodayResult,
  PersistedStudyAttempt,
  StudyTaskRating,
  TodayProblemIntent,
} from "@/lib/daily-study-plan-view";
import type { LeetCodeProblemSearchOption } from "@/lib/leetcode-catalog-types";
import type { ExtraStudyMode } from "@/lib/keep-studying";
import { studyRatings } from "@/lib/ratings";

const ratingIcons = { bad: ThumbsDown, ok: Minus, good: ThumbsUp } as const;
const ratingTones = {
  bad: "border-red-200 text-red-700 hover:bg-red-50 dark:border-red-900 dark:text-red-300 dark:hover:bg-red-950/60",
  ok: "border-zinc-300 text-zinc-700 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-200 dark:hover:bg-zinc-800",
  good: "border-emerald-200 text-emerald-700 hover:bg-emerald-50 dark:border-emerald-900 dark:text-emerald-300 dark:hover:bg-emerald-950/60",
} as const;

function getErrorMessage(error: Extract<AddProblemToTodayResult, { ok: false }>["error"]) {
  switch (error) {
    case "already_in_today":
      return "This problem is already in today's plan.";
    case "already_completed_today":
      return "This problem is already completed today.";
    case "already_deferred_today":
      return "This problem was deferred today and was not changed.";
    case "problem_not_active":
      return "This problem is not active in your Library.";
    case "invalid_problem":
      return "Choose a valid LeetCode problem from the catalog.";
    case "plan_changed":
      return "Today's plan changed. Refresh and try again.";
    case "not_authenticated":
      return "Your session ended. Sign in again to continue.";
    default:
      return "We couldn't add that problem. Please try again.";
  }
}

type Props = {
  problemOptions: LeetCodeProblemSearchOption[];
  disabled?: boolean;
  extraStudyAvailable: boolean;
  unavailableExtraModes: ReadonlySet<ExtraStudyMode>;
  onRequestExtra: (mode: ExtraStudyMode) => void;
  onSaved: (result: Extract<AddProblemToTodayResult, { ok: true }>) => Promise<void>;
  onSettled: () => void;
};

export function TodayProblemQuickAdd({
  problemOptions,
  disabled = false,
  extraStudyAvailable,
  unavailableExtraModes,
  onRequestExtra,
  onSaved,
  onSettled,
}: Props) {
  const titleId = useId();
  const resultsId = useId();
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const resultRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedProblem, setSelectedProblem] = useState<LeetCodeProblemSearchOption | null>(null);
  const [activeResult, setActiveResult] = useState(0);
  const [intent, setIntent] = useState<TodayProblemIntent>("todo");
  const [submitting, setSubmitting] = useState(false);
  const [correcting, setCorrecting] = useState(false);
  const [attempt, setAttempt] = useState<PersistedStudyAttempt | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [position, setPosition] = useState({ left: 8, top: 8, mobile: false });
  const portalTarget = typeof document === "undefined" ? null : document.body;
  const matches = useMemo(
    () => filterLeetCodeProblemOptions(problemOptions, query, 5),
    [problemOptions, query],
  );
  const searching = query.trim().length > 0 && !selectedProblem;

  const reset = useCallback(() => {
    setAttempt(null);
    setError(null);
    setIntent("todo");
    setQuery("");
    setSelectedProblem(null);
    setActiveResult(0);
  }, []);

  const close = useCallback((refresh = false) => {
    setOpen(false);
    reset();
    window.requestAnimationFrame(() => triggerRef.current?.focus());
    if (refresh) onSettled();
  }, [onSettled, reset]);

  const goBack = useCallback(() => {
    setSelectedProblem(null);
    setIntent("todo");
    setError(null);
    window.requestAnimationFrame(() => searchRef.current?.focus());
  }, []);

  useEffect(() => {
    if (!open) return;
    const reposition = () => {
      const mobile = window.innerWidth < 640;
      const anchor = triggerRef.current?.getBoundingClientRect();
      if (!anchor || mobile) {
        setPosition({ left: 8, top: 8, mobile });
        return;
      }
      const width = Math.min(432, window.innerWidth - 32);
      const height = panelRef.current?.offsetHeight ?? 352;
      const left = Math.max(16, Math.min(anchor.right - width, window.innerWidth - width - 16));
      const below = anchor.bottom + 8;
      const top = below + height <= window.innerHeight - 16
        ? below
        : Math.max(16, anchor.top - height - 8);
      setPosition({ left, top, mobile });
    };
    reposition();
    const frame = window.requestAnimationFrame(() => {
      reposition();
      searchRef.current?.focus({ preventScroll: true });
    });
    window.addEventListener("resize", reposition);
    window.addEventListener("scroll", reposition, true);
    const keyboard = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !correcting) {
        event.preventDefault();
        if (selectedProblem && !attempt) {
          goBack();
        } else if (query && !attempt) {
          setQuery("");
          setActiveResult(0);
        } else {
          close(Boolean(attempt));
        }
        return;
      }
      if (event.key !== "Tab" || !panelRef.current) return;
      const focusable = Array.from(panelRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), input:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    const outsidePointer = (event: PointerEvent) => {
      if (
        !submitting &&
        !correcting &&
        panelRef.current &&
        !panelRef.current.contains(event.target as Node)
      ) {
        close(Boolean(attempt));
      }
    };
    document.addEventListener("keydown", keyboard);
    document.addEventListener("pointerdown", outsidePointer);
    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", reposition);
      window.removeEventListener("scroll", reposition, true);
      document.removeEventListener("keydown", keyboard);
      document.removeEventListener("pointerdown", outsidePointer);
    };
  }, [attempt, close, correcting, goBack, open, query, selectedProblem, submitting]);

  function selectProblem(problem: LeetCodeProblemSearchOption) {
    setSelectedProblem(problem);
    setIntent("todo");
    setError(null);
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (!searching || matches.length === 0) return;
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      const direction = event.key === "ArrowDown" ? 1 : -1;
      const next = (activeResult + direction + matches.length) % matches.length;
      setActiveResult(next);
      resultRefs.current[next]?.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      selectProblem(matches[activeResult]);
    }
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submitting || !selectedProblem) return;
    setSubmitting(true);
    setError(null);
    try {
      const result = await addProblemToTodayAction(selectedProblem.frontendId, intent);
      if (!result.ok) {
        setError(getErrorMessage(result.error));
        return;
      }
      await onSaved(result);
      if (result.attempt) {
        setAttempt(result.attempt);
      } else {
        close(true);
      }
    } catch {
      setError("We couldn't add that problem. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  async function correct(rating: StudyTaskRating) {
    if (!attempt || correcting) return;
    if (rating === attempt.rating) {
      close(true);
      return;
    }
    setCorrecting(true);
    setError(null);
    try {
      const result = await correctStudyAttemptAction(attempt.reviewEventId, rating);
      if (!result.ok) {
        setError("The problem was completed with OK, but that rating change was not saved.");
        return;
      }
      setAttempt(result.attempt);
      close(true);
    } catch {
      setError("The problem was completed with OK, but that rating change was not saved.");
    } finally {
      setCorrecting(false);
    }
  }

  function requestExtra(mode: ExtraStudyMode) {
    if (!extraStudyAvailable || unavailableExtraModes.has(mode)) return;
    onRequestExtra(mode);
    close(false);
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        disabled={disabled}
        onClick={() => setOpen(true)}
        className="inline-flex h-8 items-center justify-center gap-1.5 rounded-md border border-violet-300 bg-white px-2.5 text-xs font-semibold text-violet-700 transition hover:border-violet-400 hover:bg-violet-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-wait disabled:opacity-50 dark:border-violet-700 dark:bg-zinc-900 dark:text-violet-300 dark:hover:border-violet-600 dark:hover:bg-violet-950/50"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
        Add Problem
      </button>

      {portalTarget && open ? createPortal(
        <div
          className={`fixed inset-0 z-[60] ${position.mobile ? "bg-zinc-950/45 backdrop-blur-sm" : "bg-zinc-950/10 dark:bg-black/20"}`}
        >
          <div
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            tabIndex={-1}
            data-add-problem-palette
            className={`fixed flex h-[min(22rem,calc(100dvh-1.5rem))] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl outline-none dark:border-zinc-700 dark:bg-zinc-900 dark:shadow-black/70 ${
              position.mobile
                ? "inset-x-3 bottom-3 w-auto"
                : "w-[min(27rem,calc(100vw-2rem))]"
            }`}
            style={position.mobile ? undefined : { left: position.left, top: position.top }}
          >
            <div className="flex h-12 shrink-0 items-center justify-between gap-3 px-4">
              <h4 id={titleId} className="text-sm font-semibold text-zinc-950 dark:text-zinc-100">Add a problem</h4>
              <button
                type="button"
                aria-label="Close Add Problem"
                disabled={submitting || correcting}
                onClick={() => close(Boolean(attempt))}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>

            {!selectedProblem && !attempt ? (
              <div className="shrink-0 px-3 pb-3">
                <label htmlFor={`${resultsId}-search`} className="sr-only">LeetCode problem</label>
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-zinc-400" aria-hidden="true" />
                  <input
                    ref={searchRef}
                    id={`${resultsId}-search`}
                    type="text"
                    role="combobox"
                    aria-expanded={searching}
                    aria-controls={resultsId}
                    aria-activedescendant={searching && matches[activeResult] ? `${resultsId}-${matches[activeResult].frontendId}` : undefined}
                    value={query}
                    onChange={(event) => {
                      setQuery(event.target.value);
                      setActiveResult(0);
                    }}
                    onKeyDown={handleSearchKeyDown}
                    placeholder="Search LeetCode problems..."
                    autoComplete="off"
                    className="h-10 w-full rounded-md border border-zinc-300 bg-white pl-9 pr-9 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-violet-500 focus:ring-2 focus:ring-violet-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-violet-500 dark:focus:ring-violet-950"
                  />
                  {query ? (
                    <button
                      type="button"
                      aria-label="Clear search"
                      onClick={() => { setQuery(""); searchRef.current?.focus(); }}
                      className="absolute right-1 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-md text-zinc-400 hover:text-zinc-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:hover:text-zinc-200"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 border-t border-zinc-100 px-3 py-3 dark:border-zinc-800">
              {attempt ? (
                <div className="flex h-full flex-col">
                  <div className="flex items-center gap-2 text-sm font-medium text-emerald-700 dark:text-emerald-300"><Check className="h-4 w-4" aria-hidden="true" />Added to today with OK</div>
                  <p className="mt-5 text-sm font-semibold text-zinc-950 dark:text-zinc-100">How did it go?</p>
                  <div className="mt-2 grid grid-cols-3 gap-2">
                    {studyRatings.map((rating) => {
                      const Icon = ratingIcons[rating.value];
                      return <button key={rating.value} type="button" disabled={correcting} aria-pressed={attempt.rating === rating.value} title={rating.description} onClick={() => void correct(rating.value)}
                        className={`inline-flex min-h-14 flex-col items-center justify-center gap-1 rounded-md border px-2 py-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-wait disabled:opacity-60 ${ratingTones[rating.value]}`}>
                        <Icon className="h-4 w-4" aria-hidden="true" />{rating.label}
                      </button>;
                    })}
                  </div>
                  {error ? <p role="alert" className="mt-3 text-xs leading-5 text-red-700 dark:text-red-300">{error}</p> : null}
                </div>
              ) : selectedProblem ? (
                <form onSubmit={submit} className="flex h-full flex-col">
                  <button type="button" onClick={goBack} className="inline-flex h-7 w-fit items-center gap-1 rounded-md px-1.5 text-xs font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-900 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100">
                    <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />Back
                  </button>
                  <div className="mt-2 flex items-center justify-between gap-3 rounded-md bg-zinc-50 px-3 py-2.5 dark:bg-zinc-950">
                    <span className="min-w-0 truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">{selectedProblem.frontendId}. {selectedProblem.title}</span>
                    <DifficultyBadge difficulty={selectedProblem.difficulty} className="shrink-0" />
                  </div>
                  <fieldset className="mt-3">
                    <legend className="sr-only">Status</legend>
                    <div className="grid grid-cols-2 gap-2">
                      {([[
                        "todo", "To-do", "Practice today",
                      ], [
                        "done", "Done", "Practiced today",
                      ]] as const).map(([value, label, description]) => (
                        <label key={value} className={`cursor-pointer rounded-md border px-3 py-2.5 transition ${intent === value ? "border-violet-500 bg-violet-50 ring-1 ring-violet-500 dark:bg-violet-950/40" : "border-zinc-200 hover:border-zinc-300 dark:border-zinc-700 dark:hover:border-zinc-600"}`}>
                          <input type="radio" name="today_status" value={value} checked={intent === value} onChange={() => setIntent(value)} className="sr-only" />
                          <span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-100">{label}</span>
                          <span className="mt-0.5 block text-xs text-zinc-500 dark:text-zinc-400">{description}</span>
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  {error ? <p role="alert" className="mt-2 text-xs leading-5 text-red-700 dark:text-red-300">{error}</p> : null}
                  <button type="submit" disabled={submitting} className="mt-auto inline-flex h-10 w-full items-center justify-center gap-2 rounded-md bg-violet-700 px-4 text-sm font-semibold text-white transition hover:bg-violet-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-wait disabled:opacity-60 dark:bg-violet-500 dark:hover:bg-violet-400">
                    {submitting ? <LoaderCircle className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" /> : null}{intent === "done" ? "Mark as Done" : "Add to Today"}
                  </button>
                </form>
              ) : searching ? (
                <div id={resultsId} role="listbox" aria-label="Matching LeetCode problems" className="h-full overflow-y-auto overscroll-contain">
                  {matches.length > 0 ? <ul className="space-y-0.5">{matches.map((problem, index) => (
                    <li key={problem.frontendId}>
                      <button ref={(element) => { resultRefs.current[index] = element; }} id={`${resultsId}-${problem.frontendId}`} type="button" role="option" aria-selected={index === activeResult} onMouseEnter={() => setActiveResult(index)} onClick={() => selectProblem(problem)}
                        className={`flex w-full items-center justify-between gap-3 rounded-md px-3 py-2 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 ${index === activeResult ? "bg-violet-50 text-violet-950 dark:bg-violet-950/60 dark:text-violet-100" : "hover:bg-zinc-50 dark:hover:bg-zinc-800"}`}>
                        <span className="min-w-0 truncate text-sm font-medium">{problem.frontendId}. {problem.title}</span>
                        <DifficultyBadge difficulty={problem.difficulty} className="shrink-0" />
                      </button>
                    </li>
                  ))}</ul> : <p className="px-3 py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">No matching problems</p>}
                </div>
              ) : (
                <div className="h-full">
                  <p className="px-2 pb-2 text-xs font-medium text-zinc-500 dark:text-zinc-400">Or let InterviewPrep choose</p>
                  <div className="space-y-1">
                    <button type="button" disabled={!extraStudyAvailable || unavailableExtraModes.has("review")} onClick={() => requestExtra("review")} className="group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-zinc-800">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><RefreshCw className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-100">Review another</span><span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">Practice a previously seen problem</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                    <button type="button" disabled={!extraStudyAvailable || unavailableExtraModes.has("roadmap")} onClick={() => requestExtra("roadmap")} className="group flex w-full items-center gap-3 rounded-md px-2 py-2.5 text-left transition hover:bg-zinc-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 disabled:cursor-not-allowed disabled:opacity-45 dark:hover:bg-zinc-800">
                      <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-violet-100 text-violet-700 dark:bg-violet-950 dark:text-violet-300"><Layers3 className="h-4 w-4" aria-hidden="true" /></span>
                      <span className="min-w-0 flex-1"><span className="block text-sm font-semibold text-zinc-950 dark:text-zinc-100">Continue roadmap</span><span className="block truncate text-xs text-zinc-500 dark:text-zinc-400">Get your next roadmap problem</span></span>
                      <ChevronRight className="h-4 w-4 shrink-0 text-zinc-400 transition group-hover:translate-x-0.5" aria-hidden="true" />
                    </button>
                  </div>
                  {!extraStudyAvailable ? <p className="px-2 pt-2 text-xs text-zinc-500 dark:text-zinc-400">Finish the current update before adding another problem.</p> : null}
                </div>
              )}
            </div>
          </div>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}
