import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { ensureTodaysDailyStudyPlan, getTodaysDailyStudyPlan, deferDailyStudyPlanTask, getDailyStudyWorkspace, getOwnedDailyStudyTask, rateNewDailyStudyTask } = loadTypeScriptModule(
  new URL("../data/daily-study-plans.ts", import.meta.url),
);

const plan = { id: "plan", user_id: "owner", planned_task_count: 1 };
const task = { id: "task", position: 0, status: "pending" };
const success = (data) => ({ data, error: null });
const failure = (message) => ({ data: null, error: { code: "P0001", message, details: "", hint: "" } });

function client(reads, rpcResults = []) {
  const calls = [];
  const rpcCalls = [];
  return {
    calls, rpcCalls,
    from(table) {
      const result = reads.shift();
      assert.ok(result, `Unexpected read from ${table}`);
      const call = { table, filters: [] };
      calls.push(call);
      const query = {
        select() { return query; },
        eq(...args) { call.filters.push(args); return query; },
        gte(...args) { call.gte = args; return query; },
        lt(...args) { call.lt = args; return query; },
        lte() { return query; },
        order(...args) { call.order = args; return query; },
        limit() { return query; },
        in() { return query; },
        maybeSingle() { return Promise.resolve(result); },
        then(resolve, reject) { return Promise.resolve(result).then(resolve, reject); },
      };
      return query;
    },
    rpc(name, args) {
      if (name === "get_effective_study_plan_settings") {
        return Promise.resolve(success([]));
      }
      rpcCalls.push({ name, args });
      assert.ok(rpcResults.length, "Unexpected RPC call");
      return Promise.resolve(rpcResults.shift());
    },
  };
}

test("persisted read uses the saved timezone and requests tasks in position order", async () => {
  const db = client([success({ time_zone: "America/Denver" }), success(plan), success([task])]);
  const result = await getTodaysDailyStudyPlan(db, "owner", new Date("2026-11-02T01:00:00Z"));
  assert.deepEqual(result.data, { plan, tasks: [task] });
  assert.ok(db.calls[1].filters.some(([key, value]) => key === "study_date" && value === "2026-11-01"));
  assert.deepEqual(db.calls[2].order, ["position", { ascending: true }]);
  for (const call of db.calls) assert.ok(call.filters.some(([key, value]) => key === "user_id" && value === "owner"));
});

test("persisted read does not create preferences or plans", async () => {
  const db = client([success(null)]);
  assert.deepEqual(await getTodaysDailyStudyPlan(db, "owner"), success(null));
  assert.equal(db.rpcCalls.length, 0);
});

test("ensure reuses existing plan without recomputing recommendations", async () => {
  const db = client([
    success({ time_zone: "UTC" }), success(plan), success([task]), success([task]),
  ], [success(plan)]);
  assert.deepEqual((await ensureTodaysDailyStudyPlan(db, "owner", "Asia/Tokyo")).data, { plan, tasks: [task] });
  assert.equal(db.rpcCalls[0].args.p_tasks, null);
  assert.equal(db.calls.some((call) => call.table === "user_problems"), false);
});

test("ensure proposes trusted canonical roadmap metadata, without tracking the problem", async () => {
  const db = client([success(null), success([]), success([]), success([task])], [success(plan)]);
  const result = await ensureTodaysDailyStudyPlan(db, "owner", " America/Denver ");
  assert.equal(result.error, null);
  const { name, args } = db.rpcCalls[0];
  assert.equal(name, "create_daily_study_plan");
  assert.equal(args.p_time_zone, "America/Denver");
  assert.equal(args.p_tasks.length, 1);
  assert.equal(args.p_tasks[0].origin, "roadmap");
  assert.equal(args.p_tasks[0].frontend_id, "217");
  assert.equal(args.p_tasks[0].slug, "contains-duplicate");
  assert.equal(args.p_tasks[0].leetcode_url, "https://leetcode.com/problems/contains-duplicate/");
  assert.equal(db.rpcCalls.length, 1);
});

test("ensure retries a stale proposal once and uses the persisted returned task set", async () => {
  const db = client([
    success(null), success([]), success([]),
    success(null), success([]), success([]), success([task]),
  ], [failure("stale_recommendations"), success(plan)]);
  assert.deepEqual((await ensureTodaysDailyStudyPlan(db, "owner", "UTC")).data, { plan, tasks: [task] });
  assert.equal(db.rpcCalls.length, 2);
});

test("ensure stops after the bounded retry and propagates structured errors", async () => {
  const db = client([
    success(null), success([]), success([]), success(null), success([]), success([]),
  ], [failure("stale_recommendations"), failure("stale_recommendations")]);
  assert.equal((await ensureTodaysDailyStudyPlan(db, "owner", "UTC")).error.message, "stale_recommendations");
  assert.equal(db.rpcCalls.length, 2);
});

test("ensure never hides read errors or calls creation after a failed read", async () => {
  const db = client([failure("read_failed")]);
  assert.equal((await ensureTodaysDailyStudyPlan(db, "owner", "UTC")).error.message, "read_failed");
  assert.equal(db.rpcCalls.length, 0);
});

