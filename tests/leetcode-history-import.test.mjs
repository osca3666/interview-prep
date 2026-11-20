import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { parseLeetCodePracticeHistory } = loadTypeScriptModule(
  new URL("../lib/leetcode-history-import.ts", import.meta.url),
);
const { classifyLeetCodeHistoryImport } = loadTypeScriptModule(
  new URL("../lib/leetcode-history-import-matching.ts", import.meta.url),
);

const referenceDate = new Date(2026, 10, 2, 12);
const catalog = [
  { frontendId: "1", title: "Two Sum", slug: "two-sum", difficulty: "easy", paidOnly: false, topics: ["Array"], leetcodeUrl: "https://leetcode.com/problems/two-sum/", category: "Algorithms" },
  { frontendId: "175", title: "Combine Two Tables", slug: "combine-two-tables", difficulty: "easy", paidOnly: false, topics: ["Database"], leetcodeUrl: "https://leetcode.com/problems/combine-two-tables/", category: "Database" },
  { frontendId: "912", title: "Sort an Array", slug: "sort-an-array", difficulty: "medium", paidOnly: false, topics: ["Array"], leetcodeUrl: "https://leetcode.com/problems/sort-an-array/", category: "Algorithms" },
];

test("parser keeps accepted and attempted-only rows, with Accepted winning duplicate input order", () => {
  const parsed = parseLeetCodePracticeHistory(`
Yesterday
1. Two Sum
Easy
Wrong Answer
2
2 hours ago
912. Sort an Array
Med.
Accepted
1
Today
1. Two Sum
Easy
Accepted
3
`, { referenceDate });
  assert.equal(parsed.stats.problemCount, 2);
  assert.equal(parsed.stats.duplicateCount, 1);
  assert.equal(parsed.stats.practicedCount, 2);
  assert.equal(parsed.stats.scheduledCount, 0);
  const twoSum = parsed.importProblems.find((problem) => problem.frontendId === 1);
  assert.equal(twoSum.importKind, "practiced");
  assert.equal(twoSum.historyDate, "2026-11-02");
  const sort = parsed.importProblems.find((problem) => problem.frontendId === 912);
  assert.equal(sort.dateText, "2 hours ago");
  assert.equal(sort.historyDate, "2026-11-02");
});

test("classification uses full-catalog frontend IDs and never title matching", () => {
  const parsed = parseLeetCodePracticeHistory(`
2025.09.14
175. A copied title that differs
Easy
Accepted
1
Oct 2
1. Two Sum
Easy
Runtime Error
4
Today
999999. Unknown
Hard
Accepted
1
`, { referenceDate });
  const classification = classifyLeetCodeHistoryImport({
    importProblems: parsed.importProblems,
    catalogProblems: catalog,
    existingProblems: [{ id: "existing", leetcode_frontend_id: "1", leetcode_slug: "two-sum", title: "Two Sum", difficulty: "easy" }],
  });
  assert.equal(classification.readyAsPracticed.length, 1);
  assert.equal(classification.readyAsPracticed[0].problem.title, "Combine Two Tables");
  assert.equal(classification.alreadyInLibrary.length, 1);
  assert.equal(classification.alreadyInLibrary[0].problem.importKind, "scheduled");
  assert.equal(classification.unmatched.length, 1);
  assert.equal(classification.unmatched[0].frontendId, "999999");
});

test("accepted rows with missing dates remain importable without inventing a date", () => {
  const parsed = parseLeetCodePracticeHistory(`
1. Two Sum
Easy
Accepted
1
`, { referenceDate });
  assert.equal(parsed.importProblems[0].dateText, undefined);
  assert.equal(parsed.importProblems[0].historyDate, null);
  const classification = classifyLeetCodeHistoryImport({ importProblems: parsed.importProblems, catalogProblems: catalog, existingProblems: [] });
  assert.equal(classification.readyAsPracticed.length, 1);
});
