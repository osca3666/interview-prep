import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const diagnostics = [];
const { getStudyPlanSettingsOverview } = loadTypeScriptModule(
  new URL("../data/study-settings.ts", import.meta.url),
  {
    "@/lib/supabase/diagnostics": {
      logStudySettingsDiagnostic(value) {
        diagnostics.push(value);
      },
    },
  },
);

function missingRpcClient(error) {
  let fromCalls = 0;
  return {
    client: {
      rpc: async () => ({ data: null, error }),
      from() {
        fromCalls += 1;
        throw new Error("table reads must not run after the capability probe fails");
      },
    },
    getFromCalls: () => fromCalls,
  };
}

function emptyQueryClient() {
  const tableResults = {
    study_roadmaps: [],
    study_roadmap_problems: [],
    user_study_preferences: null,
    study_plan_setting_revisions: null,
  };

  return {
    rpc: async () => ({ data: [], error: null }),
    from(table) {
      const result = { data: tableResults[table], error: null };
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        gt() { return builder; },
        order() { return builder; },
        limit() { return builder; },
        maybeSingle: async () => result,
        single: async () => result,
        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

function tableFailureClient(error) {
  return {
    rpc: async () => ({ data: [], error: null }),
    from(table) {
      const result = table === "study_roadmaps"
        ? { data: null, error }
        : { data: table === "user_study_preferences" ? null : [], error: null };
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        order() { return builder; },
        maybeSingle: async () => result,
        then(resolve, reject) {
          return Promise.resolve(result).then(resolve, reject);
        },
      };
      return builder;
    },
  };
}

test("missing V1 RPC returns an explicit unavailable overview without table reads", async () => {
  diagnostics.length = 0;
  const error = {
    code: "PGRST202",
    message:
      "Could not find the function public.get_effective_study_plan_settings in the schema cache",
    details: null,
    hint: null,
  };
  const { client, getFromCalls } = missingRpcClient(error);
  const result = await getStudyPlanSettingsOverview(
    client,
    "authenticated-user",
    new Date("2026-11-11T12:00:00.000Z"),
  );

  assert.equal(result.error, null);
  assert.deepEqual(result.data, {
    v1Available: false,
    unavailableReason: "missing_v1_schema",
    roadmaps: [],
    latest: null,
    effective: null,
    savedTimeZone: null,
    currentStudyDate: null,
  });
  assert.equal(getFromCalls(), 0);
  assert.equal(diagnostics.at(-1).operation, "get_effective_study_plan_settings");
  assert.equal(diagnostics.at(-1).authenticatedUserPresent, true);
  assert.equal(diagnostics.at(-1).error.code, "PGRST202");
});

test("unexpected database errors remain visible to callers", async () => {
  diagnostics.length = 0;
  const error = {
    code: "42501",
    message: "permission denied",
    details: null,
    hint: null,
  };
  const { client } = missingRpcClient(error);
  const result = await getStudyPlanSettingsOverview(
    client,
    "authenticated-user",
    new Date("2026-11-11T12:00:00.000Z"),
  );

  assert.equal(result.data, null);
  assert.equal(result.error, error);
  assert.equal(diagnostics.at(-1).error.code, "42501");
});

test("a successful capability probe does not hide a broken required table", async () => {
  diagnostics.length = 0;
  const error = {
    code: "PGRST205",
    message: "Could not find the table public.study_roadmaps in the schema cache",
    details: null,
    hint: null,
  };
  const result = await getStudyPlanSettingsOverview(
    tableFailureClient(error),
    "authenticated-user",
    new Date("2026-11-11T12:00:00.000Z"),
  );

  assert.equal(result.data, null);
  assert.equal(result.error, error);
  assert.equal(diagnostics.at(-1).operation, "study_roadmaps.select");
});

test("a V1-capable database with no user settings remains a valid empty state", async () => {
  diagnostics.length = 0;
  const result = await getStudyPlanSettingsOverview(
    emptyQueryClient(),
    "new-user",
    new Date("2026-11-11T12:00:00.000Z"),
  );

  assert.equal(result.error, null);
  assert.equal(result.data.v1Available, true);
  assert.equal(result.data.unavailableReason, null);
  assert.equal(result.data.latest, null);
  assert.equal(result.data.effective, null);
  assert.deepEqual(result.data.roadmaps, []);
  assert.equal(diagnostics.at(-1).returnedNull, true);
});
