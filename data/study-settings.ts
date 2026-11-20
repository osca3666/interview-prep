import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { isMissingV1StudySettingsCapability } from "@/lib/study-settings-capability";
import { logStudySettingsDiagnostic } from "@/lib/supabase/diagnostics";
import { getDateOnlyInTimeZone } from "@/lib/time-zone";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

type GeneratedEffectiveStudyPlanSettings =
  Database["public"]["Functions"]["get_effective_study_plan_settings"]["Returns"][number];

export type EffectiveStudyPlanSettings = Omit<
  GeneratedEffectiveStudyPlanSettings,
  "followed_roadmap_id"
> & {
  followed_roadmap_id: string | null;
};

export type StudyRoadmapOption = {
  id: string;
  name: string;
  problemCount: number;
};

export type SavedStudyPlanSettings = {
  revisionId: string;
  version: number;
  effectiveStudyDate: string;
  dailyNewTarget: number;
  dailyReviewTarget: number;
  followedRoadmapId: string | null;
  newSelectionMode: "sequential" | "shuffled";
  reviewSource: "all" | "selected_roadmaps";
  reviewRoadmapIds: string[];
  timeZone: string;
};

export type StudyPlanSettingsOverview = {
  v1Available: boolean;
  unavailableReason: "missing_v1_schema" | null;
  roadmaps: StudyRoadmapOption[];
  latest: SavedStudyPlanSettings | null;
  effective: EffectiveStudyPlanSettings | null;
  savedTimeZone: string | null;
  currentStudyDate: string | null;
};

function unavailableStudyPlanSettingsOverview(): StudyPlanSettingsOverview {
  return {
    v1Available: false,
    unavailableReason: "missing_v1_schema",
    roadmaps: [],
    latest: null,
    effective: null,
    savedTimeZone: null,
    currentStudyDate: null,
  };
}

function logOperationResult(
  operation: string,
  error: { code?: string | null; message?: string | null; details?: string | null; hint?: string | null } | null,
  returnedNull: boolean,
) {
  logStudySettingsDiagnostic({
    operation,
    error,
    returnedNull,
    authenticatedUserPresent: true,
  });
}

export async function getEffectiveStudyPlanSettings(
  client: Client,
  referenceTime = new Date(),
) {
  const { data, error } = await client.rpc("get_effective_study_plan_settings", {
    p_reference_time: referenceTime.toISOString(),
  });
  return {
    data: (data?.[0] as EffectiveStudyPlanSettings | undefined) ?? null,
    error,
  };
}

async function loadSavedSettingsForRevision(
  client: Client,
  userId: string,
  revision: Database["public"]["Tables"]["study_plan_setting_revisions"]["Row"],
  timeZone: string,
) {
  const [contextResult, linkResult] = await Promise.all([
    client
      .from("review_allocation_contexts")
      .select("review_source")
      .eq("user_id", userId)
      .eq("id", revision.review_allocation_context_id)
      .single(),
    client
      .from("review_allocation_context_roadmaps")
      .select("roadmap_id")
      .eq("user_id", userId)
      .eq("context_id", revision.review_allocation_context_id)
      .order("roadmap_id"),
  ]);

  const error = contextResult.error ?? linkResult.error;
  if (error || !contextResult.data) return { data: null, error };

  return {
    data: {
      revisionId: revision.id,
      version: revision.version,
      effectiveStudyDate: revision.effective_study_date,
      dailyNewTarget: revision.daily_new_target,
      dailyReviewTarget: revision.daily_review_target,
      followedRoadmapId: revision.followed_roadmap_id,
      newSelectionMode:
        revision.new_selection_mode === "shuffled" ? "shuffled" : "sequential",
      reviewSource:
        contextResult.data.review_source === "selected_roadmaps"
          ? "selected_roadmaps"
          : "all",
      reviewRoadmapIds: (linkResult.data ?? []).map((link) => link.roadmap_id),
      timeZone,
    } satisfies SavedStudyPlanSettings,
    error: null,
  };
}

