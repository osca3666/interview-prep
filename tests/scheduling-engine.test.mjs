import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const engine = loadTypeScriptModule(
  new URL("../lib/scheduling-engine.ts", import.meta.url),
);

const referenceTime = new Date("2026-11-10T18:00:00.000Z");
const allSources = { mode: "all" };
const emptyAllocation = { entries: [] };

function problem(id, overrides = {}) {
  return {
    id,
    canonicalId: id,
    masteryScore: 5,
    consecutiveGoodCount: 0,
    genuineRatingCount: 1,
    importedAccepted: false,
    acceptedDate: null,
    lastPracticedAt: "2026-11-07T18:00:00.000Z",
    nextReviewAt: "2026-11-09T18:00:00.000Z",
    roadmapIds: ["neetcode-150"],
    ...overrides,
  };
}

function context(overrides = {}) {
  return {
    referenceTime,
    studyDate: "2026-11-10",
    sourceFilter: allSources,
    ...overrides,
  };
}

function candidate(id, pool, overrides = {}) {
  const imported = pool === "imported";
  const row = problem(id, imported ? {
    masteryScore: 0,
    genuineRatingCount: 0,
    importedAccepted: true,
    acceptedDate: "2026-10-01",
    lastPracticedAt: null,
    nextReviewAt: null,
  } : overrides);
  return {
    problem: { ...row, ...overrides },
    pool,
    timing: imported ? "imported" : "due",
  };
}

function roadmap(id, canonicalIds) {
  return {
    id,
    problems: canonicalIds.map((canonicalId, index) => ({
      roadmapId: id,
      canonicalId,
      order: index + 1,
      title: `Problem ${canonicalId}`,
    })),
  };
}

test("Bad, OK, and consecutive Good ratings follow the V1 policy", () => {
  const bad = engine.calculateRatingTransition({
    masteryScore: 5, consecutiveGoodCount: 2, rating: "bad", completedAt: referenceTime,
  });
  assert.deepEqual(
    [bad.masteryScore, bad.consecutiveGoodCount, bad.intervalDays],
    [3, 0, 1],
  );

  const ok = engine.calculateRatingTransition({
    masteryScore: 5, consecutiveGoodCount: 2, rating: "ok", completedAt: referenceTime,
  });
  assert.deepEqual(
    [ok.masteryScore, ok.consecutiveGoodCount, ok.intervalDays],
    [6, 0, 3],
  );

  let masteryScore = 0;
  let consecutiveGoodCount = 0;
  const intervals = [];
  for (let index = 0; index < 4; index += 1) {
    const result = engine.calculateRatingTransition({
      masteryScore, consecutiveGoodCount, rating: "good", completedAt: referenceTime,
    });
    masteryScore = result.masteryScore;
    consecutiveGoodCount = result.consecutiveGoodCount;
    intervals.push(result.intervalDays);
  }
  assert.deepEqual(intervals, [7, 14, 30, 60]);
  assert.equal(masteryScore, 10);
  assert.equal(consecutiveGoodCount, 4);
});

test("Good, Good, OK, Good resets the Good interval to seven days", () => {
  let state = { masteryScore: 0, consecutiveGoodCount: 0 };
  const intervals = [];
  for (const rating of ["good", "good", "ok", "good"]) {
    const result = engine.calculateRatingTransition({ ...state, rating, completedAt: referenceTime });
    state = result;
    intervals.push(result.intervalDays);
  }
  assert.deepEqual(intervals, [7, 14, 3, 7]);
  assert.equal(state.consecutiveGoodCount, 1);
});

test("mastery is clamped at zero and ten and schedules from completion time", () => {
  const low = engine.calculateRatingTransition({
    masteryScore: 1, consecutiveGoodCount: 0, rating: "bad", completedAt: referenceTime,
  });
  const high = engine.calculateRatingTransition({
    masteryScore: 9, consecutiveGoodCount: 0, rating: "good", completedAt: referenceTime,
  });
  assert.equal(low.masteryScore, 0);
  assert.equal(high.masteryScore, 10);
  assert.equal(engine.calculateMasteryAfterRating(5, "ok"), 6);
  assert.deepEqual(engine.calculateRatingInterval("good", 2), {
    consecutiveGoodCount: 3,
    intervalDays: 30,
  });
  assert.equal(Date.parse(low.nextReviewAt) - referenceTime.getTime(), 86_400_000);
});

