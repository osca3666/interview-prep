import assert from "node:assert/strict";
import test from "node:test";
import { loadTypeScriptModule } from "./helpers/load-typescript.mjs";

const { isMissingV1StudySettingsCapability } = loadTypeScriptModule(
  new URL("../lib/study-settings-capability.ts", import.meta.url),
);

for (const code of ["42P01", "42883", "PGRST202", "PGRST205"]) {
  test(`recognizes ${code} as a missing V1 study-settings capability`, () => {
    assert.equal(isMissingV1StudySettingsCapability({ code }), true);
  });
}

test("recognizes a missing settings RPC reported through the schema cache", () => {
  assert.equal(
    isMissingV1StudySettingsCapability({
      message:
        "Could not find the function public.get_effective_study_plan_settings in the schema cache",
    }),
    true,
  );
});

test("does not hide permissions, authentication, or arbitrary query failures", () => {
  assert.equal(
    isMissingV1StudySettingsCapability({
      code: "42501",
      message: "permission denied for table study_plan_setting_revisions",
    }),
    false,
  );
  assert.equal(
    isMissingV1StudySettingsCapability({ code: "XX000", message: "query failed" }),
    false,
  );
});
