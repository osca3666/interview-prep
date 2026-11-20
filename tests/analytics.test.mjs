import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { buildAnalyticsSnapshot, getLocalDateKey } = loadTypeScriptModule(
  new URL("../lib/analytics.ts", import.meta.url),
);
const { getAnalyticsSnapshot } = loadTypeScriptModule(
  new URL("../data/analytics.ts", import.meta.url),
);
const { createAnalyticsDemoSnapshot, isAnalyticsDemoEnabled } = loadTypeScriptModule(
  new URL("../lib/analytics-demo-data.ts", import.meta.url),
);

const referenceTime = new Date("2026-11-03T18:00:00.000Z");
const timeZone = "America/Denver";

function event(id, userProblemId, reviewedAt, rating = "good", extra = {}) {
  return { id, userProblemId, reviewedAt, rating, ...extra };
}

function problem(id, topics = [], masteryScore = 0, extra = {}) {
  return { id, topics, masteryScore, difficulty: "medium", ...extra };
}

test("empty accounts produce honest zero metrics and no inferred mastery", () => {
  const result = buildAnalyticsSnapshot({ events: [], problems: [problem("imported", ["Array"], 0)], timeZone, referenceTime });
  assert.equal(result.lifetimeSessions, 0);
  assert.deepEqual(result.summary, { uniqueProblems: 0, sessions: 0, reviews: 0, activeDays: 0 });
  assert.deepEqual(result.mastery, { building: 0, developing: 0, strong: 0 });
  assert.deepEqual(result.topics, []);
});

test("first practice and repeat reviews are classified from chronological event history", () => {
  const result = buildAnalyticsSnapshot({
    events: [
      event("b", "one", "2026-11-01T18:00:00.000Z", "ok"),
      event("a", "one", "2026-10-30T18:00:00.000Z", "bad"),
      event("c", "two", "2026-11-02T18:00:00.000Z", "good"),
    ],
    problems: [problem("one", ["Array", "Hash Table"], 2), problem("two", ["Array", "Tree"], 8)],
    timeZone,
    referenceTime,
  });
  assert.deepEqual(result.summary, { uniqueProblems: 2, sessions: 3, reviews: 1, activeDays: 3 });
  assert.deepEqual(result.ratings, { bad: 1, ok: 1, good: 1 });
  assert.deepEqual(result.topics.slice(0, 3), [
    { topic: "Array", uniqueProblems: 2 },
    { topic: "Hash Table", uniqueProblems: 1 },
    { topic: "Tree", uniqueProblems: 1 },
  ]);
  assert.deepEqual(result.mastery, { building: 1, developing: 0, strong: 1 });
});

test("an event before the display window makes the next event a repeat review", () => {
  const result = buildAnalyticsSnapshot({
    events: [
      event("old", "one", "2025-01-01T18:00:00.000Z"),
      event("recent", "one", "2026-11-03T18:00:00.000Z"),
    ],
    problems: [problem("one", ["Array"], 5)],
    timeZone,
    referenceTime,
  });
  assert.equal(result.summary.sessions, 1);
  assert.equal(result.summary.reviews, 1);
  assert.equal(result.activity.daily.at(-1).reviews, 1);
  assert.equal(result.activity.daily.at(-1).firstPractices, 0);
});

test("the first genuine calibration rating is a first in-app practice", () => {
  const result = buildAnalyticsSnapshot({
    events: [event("calibration", "imported", "2026-11-03T17:00:00.000Z", "bad")],
    problems: [problem("imported", ["Database"], 0)],
    timeZone,
    referenceTime,
  });
  assert.equal(result.activity.daily.at(-1).firstPractices, 1);
  assert.equal(result.summary.reviews, 0);
});

test("Practice Over Time combines imported Accepted history with authoritative V1 activity", () => {
  const result = buildAnalyticsSnapshot({
    events: [
      event("calibration", "imported", "2026-11-01T18:00:00.000Z", "ok", {
        practiceLocalDate: "2026-11-01",
        prePracticeProblemType: "review",
      }),
      event("new", "manual-new", "2026-11-02T18:00:00.000Z", "good", {
        practiceLocalDate: "2026-11-02",
        prePracticeProblemType: "new",
      }),
    ],
    problems: [
      problem("imported", ["Database"], 4, {
        difficulty: "hard",
        source: "leetcode_import",
        externalPracticeStatus: "accepted",
        externalActivityDate: "2026-11-01",
      }),
      problem("manual-new", ["Array"], 3, { difficulty: "easy" }),
    ],
    timeZone,
    referenceTime,
  });

  const november = result.practiceOverTime.monthly.at(-1);
  assert.deepEqual(november.difficulty, { easy: 1, medium: 0, hard: 2 });
  assert.deepEqual(november.activity, {
    historicalAccepted: 1,
    new: 1,
    review: 1,
  });
  assert.equal(november.importedAccepted, 1);
  assert.equal(november.interviewPrepPractice, 2);
  assert.equal(november.total, 3);
  assert.equal(result.lifetimeRecordedActivity, 3);
});

