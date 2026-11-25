"use client";

import { useEffect } from "react";

export default function CompletePasswordRecoveryPage() {
  useEffect(() => {
    let cancelled = false;

    async function finalizeRecovery() {
      let destination = "/reset-password?error=invalid_recovery";

      try {
        const response = await fetch("/auth/recovery/finalize", {
          method: "POST",
        });
        if (response.ok) destination = "/reset-password";
      } catch {
        // The reset page provides the safe expired/invalid recovery state.
      }

      if (!cancelled) {
        window.location.replace(destination);
      }
    }

    void finalizeRecovery();

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <main className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md items-center justify-center px-5 py-16 sm:px-6 lg:px-8">
        <p
          role="status"
          className="text-sm text-zinc-600 dark:text-zinc-400"
        >
          Preparing your secure password reset...
        </p>
      </main>
    </div>
  );
}
