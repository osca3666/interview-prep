import { addProblemAction } from "@/app/problems/actions";
import { ProblemStartingStatusFields } from "@/components/problem-starting-status-fields";

type AddProblemFormProps = {
  returnTo: "/dashboard" | "/problems";
  variant?: "page" | "modal";
};

const fieldClassName =
  "mt-2 block h-11 w-full rounded-md border border-zinc-300 bg-white px-3 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800 dark:[color-scheme:dark]";

const textareaClassName =
  "mt-2 block w-full rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800";

const labelClassName = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const submitButtonClassName =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white";

export function AddProblemForm({
  returnTo,
  variant = "page",
}: AddProblemFormProps) {
  const isModal = variant === "modal";

  return (
    <form
      action={addProblemAction}
      className={
        isModal
          ? "p-5 dark:bg-zinc-900 sm:p-6"
          : "rounded-lg border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
      }
    >
      <input type="hidden" name="return_to" value={returnTo} />
      {isModal ? null : (
        <h2 className="text-base font-semibold text-zinc-950 dark:text-zinc-100">
          Add problem
        </h2>
      )}

      <div
        className={
          isModal
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
            : "mt-5 space-y-5"
        }
      >
        <div className="space-y-5">
          <div>
            <label
              htmlFor="leetcode_url"
              className={labelClassName}
            >
              LeetCode URL
            </label>
            <input
              id="leetcode_url"
              name="leetcode_url"
              type="url"
              required
              placeholder="https://leetcode.com/problems/two-sum/"
              className={fieldClassName}
            />
          </div>

          <div>
            <label
              htmlFor="title"
              className={labelClassName}
            >
              Title
            </label>
            <input
              id="title"
              name="title"
              type="text"
              required
              maxLength={160}
              className={fieldClassName}
            />
          </div>

          <div
            className={
              isModal ? "grid gap-5 sm:grid-cols-2" : "space-y-5"
            }
          >
            <div>
              <label
                htmlFor="difficulty"
                className={labelClassName}
              >
                Difficulty
              </label>
              <select
                id="difficulty"
                name="difficulty"
                required
                defaultValue="medium"
                className={fieldClassName}
              >
                <option value="easy">Easy</option>
                <option value="medium">Medium</option>
                <option value="hard">Hard</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="pattern"
                className={labelClassName}
              >
                Pattern
              </label>
              <input
                id="pattern"
                name="pattern"
                type="text"
                maxLength={80}
                placeholder="Two pointers"
                className={fieldClassName}
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="notes"
              className={labelClassName}
            >
              Notes
            </label>
            <textarea
              id="notes"
              name="notes"
              maxLength={4000}
              rows={isModal ? 7 : 5}
              className={textareaClassName}
            />
          </div>
        </div>

        <ProblemStartingStatusFields />
      </div>

      <div
        className={
          isModal
            ? "mt-6 flex justify-end border-t border-zinc-200 pt-5 dark:border-zinc-800"
            : "mt-5"
        }
      >
        <button
          type="submit"
          className={
            isModal
              ? `${submitButtonClassName} sm:w-auto`
              : submitButtonClassName
          }
        >
          Add problem
        </button>
      </div>
    </form>
  );
}
