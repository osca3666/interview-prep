import "server-only";

import leetcodeProblems from "@/data/leetcode-problems.json";
import {
  type LeetCodeCatalogProblem,
  type LeetCodeProblemLibraryOption,
  type LeetCodeProblemSearchOption,
} from "@/lib/leetcode-catalog-types";

const catalogProblems = leetcodeProblems as LeetCodeCatalogProblem[];

const problemsByFrontendId = new Map(
  catalogProblems.map((problem) => [problem.frontendId, problem]),
);
const problemsBySlug = new Map(
  catalogProblems.map((problem) => [problem.slug, problem]),
);

export function getLeetCodeProblemByFrontendId(frontendId: string) {
  return problemsByFrontendId.get(frontendId) ?? null;
}

export function getLeetCodeProblemBySlug(slug: string) {
  return problemsBySlug.get(slug) ?? null;
}

export function getLeetCodeProblemSearchOptions(): LeetCodeProblemSearchOption[] {
  return catalogProblems.map(({ frontendId, title, difficulty, paidOnly }) => ({
    frontendId,
    title,
    difficulty,
    paidOnly,
  }));
}

export function getLeetCodeProblemLibraryOptions(): LeetCodeProblemLibraryOption[] {
  return catalogProblems.map(
    ({ frontendId, slug, title, difficulty, paidOnly, topics, leetcodeUrl }) => ({
      frontendId,
      slug,
      title,
      difficulty,
      paidOnly,
      topics,
      leetcodeUrl,
    }),
  );
}
