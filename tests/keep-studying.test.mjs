import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { selectExtraReview, selectExtraRoadmap, isAssignedStudyProblem, isCurrentStudyDay } = loadTypeScriptModule(new URL("../lib/keep-studying.ts", import.meta.url));
const { getExtraStudyRecommendation, getCurrentExtraStudyPlan } = loadTypeScriptModule(new URL("../data/keep-studying.ts", import.meta.url));
const { neetcode150Problems } = loadTypeScriptModule(new URL("../data/problem-sets/neetcode-150.ts", import.meta.url));
const { getLeetCodeProblemBySlug } = loadTypeScriptModule(new URL("../lib/leetcode-catalog.ts", import.meta.url));

const reference = new Date("2026-11-02T12:00:00Z");
const success = (data) => ({ data, error: null });
const plan = { id: "plan", user_id: "owner", planned_task_count: 1, study_date: "2026-11-02", time_zone: "America/Denver",
  day_starts_at: "2026-11-02T07:00:00Z", day_ends_at: "2026-11-03T07:00:00Z" };
const assigned = { id: "task", status: "completed", user_problem_id: "assigned", original_user_problem_id: "original",
  leetcode_frontend_id: " 217 ", leetcode_slug: "contains-duplicate" };
const candidate = (id, overrides = {}) => ({ id, leetcode_frontend_id: id, leetcode_slug: `problem-${id}`,
  title: "Same title", difficulty: "easy", leetcode_url: "https://leetcode.com/problems/two-sum/", lifecycle_state: "active",
  total_reviews: 2, mastery_score: 0, schedule_version: 3, next_review_at: "2026-11-01T00:00:00Z", ...overrides });
