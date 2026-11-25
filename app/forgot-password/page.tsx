import Link from "next/link";
import { redirect } from "next/navigation";
import { requestPasswordResetAction } from "@/app/auth/actions";
import { createClient } from "@/lib/supabase/server";

type SearchParams = Promise<{
  error?: string | string[];
  message?: string | string[];
}>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

function getMessage(value: string | string[] | undefined) {
  return firstValue(value) === "check_email"
    ? "If an account exists for that email, we sent a password reset link."
    : null;
}

function getError(value: string | string[] | undefined) {
  switch (firstValue(value)) {
    case "validation":
      return "Enter a valid email address.";
    case "rate_limited":
      return "Too many reset requests. Please wait a little and try again.";
    case "request_failed":
      return "We could not send a reset email. Please try again.";
    default:
      return null;
  }
}

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/dashboard");
  }

  const params = await searchParams;
  const message = getMessage(params.message);
  const error = message ? null : getError(params.error);

  return (
    <div className="bg-zinc-50 dark:bg-zinc-950">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-md flex-col justify-center px-5 py-16 sm:px-6 lg:px-8">
        <div>
          <p className="mb-4 text-sm font-semibold uppercase tracking-wide text-emerald-700 dark:text-emerald-400">
            Account recovery
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950 dark:text-zinc-100">
            Reset your password
          </h1>
          <p className="mt-3 text-sm leading-6 text-zinc-600 dark:text-zinc-400">
            Enter your email and we will send you a secure reset link.
          </p>
        </div>

        {message ? (
          <div
            role="status"
            className="mt-6 rounded-md border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          >
            {message}
          </div>
        ) : null}

        {error ? (
          <div
            role="alert"
            className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 dark:border-red-800 dark:bg-red-950/40 dark:text-red-200"
          >
            {error}
          </div>
        ) : null}

        <form action={requestPasswordResetAction} className="mt-8 space-y-5">
          <div>
            <label
              htmlFor="recovery-email"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              Email
            </label>
            <input
              id="recovery-email"
              name="email"
              type="email"
              autoComplete="email"
              required
              className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
            />
          </div>

          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-zinc-400 focus-visible:ring-offset-2 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white dark:focus-visible:ring-offset-zinc-950"
          >
            Send reset link
          </button>
        </form>

        <p className="mt-6 text-sm text-zinc-600 dark:text-zinc-400">
          Remembered your password?{" "}
          <Link
            href="/sign-in"
            className="font-semibold text-zinc-950 underline-offset-4 hover:underline dark:text-zinc-100 dark:hover:text-sky-300"
          >
            Back to sign in
          </Link>
        </p>
      </section>
    </div>
  );
}
