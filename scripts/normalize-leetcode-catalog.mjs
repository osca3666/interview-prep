import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const inputPath = path.join("scripts", "input", "leetcode_questions_mini.json");
const outputPath = path.join("data", "leetcode-problems.json");
const validDifficulties = new Set(["easy", "medium", "hard"]);

function asString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function deriveSlugFromUrl(value) {
  const rawUrl = asString(value);

  if (!rawUrl) {
    return null;
  }

  try {
    const parsedUrl = new URL(rawUrl);
    const pathParts = parsedUrl.pathname.split("/").filter(Boolean);
    const problemsIndex = pathParts.indexOf("problems");
    const slug = problemsIndex >= 0 ? pathParts[problemsIndex + 1] : null;

    return slug ? slug.trim() : null;
  } catch {
    return null;
  }
}

function parseNumericFrontendId(value) {
  return /^\d+$/.test(value) ? Number(value) : null;
}

function compareByFrontendId(first, second) {
  const firstNumericId = parseNumericFrontendId(first.frontendId);
  const secondNumericId = parseNumericFrontendId(second.frontendId);

  if (firstNumericId !== null && secondNumericId !== null) {
    return firstNumericId - secondNumericId;
  }

  if (firstNumericId !== null) {
    return -1;
  }

  if (secondNumericId !== null) {
    return 1;
  }

  const frontendIdComparison = first.frontendId.localeCompare(
    second.frontendId,
  );

  return frontendIdComparison || first.sourceIndex - second.sourceIndex;
}

function addDuplicateErrors(items, key, label, errors) {
  const counts = new Map();

  items.forEach((item) => {
    counts.set(item[key], (counts.get(item[key]) ?? 0) + 1);
  });

  counts.forEach((count, value) => {
    if (count > 1) {
      errors.push(`Duplicate ${label}: ${value}`);
    }
  });
}

function normalizeQuestion(row, sourceIndex, errors) {
  const frontendId = asString(row.questionFrontendId);
  const title = asString(row.title);
  const slug = deriveSlugFromUrl(row.url);
  const difficulty = asString(row.difficulty).toLowerCase();
  const category = asString(row.categoryTitle);

  if (!frontendId) {
    errors.push(`Row ${sourceIndex + 1}: missing questionFrontendId`);
  }

  if (!title) {
    errors.push(`Row ${sourceIndex + 1}: missing title`);
  }

  if (!slug) {
    errors.push(
      `Row ${sourceIndex + 1}: missing or invalid LeetCode problem URL`,
    );
  }

  if (!validDifficulties.has(difficulty)) {
    errors.push(
      `Row ${sourceIndex + 1}: invalid difficulty "${asString(
        row.difficulty,
      )}"`,
    );
  }

  if (!category) {
    errors.push(`Row ${sourceIndex + 1}: missing categoryTitle`);
  }

  if (
    !frontendId ||
    !title ||
    !slug ||
    !validDifficulties.has(difficulty) ||
    !category
  ) {
    return null;
  }

  return {
    sourceIndex,
    frontendId,
    title,
    slug,
    difficulty,
    paidOnly: Boolean(row.isPaidOnly),
    topics: Array.isArray(row.topicTags)
      ? row.topicTags
          .map((tag) => asString(tag?.name))
          .filter((tagName) => tagName.length > 0)
      : [],
    leetcodeUrl: `https://leetcode.com/problems/${slug}/`,
    category,
  };
}

async function main() {
  const sourceText = await readFile(inputPath, "utf8");
  const sourceRows = JSON.parse(sourceText);

  if (!Array.isArray(sourceRows)) {
    throw new Error(`Expected ${inputPath} to contain a JSON array.`);
  }

  const errors = [];
  const normalizedItems = sourceRows
    .map((row, index) => normalizeQuestion(row, index, errors))
    .filter(Boolean);

  addDuplicateErrors(normalizedItems, "frontendId", "frontendId", errors);
  addDuplicateErrors(normalizedItems, "slug", "slug", errors);

  if (errors.length > 0) {
    console.error("LeetCode catalog normalization failed.");
    console.error(`${errors.length} validation error(s) found:`);
    errors.slice(0, 50).forEach((error) => {
      console.error(`- ${error}`);
    });

    if (errors.length > 50) {
      console.error(`...and ${errors.length - 50} more.`);
    }

    process.exitCode = 1;
    return;
  }

  const sortedItems = normalizedItems.toSorted(compareByFrontendId);
  const outputItems = sortedItems.map((item) => ({
    frontendId: item.frontendId,
    title: item.title,
    slug: item.slug,
    difficulty: item.difficulty,
    paidOnly: item.paidOnly,
    topics: item.topics,
    leetcodeUrl: item.leetcodeUrl,
    category: item.category,
  }));
  const difficultyCounts = outputItems.reduce(
    (counts, item) => {
      counts[item.difficulty] += 1;
      return counts;
    },
    { easy: 0, medium: 0, hard: 0 },
  );
  const categoryCounts = outputItems.reduce((counts, item) => {
    counts.set(item.category, (counts.get(item.category) ?? 0) + 1);
    return counts;
  }, new Map());
  const paidCount = outputItems.filter((item) => item.paidOnly).length;
  const freeCount = outputItems.length - paidCount;

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(outputItems, null, 2)}\n`);

  console.log("LeetCode catalog normalized.");
  console.log(`Source rows: ${sourceRows.length}`);
  console.log(`Output rows: ${outputItems.length}`);
  console.log(`Invalid/skipped rows: ${sourceRows.length - outputItems.length}`);
  console.log(`Duplicate frontend IDs: 0`);
  console.log(`Duplicate slugs: 0`);
  console.log(`Free problems: ${freeCount}`);
  console.log(`Paid problems: ${paidCount}`);
  console.log(`Easy: ${difficultyCounts.easy}`);
  console.log(`Medium: ${difficultyCounts.medium}`);
  console.log(`Hard: ${difficultyCounts.hard}`);
  console.log("Categories:");
  Array.from(categoryCounts.entries())
    .sort((first, second) => second[1] - first[1])
    .forEach(([category, count]) => {
      console.log(`  ${category}: ${count}`);
    });
  console.log(`Wrote ${outputPath}`);
}

main().catch((error) => {
  console.error("LeetCode catalog normalization failed.");
  console.error(error);
  process.exitCode = 1;
});