test("Practice Over Time uses saved local dates and omits undated imported history", () => {
  const result = buildAnalyticsSnapshot({
    events: [
      event("local", "one", "2026-11-03T07:30:00.000Z", "ok", {
        practiceLocalDate: "2026-11-02",
        prePracticeProblemType: "review",
      }),
    ],
    problems: [
      problem("one", [], 4, { difficulty: "medium" }),
      problem("undated", [], 0, {
        difficulty: "easy",
        source: "leetcode_import",
        externalPracticeStatus: "accepted",
        externalActivityDate: null,
      }),
    ],
    timeZone,
    referenceTime,
  });

  const currentWeek = result.practiceOverTime.weekly.at(-1);
  assert.equal(currentWeek.activity.review, 1);
  assert.equal(currentWeek.activity.historicalAccepted, 0);
  assert.equal(result.lifetimeRecordedActivity, 1);
});

test("daily plan completion is not counted without its underlying event and extra practice is", () => {
  const result = buildAnalyticsSnapshot({
    events: [event("assigned", "one", "2026-11-03T15:00:00.000Z"), event("extra", "two", "2026-11-03T16:00:00.000Z")],
    problems: [problem("one"), problem("two")],
    timeZone,
    referenceTime,
  });
  assert.equal(result.summary.sessions, 2);
  assert.equal(result.summary.uniqueProblems, 2);
});

test("Denver local dates honor midnight and DST boundaries", () => {
  assert.equal(getLocalDateKey(new Date("2026-11-03T06:30:00.000Z"), timeZone), "2026-11-02");
  assert.equal(getLocalDateKey(new Date("2026-11-03T07:30:00.000Z"), timeZone), "2026-11-03");
  const result = buildAnalyticsSnapshot({
    events: [
      event("before", "one", "2026-11-01T07:30:00.000Z"),
      event("after", "two", "2026-11-01T08:30:00.000Z"),
    ],
    problems: [problem("one"), problem("two")],
    timeZone,
    referenceTime,
  });
  assert.equal(result.summary.activeDays, 1);
  assert.equal(result.activity.daily.find((bucket) => bucket.key === "2026-11-01").total, 2);
});

test("weekly and monthly comparisons use equal elapsed calendar windows", () => {
  const result = buildAnalyticsSnapshot({
    events: [
      event("current-week-1", "a", "2026-11-02T18:00:00.000Z"),
      event("current-week-2", "b", "2026-11-03T18:00:00.000Z"),
      event("previous-week", "c", "2026-10-27T18:00:00.000Z"),
      event("previous-month", "d", "2026-10-02T18:00:00.000Z"),
    ],
    problems: [problem("a"), problem("b"), problem("c"), problem("d")],
    timeZone,
    referenceTime,
  });
  assert.deepEqual(
    { current: result.comparisons.week.current, previous: result.comparisons.week.previous },
    { current: 2, previous: 1 },
  );
  assert.deepEqual(
    { current: result.comparisons.month.current, previous: result.comparisons.month.previous },
    { current: 2, previous: 1 },
  );
});

test("unknown ratings are ignored and duplicate event rows do not inflate totals", () => {
  const duplicate = event("same", "one", "2026-11-03T18:00:00.000Z", "unknown");
  const result = buildAnalyticsSnapshot({ events: [duplicate, duplicate], problems: [problem("one")], timeZone, referenceTime });
  assert.equal(result.lifetimeSessions, 1);
  assert.equal(result.summary.sessions, 1);
  assert.deepEqual(result.ratings, { bad: 0, ok: 0, good: 0 });
});

test("large histories aggregate without changing input order", () => {
  const events = Array.from({ length: 5_000 }, (_, index) => event(
    String(index),
    `problem-${index % 200}`,
    new Date(referenceTime.getTime() - (index % 20) * 86_400_000).toISOString(),
    index % 3 === 0 ? "bad" : index % 3 === 1 ? "ok" : "good",
  ));
  const originalFirst = events[0];
  const result = buildAnalyticsSnapshot({
    events,
    problems: Array.from({ length: 200 }, (_, index) => problem(`problem-${index}`, ["Array"], 5)),
    timeZone,
    referenceTime,
  });
  assert.equal(result.summary.sessions, 5_000);
  assert.equal(events[0], originalFirst);
  assert.equal(result.topics[0].uniqueProblems, 200);
});

