export type LeetCodeHistoryDifficulty = "easy" | "medium" | "hard";

export type LeetCodeHistoryImportProblem = {
  frontendId: number;
  title: string;
  difficulty: LeetCodeHistoryDifficulty;
  importKind: "practiced" | "scheduled";
  result: string;
  dateText?: string;
  acceptedDate: string | null;
  submissionCount: number;
  slug: string;
  leetcodeUrl: string;
};

export type LeetCodeHistorySkippedRow = {
  frontendId: number;
  title: string;
  result: string;
  reason: "duplicate_row";
};

export type LeetCodeHistoryParseStats = {
  totalCandidates: number;
  problemCount: number;
  practicedCount: number;
  scheduledCount: number;
  duplicateCount: number;
  invalidCandidateCount: number;
};

export type LeetCodeHistoryParseResult = {
  importProblems: LeetCodeHistoryImportProblem[];
  acceptedProblems: LeetCodeHistoryImportProblem[];
  skippedRows: LeetCodeHistorySkippedRow[];
  stats: LeetCodeHistoryParseStats;
};

export type LeetCodePracticeHistoryParseOptions = {
  referenceDate?: Date;
};

type ParsedProblemLine = {
  frontendId: number;
  title: string;
};

type ParsedCandidate = ParsedProblemLine & {
  difficulty: LeetCodeHistoryDifficulty;
  result: string;
  submissionCount: number;
  dateText?: string;
  acceptedDate: string | null;
};

const problemLinePattern = /^(\d+)\.\s+(.+)$/;
const acceptedResult = "Accepted";
const weekdayIndexes = new Map([
  ["sun", 0],
  ["mon", 1],
  ["tue", 2],
  ["wed", 3],
  ["thu", 4],
  ["fri", 5],
  ["sat", 6],
]);
const monthIndexes = new Map([
  ["jan", 0],
  ["feb", 1],
  ["mar", 2],
  ["apr", 3],
  ["may", 4],
  ["jun", 5],
  ["jul", 6],
  ["aug", 7],
  ["sep", 8],
  ["oct", 9],
  ["nov", 10],
  ["dec", 11],
]);
const relativeSameDayDatePattern =
  /^(?:just now|a few seconds ago|a minute ago|1 minute ago|(?:[2-9]|[1-9]\d+) minutes ago|an hour ago|1 hour ago|(?:[2-9]|[1-9]\d+) hours ago)$/i;
const submissionResults = new Set([
  "Accepted",
  "Wrong Answer",
  "Runtime Error",
  "Time Limit Exceeded",
  "Memory Limit Exceeded",
  "Compile Error",
  "Output Limit Exceeded",
  "Presentation Error",
  "Internal Error",
]);

function normalizeLines(rawText: string) {
  return rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);
}

function parseProblemLine(line: string): ParsedProblemLine | null {
  const match = line.match(problemLinePattern);

  if (!match) {
    return null;
  }

  const frontendId = Number(match[1]);
  const title = match[2].trim();

  if (!Number.isSafeInteger(frontendId) || frontendId <= 0 || !title) {
    return null;
  }

  return {
    frontendId,
    title,
  };
}

function parseDifficulty(value: string): LeetCodeHistoryDifficulty | null {
  const normalizedValue = value.trim().toLowerCase();

  switch (normalizedValue) {
    case "easy":
      return "easy";
    case "med.":
    case "medium":
      return "medium";
    case "hard":
      return "hard";
    default:
      return null;
  }
}

function isSubmissionResult(value: string) {
  return submissionResults.has(value.trim());
}

function parseSubmissionCount(value: string) {
  if (!/^\d+$/.test(value.trim())) {
    return null;
  }

  const parsed = Number(value.trim());
  return Number.isSafeInteger(parsed) ? parsed : null;
}

function titleToLeetCodeSlug(title: string) {
  return title
    .toLowerCase()
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function createLocalNoonDate(year: number, monthIndex: number, day: number) {
  return new Date(year, monthIndex, day, 12, 0, 0, 0);
}

function normalizeToLocalNoon(date: Date) {
  return createLocalNoonDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate(),
  );
}

function addLocalDays(date: Date, dayDelta: number) {
  return createLocalNoonDate(
    date.getFullYear(),
    date.getMonth(),
    date.getDate() + dayDelta,
  );
}

