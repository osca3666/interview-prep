import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const {
  buildRoadmapCatalog,
  createRoadmapFollowSettingsInput,
  partitionRoadmapCatalog,
} = loadTypeScriptModule(new URL("../lib/roadmaps.ts", import.meta.url));

const registry = [
  { id: "neetcode-150", name: "NeetCode 150", contentVersion: "v1" },
  { id: "second-roadmap", name: "Second Roadmap", contentVersion: "v1" },
];
const memberships = [
  { roadmapId: "neetcode-150", leetcodeSlug: "two-sum", position: 1 },
  { roadmapId: "neetcode-150", leetcodeSlug: "valid-anagram", position: 2 },
  { roadmapId: "second-roadmap", leetcodeSlug: "two-sum", position: 1 },
  { roadmapId: "second-roadmap", leetcodeSlug: "merge-intervals", position: 2 },
];

function build(userProblems = []) {
  return buildRoadmapCatalog({
    roadmaps: registry,
    memberships,
    userProblems,
  });
}

test("no followed roadmap features NeetCode 150 as suggested without claiming it is followed", () => {
  const partition = partitionRoadmapCatalog(build(), null);
  assert.equal(partition.featured.id, "neetcode-150");
  assert.equal(partition.isSuggested, true);
  assert.deepEqual(
    partition.otherRoadmaps.map((roadmap) => roadmap.id),
    ["second-roadmap"],
  );
});

test("exactly one followed roadmap is featured and never duplicated", () => {
  const partition = partitionRoadmapCatalog(build(), "second-roadmap");
  assert.equal(partition.featured.id, "second-roadmap");
  assert.equal(partition.isSuggested, false);
  assert.deepEqual(
    partition.otherRoadmaps.map((roadmap) => roadmap.id),
    ["neetcode-150"],
  );
});

test("genuine practice and imported Accepted history count, while To-do tracking does not", () => {
  const catalog = build([
    {
      leetcodeSlug: "two-sum",
      totalReviews: 1,
      externalPracticeStatus: null,
    },
    {
      leetcodeSlug: "valid-anagram",
      totalReviews: 0,
      externalPracticeStatus: null,
    },
    {
      leetcodeSlug: "merge-intervals",
      totalReviews: 0,
      externalPracticeStatus: "accepted",
    },
  ]);

  assert.equal(catalog[0].completedProblemCount, 1);
  assert.equal(catalog[1].completedProblemCount, 2);
});

test("one practiced canonical problem advances every roadmap that contains it", () => {
  const catalog = build([
    {
      leetcodeSlug: "two-sum",
      totalReviews: 2,
      externalPracticeStatus: null,
    },
  ]);

  assert.deepEqual(
    catalog.map((roadmap) => roadmap.completedProblemCount),
    [1, 1],
  );
});

test("completed roadmaps expose an exhausted state without switching sources", () => {
  const catalog = build([
    {
      leetcodeSlug: "two-sum",
      totalReviews: 1,
      externalPracticeStatus: null,
    },
    {
      leetcodeSlug: "valid-anagram",
      totalReviews: 1,
      externalPracticeStatus: null,
    },
  ]);

  const neetcode = catalog.find((roadmap) => roadmap.id === "neetcode-150");
  assert.equal(neetcode.isComplete, true);
  assert.equal(neetcode.progressPercent, 100);
});

test("following and stopping preserve targets, selection mode, and independent review sources", () => {
  const base = {
    dailyNewTarget: 2,
    dailyReviewTarget: 5,
    newSelectionMode: "shuffled",
    reviewSource: "selected_roadmaps",
    reviewRoadmapIds: ["second-roadmap"],
    timeZone: "America/Denver",
  };

  const today = createRoadmapFollowSettingsInput(
    base,
    "neetcode-150",
    "today",
  );
  const tomorrow = createRoadmapFollowSettingsInput(base, null, "tomorrow");

  assert.deepEqual(today, {
    ...base,
    followedRoadmapId: "neetcode-150",
    applyWhen: "today",
  });
  assert.deepEqual(tomorrow, {
    ...base,
    followedRoadmapId: null,
    applyWhen: "tomorrow",
  });
  assert.notStrictEqual(today.reviewRoadmapIds, base.reviewRoadmapIds);
});
