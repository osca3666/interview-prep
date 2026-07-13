import { type LeetCodeProblemLibraryOption } from "@/lib/leetcode-catalog-types";
import {
  type LeetCodeHistoryImportProblem,
  type LeetCodeHistoryDifficulty,
} from "@/lib/leetcode-history-import";

export type ExistingLibraryProblemForImport = {
  id: string;
  leetcode_frontend_id: string | null;
  leetcode_slug: string;
  title: string;
  difficulty: string;
};

export type CanonicalImportPreviewProblem = {
  frontendId: string;
  title: string;
  slug: string;
  difficulty: LeetCodeProblemLibraryOption["difficulty"];
  leetcodeUrl: string;
  topics: string[];
  importKind: LeetCodeHistoryImportProblem["importKind"];
  result: string;
  submissionCount: number;
  dateText?: string;
  acceptedDate: string | null;
};

export type ReadyToImportPreviewRow = {
  problem: CanonicalImportPreviewProblem;
};

export type AlreadyInLibraryPreviewRow = {
  problem: CanonicalImportPreviewProblem;
  existingProblem: ExistingLibraryProblemForImport;
};

export type UnmatchedImportPreviewRow = {
  frontendId: string;
  parsedTitle: string;
  parsedDifficulty: LeetCodeHistoryDifficulty;
  importKind: LeetCodeHistoryImportProblem["importKind"];
  result: string;
  submissionCount: number;
  dateText?: string;
  acceptedDate: string | null;
  reason: "catalog_problem_not_found";
};

export type LeetCodeHistoryImportClassification = {
  readyAsPracticed: ReadyToImportPreviewRow[];
  readyToSchedule: ReadyToImportPreviewRow[];
  alreadyInLibrary: AlreadyInLibraryPreviewRow[];
  unmatched: UnmatchedImportPreviewRow[];
};

type ClassifyLeetCodeHistoryImportInput = {
  importProblems: LeetCodeHistoryImportProblem[];
  catalogProblems: LeetCodeProblemLibraryOption[];
  existingProblems: ExistingLibraryProblemForImport[];
};

function normalizeFrontendId(frontendId: string | number | null | undefined) {
  return String(frontendId ?? "").trim();
}

function toCanonicalPreviewProblem(
  parsedProblem: LeetCodeHistoryImportProblem,
  catalogProblem: LeetCodeProblemLibraryOption,
): CanonicalImportPreviewProblem {
  return {
    frontendId: normalizeFrontendId(catalogProblem.frontendId),
    title: catalogProblem.title,
    slug: catalogProblem.slug,
    difficulty: catalogProblem.difficulty,
    leetcodeUrl: catalogProblem.leetcodeUrl,
    topics: catalogProblem.topics,
    importKind: parsedProblem.importKind,
    result: parsedProblem.result,
    submissionCount: parsedProblem.submissionCount,
    dateText: parsedProblem.dateText,
    acceptedDate: parsedProblem.acceptedDate,
  };
}

export function classifyLeetCodeHistoryImport({
  importProblems,
  catalogProblems,
  existingProblems,
}: ClassifyLeetCodeHistoryImportInput): LeetCodeHistoryImportClassification {
  const catalogProblemsByFrontendId = new Map(
    catalogProblems.map((problem) => [
      normalizeFrontendId(problem.frontendId),
      problem,
    ]),
  );
  const existingProblemsByFrontendId = new Map(
    existingProblems
      .filter((problem) => problem.leetcode_frontend_id)
      .map((problem) => [
        normalizeFrontendId(problem.leetcode_frontend_id),
        problem,
      ]),
  );
  const existingProblemsBySlug = new Map(
    existingProblems.map((problem) => [problem.leetcode_slug, problem]),
  );

  return importProblems.reduce<LeetCodeHistoryImportClassification>(
    (classification, parsedProblem) => {
      const parsedFrontendId = normalizeFrontendId(parsedProblem.frontendId);
      const catalogProblem =
        catalogProblemsByFrontendId.get(parsedFrontendId);

      if (!catalogProblem) {
        classification.unmatched.push({
          frontendId: parsedFrontendId,
          parsedTitle: parsedProblem.title,
          parsedDifficulty: parsedProblem.difficulty,
          importKind: parsedProblem.importKind,
          result: parsedProblem.result,
          submissionCount: parsedProblem.submissionCount,
          dateText: parsedProblem.dateText,
          acceptedDate: parsedProblem.acceptedDate,
          reason: "catalog_problem_not_found",
        });
        return classification;
      }

      const canonicalProblem = toCanonicalPreviewProblem(
        parsedProblem,
        catalogProblem,
      );
      const existingProblem =
        existingProblemsByFrontendId.get(canonicalProblem.frontendId) ??
        existingProblemsBySlug.get(canonicalProblem.slug);

      if (existingProblem) {
        classification.alreadyInLibrary.push({
          problem: canonicalProblem,
          existingProblem,
        });
        return classification;
      }

      const readyRows =
        canonicalProblem.importKind === "practiced"
          ? classification.readyAsPracticed
          : classification.readyToSchedule;

      readyRows.push({
        problem: canonicalProblem,
      });
      return classification;
    },
    {
      readyAsPracticed: [],
      readyToSchedule: [],
      alreadyInLibrary: [],
      unmatched: [],
    },
  );
}