test("an Accepted import starts from provisional mastery three and becomes established", () => {
  const imported = problem("imported", {
    masteryScore: 0,
    genuineRatingCount: 0,
    importedAccepted: true,
    acceptedDate: "2026-01-01",
    lastPracticedAt: null,
    nextReviewAt: null,
  });
  assert.equal(engine.classifyReviewProblem(imported), "imported");
  assert.equal(engine.getSchedulingMastery(imported), 3);
  const result = engine.applyProblemRating({ problem: imported, rating: "good", completedAt: referenceTime });
  assert.equal(result.classificationAfter, "established");
  assert.equal(result.transition.masteryScore, 6);
  assert.equal(result.transition.intervalDays, 7);
});

test("unpracticed To-do problems never enter a review pool", () => {
  const todo = problem("todo", {
    genuineRatingCount: 0,
    importedAccepted: false,
    masteryScore: 0,
  });
  assert.equal(engine.classifyReviewProblem(todo), "unpracticed");
  assert.equal(engine.getReviewEligibility(todo, context()), null);
});

test("due reviews bypass the 48-hour early cooldown while future reviews do not", () => {
  const recentlyBad = problem("bad", {
    lastPracticedAt: "2026-11-09T18:00:00.000Z",
    nextReviewAt: "2026-11-10T18:00:00.000Z",
  });
  const future = problem("future", {
    lastPracticedAt: "2026-11-09T18:00:00.000Z",
    nextReviewAt: "2026-11-12T18:00:00.000Z",
  });
  assert.equal(engine.getReviewEligibility(recentlyBad, context()).timing, "due");
  assert.equal(engine.getReviewEligibility(future, context()), null);
  assert.equal(engine.getReviewEligibility(future, context({ manualSelection: true })).timing, "early");
});

test("established early reviews become eligible after 48 elapsed hours", () => {
  const early = problem("early", {
    lastPracticedAt: "2026-11-08T18:00:00.000Z",
    nextReviewAt: "2026-11-20T18:00:00.000Z",
  });
  assert.equal(engine.getReviewEligibility(early, context()).timing, "early");
  assert.equal(engine.getReviewEligibility(early, context({
    referenceTime: new Date("2026-11-08T18:00:00.000Z"),
    studyDate: "2026-11-08",
  })), null);
});

test("date-only imports use a conservative three-calendar-date cooldown", () => {
  const imported = problem("imported", {
    genuineRatingCount: 0,
    importedAccepted: true,
    acceptedDate: "2026-11-07",
    lastPracticedAt: null,
    nextReviewAt: null,
  });
  assert.equal(engine.getReviewEligibility(imported, context({ studyDate: "2026-11-09" })), null);
  assert.equal(engine.getReviewEligibility(imported, context()).pool, "imported");
});

test("imports with unknown Accepted dates remain eligible and rank after known dates", () => {
  const missing = problem("missing", {
    genuineRatingCount: 0, importedAccepted: true, acceptedDate: null,
  });
  const newer = problem("newer", {
    genuineRatingCount: 0, importedAccepted: true, acceptedDate: "2026-02-01",
  });
  const older = problem("older", {
    genuineRatingCount: 0, importedAccepted: true, acceptedDate: "2025-02-01",
  });
  const pools = engine.buildEligibleReviewPools([missing, newer, older], context());
  assert.deepEqual(pools.imported.map((item) => item.problem.id), ["older", "newer", "missing"]);
});

test("established ranking puts due work before early work and preserves oldest-due fairness", () => {
  const rows = [
    problem("oldest", { masteryScore: 10, nextReviewAt: "2026-10-01T00:00:00Z" }),
    problem("weak", { masteryScore: 0, nextReviewAt: "2026-11-09T00:00:00Z" }),
    problem("strong", { masteryScore: 10, nextReviewAt: "2026-11-08T00:00:00Z" }),
    problem("early-near", { nextReviewAt: "2026-11-11T00:00:00Z" }),
    problem("early-far", { nextReviewAt: "2026-11-20T00:00:00Z" }),
  ];
  const pools = engine.buildEligibleReviewPools(rows, context());
  assert.deepEqual(
    pools.established.map((item) => item.problem.id),
    ["oldest", "weak", "strong", "early-near", "early-far"],
  );
});

test("selected-roadmap review filters are independent from following a roadmap", () => {
  const selected = problem("selected", { roadmapIds: ["blind-75"] });
  const other = problem("other", { roadmapIds: ["neetcode-150"] });
  const pools = engine.buildEligibleReviewPools([selected, other], context({
    sourceFilter: { mode: "roadmaps", roadmapIds: ["blind-75"] },
  }));
  assert.deepEqual(pools.established.map((item) => item.problem.id), ["selected"]);
});