export async function getStudyPlanSettingsOverview(
  client: Client,
  userId: string,
  referenceTime = new Date(),
) {
  const effectiveResult = await getEffectiveStudyPlanSettings(client, referenceTime);

  if (effectiveResult.error) {
    logOperationResult(
      "get_effective_study_plan_settings",
      effectiveResult.error,
      false,
    );
    if (isMissingV1StudySettingsCapability(effectiveResult.error)) {
      return {
        data: unavailableStudyPlanSettingsOverview(),
        error: null,
      };
    }
    return { data: null, error: effectiveResult.error };
  }

  if (!effectiveResult.data) {
    logOperationResult("get_effective_study_plan_settings", null, true);
  }

  const [roadmapResult, membershipResult, preferenceResult] =
    await Promise.all([
      client.from("study_roadmaps").select("id,name").order("name"),
      client.from("study_roadmap_problems").select("roadmap_id"),
      client.from("user_study_preferences").select("time_zone")
        .eq("user_id", userId).maybeSingle(),
    ]);
  const operationResult = roadmapResult.error
    ? { operation: "study_roadmaps.select", error: roadmapResult.error }
    : membershipResult.error
      ? { operation: "study_roadmap_problems.select", error: membershipResult.error }
      : preferenceResult.error
        ? { operation: "user_study_preferences.select", error: preferenceResult.error }
        : null;

  if (operationResult) {
    logOperationResult(operationResult.operation, operationResult.error, false);
    return { data: null, error: operationResult.error };
  }

  const counts = new Map<string, number>();
  for (const membership of membershipResult.data ?? []) {
    counts.set(membership.roadmap_id, (counts.get(membership.roadmap_id) ?? 0) + 1);
  }
  const roadmaps = (roadmapResult.data ?? []).map((roadmap) => ({
    id: roadmap.id,
    name: roadmap.name,
    problemCount: counts.get(roadmap.id) ?? 0,
  }));
  const savedTimeZone = preferenceResult.data?.time_zone ?? null;
  const settingsTimeZone = savedTimeZone ?? effectiveResult.data?.time_zone ?? null;
  const currentStudyDate = settingsTimeZone
    ? getDateOnlyInTimeZone(referenceTime, settingsTimeZone)
    : null;
  const [futureRevisionResult, effectiveRevisionResult, fallbackRevisionResult] =
    await Promise.all([
      currentStudyDate
        ? client
            .from("study_plan_setting_revisions")
            .select("*")
            .eq("user_id", userId)
            .gt("effective_study_date", currentStudyDate)
            .order("effective_study_date", { ascending: true })
            .order("version", { ascending: false })
            .limit(1)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      effectiveResult.data
        ? client
            .from("study_plan_setting_revisions")
            .select("*")
            .eq("user_id", userId)
            .eq("id", effectiveResult.data.revision_id)
            .maybeSingle()
        : Promise.resolve({ data: null, error: null }),
      client
        .from("study_plan_setting_revisions")
        .select("*")
        .eq("user_id", userId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
  const revisionError =
    futureRevisionResult.error ??
    effectiveRevisionResult.error ??
    fallbackRevisionResult.error;
  if (revisionError) {
    logOperationResult("study_plan_setting_revisions.select", revisionError, false);
    return { data: null, error: revisionError };
  }

  const revision =
    futureRevisionResult.data ??
    effectiveRevisionResult.data ??
    fallbackRevisionResult.data;
  let latest: SavedStudyPlanSettings | null = null;

  if (revision) {
    const revisionSettings = await loadSavedSettingsForRevision(
      client,
      userId,
      revision,
      settingsTimeZone ?? "UTC",
    );
    if (revisionSettings.error || !revisionSettings.data) {
      if (revisionSettings.error) {
        logOperationResult(
          "review_allocation_contexts.select",
          revisionSettings.error,
          false,
        );
      }
      return { data: null, error: revisionSettings.error };
    }
    latest = revisionSettings.data;
  }

  return {
    data: {
      v1Available: true,
      unavailableReason: null,
      roadmaps,
      latest,
      effective: effectiveResult.data,
      savedTimeZone,
      currentStudyDate,
    } satisfies StudyPlanSettingsOverview,
    error: null,
  };
}

export async function saveStudyPlanSettings(
  client: Client,
  input: Database["public"]["Functions"]["save_study_plan_settings"]["Args"],
) {
  return client.rpc("save_study_plan_settings", input);
}

export async function saveAndReconcileStudyPlanSettings(
  client: Client,
  input: Database["public"]["Functions"]["save_and_reconcile_study_plan_settings"]["Args"],
) {
  return client.rpc("save_and_reconcile_study_plan_settings", input);
}
