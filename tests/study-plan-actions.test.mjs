import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

function action({ authenticated = true, task = { leetcode_frontend_id: " 1 ", leetcode_slug: "two-sum" }, rpcError = null } = {}) {
  const calls = [];
  const paths = [];
  const reviewEventId = randomUUID();
  const attempt = { reviewEventId, rating: "ok", correctableUntil: "2026-11-03T18:05:00.000Z" };
  const client = { auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: "owner" } : {} }, error: null }) } };
  const { rateNewStudyTaskAction } = loadTypeScriptModule(new URL("../app/study-plan/actions.ts", import.meta.url), {
    "next/cache": { revalidatePath: (path) => paths.push(path) },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/data/daily-study-plans": {
      getOwnedDailyStudyTask: async (db, owner, id) => {
        assert.equal(db, client);
        calls.push({ owner, id });
        return { data: task, error: null };
      },
      rateNewDailyStudyTask: async (db, args) => {
        assert.equal(db, client);
        calls.push(args);
        return { data: rpcError ? null : { status: "completed", completed_review_event_id: reviewEventId }, error: rpcError };
      },
    },
    "@/data/reviews": {
      getReviewAttempt: async () => ({ data: { id: reviewEventId, rating: "ok", correctable_until: attempt.correctableUntil }, error: null }),
    },
  });
  return { rate: rateNewStudyTaskAction, calls, paths, attempt };
}

test("new practice action resolves metadata server-side and submits no client date or timezone", async () => {
  for (const rating of ["bad", "ok", "good"]) {
    const harness = action();
    const taskId = randomUUID();
    assert.deepEqual(await harness.rate(taskId, rating), { ok: true, attempt: harness.attempt });
    assert.deepEqual(harness.calls[0], { owner: "owner", id: taskId });
    assert.deepEqual(harness.calls[1], {
      p_task_id: taskId, p_rating: rating, p_leetcode_frontend_id: "1", p_leetcode_slug: "two-sum",
      p_title: "Two Sum", p_difficulty: "easy", p_leetcode_url: "https://leetcode.com/problems/two-sum/",
      p_leetcode_topics: ["Array", "Hash Table"],
    });
    assert.deepEqual(harness.paths, ["/dashboard", "/problems", "/roadmaps/neetcode-150"]);
  }
});

test("new practice action rejects missing auth, malformed IDs and unsupported ratings before RPC", async () => {
  const signedOut = action({ authenticated: false });
  assert.deepEqual(await signedOut.rate(randomUUID(), "ok"), { ok: false, error: "not_authenticated" });
  assert.equal(signedOut.calls.length, 0);
  for (const [id, rating] of [["invalid", "ok"], [randomUUID(), "again"], [null, "easy"]]) {
    const harness = action();
    assert.deepEqual(await harness.rate(id, rating), { ok: false, error: "task_changed" });
    assert.equal(harness.calls.length, 0);
  }
});

test("new practice action requires an owned task with matching canonical identity", async () => {
  for (const task of [null, { leetcode_frontend_id: null }, { leetcode_frontend_id: "unknown" }, { leetcode_frontend_id: "1", leetcode_slug: "tampered" }]) {
    const harness = action({ task });
    assert.deepEqual(await harness.rate(randomUUID(), "good"), { ok: false, error: "task_changed" });
    assert.equal(harness.calls.length, 1);
  }
});

test("new practice action returns safe conflicts without retrying or falling back to review", async () => {
  for (const message of ["not_found", "task_not_pending", "stale_task", "duplicate_problem", "invalid_date"]) {
    const harness = action({ rpcError: { code: "P0001", message, details: "private", hint: "private" } });
    assert.deepEqual(await harness.rate(randomUUID(), "good"), { ok: false, error: "task_changed" });
    assert.equal(harness.calls.length, 2);
    assert.deepEqual(harness.paths, ["/dashboard"]);
  }
});

test("new practice action hides unexpected database details and preserves development diagnostics", async (t) => {
  const logger = t.mock.method(console, "error", () => {});
  const harness = action({ rpcError: { code: "XX001", message: "private failure", details: "private details", hint: "private hint" } });
  assert.deepEqual(await harness.rate(randomUUID(), "good"), { ok: false, error: "save_failed" });
  assert.equal(harness.calls.length, 2);
  assert.equal(logger.mock.calls.length, 1);
  assert.deepEqual(logger.mock.calls[0].arguments[1], {
    operation: "rate_new_daily_study_task", code: "XX001", message: "private failure", details: "private details", hint: "private hint",
  });
});

