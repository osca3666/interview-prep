import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { getStudyPlanSettingsOverview } from "@/data/study-settings";
import {
  buildRoadmapCatalog,
  type RoadmapCatalogItem,
} from "@/lib/roadmaps";
import type { Database } from "@/types/database";

type Client = SupabaseClient<Database>;

export type RoadmapsExperience = {
  roadmaps: RoadmapCatalogItem[];
  effectiveFollowedRoadmapId: string | null;
  upcomingFollowedRoadmapId: string | null;
  upcomingEffectiveDate: string | null;
  newSelectionMode: "sequential" | "shuffled";
  hasStudyPlanSettings: boolean;
};

export async function getRoadmapsExperience(
  client: Client,
  userId: string,
  referenceTime = new Date(),
) {
  const [registryResult, membershipResult, userProblemsResult, settingsResult] =
    await Promise.all([
      client
        .from("study_roadmaps")
        .select("id,name,content_version")
        .order("name"),
      client
        .from("study_roadmap_problems")
        .select("roadmap_id,leetcode_slug,position")
        .order("roadmap_id")
        .order("position"),
      client
        .from("user_problems")
        .select("leetcode_slug,total_reviews,external_practice_status")
        .eq("user_id", userId),
      getStudyPlanSettingsOverview(client, userId, referenceTime),
    ]);

  const error =
    registryResult.error ??
    membershipResult.error ??
    userProblemsResult.error ??
    settingsResult.error;
  if (error || !settingsResult.data) return { data: null, error };

  const settings = settingsResult.data;
  const effectiveFollowedRoadmapId =
    settings.effective?.followed_roadmap_id ?? null;
  const hasUpcomingSettings = Boolean(
    settings.latest &&
      settings.currentStudyDate &&
      settings.latest.effectiveStudyDate > settings.currentStudyDate,
  );

  return {
    data: {
      roadmaps: buildRoadmapCatalog({
        roadmaps: (registryResult.data ?? []).map((roadmap) => ({
          id: roadmap.id,
          name: roadmap.name,
          contentVersion: roadmap.content_version,
        })),
        memberships: (membershipResult.data ?? []).map((membership) => ({
          roadmapId: membership.roadmap_id,
          leetcodeSlug: membership.leetcode_slug,
          position: membership.position,
        })),
        userProblems: (userProblemsResult.data ?? []).map((problem) => ({
          leetcodeSlug: problem.leetcode_slug,
          totalReviews: problem.total_reviews,
          externalPracticeStatus: problem.external_practice_status,
        })),
      }),
      effectiveFollowedRoadmapId,
      upcomingFollowedRoadmapId: hasUpcomingSettings
        ? settings.latest?.followedRoadmapId ?? null
        : null,
      upcomingEffectiveDate: hasUpcomingSettings
        ? settings.latest?.effectiveStudyDate ?? null
        : null,
      newSelectionMode:
        settings.effective?.new_selection_mode === "shuffled"
          ? "shuffled"
          : settings.latest?.newSelectionMode ?? "sequential",
      hasStudyPlanSettings: Boolean(settings.latest),
    } satisfies RoadmapsExperience,
    error: null,
  };
}