function analyticsClientStub() {
  const queries = [];
  const client = {
    from(table) {
      const query = { table, filters: [], orders: [] };
      queries.push(query);
      const builder = {
        select(fields) { query.fields = fields; return builder; },
        eq(field, value) { query.filters.push([field, value]); return builder; },
        order(field, options) { query.orders.push([field, options]); return builder; },
        limit(value) { query.limit = value; return builder; },
        or(value) { query.cursor = value; return builder; },
        gt(field, value) { query.gt = [field, value]; return builder; },
        maybeSingle() {
          return Promise.resolve({ data: { time_zone: timeZone }, error: null });
        },
        then(resolve, reject) {
          return Promise.resolve({ data: [], error: null }).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, queries };
}

test("the server reader scopes every analytics source to the authenticated user", async () => {
  const { client, queries } = analyticsClientStub();
  const result = await getAnalyticsSnapshot(client, "current-user", referenceTime);
  assert.equal(result.error, null);
  assert.equal(result.data.lifetimeSessions, 0);
  assert.deepEqual(queries.map((query) => query.table).sort(), ["review_events", "user_problems", "user_study_preferences"]);
  for (const query of queries) assert.deepEqual(query.filters, [["user_id", "current-user"]]);
  const eventQuery = queries.find((query) => query.table === "review_events");
  assert.match(eventQuery.fields, /reviewed_at/);
  assert.match(eventQuery.fields, /pre_practice_problem_type/);
  assert.match(eventQuery.fields, /practice_local_date/);
  assert.deepEqual(eventQuery.orders, [["reviewed_at", { ascending: true }], ["id", { ascending: true }]]);
  const problemQuery = queries.find((query) => query.table === "user_problems");
  assert.match(problemQuery.fields, /difficulty/);
  assert.match(problemQuery.fields, /external_activity_date/);
});

test("demo mode is development-only and real data remains the default", () => {
  assert.equal(isAnalyticsDemoEnabled(undefined, "development"), false);
  assert.equal(isAnalyticsDemoEnabled("0", "development"), false);
  assert.equal(isAnalyticsDemoEnabled("1", "development"), true);
  assert.equal(isAnalyticsDemoEnabled(["1"], "development"), true);
  assert.equal(isAnalyticsDemoEnabled("1", "production"), false);
  assert.equal(isAnalyticsDemoEnabled("1", "test"), false);
});

test("demo data is deterministic, internally consistent, and uses the real aggregator", () => {
  const first = createAnalyticsDemoSnapshot({ referenceTime, timeZone });
  const second = createAnalyticsDemoSnapshot({ referenceTime, timeZone });
  assert.deepEqual(first, second);
  assert.ok(first.lifetimeSessions > 100);
  assert.ok(first.summary.uniqueProblems > 10);
  assert.ok(first.summary.activeDays > 10);
  assert.equal(
    first.activity.daily.reduce((total, bucket) => total + bucket.total, 0),
    first.summary.sessions,
  );
  assert.equal(
    first.activity.daily.reduce((total, bucket) => total + bucket.reviews, 0),
    first.summary.reviews,
  );
  assert.equal(
    first.ratings.bad + first.ratings.ok + first.ratings.good,
    first.summary.sessions,
  );
  assert.ok(first.calendar.days.filter((day) => day.count > 0).length > 40);
  assert.deepEqual(
    Object.fromEntries(
      Object.entries(first.activityRanges).map(([range, buckets]) => [range, buckets.length]),
    ),
    { "7d": 7, "30d": 30, "3m": 13, "6m": 26, "1y": 12, all: 4 },
  );
  assert.equal(first.calendar.days.length, 26 * 7);
  assert.ok(first.consistency.activeDays > 0);
  assert.ok(first.consistency.totalDays >= 176 && first.consistency.totalDays <= 182);
  assert.ok(first.topics.length >= 5);
});

test("six-month consistency reports current and longest local-day streaks", () => {
  const activeDates = [
    "2026-10-20",
    "2026-10-21",
    "2026-10-22",
    "2026-10-23",
    "2026-11-01",
    "2026-11-02",
    "2026-11-03",
  ];
  const result = buildAnalyticsSnapshot({
    events: activeDates.map((date, index) =>
      event(`streak-${index}`, `problem-${index}`, `${date}T18:00:00.000Z`),
    ),
    problems: activeDates.map((_, index) => problem(`problem-${index}`)),
    timeZone,
    referenceTime,
  });

  assert.equal(result.consistency.activeDays, 7);
  assert.equal(result.consistency.currentStreak, 3);
  assert.equal(result.consistency.longestStreak, 4);
});

test("the demo fixture has no database or mutation dependency", () => {
  const source = readFileSync(new URL("../lib/analytics-demo-data.ts", import.meta.url), "utf8");
  assert.doesNotMatch(
    source,
    /@\/lib\/supabase|supabase\.|createClient|\.rpc\(|["']use server["']/,
  );
});
