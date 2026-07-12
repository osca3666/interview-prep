"use client";

import { useEffect, useState } from "react";

const ratings = [
  { value: "again", label: "Redo" },
  { value: "good", label: "OK" },
  { value: "easy", label: "Great" },
];

const dateFieldClassName =
  "mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:focus:border-zinc-500 dark:focus:ring-zinc-800 dark:[color-scheme:dark]";

const radioClassName =
  "mt-1 h-4 w-4 border-zinc-300 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-950 dark:text-sky-400 dark:focus:ring-sky-800";

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
  const [todayLocalDate, setTodayLocalDate] = useState("");
  const [practiceDate, setPracticeDate] = useState("");
  const [firstReviewDate, setFirstReviewDate] = useState("");
  const [timeZone, setTimeZone] = useState("");

  useEffect(() => {
    const timeoutId = window.setTimeout(() => {
      const today = getLocalDateInputValue();
      setTodayLocalDate(today);
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
    <fieldset className="rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <legend className="px-1 text-sm font-semibold text-zinc-950 dark:text-zinc-100">
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
            className={radioClassName}
          />
          <span>
            <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Practiced
            </span>
            <span className="block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Use this when you already worked on the problem.
            </span>
          </span>
        </label>

        {startMode === "practiced" ? (
          <div className="ml-7 space-y-4">
            <div>
              <label
                htmlFor="practice_date"
                className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
              >
                Date
              </label>
              <input
                id="practice_date"
                name="practice_date"
                type="date"
                required
                value={practiceDate}
                max={todayLocalDate}
                onChange={(event) => setPracticeDate(event.target.value)}
                className={dateFieldClassName}
              />
            </div>

            <fieldset>
              <legend className="text-sm font-medium text-zinc-700 dark:text-zinc-300">
                How did it go?
              </legend>
              <div className="mt-2 grid grid-cols-3 gap-2">
                {ratings.map((rating) => (
                  <label
                    key={rating.value}
                    className="flex items-center gap-2 rounded-md border border-zinc-200 px-3 py-2 text-sm font-medium text-zinc-700 dark:border-zinc-700 dark:bg-zinc-950/50 dark:text-zinc-200"
                  >
                    <input
                      type="radio"
                      name="rating"
                      value={rating.value}
                      defaultChecked={rating.value === "good"}
                      className="h-4 w-4 border-zinc-300 text-zinc-950 dark:border-zinc-600 dark:bg-zinc-950 dark:text-sky-400 dark:focus:ring-sky-800"
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
            className={radioClassName}
          />
          <span>
            <span className="block text-sm font-medium text-zinc-800 dark:text-zinc-200">
              Schedule
            </span>
            <span className="block text-xs leading-5 text-zinc-500 dark:text-zinc-400">
              Use this to choose when it first appears in review.
            </span>
          </span>
        </label>

        {startMode === "scheduled" ? (
          <div className="ml-7">
            <label
              htmlFor="first_review_date"
              className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
            >
              First review date
            </label>
            <input
              id="first_review_date"
              name="first_review_date"
              type="date"
              required
              value={firstReviewDate}
              min={todayLocalDate}
              onChange={(event) => setFirstReviewDate(event.target.value)}
              className={dateFieldClassName}
            />
          </div>
        ) : null}
      </div>
    </fieldset>
  );
}
