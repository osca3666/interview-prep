import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const {
  MAX_DAILY_NEW_PROBLEMS,
  MAX_DAILY_REVIEWS,
  normalizeStudyPlanRoadmapIds,
  validateStudyPlanSettingsInput,
} = loadTypeScriptModule(new URL("../lib/study-plan-settings.ts", import.meta.url));

function valid(overrides = {}) {
  return {
    dailyNewTarget: 1,
    dailyReviewTarget: 3,
    followedRoadmapId: null,
    newSelectionMode: "sequential",
    reviewSource: "all",
    reviewRoadmapIds: [],
    applyWhen: "today",
    timeZone: "America/Denver",
    ...overrides,
  };
}

test("study plan settings accept defaults and an intentional zero-target plan", () => {
  assert.equal(validateStudyPlanSettingsInput(valid()), null);
  assert.equal(validateStudyPlanSettingsInput(valid({ dailyNewTarget: 0, dailyReviewTarget: 0 })), null);
});

test("study plan settings enforce target bounds and whole numbers", () => {
  assert.equal(validateStudyPlanSettingsInput(valid({ dailyNewTarget: -1 })), "invalid_new_target");
  assert.equal(validateStudyPlanSettingsInput(valid({ dailyNewTarget: MAX_DAILY_NEW_PROBLEMS + 1 })), "invalid_new_target");
  assert.equal(validateStudyPlanSettingsInput(valid({ dailyNewTarget: 1.5 })), "invalid_new_target");
  assert.equal(validateStudyPlanSettingsInput(valid({ dailyReviewTarget: -1 })), "invalid_review_target");
  assert.equal(validateStudyPlanSettingsInput(valid({ dailyReviewTarget: MAX_DAILY_REVIEWS + 1 })), "invalid_review_target");
});

test("New and Review sources remain independent", () => {
  assert.equal(validateStudyPlanSettingsInput(valid({
    followedRoadmapId: "neetcode-150",
    reviewSource: "all",
    reviewRoadmapIds: [],
  })), null);
  assert.equal(validateStudyPlanSettingsInput(valid({
    followedRoadmapId: null,
    reviewSource: "selected_roadmaps",
    reviewRoadmapIds: ["neetcode-150"],
  })), null);
});

test("selected-roadmap reviews require at least one roadmap", () => {
  assert.equal(validateStudyPlanSettingsInput(valid({
    reviewSource: "selected_roadmaps",
    reviewRoadmapIds: [],
  })), "invalid_review_source");
  assert.equal(validateStudyPlanSettingsInput(valid({
    reviewSource: "all",
    reviewRoadmapIds: ["neetcode-150"],
  })), "invalid_review_source");
});

test("sequential/shuffled and today/tomorrow are the only accepted choices", () => {
  assert.equal(validateStudyPlanSettingsInput(valid({ newSelectionMode: "shuffled" })), null);
  assert.equal(validateStudyPlanSettingsInput(valid({ applyWhen: "tomorrow" })), null);
  assert.equal(validateStudyPlanSettingsInput(valid({ newSelectionMode: "random" })), "invalid_selection_mode");
  assert.equal(validateStudyPlanSettingsInput(valid({ applyWhen: "later" })), "invalid_apply_when");
});

test("roadmap ids are trimmed, de-duplicated, and sorted before persistence", () => {
  assert.deepEqual(
    normalizeStudyPlanRoadmapIds([" roadmap-b ", "roadmap-a", "roadmap-b", ""]),
    ["roadmap-a", "roadmap-b"],
  );
});
