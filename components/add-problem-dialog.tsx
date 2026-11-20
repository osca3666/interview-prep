"use client";

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AddProblemForm } from "@/components/add-problem-form";
import { type LeetCodeProblemSearchOption } from "@/lib/leetcode-catalog-types";

type AddProblemDialogProps = {
  problemOptions: LeetCodeProblemSearchOption[];
  returnTo?: "/dashboard" | "/problems";
  initialFrontendId?: string | null;
  open?: boolean;
  onOpenChange?: (isOpen: boolean) => void;
  triggerLabel?: string;
  triggerContent?: ReactNode;
  triggerClassName?: string;
  showTrigger?: boolean;
};

export function AddProblemDialog({
  problemOptions,
  returnTo = "/dashboard",
  initialFrontendId,
  open,
  onOpenChange,
  triggerLabel = "+ Track Problem",
  triggerContent,
  triggerClassName = "inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:w-auto dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white",
  showTrigger = true,
}: AddProblemDialogProps) {
  const [uncontrolledIsOpen, setUncontrolledIsOpen] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const isOpen = open ?? uncontrolledIsOpen;
  const portalTarget = typeof document === "undefined" ? null : document.body;

  const setIsOpen = useCallback((nextIsOpen: boolean) => {
    onOpenChange?.(nextIsOpen);

    if (open === undefined) {
      setUncontrolledIsOpen(nextIsOpen);
    }
  }, [onOpenChange, open]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const previouslyFocused = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : triggerRef.current;
    const previousBodyOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        setIsOpen(false);
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) {
        return;
      }

      const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(
        'button:not([disabled]), [href], input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])',
      ));
      if (focusable.length === 0) {
        event.preventDefault();
        dialogRef.current.focus();
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (document.activeElement === dialogRef.current || !dialogRef.current.contains(document.activeElement)) {
        event.preventDefault();
        (event.shiftKey ? last : first).focus();
      } else if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    const frame = window.requestAnimationFrame(() => dialogRef.current?.focus());
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousBodyOverflow;
      previouslyFocused?.focus();
    };
  }, [isOpen, setIsOpen]);

  return (
    <>
      {showTrigger ? (
        <button
          ref={triggerRef}
          type="button"
          onClick={() => setIsOpen(true)}
          className={triggerClassName}
        >
          {triggerContent ?? triggerLabel}
        </button>
      ) : null}

      {portalTarget && isOpen ? createPortal(
        <div
          data-add-problem-dialog-overlay
          className="scrollbar-app fixed inset-0 z-[60] flex min-h-dvh w-screen items-start justify-center overflow-y-auto overscroll-contain bg-zinc-950/50 px-4 pt-12 pb-6 backdrop-blur-sm sm:pt-20 sm:pb-10 dark:bg-black/70"
          role="presentation"
          onMouseDown={() => setIsOpen(false)}
        >
          <div
            ref={dialogRef}
            role="dialog"
            tabIndex={-1}
            aria-modal="true"
            aria-labelledby="add-problem-dialog-title"
            className="scrollbar-app relative max-h-[90dvh] w-[min(calc(100vw-2rem),900px)] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-6 dark:border-zinc-800">
              <h2
                id="add-problem-dialog-title"
                className="text-base font-semibold text-zinc-950 dark:text-zinc-100"
              >
                Track a problem
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-xl leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
                aria-label="Close Track Problem dialog"
              >
                X
              </button>
            </div>
            <AddProblemForm
              key={initialFrontendId ?? "blank"}
              returnTo={returnTo}
              problemOptions={problemOptions}
              variant="modal"
              initialFrontendId={initialFrontendId}
            />
          </div>
        </div>,
        portalTarget,
      ) : null}
    </>
  );
}
