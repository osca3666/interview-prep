import { redirect } from "next/navigation";
import { signOutAction } from "@/app/auth/actions";
import { getAuthErrorMessage } from "@/lib/auth/redirect";
import { createClient } from "@/lib/supabase/server";

const summaryItems = [
  { label: "Due today", value: "0" },
  { label: "Active problems", value: "0" },
  { label: "Review events", value: "0" },
];

type SearchParams = Promise<{
  error?: string | string[];
}>;

export default async function Dashboard({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const supabase = await createClient();
  const { data, error: claimsError } = await supabase.auth.getClaims();

  if (claimsError || !data?.claims) {
    redirect("/sign-in");
  }

  const params = await searchParams;
  const error = getAuthErrorMessage(params.error);

  return (
    <div className="bg-zinc-50">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex flex-col gap-2">
            <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
              Dashboard
            </p>
            <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
              Review workspace
            </h1>
            <p className="max-w-2xl text-base leading-7 text-zinc-600">
              This page will become the signed-in command center for due
              reviews, problem tracking, and immutable review history.
            </p>
          </div>
          <form action={signOutAction}>
            <button
              type="submit"
              className="inline-flex h-10 items-center justify-center rounded-md border border-zinc-300 bg-white px-4 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
            >
              Sign out
            </button>
          </form>
        </div>

        {error ? (
          <div className="mt-6 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {error}
          </div>
        ) : null}

        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {summaryItems.map((item) => (
            <div
              key={item.label}
              className="rounded-lg border border-zinc-200 bg-white p-5 shadow-sm"
            >
              <p className="text-sm font-medium text-zinc-500">{item.label}</p>
              <p className="mt-3 text-3xl font-semibold text-zinc-950">
                {item.value}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-8 rounded-lg border border-dashed border-zinc-300 bg-white p-6">
          <h2 className="text-base font-semibold text-zinc-950">
            No review data yet
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-zinc-600">
            Supabase integration will add authentication, saved problems, due
            review calculations, and review history in the next vertical slices.
          </p>
        </div>
      </section>
    </div>
  );
}
