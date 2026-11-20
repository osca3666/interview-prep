import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { selectDailyStudyPlan } = loadTypeScriptModule(
  new URL("../lib/study-plan.ts", import.meta.url),
);
const { getDailyStudyRecommendations } = loadTypeScriptModule(
  new URL("../data/study-plan.ts", import.meta.url),
);

const referenceTime = new Date("2026-11-02T12:00:00.000Z");
const day = 86_400_000;

function problem(id, overrides = {}) {
  return {
    id,
    leetcode_frontend_id: "1",
    leetcode_slug: id,
    title: `Problem ${id}`,
    difficulty: "medium",
    leetcode_url: `https://leetcode.com/problems/${id}/`,
    lifecycle_state: "active",
    mastery_score: 5,
    next_review_at: referenceTime.toISOString(),
    schedule_version: 3,
    total_reviews: 1,
    source: "manual",
    external_practice_status: null,
    external_activity_date: null,
    ...overrides,
  };
}

function overdue(days) {
  return new Date(referenceTime.getTime() - days * day).toISOString();
}

const roadmapProblems = [
  { order: 1, slug: "contains-duplicate", title: "Contains Duplicate", difficulty: "easy", leetcode_url: "https://leetcode.com/problems/contains-duplicate/" },
  { order: 2, slug: "valid-anagram", title: "Valid Anagram", difficulty: "easy", leetcode_url: "https://leetcode.com/problems/valid-anagram/" },
  { order: 3, slug: "two-sum", title: "Two Sum", difficulty: "easy", leetcode_url: "https://leetcode.com/problems/two-sum/" },
];

function select(dueProblems = [], overrides = {}) {
  return selectDailyStudyPlan({
    dueProblems,
    trackedSlugs: [],
    roadmapProblems,
    referenceTime,
    ...overrides,
  });
}

function reviewIds(plan) {
  return plan.tasks.filter((task) => task.kind === "review").map((task) => task.userProblemId);
}

test("reviewed and never-practiced problems use separate task kinds and budgets", () => {
  const plan = select([
    problem("reviewed"),
    problem("scheduled", { total_reviews: 0, mastery_score: 0 }),
  ]);
  assert.deepEqual(plan.counts, { reviews: 1, newProblems: 1, calibrations: 0 });
  assert.equal(plan.target, 4);
  assert.deepEqual(plan.tasks.map((task) => task.kind), ["review", "new_problem"]);
  assert.equal(plan.tasks[1].origin, "tracked");
  assert.equal(plan.tasks[1].userProblemId, "scheduled");
  assert.equal(plan.tasks[1].scheduleVersion, 3);
  assert.equal(plan.tasks.some((task) => task.kind === "calibration"), false);
});

test("accepted imports use the calibration slot and oldest known history date first", () => {
  const plan = select([
    problem("manual", { total_reviews: 0 }),
    problem("missing-date", { total_reviews: 0, source: "leetcode_import", external_practice_status: "accepted" }),
    problem("newer-import", { total_reviews: 0, source: "leetcode_import", external_practice_status: "accepted", external_activity_date: "2026-01-01" }),
    problem("older-import", { total_reviews: 0, source: "leetcode_import", external_practice_status: "accepted", external_activity_date: "2024-01-01" }),
  ]);
  assert.deepEqual(plan.counts, { reviews: 0, newProblems: 0, calibrations: 1 });
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].kind, "calibration");
  assert.equal(plan.tasks[0].userProblemId, "older-import");
});

test("a calibrated import returns to the ordinary review pool", () => {
  const plan = select([
    problem("calibrated", { source: "leetcode_import", external_practice_status: "accepted", external_activity_date: "2024-01-01" }),
  ], { roadmapProblems: [] });
  assert.deepEqual(plan.tasks.map((task) => task.kind), ["review"]);
  assert.deepEqual(plan.counts, { reviews: 1, newProblems: 0, calibrations: 0 });
});

test("the oldest due unpracticed problem takes priority even outside NeetCode", () => {
  const plan = select([
    problem("recent", { total_reviews: 0 }),
    problem("old-z", { total_reviews: 0, next_review_at: overdue(3) }),
    problem("old-a", { total_reviews: 0, next_review_at: overdue(3) }),
  ]);
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].userProblemId, "old-a");
  assert.equal(plan.tasks[0].origin, "tracked");
});

test("low mastery wins among similarly overdue reviews after the fairness slot", () => {
  const plan = select([
    problem("oldest", { mastery_score: 10, next_review_at: overdue(20) }),
    problem("strong", { mastery_score: 10, next_review_at: overdue(1) }),
    problem("weak", { mastery_score: 0, next_review_at: overdue(1) }),
    problem("medium", { mastery_score: 5, next_review_at: overdue(1) }),
  ]);
  assert.deepEqual(reviewIds(plan), ["oldest", "weak", "medium"]);
});

