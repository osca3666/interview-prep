import Link from "next/link";

export default function Home() {
  return (
    <div className="bg-zinc-50">
      <section className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl flex-col justify-center px-5 py-16 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <p className="mb-5 text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Spaced repetition for coding practice
          </p>
          <h1 className="text-4xl font-semibold tracking-tight text-zinc-950 sm:text-5xl">
            Keep LeetCode problems fresh without turning review into a chore.
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-zinc-600">
            Add problems, see what is due, and build a durable review habit
            around the patterns you are actively learning.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link
              href="/dashboard"
              className="inline-flex h-11 items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800"
            >
              View dashboard
            </Link>
            <a
              href="#mvp"
              className="inline-flex h-11 items-center justify-center rounded-md border border-zinc-300 bg-white px-5 text-sm font-semibold text-zinc-800 transition hover:bg-zinc-100"
            >
              See MVP scope
            </a>
          </div>
        </div>

        <div
          id="mvp"
          className="mt-16 grid gap-4 border-t border-zinc-200 pt-8 sm:grid-cols-3"
        >
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              Track problems
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Store the LeetCode link, difficulty, pattern, and notes you need
              for later review.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              Review what is due
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Prioritize active problems by their next review date instead of a
              static solved list.
            </p>
          </div>
          <div>
            <h2 className="text-sm font-semibold text-zinc-950">
              Keep history
            </h2>
            <p className="mt-2 text-sm leading-6 text-zinc-600">
              Preserve immutable review events so progress is easy to inspect
              and scheduling stays explainable.
            </p>
          </div>
        </div>
      </section>
    </div>
  );
}