test("weighted deficits produce a 3:2 split across repeated one-review days", () => {
  const pools = {
    imported: Array.from({ length: 9 }, (_, index) => candidate(`i-${index}`, "imported")),
    established: Array.from({ length: 4 }, (_, index) => candidate(`e-${index}`, "established")),
  };
  let state = emptyAllocation;
  const selectedPools = [];
  for (let day = 0; day < 5; day += 1) {
    const result = engine.allocateReviewCandidates({
      pools, limit: 1, state, allocationIds: [`day-${day}`],
    });
    state = result.state;
    selectedPools.push(result.selected[0].pool);
  }
  assert.deepEqual(selectedPools, ["imported", "established", "imported", "established", "imported"]);
});

test("allocation majority changes with eligible pool sizes", () => {
  const importedMajority = engine.allocateReviewCandidates({
    pools: {
      imported: [candidate("i1", "imported"), candidate("i2", "imported")],
      established: [candidate("e1", "established")],
    },
    limit: 1,
    state: emptyAllocation,
    allocationIds: ["first"],
  });
  const establishedMajority = engine.allocateReviewCandidates({
    pools: {
      imported: [candidate("i3", "imported")],
      established: [candidate("e2", "established"), candidate("e3", "established"), candidate("e4", "established")],
    },
    limit: 1,
    state: importedMajority.state,
    allocationIds: ["second"],
  });
  assert.equal(importedMajority.selected[0].pool, "imported");
  assert.equal(establishedMajority.selected[0].pool, "established");
});

test("pool exhaustion falls back without inventing candidates", () => {
  const result = engine.allocateReviewCandidates({
    pools: {
      imported: [candidate("i", "imported")],
      established: [candidate("e1", "established"), candidate("e2", "established")],
    },
    limit: 5,
    state: emptyAllocation,
    allocationIds: ["a", "b", "c", "d", "e"],
  });
  assert.equal(result.selected.length, 3);
  assert.deepEqual(new Set(result.selected.map((item) => item.problem.id)), new Set(["i", "e1", "e2"]));
});

test("manual allocation credit is idempotent and generated credit can be reversed", () => {
  const weights = { imported: 3, established: 2 };
  const manual = engine.recordReviewAllocation(emptyAllocation, {
    allocationId: "manual-1",
    candidateId: "i",
    pool: "imported",
    source: "manual",
    weights,
  });
  assert.equal(engine.recordReviewAllocation(manual, {
    allocationId: "manual-1", candidateId: "i", pool: "imported", source: "manual", weights,
  }), manual);
  assert.equal(engine.chooseNextReviewPool(manual, { imported: 9, established: 4 }), "established");

  const generated = engine.recordReviewAllocation(emptyAllocation, {
    allocationId: "generated-1",
    candidateId: "i",
    pool: "imported",
    source: "generated",
    weights,
  });
  const reversed = engine.reverseGeneratedAllocation(generated, "generated-1");
  assert.deepEqual(engine.getAllocationDeficits(reversed), { imported: 0, established: 0 });
  assert.equal(engine.reverseGeneratedAllocation(reversed, "generated-1"), reversed);
  assert.equal(engine.reverseGeneratedAllocation(manual, "manual-1"), manual);
});

test("settings reconciliation preserves eligible priority and removes deterministic surplus", () => {
  const result = engine.reconcileGeneratedAssignments([
    { taskId: "later", position: 4, eligible: true },
    { taskId: "invalid", position: 1, eligible: false },
    { taskId: "first", position: 0, eligible: true },
    { taskId: "second", position: 2, eligible: true },
  ], 2);
  assert.deepEqual(result.keptTaskIds, ["first", "second"]);
  assert.deepEqual(result.unassignedTaskIds, ["invalid", "later"]);
});

test("settings reconciliation is immutable, bounded, and idempotent", () => {
  const assignments = [
    { taskId: "a", position: 0, eligible: true },
    { taskId: "b", position: 1, eligible: true },
  ];
  const first = engine.reconcileGeneratedAssignments(assignments, 1);
  const second = engine.reconcileGeneratedAssignments(assignments, 1);
  assert.deepEqual(first, second);
  assert.deepEqual(assignments.map((item) => item.taskId), ["a", "b"]);
  assert.deepEqual(engine.reconcileGeneratedAssignments(assignments, -4).keptTaskIds, []);
});

