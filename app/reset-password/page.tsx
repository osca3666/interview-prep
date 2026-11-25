import Link from "next/link";
import { cookies } from "next/headers";
import { resetPasswordAction } from "@/app/auth/actions";
import {
  AUTH_MIN_PASSWORD_LENGTH,
  PASSWORD_RECOVERY_COOKIE,
  PASSWORD_RECOVERY_COOKIE_VALUE,
} from "@/lib/auth/recovery";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getError(value: string | string[] | undefined) {
  switch (firstValue(value)) {
    case "password_too_short":
      return `Use at least ${AUTH_MIN_PASSWORD_LENGTH} characters for your new password.`;
    case "password_mismatch":
      return "The passwords do not match.";
    case "update_failed":
      return "We could not update your password. Please try again.";
    case "invalid_recovery":
      return "This reset link is invalid or has expired. Request a new one.";
    default:
      return null;
  }
}

export default async function ResetPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const passwordUpdated = firstValue(params.message) === "password_updated";
  const requestedError = getError(params.error);
  let recoveryIsValid = false;

  if (!passwordUpdated) {
    const cookieStore = await cookies();
    const hasRecoveryMarker =
      cookieStore.get(PASSWORD_RECOVERY_COOKIE)?.value ===
      PASSWORD_RECOVERY_COOKIE_VALUE;
    if (hasRecoveryMarker) {
      const supabase = await createClient();
      const claimsResult = await supabase.auth.getClaims();
      recoveryIsValid = Boolean(
        !claimsResult.error && claimsResult.data?.claims,
      );
    }
  }

  const error =
    requestedError ??
    (!passwordUpdated && !recoveryIsValid
      ? "This reset link is invalid or has expired. Request a new one."
      : null);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-5 py-16 sm:px-6 lg:px-8">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Account recovery
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            {passwordUpdated ? "Password updated" : "Choose a new password"}
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            {passwordUpdated
              ? "Your new password is ready to use."
              : "Create a new password for your InterviewPrep account."}
          </p>
        </div>

        {passwordUpdated ? (
          <div
            role="status"
            className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            Your password was updated successfully.
          </div>
        ) : null}

        {error && !passwordUpdated ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        {recoveryIsValid && !passwordUpdated ? (
          <form action={resetPasswordAction} className="mt-8 space-y-5">
            <div>
              <label
                htmlFor="new-password"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                New password
              </label>
              <input
                id="new-password"
                name="password"
                type="password"
                autoComplete="new-password"
                required
                minLength={AUTH_MIN_PASSWORD_LENGTH}
                className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
              />
            </div>

            <div>
              <label
                htmlFor="password-confirmation"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Confirm new password
              </label>
              <input
                id="password-confirmation"
                name="password_confirmation"
                type="password"
                autoComplete="new-password"
                required
                minLength={AUTH_MIN_PASSWORD_LENGTH}
                className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
              />
            </div>

            <button
              type="submit"
              className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:focus-visible:ring-offset-zinc-950"
            >
              Update password
            </button>
          </form>
        ) : null}

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          {error && !passwordUpdated ? (
            <Link
              href="/forgot-password"
              className="font-semibold text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-100 dark:hover:text-sky-300"
            >
              Request a new reset link
            </Link>
          ) : (
            <Link
              href="/sign-in"
              className="font-semibold text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-100 dark:hover:text-sky-300"
            >
              Back to sign in
            </Link>
          )}
        </p>
      </section>
    </div>
  );
}
