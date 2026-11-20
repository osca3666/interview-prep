import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const settingsMigration = readFileSync(
  new URL("../supabase/migrations/20261111000000_add_v1_settings_and_plan_creation.sql", import.meta.url),
  "utf8",
);
const ratingMigration = readFileSync(
  new URL("../supabase/migrations/20261111001000_activate_v1_rating_policy.sql", import.meta.url),
  "utf8",
);
const reconciliationMigration = readFileSync(
  new URL("../supabase/migrations/20261111002000_reconcile_v1_manual_practice.sql", import.meta.url),
  "utf8",
);
const applyTodayMigration = readFileSync(
  new URL("../supabase/migrations/20261111004000_reconcile_v1_apply_today.sql", import.meta.url),
  "utf8",
);
const manualAllocationRaceMigration = readFileSync(
  new URL("../supabase/migrations/20261111005000_preserve_manual_allocation_after_reconciliation.sql", import.meta.url),
  "utf8",
);
const types = readFileSync(new URL("../types/database.ts", import.meta.url), "utf8");

test("Phase 2B migrations are additive and leave legacy plan creation available", () => {
  for (const migration of [settingsMigration, ratingMigration, reconciliationMigration]) {
    assert.doesNotMatch(migration, /\btruncate\b/i);
    assert.doesNotMatch(migration, /\bdrop\s+(table|function)\b/i);
    assert.doesNotMatch(migration, /\bdelete\s+from\b/i);
  }
  assert.match(settingsMigration, /create or replace function public\.create_v1_daily_study_plan/);
  assert.doesNotMatch(settingsMigration, /create or replace function public\.create_daily_study_plan/);
});

test("Phase 2C reconciles Apply today atomically without deleting study evidence", () => {
  assert.match(applyTodayMigration, /create or replace function public\.save_and_reconcile_study_plan_settings/);
  assert.match(applyTodayMigration, /pg_advisory_xact_lock/);
  assert.match(applyTodayMigration, /settings_target_reduced/);
  assert.match(applyTodayMigration, /settings_source_changed/);
  assert.match(applyTodayMigration, /reversal_reason = 'settings_reconciliation'/);
  assert.match(applyTodayMigration, /task\.assignment_source = 'generated'/);
  assert.doesNotMatch(applyTodayMigration, /delete\s+from\s+public\.(review_events|user_problems|daily_study_plan_tasks)/i);
});

test("settings revisions support bounded targets and safe effective dates", () => {
  assert.match(settingsMigration, /p_daily_new_target not between 0 and 10/);
  assert.match(settingsMigration, /p_daily_review_target not between 0 and 20/);
  assert.match(settingsMigration, /p_apply_when not in \('today', 'tomorrow'\)/);
  assert.match(settingsMigration, /apply_today_requires_reconciliation/);
  assert.match(settingsMigration, /effective_study_date <= v_study_date/);
});

test("V1 transition SQL mirrors the pure Bad OK Good policy", () => {
  assert.match(ratingMigration, /when 'bad' then -2 when 'ok' then 1 else 3/);
  assert.match(ratingMigration, /when p_rating = 'bad' then 1/);
  assert.match(ratingMigration, /when p_rating = 'ok' then 3/);
  assert.match(ratingMigration, /new_consecutive_good_count <= 1 then 7/);
  assert.match(ratingMigration, /new_consecutive_good_count = 2 then 14/);
  assert.match(ratingMigration, /new_consecutive_good_count = 3 then 30/);
  assert.match(ratingMigration, /else 60/);
  assert.match(ratingMigration, /when v_review_pool = 'imported' then 3/);
});

test("same-event correction and manual reconciliation preserve evidence", () => {
  assert.match(ratingMigration, /where id = v_event\.id and user_id = v_user_id/);
  assert.match(ratingMigration, /previous_consecutive_good_count/);
  assert.match(reconciliationMigration, /'manual:' \|\| p_event\.id::text/);
  assert.match(reconciliationMigration, /on conflict do nothing/);
  assert.match(reconciliationMigration, /replaced_by_manual_practice/);
  assert.match(reconciliationMigration, /reversal_reason = 'task_unassigned'/);
  assert.doesNotMatch(reconciliationMigration, /delete\s+from/i);
});

test("historical same-day tasks do not suppress manual allocation evidence", () => {
  assert.match(
    manualAllocationRaceMigration,
    /if p_activity in \('review', 'practiced'\) then\s+perform private\.record_v1_manual_review_allocation/,
  );
  assert.doesNotMatch(manualAllocationRaceMigration, /delete\s+from/i);
});

test("generated types expose the protected V1 API", () => {
  for (const name of [
    "create_v1_daily_study_plan",
    "get_effective_study_plan_settings",
    "save_study_plan_settings",
    "save_and_reconcile_study_plan_settings",
  ]) assert.match(types, new RegExp(`"${name}"`));
});
