import { addProblemAction } from "@/app/problems/actions";
import { LeetCodeProblemCombobox } from "@/components/leetcode-problem-combobox";
import { ProblemStartingStatusFields } from "@/components/problem-starting-status-fields";
import { type LeetCodeProblemSearchOption } from "@/lib/leetcode-catalog-types";

type AddProblemFormProps = {
  returnTo: "/dashboard" | "/problems";
  problemOptions: LeetCodeProblemSearchOption[];
  variant?: "page" | "modal";
  initialFrontendId?: string | null;
};

const textareaClassName =
  "mt-2 block w-full flex-1 resize-y rounded-md border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-950 outline-none transition placeholder:text-zinc-400 focus:border-zinc-500 focus:ring-2 focus:ring-zinc-200 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100 dark:placeholder:text-zinc-500 dark:focus:border-zinc-500 dark:focus:ring-zinc-800";

const labelClassName = "block text-sm font-medium text-zinc-700 dark:text-zinc-300";

const submitButtonClassName =
  "inline-flex h-11 w-full items-center justify-center rounded-md bg-zinc-950 px-5 text-sm font-semibold text-white transition hover:bg-zinc-800 dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white";

export function AddProblemForm({
  returnTo,
  problemOptions,
  variant = "page",
  initialFrontendId,
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
          Track a problem
        </h2>
      )}

      <div
        className={
          isModal
            ? "grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(280px,360px)]"
            : "mt-5 space-y-5"
        }
      >
        <div className="flex min-h-0 flex-col gap-5">
          <LeetCodeProblemCombobox
            options={problemOptions}
            initialFrontendId={initialFrontendId}
          />

          <div className="flex min-h-[12rem] flex-1 flex-col">
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
              rows={isModal ? 10 : 7}
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
          Track problem
        </button>
      </div>
    </form>
  );
}
