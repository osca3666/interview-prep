const summaryItems = [
  { label: "Due today", value: "0" },
  { label: "Active problems", value: "0" },
  { label: "Review events", value: "0" },
];

export default function Dashboard() {
  return (
    <div className="bg-zinc-50">
      <section className="mx-auto w-full max-w-6xl px-5 py-10 sm:px-6 lg:px-8">
        <div className="flex flex-col gap-2">
          <p className="text-sm font-semibold uppercase tracking-wide text-emerald-700">
            Dashboard
          </p>
          <h1 className="text-3xl font-semibold tracking-tight text-zinc-950">
            Review workspace
          </h1>
          <p className="max-w-2xl text-base leading-7 text-zinc-600">
            This page will become the signed-in command center for due reviews,
            problem tracking, and immutable review history.
          </p>
        </div>

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