function todayAction({ authenticated = true, rpcError = null, outcome = "added_todo" } = {}) {
  const calls = [];
  const paths = [];
  const reviewEventId = outcome === "marked_done" ? randomUUID() : null;
  const client = {
    auth: {
      getClaims: async () => ({
        data: { claims: authenticated ? { sub: "owner" } : {} },
        error: null,
      }),
    },
  };
  const actions = loadTypeScriptModule(new URL("../app/study-plan/actions.ts", import.meta.url), {
    "next/cache": { revalidatePath: (path) => paths.push(path) },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/data/daily-study-plans": {
      addProblemToToday: async (db, args) => {
        assert.equal(db, client);
        calls.push(args);
        return {
          data: rpcError ? null : [{
            task_id: "task-id",
            task_status: outcome === "marked_done" ? "completed" : "pending",
            outcome,
            review_event_id: reviewEventId,
            correctable_until: reviewEventId ? "2026-11-07T18:05:00.000Z" : null,
          }],
          error: rpcError,
        };
      },
    },
    "@/data/reviews": {
      getReviewAttempt: async () => ({
        data: reviewEventId ? {
          id: reviewEventId,
          rating: "ok",
          correctable_until: "2026-11-07T18:05:00.000Z",
        } : null,
        error: null,
      }),
    },
  });
  return { ...actions, calls, paths, reviewEventId };
}

test("today add action resolves canonical metadata and submits only intent plus trusted fields", async () => {
  for (const [intent, outcome] of [["todo", "added_todo"], ["done", "marked_done"]]) {
    const harness = todayAction({ outcome });
    const result = await harness.addProblemToTodayAction(" 1 ", intent);
    assert.equal(result.ok, true);
    assert.equal(result.outcome, outcome);
    assert.deepEqual(harness.calls[0], {
      p_intent: intent,
      p_leetcode_frontend_id: "1",
      p_leetcode_slug: "two-sum",
      p_leetcode_url: "https://leetcode.com/problems/two-sum/",
      p_title: "Two Sum",
      p_difficulty: "easy",
      p_leetcode_topics: ["Array", "Hash Table"],
    });
    assert.deepEqual(harness.paths, ["/dashboard", "/problems", "/roadmaps/neetcode-150"]);
    assert.equal(Boolean(result.attempt), intent === "done");
  }
});

test("today add action rejects untrusted identities and maps duplicate task states safely", async () => {
  const signedOut = todayAction({ authenticated: false });
  assert.deepEqual(await signedOut.addProblemToTodayAction("1", "todo"), {
    ok: false,
    error: "not_authenticated",
  });
  assert.equal(signedOut.calls.length, 0);

  for (const [id, intent] of [["", "todo"], ["unknown", "todo"], ["1", "later"]]) {
    const harness = todayAction();
    assert.deepEqual(await harness.addProblemToTodayAction(id, intent), {
      ok: false,
      error: "invalid_problem",
    });
    assert.equal(harness.calls.length, 0);
  }

  for (const message of [
    "already_in_today",
    "already_completed_today",
    "already_deferred_today",
    "problem_not_active",
  ]) {
    const harness = todayAction({ rpcError: { code: "P0001", message } });
    assert.deepEqual(await harness.addProblemToTodayAction("1", "todo"), {
      ok: false,
      error: message,
    });
    assert.equal(harness.calls.length, 1);
    assert.deepEqual(harness.paths, []);
  }
});

function recommendationAction({ authenticated = true, recommendationError = null, rpcError = null, candidate = null, emptyResult = false } = {}) {
  const calls = [];
  const paths = [];
  const plan = { id: randomUUID() };
  const client = { auth: { getClaims: async () => ({ data: { claims: authenticated ? { sub: "owner" } : {} }, error: null }) } };
  const actions = loadTypeScriptModule(new URL("../app/study-plan/actions.ts", import.meta.url), {
    "next/cache": { revalidatePath: (path) => paths.push(path) },
    "@/lib/supabase/server": { createClient: async () => client },
    "@/data/keep-studying": {
      getExtraStudyRecommendation: async (db, userId, planId, mode) => {
        assert.equal(db, client); calls.push({ operation: "read", userId, planId, mode });
        return { data: candidate, error: recommendationError };
      },
    },
    "@/data/daily-study-plans": { addProblemToToday: async (db, args) => {
      assert.equal(db, client); calls.push({ operation: "create", args });
      return { data: rpcError ? null : emptyResult ? [] : [{ task_id: "task", outcome: "added_todo" }], error: rpcError };
    } },
  });
  return { ...actions, plan, calls, paths };
}

