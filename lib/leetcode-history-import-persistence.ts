export type LeetCodeHistoryImportRequestProblem = {
  frontendId: string;
  importKind: "practiced" | "scheduled";
  historyDate: string | null;
};

export type LeetCodeHistoryImportSummary = {
  imported: number;
  alreadyTracked: number;
  skipped: number;
  failed: number;
};

export type LeetCodeHistoryImportActionResult =
  | { ok: true; summary: LeetCodeHistoryImportSummary }
  | {
      ok: false;
      error:
        | "not_authenticated"
        | "invalid_submission"
        | "too_many_problems"
        | "save_failed";
    };