function formatLocalDateOnly(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

function isRelativeSameDayDateText(dateText: string) {
  return relativeSameDayDatePattern.test(dateText.trim());
}

function isRealLocalDate(year: number, monthIndex: number, day: number) {
  const date = createLocalNoonDate(year, monthIndex, day);

  return (
    date.getFullYear() === year &&
    date.getMonth() === monthIndex &&
    date.getDate() === day
  );
}

function parseAcceptedDate(dateText: string | undefined, referenceDate: Date) {
  if (!dateText) {
    return null;
  }

  const normalizedReferenceDate = normalizeToLocalNoon(referenceDate);
  const normalizedDateText = dateText.trim();
  const lowerDateText = normalizedDateText.toLowerCase();

  if (lowerDateText === "today") {
    return formatLocalDateOnly(normalizedReferenceDate);
  }

  if (isRelativeSameDayDateText(normalizedDateText)) {
    return formatLocalDateOnly(normalizedReferenceDate);
  }

  if (lowerDateText === "yesterday") {
    return formatLocalDateOnly(addLocalDays(normalizedReferenceDate, -1));
  }

  const weekdayIndex = weekdayIndexes.get(lowerDateText);

  if (weekdayIndex !== undefined) {
    let dayDelta = normalizedReferenceDate.getDay() - weekdayIndex;

    if (dayDelta <= 0) {
      dayDelta += 7;
    }

    return formatLocalDateOnly(addLocalDays(normalizedReferenceDate, -dayDelta));
  }

  const monthDayMatch = normalizedDateText.match(
    /^(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2})$/i,
  );

  if (monthDayMatch) {
    const monthIndex = monthIndexes.get(monthDayMatch[1].toLowerCase());
    const day = Number(monthDayMatch[2]);

    if (monthIndex === undefined) {
      return null;
    }

    let year = normalizedReferenceDate.getFullYear();

    if (!isRealLocalDate(year, monthIndex, day)) {
      return null;
    }

    let acceptedDate = formatLocalDateOnly(
      createLocalNoonDate(year, monthIndex, day),
    );

    if (acceptedDate > formatLocalDateOnly(normalizedReferenceDate)) {
      year -= 1;

      if (!isRealLocalDate(year, monthIndex, day)) {
        return null;
      }

      acceptedDate = formatLocalDateOnly(
        createLocalNoonDate(year, monthIndex, day),
      );
    }

    return acceptedDate;
  }

  const historicDateMatch = normalizedDateText.match(
    /^(\d{4})\.(\d{2})\.(\d{2})$/,
  );

  if (historicDateMatch) {
    const year = Number(historicDateMatch[1]);
    const monthIndex = Number(historicDateMatch[2]) - 1;
    const day = Number(historicDateMatch[3]);

    if (!isRealLocalDate(year, monthIndex, day)) {
      return null;
    }

    return formatLocalDateOnly(createLocalNoonDate(year, monthIndex, day));
  }

  return null;
}

function getDateTextBeforeProblem(lines: string[], problemLineIndex: number) {
  const previousLine = lines[problemLineIndex - 1];

  if (!previousLine || parseProblemLine(previousLine)) {
    return undefined;
  }

  if (
    parseDifficulty(previousLine) ||
    isSubmissionResult(previousLine) ||
    parseSubmissionCount(previousLine) !== null
  ) {
    return undefined;
  }

  return previousLine;
}

function parseCandidateAt(
  lines: string[],
  problemLineIndex: number,
  referenceDate: Date,
): ParsedCandidate | null {
  const problemLine = parseProblemLine(lines[problemLineIndex]);

  if (!problemLine) {
    return null;
  }

  const difficulty = parseDifficulty(lines[problemLineIndex + 1] ?? "");
  const result = lines[problemLineIndex + 2]?.trim() ?? "";
  const submissionCount = parseSubmissionCount(
    lines[problemLineIndex + 3] ?? "",
  );

  if (!difficulty || !isSubmissionResult(result) || submissionCount === null) {
    return null;
  }

  const dateText = getDateTextBeforeProblem(lines, problemLineIndex);

  return {
    ...problemLine,
    difficulty,
    result,
    submissionCount,
    dateText,
    acceptedDate: parseAcceptedDate(dateText, referenceDate),
  };
}

