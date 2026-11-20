export const MAX_DAILY_NEW_PROBLEMS = 10;
export const MAX_DAILY_REVIEWS = 20;

export type StudyPlanSelectionMode = "sequential" | "shuffled";
export type StudyPlanReviewSource = "all" | "selected_roadmaps";
export type StudyPlanApplyWhen = "today" | "tomorrow";

export type StudyPlanSettingsValues = {
  dailyNewTarget: number;
  dailyReviewTarget: number;
  followedRoadmapId: string | null;
  newSelectionMode: StudyPlanSelectionMode;
  reviewSource: StudyPlanReviewSource;
  reviewRoadmapIds: string[];
};

export type SaveStudyPlanSettingsInput = StudyPlanSettingsValues & {
  applyWhen: StudyPlanApplyWhen;
  timeZone: string;
};

export type StudyPlanSettingsValidationError =
  | "invalid_new_target"
  | "invalid_review_target"
  | "invalid_new_source"
  | "invalid_selection_mode"
  | "invalid_review_source"
  | "invalid_apply_when"
  | "invalid_time_zone";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isRoadmapId(value: unknown) {
  return typeof value === "string" && value.trim().length > 0;
}

export function normalizeStudyPlanRoadmapIds(values: string[]) {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))].sort();
}

export function validateStudyPlanSettingsInput(
  value: unknown,
): StudyPlanSettingsValidationError | null {
  if (!isRecord(value)) return "invalid_new_target";
  if (
    !Number.isInteger(value.dailyNewTarget) ||
    (value.dailyNewTarget as number) < 0 ||
    (value.dailyNewTarget as number) > MAX_DAILY_NEW_PROBLEMS
  ) {
    return "invalid_new_target";
  }
  if (
    !Number.isInteger(value.dailyReviewTarget) ||
    (value.dailyReviewTarget as number) < 0 ||
    (value.dailyReviewTarget as number) > MAX_DAILY_REVIEWS
  ) {
    return "invalid_review_target";
  }
  if (
    value.followedRoadmapId !== null &&
    !isRoadmapId(value.followedRoadmapId)
  ) {
    return "invalid_new_source";
  }
  if (!['sequential', 'shuffled'].includes(String(value.newSelectionMode))) {
    return "invalid_selection_mode";
  }
  if (!['all', 'selected_roadmaps'].includes(String(value.reviewSource))) {
    return "invalid_review_source";
  }
  if (!Array.isArray(value.reviewRoadmapIds) || !value.reviewRoadmapIds.every(isRoadmapId)) {
    return "invalid_review_source";
  }
  if (
    value.reviewSource === "all" &&
    value.reviewRoadmapIds.length > 0
  ) {
    return "invalid_review_source";
  }
  if (
    value.reviewSource === "selected_roadmaps" &&
    value.reviewRoadmapIds.length === 0
  ) {
    return "invalid_review_source";
  }
  if (!['today', 'tomorrow'].includes(String(value.applyWhen))) {
    return "invalid_apply_when";
  }
  if (typeof value.timeZone !== "string" || !value.timeZone.trim()) {
    return "invalid_time_zone";
  }
  return null;
}
