"use client";

import { useId, useMemo, useState } from "react";
import { DifficultyBadge } from "@/components/problem-table-primitives";
import { type LeetCodeProblemSearchOption } from "@/lib/leetcode-catalog-types";

type LeetCodeProblemComboboxProps = {
  options: LeetCodeProblemSearchOption[];
  initialFrontendId?: string | null;
};

function getOptionLabel(option: LeetCodeProblemSearchOption) {
  return `${option.frontendId}. ${option.title}`;
}

function matchesQuery(option: LeetCodeProblemSearchOption, query: string) {
  const normalizedQuery = query.trim().toLowerCase();

  if (!normalizedQuery) {
    return false;
  }

  return [
    option.frontendId,
    option.title,
    option.difficulty,
    option.paidOnly ? "premium" : "free",
  ]
    .join(" ")
    .toLowerCase()
    .includes(normalizedQuery);
}

export function LeetCodeProblemCombobox({
  options,
  initialFrontendId,
}: LeetCodeProblemComboboxProps) {
  const inputId = useId();
  const initialOption = useMemo(
    () =>
      initialFrontendId
        ? options.find((option) => option.frontendId === initialFrontendId) ??
          null
        : null,
    [initialFrontendId, options],
  );
  const [query, setQuery] = useState(
    initialOption ? getOptionLabel(initialOption) : "",
  );
  const [selectedOption, setSelectedOption] =
    useState<LeetCodeProblemSearchOption | null>(initialOption);
  const filteredOptions = useMemo(() => {
    if (!query.trim()) {
      return [];
    }

    return options.filter((option) => matchesQuery(option, query)).slice(0, 8);
  }, [options, query]);
  const showSuggestions =
    query.trim().length > 0 &&
    (selectedOption === null || query !== getOptionLabel(selectedOption));

  function handleSelect(option: LeetCodeProblemSearchOption) {
    setSelectedOption(option);
    setQuery(getOptionLabel(option));
  }

  return (
    <div>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-zinc-700 dark:text-zinc-300"
      >
        LeetCode problem
      </label>
      <input
        type="hidden"
        name="leetcode_frontend_id"
        value={selectedOption?.frontendId ?? ""}
      />
      <div className="relative mt-2">
        <input
          id={inputId}
          type="search"
          required
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setSelectedOption(null);
          }}
          placeholder="Search by number or title, e.g. 1 or Two Sum"
          autoComplete="off"
          className="block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800"
        />
        {showSuggestions ? (
          <div className="absolute z-20 mt-2 max-h-72 w-full overflow-y-auto rounded-md border border-zinc-200 bg-white shadow-lg dark:border-zinc-800 dark:bg-zinc-950">
            {filteredOptions.length > 0 ? (
              <ul className="py-1">
                {filteredOptions.map((option) => (
                  <li key={option.frontendId}>
                    <button
                      type="button"
                      onClick={() => handleSelect(option)}
                      className="flex w-full items-center justify-between gap-3 px-3 py-2 text-left transition hover:bg-zinc-50 focus-visible:bg-zinc-50 focus-visible:outline-none dark:hover:bg-zinc-900 dark:focus-visible:bg-zinc-900"
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-semibold text-zinc-950 dark:text-zinc-100">
                          {option.frontendId}. {option.title}
                        </span>
                        {option.paidOnly ? (
                          <span className="mt-0.5 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
                            Premium
                          </span>
                        ) : null}
                      </span>
                      <DifficultyBadge
                        difficulty={option.difficulty}
                        className="shrink-0"
                      />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="px-3 py-2 text-sm text-zinc-500 dark:text-zinc-400">
                No catalog problems match your search.
              </p>
            )}
          </div>
        ) : null}
      </div>
    </div>
  );
}