test("sequential New selection uses the followed roadmap and excludes practiced problems", () => {
  const result = engine.selectNewProblems({
    roadmaps: [roadmap("neetcode-150", ["a", "b"]), roadmap("company", ["b", "c", "d"])],
    followedRoadmapId: "company",
    suggestedRoadmapId: "neetcode-150",
    history: [{ canonicalId: "b", genuinelyPracticed: false, importedAccepted: true }],
    count: 2,
    mode: "sequential",
    shuffleSeed: "2026-11-10:user",
  });
  assert.equal(result.source, "followed");
  assert.equal(result.sourceRoadmapId, "company");
  assert.deepEqual(result.problems.map((item) => item.canonicalId), ["c", "d"]);
});

test("To-do tracking alone does not remove a problem from the New pool", () => {
  const result = engine.selectNewProblems({
    roadmaps: [roadmap("neetcode-150", ["a"])],
    followedRoadmapId: null,
    suggestedRoadmapId: "neetcode-150",
    history: [{ canonicalId: "a", genuinelyPracticed: false, importedAccepted: false }],
    count: 1,
    mode: "sequential",
    shuffleSeed: "seed",
  });
  assert.deepEqual(result.problems.map((item) => item.canonicalId), ["a"]);
});

test("duplicate canonical problems across roadmaps come only from the active source", () => {
  const result = engine.selectNewProblems({
    roadmaps: [
      roadmap("neetcode-150", ["shared", "default-only"]),
      roadmap("company", ["shared", "company-only"]),
    ],
    followedRoadmapId: "company",
    suggestedRoadmapId: "neetcode-150",
    history: [],
    count: 3,
    mode: "sequential",
    shuffleSeed: "seed",
  });
  assert.deepEqual(result.problems.map((item) => [item.roadmapId, item.canonicalId]), [
    ["company", "shared"],
    ["company", "company-only"],
  ]);
  assert.equal(result.shortage, 1);
});

test("shuffled New selection is deterministic and deduplicates canonical identities", () => {
  const source = roadmap("neetcode-150", ["a", "b", "a", "c", "d"]);
  const input = {
    roadmaps: [source],
    followedRoadmapId: null,
    suggestedRoadmapId: "neetcode-150",
    history: [],
    count: 4,
    mode: "shuffled",
    shuffleSeed: "user:2026-11-10",
  };
  const first = engine.selectNewProblems(input);
  const second = engine.selectNewProblems({ ...input, roadmaps: [{ ...source, problems: [...source.problems].reverse() }] });
  assert.deepEqual(first, second);
  assert.equal(new Set(first.problems.map((item) => item.canonicalId)).size, first.problems.length);
});

test("an exhausted selected roadmap reports a shortage and never switches sources", () => {
  const result = engine.selectNewProblems({
    roadmaps: [roadmap("neetcode-150", ["a", "b"]), roadmap("company", ["c"])],
    followedRoadmapId: "company",
    suggestedRoadmapId: "neetcode-150",
    history: [{ canonicalId: "c", genuinelyPracticed: true, importedAccepted: false }],
    count: 2,
    mode: "sequential",
    shuffleSeed: "seed",
  });
  assert.equal(result.sourceRoadmapId, "company");
  assert.equal(result.problems.length, 0);
  assert.equal(result.shortage, 2);
  assert.equal(result.exhausted, true);
});

test("the full engine returns shortages instead of cross-filling targets", () => {
  const result = engine.selectV1SchedulingPlan({
    problems: [problem("review")],
    eligibility: context(),
    reviewTarget: 3,
    allocationState: emptyAllocation,
    allocationIds: ["r1", "r2", "r3"],
    roadmaps: [roadmap("neetcode-150", ["new"])],
    followedRoadmapId: null,
    suggestedRoadmapId: "neetcode-150",
    newProblemHistory: [],
    newProblemTarget: 2,
    newProblemMode: "sequential",
    shuffleSeed: "seed",
  });
  assert.equal(result.reviews.length, 1);
  assert.equal(result.newProblems.length, 1);
  assert.deepEqual(result.shortages, { reviews: 2, newProblems: 1 });
});

test("equivalent input orders produce deterministic review and New output", () => {
  const problems = [problem("c"), problem("a"), problem("b")];
  const firstPools = engine.buildEligibleReviewPools(problems, context());
  const secondPools = engine.buildEligibleReviewPools([...problems].reverse(), context());
  assert.deepEqual(firstPools, secondPools);
});
