export type LeetCodeCatalogDifficulty = "easy" | "medium" | "hard";

export type LeetCodeCatalogProblem = {
  frontendId: string;
  title: string;
  slug: string;
  difficulty: LeetCodeCatalogDifficulty;
  paidOnly: boolean;
  topics: string[];
  leetcodeUrl: string;
};

export type LeetCodeProblemSearchOption = Pick<
  LeetCodeCatalogProblem,
  "frontendId" | "title" | "difficulty" | "paidOnly"
>;

export type LeetCodeProblemLibraryOption = Pick<
  LeetCodeCatalogProblem,
  | "frontendId"
  | "slug"
  | "title"
  | "difficulty"
  | "paidOnly"
  | "topics"
  | "leetcodeUrl"
>;
