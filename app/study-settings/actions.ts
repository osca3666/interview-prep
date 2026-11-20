"use server";

import { revalidatePath } from "next/cache";
import { saveAndReconcileStudyPlanSettings } from "@/data/study-settings";
import { getV1StudyPlanReconciliationProposal } from "@/data/v1-study-plan";
import {
  normalizeStudyPlanRoadmapIds,
  validateStudyPlanSettingsInput,
  type SaveStudyPlanSettingsInput,
} from "@/lib/study-plan-settings";
import { createClient } from "@/lib/supabase/server";
import { isValidTimeZone, normalizeTimeZone } from "@/lib/time-zone";

export type { SaveStudyPlanSettingsInput } from "@/lib/study-plan-settings";

export async function saveStudyPlanSettingsAction(input: SaveStudyPlanSettingsInput) {
  const client = await createClient();
  const { data: claims } = await client.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false as const, error: "not_authenticated" as const };
  const inputValidationError = validateStudyPlanSettingsInput(input);
  if (inputValidationError) {
    return { ok: false as const, error: inputValidationError };
  }
  const timeZone = normalizeTimeZone(input.timeZone);
  const validationError = validateStudyPlanSettingsInput({ ...input, timeZone });
  if (validationError || !isValidTimeZone(timeZone)) {
    return { ok: false as const, error: validationError ?? "invalid_time_zone" };
  }
  const reviewRoadmapIds = normalizeStudyPlanRoadmapIds(input.reviewRoadmapIds);
  const followedRoadmapId = input.followedRoadmapId?.trim() || null;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const referenceTime = new Date();
    const proposal = input.applyWhen === "today"
      ? await getV1StudyPlanReconciliationProposal(client, claims.claims.sub, {
        dailyNewTarget: input.dailyNewTarget,
        dailyReviewTarget: input.dailyReviewTarget,
        followedRoadmapId,
        newSelectionMode: input.newSelectionMode,
        reviewSource: input.reviewSource,
        reviewRoadmapIds,
        timeZone,
      }, referenceTime)
      : { data: [], error: null };
    if (proposal.error || !proposal.data) {
      if (process.env.NODE_ENV === "development" && proposal.error) {
        console.error("prepare settings reconciliation failed", proposal.error);
      }
      return { ok: false as const, error: "save_failed" as const };
    }
    const { data, error } = await saveAndReconcileStudyPlanSettings(client, {
      p_daily_new_target: input.dailyNewTarget,
      p_daily_review_target: input.dailyReviewTarget,
      // PostgREST accepts SQL NULL here; generated function Args cannot express
      // nullable input parameters even though the column snapshot is nullable.
      p_followed_roadmap_id: followedRoadmapId as unknown as string,
      p_new_selection_mode: input.newSelectionMode,
      p_review_source: input.reviewSource,
      p_review_roadmap_ids: reviewRoadmapIds,
      p_apply_when: input.applyWhen,
      p_time_zone: timeZone,
      p_reference_time: referenceTime.toISOString(),
      p_tasks: proposal.data,
    });
    if (!error) {
      revalidatePath("/dashboard");
      revalidatePath("/study-plan");
      revalidatePath("/study-plan/setup");
      revalidatePath("/roadmaps");
      revalidatePath("/roadmaps/neetcode-150");
      return {
        ok: true as const,
        revision: data,
        applyWhen: input.applyWhen,
      };
    }
    if (error.code === "P0001"
      && ["stale_recommendations", "stale_allocation"].includes(error.message)
      && attempt === 0) continue;
    if (process.env.NODE_ENV === "development") {
      console.error("save_and_reconcile_study_plan_settings failed", {
        code: error.code, message: error.message, details: error.details, hint: error.hint,
      });
    }
    const controlled = ["invalid_settings", "invalid_time_zone", "invalid_roadmap", "invalid_review_source", "existing_plan_not_v1"];
    return { ok: false as const, error: controlled.includes(error.message) ? error.message : "save_failed" };
  }
  return { ok: false as const, error: "save_failed" as const };
}