function toImportProblem(
  candidate: ParsedCandidate,
): LeetCodeHistoryImportProblem {
  const slug = titleToLeetCodeSlug(candidate.title);

  return {
    frontendId: candidate.frontendId,
    title: candidate.title,
    difficulty: candidate.difficulty,
    importKind:
      candidate.result === acceptedResult ? "practiced" : "scheduled",
    result: candidate.result,
    dateText: candidate.dateText,
    acceptedDate: candidate.acceptedDate,
    submissionCount: candidate.submissionCount,
    slug,
    leetcodeUrl: `https://leetcode.com/problems/${slug}/`,
  };
}

function shouldReplaceAcceptedProblem(
  currentProblem: LeetCodeHistoryImportProblem,
  candidate: ParsedCandidate,
) {
  if (candidate.acceptedDate && !currentProblem.acceptedDate) {
    return true;
  }

  if (!candidate.acceptedDate || !currentProblem.acceptedDate) {
    return false;
  }

  return candidate.acceptedDate > currentProblem.acceptedDate;
}

function shouldReplaceScheduledProblem(
  currentProblem: LeetCodeHistoryImportProblem,
  candidate: ParsedCandidate,
) {
  if (candidate.acceptedDate && !currentProblem.acceptedDate) {
    return true;
  }

  if (!candidate.acceptedDate || !currentProblem.acceptedDate) {
    return false;
  }

  return candidate.acceptedDate > currentProblem.acceptedDate;
}

export function parseLeetCodePracticeHistory(
  rawText: string,
  options: LeetCodePracticeHistoryParseOptions = {},
): LeetCodeHistoryParseResult {
  const lines = normalizeLines(rawText);
  const referenceDate = options.referenceDate ?? new Date();
  const problemsByFrontendId = new Map<number, LeetCodeHistoryImportProblem>();
  const skippedRows: LeetCodeHistorySkippedRow[] = [];
  let totalCandidates = 0;
  let invalidCandidateCount = 0;
  let duplicateCount = 0;

  lines.forEach((line, index) => {
    const problemLine = parseProblemLine(line);

    if (!problemLine) {
      return;
    }

    totalCandidates += 1;

    const candidate = parseCandidateAt(lines, index, referenceDate);

    if (!candidate) {
      invalidCandidateCount += 1;
      return;
    }

    const currentProblem = problemsByFrontendId.get(candidate.frontendId);

    if (currentProblem) {
      duplicateCount += 1;
      skippedRows.push({
        frontendId: candidate.frontendId,
        title: candidate.title,
        result: candidate.result,
        reason: "duplicate_row",
      });

      if (
        candidate.result === acceptedResult &&
        currentProblem.importKind === "scheduled"
      ) {
        problemsByFrontendId.set(
          candidate.frontendId,
          toImportProblem(candidate),
        );
        return;
      }

      if (
        candidate.result === acceptedResult &&
        currentProblem.importKind === "practiced" &&
        shouldReplaceAcceptedProblem(currentProblem, candidate)
      ) {
        problemsByFrontendId.set(
          candidate.frontendId,
          toImportProblem(candidate),
        );
        return;
      }

      if (
        candidate.result !== acceptedResult &&
        currentProblem.importKind === "scheduled" &&
        shouldReplaceScheduledProblem(currentProblem, candidate)
      ) {
        problemsByFrontendId.set(
          candidate.frontendId,
          toImportProblem(candidate),
        );
      }

      return;
    }

    problemsByFrontendId.set(candidate.frontendId, toImportProblem(candidate));
  });

  const importProblems = Array.from(problemsByFrontendId.values());
  const acceptedProblems = importProblems.filter(
    (problem) => problem.importKind === "practiced",
  );
  const scheduledProblems = importProblems.filter(
    (problem) => problem.importKind === "scheduled",
  );

  return {
    importProblems,
    acceptedProblems,
    skippedRows,
    stats: {
      totalCandidates,
      problemCount: importProblems.length,
      practicedCount: acceptedProblems.length,
      scheduledCount: scheduledProblems.length,
      duplicateCount,
      invalidCandidateCount,
    },
  };
}
