"use server";

import { revalidatePath } from "next/cache";
import { importLeetCodeHistory } from "@/data/leetcode-history-import";
import { isValidDateOnly } from "@/lib/date-only";
import { getLeetCodeProblemByFrontendId } from "@/lib/leetcode-catalog";
import type {
  LeetCodeHistoryImportActionResult,
  LeetCodeHistoryImportRequestProblem,
} from "@/lib/leetcode-history-import-persistence";
import { createClient } from "@/lib/supabase/server";
import type { Json } from "@/types/database";

const maximumImportProblems = 4000;

function logImportError(operation: string, error: unknown) {
  if (process.env.NODE_ENV === "production") return;
  const details = error as {
    code?: string;
    message?: string;
    details?: string;
    hint?: string;
  };
  console.error("LeetCode history import failed", {
    operation,
    code: details?.code,
    message: details?.message,
    details: details?.details,
    hint: details?.hint,
  });
}

function isRequestProblem(value: unknown): value is LeetCodeHistoryImportRequestProblem {
  if (!value || typeof value !== "object") return false;
  const problem = value as Partial<LeetCodeHistoryImportRequestProblem>;
  return (
    typeof problem.frontendId === "string" &&
    problem.frontendId.trim().length > 0 &&
    problem.frontendId.length <= 100 &&
    (problem.importKind === "practiced" || problem.importKind === "scheduled") &&
    (problem.historyDate === null ||
      (typeof problem.historyDate === "string" &&
        isValidDateOnly(problem.historyDate)))
  );
}

export async function importLeetCodeHistoryAction(
  submittedProblems: unknown,
): Promise<LeetCodeHistoryImportActionResult> {
  try {
    const client = await createClient();
    const { data, error } = await client.auth.getClaims();
    if (error || !data?.claims?.sub) {
      return { ok: false, error: "not_authenticated" };
    }

    if (!Array.isArray(submittedProblems) || submittedProblems.length === 0) {
      return { ok: false, error: "invalid_submission" };
    }
    if (submittedProblems.length > maximumImportProblems) {
      return { ok: false, error: "too_many_problems" };
    }

    const seenFrontendIds = new Set<string>();
    const seenSlugs = new Set<string>();
    const trustedProblems: Json[] = [];

    for (const value of submittedProblems) {
      if (!isRequestProblem(value)) {
        return { ok: false, error: "invalid_submission" };
      }
      const frontendId = value.frontendId.trim();
      const canonical = getLeetCodeProblemByFrontendId(frontendId);
      if (
        !canonical ||
        seenFrontendIds.has(canonical.frontendId) ||
        seenSlugs.has(canonical.slug)
      ) {
        return { ok: false, error: "invalid_submission" };
      }
      seenFrontendIds.add(canonical.frontendId);
      seenSlugs.add(canonical.slug);
      trustedProblems.push({
        frontend_id: canonical.frontendId,
        slug: canonical.slug,
        title: canonical.title,
        difficulty: canonical.difficulty,
        topics: canonical.topics,
        leetcode_url: canonical.leetcodeUrl,
        external_practice_status:
          value.importKind === "practiced" ? "accepted" : "attempted_only",
        external_activity_date: value.historyDate,
      });
    }

    const result = await importLeetCodeHistory(client, trustedProblems);
    const summary = result.data?.[0];
    if (result.error || !summary) {
      if (
        result.error?.code === "P0001" &&
        result.error.message === "not_authenticated"
      ) {
        return { ok: false, error: "not_authenticated" };
      }
      if (
        result.error?.code === "P0001" &&
        result.error.message === "invalid_submission"
      ) {
        return { ok: false, error: "invalid_submission" };
      }
      logImportError("import_leetcode_history", result.error);
      return { ok: false, error: "save_failed" };
    }

    revalidatePath("/dashboard");
    revalidatePath("/problems");
    revalidatePath("/problems/import");
    revalidatePath("/roadmaps/neetcode-150");

    return {
      ok: true,
      summary: {
        imported: summary.imported_count,
        alreadyTracked: summary.already_tracked_count,
        skipped: summary.skipped_count,
        failed: summary.failed_count,
      },
    };
  } catch (error) {
    logImportError("importLeetCodeHistoryAction", error);
    return { ok: false, error: "save_failed" };
  }
}