test("roadmap recommendations append one unpracticed canonical task to today's plan", async () => {
  const candidate = { kind: "roadmap", frontendId: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy",
    leetcodeUrl: "https://leetcode.com/problems/two-sum/", order: 7 };
  const h = recommendationAction({ candidate });
  assert.deepEqual(await h.addRecommendedProblemToTodayAction(h.plan.id, "roadmap"), { ok: true, added: true, taskId: "task" });
  assert.deepEqual(h.calls[1], { operation: "create", args: {
    p_intent: "todo", p_leetcode_frontend_id: "1", p_leetcode_slug: "two-sum",
    p_leetcode_url: "https://leetcode.com/problems/two-sum/", p_title: "Two Sum",
    p_difficulty: "easy", p_leetcode_topics: ["Array", "Hash Table"],
  } });
  assert.deepEqual(h.paths, ["/dashboard"]);
});

test("review recommendations append the validated due version without recording practice", async () => {
  const candidate = { kind: "review", userProblemId: randomUUID(), scheduleVersion: 9, frontendId: "1",
    slug: "two-sum", title: "Two Sum", difficulty: "easy", leetcodeUrl: "https://leetcode.com/problems/two-sum/" };
  const h = recommendationAction({ candidate });
  assert.deepEqual(await h.addRecommendedProblemToTodayAction(h.plan.id, "review"), { ok: true, added: true, taskId: "task" });
  assert.deepEqual(h.calls[1].args, {
    p_intent: "todo", p_leetcode_frontend_id: "1", p_leetcode_slug: "two-sum",
    p_leetcode_url: "https://leetcode.com/problems/two-sum/", p_title: "Two Sum",
    p_difficulty: "easy", p_leetcode_topics: ["Array", "Hash Table"],
  });
});

test("recommendation insertion requires authentication and valid plan/mode identities", async () => {
  const signedOut = recommendationAction({ authenticated: false });
  assert.deepEqual(await signedOut.addRecommendedProblemToTodayAction(randomUUID(), "review"), { ok: false, error: "not_authenticated" });
  assert.equal(signedOut.calls.length, 0);
  const h = recommendationAction();
  assert.deepEqual(await h.addRecommendedProblemToTodayAction("invalid", "review"), { ok: false, error: "plan_changed" });
  assert.deepEqual(await h.addRecommendedProblemToTodayAction(h.plan.id, "invalid"), { ok: false, error: "plan_changed" });
  assert.equal(h.calls.length, 0);
});

test("recommendation conflicts are controlled and never retried", async () => {
  const candidate = { kind: "roadmap", frontendId: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy",
    leetcodeUrl: "https://leetcode.com/problems/two-sum/", order: 1 };
  for (const message of ["candidate_changed", "already_in_today", "already_completed_today", "already_deferred_today"]) {
    const h = recommendationAction({ candidate, rpcError: { code: "P0001", message } });
    assert.deepEqual(await h.addRecommendedProblemToTodayAction(h.plan.id, "roadmap"), { ok: false, error: "candidate_changed" });
    assert.equal(h.calls.length, 2);
  }
  for (const message of ["plan_changed", "plan_not_found", "plan_not_resolved"]) {
    const h = recommendationAction({ candidate, recommendationError: { code: "P0001", message } });
    assert.deepEqual(await h.addRecommendedProblemToTodayAction(h.plan.id, "roadmap"), { ok: false, error: "plan_changed" });
    assert.equal(h.calls.length, 1);
  }
});

test("an exhausted recommendation pool returns a clean unavailable result without writes", async () => {
  const h = recommendationAction({ candidate: null });
  assert.deepEqual(await h.addRecommendedProblemToTodayAction(h.plan.id, "review"), { ok: true, added: false });
  assert.deepEqual(h.calls, [{ operation: "read", userId: "owner", planId: h.plan.id, mode: "review" }]);
});

test("recommendation insertion hides unexpected database details and rejects empty RPC results", async (t) => {
  const logger = t.mock.method(console, "error", () => {});
  const candidate = { kind: "roadmap", frontendId: "1", slug: "two-sum", title: "Two Sum", difficulty: "easy",
    leetcodeUrl: "https://leetcode.com/problems/two-sum/", order: 1 };
  const h = recommendationAction({ candidate, rpcError: { code: "XX001", message: "private", details: "private details", hint: "private hint" } });
  assert.deepEqual(await h.addRecommendedProblemToTodayAction(h.plan.id, "roadmap"), { ok: false, error: "save_failed" });
  assert.equal(logger.mock.calls[0].arguments[1].operation, "add_problem_to_today");
  const empty = recommendationAction({ candidate, emptyResult: true });
  assert.deepEqual(await empty.addRecommendedProblemToTodayAction(empty.plan.id, "roadmap"), { ok: false, error: "save_failed" });
});