test("ensure sends only tracked identity and version for a scheduled new-problem task", async () => {
  const candidate = {
    id: "scheduled", leetcode_frontend_id: "1", leetcode_slug: "two-sum", title: "Library title",
    difficulty: "easy", leetcode_url: "https://leetcode.com/problems/two-sum/", lifecycle_state: "active",
    mastery_score: 0, next_review_at: "2020-01-01T00:00:00Z", schedule_version: 42, total_reviews: 0,
  };
  const db = client([success(null), success([candidate]), success([]), success([task])], [success(plan)]);
  await ensureTodaysDailyStudyPlan(db, "owner", "UTC");
  assert.deepEqual(db.rpcCalls[0].args.p_tasks, [{
    kind: "new_problem", origin: "tracked", user_problem_id: "scheduled", schedule_version: 42,
  }]);
});

test("ensure persists an accepted import as a tracked calibration task", async () => {
  const candidate = {
    id: "imported", leetcode_frontend_id: "1", leetcode_slug: "two-sum", title: "Two Sum",
    difficulty: "easy", leetcode_url: "https://leetcode.com/problems/two-sum/", lifecycle_state: "active",
    mastery_score: 0, next_review_at: "2020-01-01T00:00:00Z", schedule_version: 0, total_reviews: 0,
    source: "leetcode_import", external_practice_status: "accepted", external_activity_date: "2019-01-01",
  };
  const db = client([success(null), success([candidate]), success([]), success([task])], [success(plan)]);
  await ensureTodaysDailyStudyPlan(db, "owner", "UTC");
  assert.deepEqual(db.rpcCalls[0].args.p_tasks, [{
    kind: "calibration", origin: "tracked", user_problem_id: "imported", schedule_version: 0,
  }]);
});

test("a missing persisted task is reported rather than silently changing the denominator", async () => {
  const db = client([success({ time_zone: "UTC" }), success(plan), success([])]);
  const result = await getTodaysDailyStudyPlan(db, "owner");
  assert.equal(result.data, null);
  assert.equal(result.error.message, "save_failed");
});

test("untracked task deferral submits only task identity and preserves the typed RPC result", async () => {
  const deferred = { ...task, status: "deferred" };
  const db = client([], [success(deferred)]);
  assert.deepEqual(await deferDailyStudyPlanTask(db, task.id), success(deferred));
  assert.deepEqual(db.rpcCalls, [{ name: "defer_daily_study_plan_task", args: { p_task_id: task.id } }]);
});

test("workspace loading scopes current problem versions to the assigned owner and keeps evidence private", async () => {
  const live = { id: "problem", schedule_version: 12, lifecycle_state: "active", next_review_at: "2026-11-02T00:00:00Z" };
  const persisted = { plan: { ...plan, time_zone: "UTC" }, tasks: [{ ...task, user_problem_id: live.id, completed_review_event_id: "private-event" }] };
  const db = client([success([live])]);
  const result = await getDailyStudyWorkspace(db, "owner", persisted);
  assert.equal(result.data.liveProblems[0].schedule_version, 12);
  assert.ok(db.calls[0].filters.some(([key, value]) => key === "user_id" && value === "owner"));
  assert.equal("completed_review_event_id" in result.data.tasks[0], false);
});

test("resolved workspace loads only assigned live problems and never scans same-day events", async () => {
  const resolvedPlan = {
    ...plan,
    planned_task_count: 1,
    study_date: "2026-11-02",
    time_zone: "America/Denver",
    day_starts_at: "2026-11-02T07:00:00Z",
    day_ends_at: "2026-11-03T07:00:00Z",
  };
  const assignedTask = {
    ...task,
    status: "completed",
    user_problem_id: "assigned",
    completion_event_id_snapshot: "assigned-event",
    leetcode_frontend_id: "1",
    title: "Two Sum",
    difficulty: "easy",
    leetcode_url: "https://leetcode.com/problems/two-sum/",
  };
  const problems = [
    { id: "assigned", lifecycle_state: "active", next_review_at: "2026-11-03T08:00:00Z", schedule_version: 1 },
  ];
  const db = client([success(problems)]);
  const result = await getDailyStudyWorkspace(db, "owner", { plan: resolvedPlan, tasks: [assignedTask] });

  assert.equal(result.data.tasks.length, 1);
  assert.equal(result.data.tasks[0].status, "completed");
  assert.equal(result.data.tasks[0].user_problem_id, "assigned");
  assert.equal("completion_event_id_snapshot" in result.data.tasks[0], false);
  assert.deepEqual(result.data.liveProblems.map((problem) => problem.id), ["assigned"]);
  assert.equal(db.calls.length, 1);
  assert.equal(db.calls[0].table, "user_problems");
});

test("an untracked or empty workspace does not query the full Library", async () => {
  const db = client([]);
  const result = await getDailyStudyWorkspace(db, "owner", { plan, tasks: [] });
  assert.deepEqual(result.data.liveProblems, []);
  assert.equal(db.calls.length, 0);
});

test("new task metadata reads are owner-scoped and RPC errors remain structured without retries", async () => {
  const metadata = { leetcode_frontend_id: "1", leetcode_slug: "two-sum" };
  const error = failure("stale_task");
  const db = client([success(metadata)], [error]);
  assert.deepEqual(await getOwnedDailyStudyTask(db, "owner", "task"), success(metadata));
  assert.deepEqual(db.calls[0].filters, [["user_id", "owner"], ["id", "task"]]);
  const args = { p_task_id: "task", p_rating: "good" };
  assert.deepEqual(await rateNewDailyStudyTask(db, args), error);
  assert.deepEqual(db.rpcCalls, [{ name: "rate_new_daily_study_task", args }]);
});
