import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { getStudyPlanSummary, getStudyTaskAction, getStudyWorkspaceRevision, orderStudyPlanTasks } = loadTypeScriptModule(
  new URL("../lib/daily-study-plan-view.ts", import.meta.url),
);

function workspace(statuses = ["pending", "pending", "pending", "pending"]) {
  return {
    plan: { id: "plan", planned_task_count: statuses.length },
    tasks: statuses.map((status, index) => ({
      id: `task-${index}`, kind: "review", origin: "tracked", user_problem_id: `problem-${index}`,
      leetcode_frontend_id: String(index + 1), status, assignment_source: "generated", position: index,
      created_at: `2026-11-02T12:0${index}:00Z`,
      completed_at: status === "completed" ? `2026-11-02T13:0${index}:00Z` : null,
      deferred_at: status === "deferred" ? `2026-11-02T13:0${index}:00Z` : null,
    })),
    liveProblems: [{ id: "problem-0", lifecycle_state: "active", next_review_at: "2026-11-02T12:00:00Z", schedule_version: 5 }],
    asOf: "2026-11-02T12:00:00Z",
  };
}

test("progress uses the persisted task denominator, not a hardcoded four", () => {
  assert.deepEqual(getStudyPlanSummary(workspace(["completed", "pending"])), {
    total: 2, completed: 1, deferred: 0, percent: 50, state: "active",
  });
});

test("three completed and one deferred is resolved, not four completed", () => {
  assert.deepEqual(getStudyPlanSummary(workspace(["completed", "completed", "completed", "deferred"])), {
    total: 4, completed: 3, deferred: 1, percent: 75, state: "resolved",
  });
});

test("all completed produces a full bar and completion state", () => {
  const summary = getStudyPlanSummary(workspace(["completed", "completed", "completed", "completed"]));
  assert.equal(summary.state, "completed");
  assert.equal(summary.percent, 100);
});

test("all deferred never implies practice or a full progress bar", () => {
  const summary = getStudyPlanSummary(workspace(["deferred", "deferred"]));
  assert.equal(summary.state, "resolved");
  assert.equal(summary.completed, 0);
  assert.equal(summary.percent, 0);
});

test("empty plans are empty, not completed or resolved", () => {
  assert.deepEqual(getStudyPlanSummary(workspace([])), {
    total: 0, completed: 0, deferred: 0, percent: 0, state: "empty",
  });
});

test("tracking and opening a problem do not change persisted progress", () => {
  const data = workspace(["pending"]);
  data.tasks[0].kind = "new_problem";
  data.tasks[0].origin = "roadmap";
  data.tasks[0].user_problem_id = null;
  assert.equal(getStudyTaskAction(data.tasks[0], undefined, data.asOf), "practice_new");
  assert.equal(getStudyPlanSummary(data).completed, 0);
  data.tasks[0].user_problem_id = data.liveProblems[0].id;
  assert.equal(getStudyTaskAction(data.tasks[0], data.liveProblems[0], data.asOf), "review");
  assert.equal(getStudyPlanSummary(data).completed, 0);
});

test("a future scheduled task stays pending and has no review controls", () => {
  const data = workspace(["pending"]);
  data.liveProblems[0].next_review_at = "2026-11-03T00:00:00Z";
  assert.equal(getStudyTaskAction(data.tasks[0], data.liveProblems[0], data.asOf), "scheduled");
});

test("an explicitly added Today task remains actionable without rewriting its future schedule", () => {
  const data = workspace(["pending"]);
  data.tasks[0].assignment_source = "manual_today";
  data.liveProblems[0].next_review_at = "2026-12-03T00:00:00Z";
  assert.equal(getStudyTaskAction(data.tasks[0], data.liveProblems[0], data.asOf), "review");
});

test("completed and deferred tasks do not regain mutation controls", () => {
  for (const status of ["completed", "deferred"]) {
    const data = workspace([status]);
    assert.equal(getStudyTaskAction(data.tasks[0], data.liveProblems[0], data.asOf), "resolved");
  }
});

test("deleted, inactive, or different bound problems do not get review controls", () => {
  const data = workspace(["pending"]);
  for (const live of [undefined, { ...data.liveProblems[0], lifecycle_state: "paused" }, { ...data.liveProblems[0], id: "different" }]) {
    assert.equal(getStudyTaskAction(data.tasks[0], live, data.asOf), "unavailable");
  }
  data.tasks[0].user_problem_id = null;
  assert.equal(getStudyTaskAction(data.tasks[0], undefined, data.asOf), "unavailable");
});

test("workspace revisions change with binding, completion, and live schedule versions", () => {
  const data = workspace(["pending"]);
  const initial = getStudyWorkspaceRevision(data);
  for (const mutate of [
    (copy) => { copy.tasks[0].status = "completed"; },
    (copy) => { copy.tasks[0].user_problem_id = null; },
    (copy) => { copy.liveProblems[0].schedule_version += 1; },
  ]) {
    const changed = structuredClone(data);
    mutate(changed);
    assert.notEqual(getStudyWorkspaceRevision(changed), initial);
  }
  assert.equal(getStudyWorkspaceRevision(structuredClone(data)), initial);
});

test("task ordering keeps new pending work first, deferred work next, and recent completions last", () => {
  const data = workspace(["completed", "pending", "deferred", "pending", "completed"]);
  data.tasks[3].assignment_source = "manual_today";
  data.tasks[3].position = 8;
  data.tasks[4].completed_at = "2026-11-02T14:00:00Z";
  assert.deepEqual(orderStudyPlanTasks(data.tasks).map((task) => task.id), [
    "task-3", "task-1", "task-2", "task-0", "task-4",
  ]);
});

test("multiple newly added tasks stay pinned while rating is open, then optimistic completion moves without mutation", () => {
  const data = workspace(["pending", "pending", "completed"]);
  data.tasks[0].assignment_source = "manual_today";
  data.tasks[0].position = 5;
  data.tasks[1].assignment_source = "manual_today";
  data.tasks[1].position = 6;
  const original = structuredClone(data.tasks);
  assert.deepEqual(orderStudyPlanTasks(data.tasks).map((task) => task.id), ["task-1", "task-0", "task-2"]);
  const optimistic = new Set(["task-1"]);
  const pinnedWhileRatingOpen = new Set([...optimistic].filter((taskId) => taskId !== "task-1"));
  assert.deepEqual(orderStudyPlanTasks(data.tasks, pinnedWhileRatingOpen).map((task) => task.id), ["task-1", "task-0", "task-2"]);
  assert.deepEqual(orderStudyPlanTasks(data.tasks, optimistic).map((task) => task.id), ["task-0", "task-2", "task-1"]);
  assert.deepEqual(data.tasks, original);
});

