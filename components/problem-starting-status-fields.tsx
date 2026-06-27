"use client";

import { useEffect, useState } from "react";

const ratings = [
  { value: "again", label: "Redo" },
  { value: "good", label: "OK" },
  { value: "easy", label: "Great" },
];

function getLocalDateInputValue(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function ProblemStartingStatusFields() {
  const [startMode, setStartMode] = useState<"practiced" | "scheduled">(
    "practiced",
  );
  const [practiceDate, setPracticeDate] = useState("");
  const [firstReviewDate, setFirstReviewDate] = useState("");
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const today = getLocalDateInputValue();
      setPracticeDate(today);
      setFirstReviewDate(today);

      try {
        setTimeZone(Intl.DateTimeFormat().resolvedOptions().timeZone ?? "");
      } catch {
        setTimeZone("");
      }
    }, 0);

    return () => window.clearTimeout(timeoutId);
  }, []);

  return (
    <fieldset className="rounded-md border border-zinc-200 p-4">
      <legend className="px-1 text-sm font-semibold text-zinc-950">
        Starting status
      </legend>
      <input type="hidden" name="time_zone" value={timeZone} />

      <div className="mt-3 space-y-4">
        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="start_mode"
            value="practiced"
            checked={startMode === "practiced"}
            onChange={() => setStartMode("practiced")}
            className="mt-1 h-4 w-4 border-zinc-300 text-zinc-950"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-800">
              I practiced this problem
            </span>
            <span className="block text-xs leading-5 text-zinc-500">
              Use this when you already worked on the problem.
            </span>
          </span>
        </label>

        {startMode === "practiced" ? (
          <div className="ml-7 space-y-4">
            <div>
              <label
                htmlFor="practice_date"
                className="block text-sm font-medium text-zinc-700"
              >
                Practice date
              </label>
              <input
                id="practice_date"
                name="practice_date"
                type="date"
                required
                value={practiceDate}
                max={practiceDate}
                onChange={(event) => setPracticeDate(event.target.value)}
                className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-zinc-700">
                How did it go?
              </legend>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {ratings.map((rating) => (
                  <label
                    key={rating.value}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700"
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={rating.value}
                      defaultChecked={rating.value === "good"}
                      className="h-4 w-4 border-zinc-300 text-zinc-950"
                    />
                    {rating.label}
                  </label>
                ))}
              </div>
            </fieldset>
          </div>
        ) : null}

        <label className="flex items-start gap-3">
          <input
            type="radio"
            name="start_mode"
            value="scheduled"
            checked={startMode === "scheduled"}
            onChange={() => setStartMode("scheduled")}
            className="mt-1 h-4 w-4 border-zinc-300 text-zinc-950"
          />
          <span>
            <span className="block text-sm font-medium text-zinc-800">
              I have not practiced it yet
            </span>
            <span className="block text-xs leading-5 text-zinc-500">
              Use this to choose when it first appears in review.
            </span>
          </span>
        </label>

        {startMode === "scheduled" ? (
          <div className="ml-7">
            <label
              htmlFor="first_review_date"
              className="block text-sm font-medium text-zinc-700"
            >
              First review date
            </label>
            <input
              id="first_review_date"
              name="first_review_date"
              type="date"
              required
              value={firstReviewDate}
              onChange={(event) => setFirstReviewDate(event.target.value)}
              className="mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200"
            />
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
