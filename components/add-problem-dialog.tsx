"use client";

import { useEffect, useState } from "react";
import { AddProblemForm } from "@/components/add-problem-form";

export function AddProblemDialog() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setIsOpen(false);
      }
    }

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      <button
        type="button"
        onClick={() => setIsOpen(true)}
        className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 sm:w-auto"
      >
        + Add Problem
      </button>

      {isOpen ? (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-zinc-950/40 px-4 py-6 backdrop-blur-sm sm:py-10"
          role="presentation"
          onMouseDown={() => setIsOpen(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="add-problem-dialog-title"
            className="max-h-[90vh] w-[min(calc(100vw-2rem),900px)] overflow-y-auto rounded-lg border border-zinc-200 bg-white shadow-xl"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4 sm:px-6">
              <h2
                id="add-problem-dialog-title"
                className="text-base font-semibold text-zinc-950"
              >
                Add problem
              </h2>
              <button
                type="button"
                onClick={() => setIsOpen(false)}
                className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-zinc-200 text-xl leading-none text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950"
                aria-label="Close add problem dialog"
              >
                X
              </button>
            </div>
            <AddProblemForm returnTo="/dashboard" variant="modal" />
          </div>
        </div>
      ) : null}
    </>
  );
}