test("overdue age can outweigh the bounded low-mastery bonus", () => {
  const plan = select([
    problem("oldest", { mastery_score: 10, next_review_at: overdue(30) }),
    problem("older-strong", { mastery_score: 10, next_review_at: overdue(15) }),
    problem("new-weak", { mastery_score: 0 }),
    problem("new-medium", { mastery_score: 5 }),
  ]);
  assert.deepEqual(reviewIds(plan), ["oldest", "older-strong", "new-weak"]);
});

test("the oldest due review is included even when many newer weak reviews outrank it", () => {
  const oldest = problem("oldest", { mastery_score: 10, next_review_at: overdue(2) });
  const newer = Array.from({ length: 8 }, (_, i) => problem(`weak-${i}`, {
    mastery_score: 0,
    next_review_at: overdue(1),
  }));
  assert.equal(reviewIds(select([...newer, oldest]))[0], "oldest");
  // Once the oldest is actually reviewed, the next oldest retains the fairness slot.
  assert.equal(reviewIds(select(newer))[0], "weak-0");
});

test("reordering identical inputs cannot change task order, including exact ties", () => {
  const candidates = ["d", "c", "b", "a"].map((id) => problem(id));
  const plan = select(candidates);
  assert.deepEqual(reviewIds(plan), ["a", "b", "c"]);
  assert.deepEqual(select([...candidates].reverse(), {
    roadmapProblems: [...roadmapProblems].reverse(),
  }), plan);
  assert.deepEqual(select([candidates[1], candidates[3], candidates[0], candidates[2]]), plan);
});

test("equal urgency scores prefer the earlier due timestamp", () => {
  const plan = select([
    problem("oldest", { next_review_at: overdue(30) }),
    problem("earlier", { mastery_score: 10, next_review_at: overdue(10) }),
    problem("today-a", { mastery_score: 0 }),
    problem("today-b", { mastery_score: 0 }),
  ]);
  assert.deepEqual(reviewIds(plan), ["oldest", "earlier", "today-a"]);
});

for (const count of [0, 1, 2]) {
  test(`${count} available reviews produce a smaller plan without filling review slots`, () => {
    const plan = select(Array.from({ length: count }, (_, i) => problem(`review-${i}`)));
    assert.deepEqual(plan.counts, { reviews: count, newProblems: 1, calibrations: 0 });
    assert.equal(plan.tasks.length, count + 1);
  });
}

test("an empty Library selects only the first roadmap problem", () => {
  const plan = select();
  assert.equal(plan.tasks.length, 1);
  assert.equal(plan.tasks[0].origin, "roadmap");
  assert.equal(plan.tasks[0].slug, "contains-duplicate");
  assert.equal(plan.tasks[0].roadmapId, "neetcode-150");
  assert.equal("userProblemId" in plan.tasks[0], false);
});

test("an exhausted roadmap leaves the new-problem slot empty", () => {
  const plan = select([problem("review")], {
    trackedSlugs: roadmapProblems.map((item) => item.slug),
  });
  assert.deepEqual(plan.counts, { reviews: 1, newProblems: 0, calibrations: 0 });
  assert.equal(select([], { roadmapProblems: [] }).tasks.length, 0);
});

test("paused, archived, and future scheduled entries are excluded but still tracked", () => {
  const plan = select([
    problem("paused", { leetcode_slug: "contains-duplicate", lifecycle_state: "paused", total_reviews: 0 }),
    problem("archived", { leetcode_slug: "valid-anagram", lifecycle_state: "archived", total_reviews: 0 }),
    problem("future", { leetcode_slug: "two-sum", next_review_at: overdue(-1), total_reviews: 0 }),
    problem("future-review", { next_review_at: overdue(-1) }),
  ]);
  assert.equal(plan.tasks.length, 0);
});

test("all tracked roadmap slugs are excluded even when not in the due pool", () => {
  const plan = select([], { trackedSlugs: ["contains-duplicate", "valid-anagram"] });
  assert.equal(plan.tasks[0].slug, "two-sum");
});

test("a scheduled problem becomes eligible exactly at its due timestamp", () => {
  const scheduled = problem("scheduled", { total_reviews: 0 });
  assert.equal(select([scheduled]).tasks[0].userProblemId, "scheduled");
  assert.equal(select([scheduled], {
    referenceTime: new Date(referenceTime.getTime() - 1),
    roadmapProblems: [],
  }).tasks.length, 0);
});

test("an empty new pool cannot be filled by extra reviews", () => {
  const plan = select(Array.from({ length: 10 }, (_, i) => problem(`review-${i}`)), {
    roadmapProblems: [],
  });
  assert.deepEqual(plan.counts, { reviews: 3, newProblems: 0, calibrations: 0 });
});

test("inputs are not mutated and repeated rows do not create duplicate tasks", () => {
  const a = Object.freeze(problem("a"));
  const b = Object.freeze(problem("b"));
  const input = Object.freeze([b, a, b, a]);
  const roadmap = Object.freeze(roadmapProblems.map((item) => Object.freeze({ ...item })));
  const plan = select(input, { roadmapProblems: roadmap, trackedSlugs: Object.freeze([]) });
  assert.deepEqual(reviewIds(plan), ["a", "b"]);
  assert.deepEqual(input.map((item) => item.id), ["b", "a", "b", "a"]);
  assert.equal(referenceTime.toISOString(), "2026-11-02T12:00:00.000Z");
  assert.equal(plan.referenceTime, referenceTime.toISOString());
});

