type DatabaseError = {
  code?: string | null;
  message?: string | null;
};

const missingCapabilityCodes = new Set([
  "42P01",
  "42883",
  "PGRST202",
  "PGRST205",
]);

export function isMissingV1StudySettingsCapability(error: DatabaseError) {
  if (error.code && missingCapabilityCodes.has(error.code)) return true;

  const message = error.message?.toLowerCase() ?? "";
  return (
    message.includes("get_effective_study_plan_settings") &&
    (message.includes("could not find") ||
      message.includes("does not exist") ||
      message.includes("schema cache"))
  );
}
