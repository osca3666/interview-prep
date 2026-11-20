import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync(
  new URL("../supabase/migrations/20261110000000_add_v1_scheduling_foundation.sql", import.meta.url),
  "utf8",
);
const roadmapSource = readFileSync(
  new URL("../data/problem-sets/neetcode-150.ts", import.meta.url),
  "utf8",
);
const databaseTypes = readFileSync(
  new URL("../types/database.ts", import.meta.url),
  "utf8",
);

test("Phase 2A is additive and contains no destructive data operation", () => {
  assert.doesNotMatch(migration, /\btruncate\b/i);
  assert.doesNotMatch(migration, /\bdrop\s+table\b/i);
  assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  assert.match(migration, /create table public\.study_plan_setting_revisions/);
  assert.match(migration, /create table public\.review_allocation_entries/);
});

test("the persisted NeetCode membership exactly matches the static roadmap", () => {
  const sourceRows = [...roadmapSource.matchAll(/\{ order: (\d+), slug: "([^"]+)"/g)]
    .map((match) => [Number(match[1]), match[2]]);
  const migrationRows = [...migration.matchAll(/\('neetcode-150', '([^']+)', (\d+)\)/g)]
    .map((match) => [Number(match[2]), match[1]]);
  assert.equal(sourceRows.length, 150);
  assert.deepEqual(migrationRows, sourceRows);
});

test("settings, allocation, and plan snapshot constraints match Phase 1 contracts", () => {
  assert.match(migration, /daily_new_target between 0 and 10/);
  assert.match(migration, /daily_review_target between 0 and 20/);
  assert.match(migration, /new_selection_mode in \('sequential', 'shuffled'\)/);
  assert.match(migration, /review_source in \('all', 'selected_roadmaps'\)/);
  assert.match(migration, /pool in \('imported', 'established'\)/);
  assert.match(migration, /source in \('generated', 'manual'\)/);
  assert.match(migration, /status in \('pending', 'completed', 'deferred', 'unassigned'\)/);
  assert.match(migration, /unique \(context_id, allocation_key\)/);
});

test("generated database types expose the complete Phase 2A contract", () => {
  for (const name of [
    "review_allocation_contexts",
    "review_allocation_context_roadmaps",
    "review_allocation_entries",
    "study_plan_setting_revisions",
    "study_roadmap_problems",
    "study_roadmaps",
    "consecutive_good_count",
    "provisional_mastery_score",
    "previous_consecutive_good_count",
    "pre_practice_review_pool",
    "review_pool_snapshot",
    "unassignment_reason",
    "settings_revision_id",
  ]) {
    assert.match(databaseTypes, new RegExp(`"${name}"`));
  }
});