test("ranking examines candidates beyond both 20 and 1000 rows", () => {
  const candidates = Array.from({ length: 1001 }, (_, i) => problem(`review-${String(i).padStart(4, "0")}`, {
    mastery_score: i === 1000 ? 0 : 10,
    next_review_at: overdue(1),
  }));
  assert.deepEqual(reviewIds(select(candidates)), ["review-0000", "review-1000", "review-0001"]);
});

test("invalid reference times fail clearly and invalid due timestamps are excluded", () => {
  assert.throws(() => select([], { referenceTime: new Date("invalid") }), RangeError);
  assert.equal(select([problem("invalid", { next_review_at: "invalid" })], {
    roadmapProblems: [],
  }).tasks.length, 0);
});

function supabaseStub({ pages = [], tracked = [], dueError = null, trackedError = null } = {}) {
  const queries = [];
  let pageIndex = 0;
  const client = {
    from(table) {
      const query = { table, filters: [], orders: [] };
      queries.push(query);
      const builder = {
        select(fields) { query.fields = fields; return builder; },
        eq(field, value) { query.filters.push([field, value]); return builder; },
        lte(field, value) { query.dueBefore = [field, value]; return builder; },
        order(field, options) { query.orders.push([field, options]); return builder; },
        limit(value) { query.limit = value; return builder; },
        or(value) { query.cursor = value; return builder; },
        in(field, values) { query.in = [field, values]; return builder; },
        then(resolve, reject) {
          const result = query.fields === "leetcode_slug"
            ? { data: tracked, error: trackedError }
            : { data: pages[pageIndex++] ?? [], error: dueError };
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  };
  return { client, queries };
}

test("the data helper fetches every keyset page with a fixed user and timestamp", async () => {
  const rows = Array.from({ length: 1001 }, (_, i) => problem(String(i).padStart(8, "0"), {
    mastery_score: i === 1000 ? 0 : 10,
  }));
  const { client, queries } = supabaseStub({
    pages: [rows.slice(0, 500), rows.slice(500, 1000), rows.slice(1000)],
    tracked: [{ leetcode_slug: "contains-duplicate" }],
  });
  const result = await getDailyStudyRecommendations(client, "current-user", referenceTime);
  assert.equal(result.error, null);
  assert.deepEqual(reviewIds(result.data), ["00000000", "00001000", "00000001"]);
  assert.equal(result.data.tasks[3].slug, "valid-anagram");

  const dueQueries = queries.filter((query) => query.fields !== "leetcode_slug");
  assert.equal(dueQueries.length, 3);
  for (const query of dueQueries) {
    assert.equal(query.table, "user_problems");
    assert.deepEqual(query.filters, [["user_id", "current-user"], ["lifecycle_state", "active"]]);
    assert.deepEqual(query.dueBefore, ["next_review_at", referenceTime.toISOString()]);
    assert.deepEqual(query.orders, [["next_review_at", { ascending: true }], ["id", { ascending: true }]]);
    assert.equal(query.limit, 500);
    assert.match(query.fields, /total_reviews/);
    assert.match(query.fields, /mastery_score/);
  }
  assert.equal(dueQueries[0].cursor, undefined);
  assert.equal(dueQueries[1].cursor, `next_review_at.gt.${rows[499].next_review_at},and(next_review_at.eq.${rows[499].next_review_at},id.gt.${rows[499].id})`);
  assert.equal(dueQueries[2].cursor, `next_review_at.gt.${rows[999].next_review_at},and(next_review_at.eq.${rows[999].next_review_at},id.gt.${rows[999].id})`);
  const trackedQuery = queries.find((query) => query.fields === "leetcode_slug");
  assert.deepEqual(trackedQuery.filters, [["user_id", "current-user"]]);
  assert.equal(trackedQuery.in[0], "leetcode_slug");
  assert.equal(trackedQuery.in[1].length, 150);
});

test("a full final page is followed by an empty page rather than silently truncating", async () => {
  const { client, queries } = supabaseStub({
    pages: [Array.from({ length: 500 }, (_, i) => problem(`row-${i}`)), []],
  });
  const result = await getDailyStudyRecommendations(client, "current-user", referenceTime);
  assert.equal(result.error, null);
  assert.equal(queries.filter((query) => query.fields !== "leetcode_slug").length, 2);
});

for (const field of ["dueError", "trackedError"]) {
  test(`the data helper propagates ${field} without returning a partial plan`, async () => {
    const error = { code: "XX000", message: "Read failed", details: "", hint: "" };
    const { client } = supabaseStub({ [field]: error });
    assert.deepEqual(await getDailyStudyRecommendations(client, "current-user", referenceTime), {
      data: null,
      error,
    });
  });
}
