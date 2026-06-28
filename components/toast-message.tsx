"use client";

import { useCallback, useEffect, useState } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";

type ToastMessageProps = {
  message: string;
  queryKey: string;
  tone: "success" | "error";
};

const dismissDelay = 4000;

export function ToastMessage({ message, queryKey, tone }: ToastMessageProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isVisible, setIsVisible] = useState(true);

  const dismiss = useCallback(() => {
    setIsVisible(false);

    const nextParams = new URLSearchParams(searchParams.toString());

    if (
      nextParams.get("message") !== queryKey &&
      nextParams.get("error") !== queryKey
    ) {
      return;
    }

    nextParams.delete("message");
    nextParams.delete("error");

    const queryString = nextParams.toString();
    router.replace(queryString ? `${pathname}?${queryString}` : pathname, {
      scroll: false,
    });
  }, [pathname, queryKey, router, searchParams]);

  useEffect(() => {
    if (!isVisible) {
      return;
    }

    const timeoutId = window.setTimeout(dismiss, dismissDelay);
    return () => window.clearTimeout(timeoutId);
  }, [dismiss, isVisible]);

  if (!isVisible) {
    return null;
  }

  const isSuccess = tone === "success";

  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-x-4 bottom-4 z-50 sm:inset-x-auto sm:right-5 sm:w-full sm:max-w-sm"
    >
      <div
        className={
          isSuccess
            ? "rounded-lg border border-emerald-200 bg-white px-4 py-3 text-sm text-emerald-900 shadow-lg dark:border-emerald-800 dark:bg-zinc-900 dark:text-emerald-200"
            : "rounded-lg border border-red-200 bg-white px-4 py-3 text-sm text-red-900 shadow-lg dark:border-red-800 dark:bg-zinc-900 dark:text-red-200"
        }
      >
        <div className="flex items-start gap-3">
          <div
            className={
              isSuccess
                ? "mt-1 h-2 w-2 rounded-full bg-emerald-500"
                : "mt-1 h-2 w-2 rounded-full bg-red-500"
            }
            aria-hidden="true"
          />
          <p className="min-w-0 flex-1 leading-6">{message}</p>
          <button
            type="button"
            onClick={dismiss}
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-950 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-100"
            aria-label="Dismiss notification"
          >
            X
          </button>
        </div>
      </div>
    </div>
  );
}