const roadmap = [{ frontendId: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy", leetcodeUrl: "https://leetcode.com/problems/two-sum/", order: 1 },
  { frontendId: "2", slug: "add-two-numbers", title: "Add Two Numbers", difficulty: "medium", leetcodeUrl: "https://leetcode.com/problems/add-two-numbers/", order: 2 }];

function db(reads) {
  const calls = [];
  return { calls, from(table) {
    const result = reads.shift(); assert.ok(result, `Unexpected query: ${table}`);
    const call = { table, filters: [], inFilters: [] }; calls.push(call);
    const query = {
      select(fields) { call.fields = fields; return query; }, eq(...args) { call.filters.push(args); return query; },
      in(...args) { call.inFilters.push(args); return query; }, lte(...args) { call.filters.push(args); return query; },
      gt(...args) { call.filters.push(args); return query; },
      order() { return query; }, limit(value) { call.limit = value; return query; }, or() { return query; },
      maybeSingle() { return Promise.resolve(result); }, then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
    }; return query;
  }, rpc() { throw new Error("Optional reads must not create plans or write data"); } };
}
const planReads = (p = plan, tasks = [assigned]) => [success({ time_zone: p.time_zone }), success(p), success(tasks)];

test("extra selection excludes assigned live/original IDs, frontend IDs and saved slugs for every status", () => {
  for (const status of ["completed", "deferred"]) {
    const task = { ...assigned, status };
    const rows = [candidate("assigned"), candidate("original"), candidate("different", { leetcode_frontend_id: "217" }),
      candidate("slug-match", { leetcode_slug: "contains-duplicate" }), candidate("allowed")];
    assert.equal(selectExtraReview(rows, [task]).userProblemId, "allowed");
  }
  assert.equal(isAssignedStudyProblem([{ ...assigned, user_problem_id: null }], { id: "original", frontendId: null, slug: "changed" }), true);
  assert.equal(isAssignedStudyProblem([assigned], { id: "other", frontendId: null, slug: "unrelated" }), false);
});

test("extra reviews choose the earliest practiced schedule, including future reviews", () => {
  const oldest = candidate("oldest", { mastery_score: 10, next_review_at: "2026-10-01T00:00:00Z" });
  const rows = [candidate("weak"), oldest, candidate("future", { next_review_at: "2026-12-01T00:00:00Z" }),
    candidate("paused", { lifecycle_state: "paused" }), candidate("new", { total_reviews: 0 })];
  assert.equal(selectExtraReview(rows, []).userProblemId, "oldest");
  assert.equal(selectExtraReview([...rows].reverse(), []).userProblemId, "oldest");
  assert.equal(selectExtraReview([candidate("b"), candidate("a")], []).userProblemId, "a");
  assert.equal(selectExtraReview([rows[2]], []).userProblemId, "future");
  assert.equal(selectExtraReview([rows[3], rows[4]], []), null);
});

test("extra roadmap selection excludes practiced identities but keeps tracked unpracticed problems eligible", () => {
  const practiced = { total_reviews: 1, source: "manual", external_practice_status: null };
  const unpracticed = { total_reviews: 0, source: "manual", external_practice_status: null };
  const tracked = [{ leetcode_frontend_id: " 1 ", leetcode_slug: "legacy-slug", ...practiced }];
  assert.equal(selectExtraRoadmap([...roadmap].reverse(), tracked, []).frontendId, "2");
  assert.equal(selectExtraRoadmap(roadmap, [{ leetcode_frontend_id: null, leetcode_slug: "two-sum", ...practiced }], []).frontendId, "2");
  assert.equal(selectExtraRoadmap(roadmap, [{ leetcode_frontend_id: "1", leetcode_slug: "two-sum", ...unpracticed }], []).frontendId, "1");
  assert.equal(selectExtraRoadmap(roadmap, [{ leetcode_frontend_id: "1", leetcode_slug: "two-sum", total_reviews: 0, source: "leetcode_import", external_practice_status: "accepted" }], []).frontendId, "2");
  assert.equal(selectExtraRoadmap(roadmap, tracked, [{ ...assigned, leetcode_frontend_id: "2", leetcode_slug: "old-slug" }]), null);
  assert.equal(selectExtraRoadmap([], [], []), null);
  const copy = structuredClone(roadmap); selectExtraRoadmap(roadmap, [], []); assert.deepEqual(roadmap, copy);
});

test("extra read authenticates the owning current plan without requiring resolution", async () => {
  for (const status of ["pending", "completed", "deferred"]) {
    const client = db(planReads(plan, [{ ...assigned, status }]));
    assert.equal((await getCurrentExtraStudyPlan(client, "owner", "plan", reference)).data.plan.id, "plan");
    assert.ok(client.calls.every((call) => call.filters.some(([key, value]) => key === "user_id" && value === "owner")));
  }
  for (const [p, tasks, id] of [[{ ...plan, user_id: "other" }, [assigned], "plan"], [plan, [assigned], "other"]]) {
    assert.equal((await getCurrentExtraStudyPlan(db(planReads(p, tasks)), "owner", id, reference)).error.message, "plan_changed");
  }
  const empty = { ...plan, planned_task_count: 0 };
  assert.equal((await getCurrentExtraStudyPlan(db(planReads(empty, [])), "owner", "plan", reference)).data.plan.id, "plan");
});

test("saved study date and exclusive midnight boundaries govern extra work, including DST snapshots", async () => {
  const client = db(planReads());
  await getCurrentExtraStudyPlan(client, "owner", "plan", reference);
  assert.ok(client.calls[1].filters.some(([key, value]) => key === "study_date" && value === "2026-11-02"));
  assert.equal(isCurrentStudyDay(plan, new Date(plan.day_starts_at)), true);
  assert.equal(isCurrentStudyDay(plan, new Date(plan.day_ends_at)), false);
  assert.equal(isCurrentStudyDay(plan, new Date(Date.parse(plan.day_starts_at) - 1)), false);
  for (const [start, end] of [["2026-03-08T07:00:00Z", "2026-03-09T06:00:00Z"], ["2026-11-01T06:00:00Z", "2026-11-02T07:00:00Z"]]) {
    const snapshot = { ...plan, day_starts_at: start, day_ends_at: end };
    assert.equal(isCurrentStudyDay(snapshot, new Date(Date.parse(end) - 1)), true);
    assert.equal(isCurrentStudyDay(snapshot, new Date(end)), false);
  }
  const missing = db([success({ time_zone: "America/Denver" }), success(null)]);
  assert.equal((await getCurrentExtraStudyPlan(missing, "owner", "plan", reference)).error.message, "plan_changed");
});

test("extra review reads the practiced pool without a due cutoff and returns one compact candidate", async () => {
  const client = db([...planReads(), success([candidate("assigned"), candidate("extra")])]);
  const result = await getExtraStudyRecommendation(client, "owner", "plan", "review", reference);
  assert.equal(result.data.userProblemId, "extra");
  assert.equal("mastery_score" in result.data, false);
  assert.equal(client.calls[3].limit, 500);
  assert.ok(client.calls[3].filters.some(([key, value]) => key === "total_reviews" && value === 0));
  assert.ok(!client.calls[3].filters.some(([key]) => key === "next_review_at"));
  assert.equal((await getExtraStudyRecommendation(db([...planReads(), success([])]), "owner", "plan", "review", reference)).data, null);
});

test("extra roadmap reads resolve canonical metadata and match every lifecycle by ID and legacy slug", async () => {
  const practiced = { total_reviews: 1, source: "manual", external_practice_status: null };
  const client = db([...planReads(), success([{ leetcode_frontend_id: "242", leetcode_slug: "legacy", ...practiced }]), success([])]);
  const result = await getExtraStudyRecommendation(client, "owner", "plan", "roadmap", reference);
  assert.equal(result.data.frontendId, "1");
  assert.equal(result.data.title, "Two Sum");
  assert.equal(result.data.order, neetcode150Problems.find((problem) => problem.slug === "two-sum").order);
  assert.deepEqual(client.calls.slice(3).map((call) => call.inFilters[0][0]), ["leetcode_frontend_id", "leetcode_slug"]);
  assert.ok(client.calls.slice(3).every((call) => call.limit === 150 && !call.filters.some(([key]) => key === "lifecycle_state")));
  const allTracked = neetcode150Problems.map((p) => ({ leetcode_frontend_id: getLeetCodeProblemBySlug(p.slug).frontendId, leetcode_slug: p.slug, ...practiced }));
  assert.equal((await getExtraStudyRecommendation(db([...planReads(), success(allTracked), success([])]), "owner", "plan", "roadmap", reference)).data, null);
});

test("extra read failures propagate without offering partial recommendations", async () => {
  const error = { code: "XX001", message: "read failed", details: "", hint: "" };
  assert.equal((await getExtraStudyRecommendation(db([{ data: null, error }]), "owner", "plan", "review", reference)).error, error);
  assert.equal((await getExtraStudyRecommendation(db([...planReads(), { data: null, error }]), "owner", "plan", "review", reference)).error, error);
});
