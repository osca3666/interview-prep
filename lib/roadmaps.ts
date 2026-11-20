import type {
  SaveStudyPlanSettingsInput,
  StudyPlanApplyWhen,
  StudyPlanReviewSource,
  StudyPlanSelectionMode,
} from "@/lib/study-plan-settings";

export type RoadmapRegistryRecord = {
  id: string;
  name: string;
  contentVersion: string;
};

export type RoadmapMembershipRecord = {
  roadmapId: string;
  leetcodeSlug: string;
  position: number;
};

export type RoadmapPracticeRecord = {
  leetcodeSlug: string;
  totalReviews: number;
  externalPracticeStatus: string | null;
};

export type RoadmapCatalogItem = {
  id: string;
  name: string;
  description: string;
  href: string;
  contentVersion: string;
  totalProblemCount: number;
  completedProblemCount: number;
  progressPercent: number;
  isComplete: boolean;
};

export type RoadmapFollowSettingsBase = {
  dailyNewTarget: number;
  dailyReviewTarget: number;
  newSelectionMode: StudyPlanSelectionMode;
  reviewSource: StudyPlanReviewSource;
  reviewRoadmapIds: string[];
  timeZone: string;
};

const roadmapPresentation: Record<
  string,
  { description: string; href: string }
> = {
  "neetcode-150": {
    description:
      "A curated progression through the core patterns used in technical interviews.",
    href: "/roadmaps/neetcode-150",
  },
};

function getRoadmapPresentation(roadmap: RoadmapRegistryRecord) {
  return (
    roadmapPresentation[roadmap.id] ?? {
      description: `Practice the curated problems in ${roadmap.name}.`,
      href: `/roadmaps/${encodeURIComponent(roadmap.id)}`,
    }
  );
}

export function isCompletedRoadmapPractice(problem: RoadmapPracticeRecord) {
  return (
    problem.totalReviews > 0 || problem.externalPracticeStatus === "accepted"
  );
}

export function buildRoadmapCatalog({
  roadmaps,
  memberships,
  userProblems,
}: {
  roadmaps: RoadmapRegistryRecord[];
  memberships: RoadmapMembershipRecord[];
  userProblems: RoadmapPracticeRecord[];
}): RoadmapCatalogItem[] {
  const completedSlugs = new Set(
    userProblems
      .filter(isCompletedRoadmapPractice)
      .map((problem) => problem.leetcodeSlug),
  );
  const membershipsByRoadmap = new Map<string, Set<string>>();

  for (const membership of memberships) {
    const roadmapMemberships =
      membershipsByRoadmap.get(membership.roadmapId) ?? new Set<string>();
    roadmapMemberships.add(membership.leetcodeSlug);
    membershipsByRoadmap.set(membership.roadmapId, roadmapMemberships);
  }

  return roadmaps.map((roadmap) => {
    const roadmapMemberships =
      membershipsByRoadmap.get(roadmap.id) ?? new Set<string>();
    const completedProblemCount = [...roadmapMemberships].filter((slug) =>
      completedSlugs.has(slug),
    ).length;
    const totalProblemCount = roadmapMemberships.size;
    const progressPercent =
      totalProblemCount === 0
        ? 0
        : Math.round((completedProblemCount / totalProblemCount) * 100);
    const presentation = getRoadmapPresentation(roadmap);

    return {
      id: roadmap.id,
      name: roadmap.name,
      description: presentation.description,
      href: presentation.href,
      contentVersion: roadmap.contentVersion,
      totalProblemCount,
      completedProblemCount,
      progressPercent,
      isComplete:
        totalProblemCount > 0 && completedProblemCount === totalProblemCount,
    };
  });
}

export function partitionRoadmapCatalog(
  roadmaps: RoadmapCatalogItem[],
  followedRoadmapId: string | null,
  suggestedRoadmapId = "neetcode-150",
) {
  const featured =
    roadmaps.find((roadmap) => roadmap.id === followedRoadmapId) ??
    roadmaps.find((roadmap) => roadmap.id === suggestedRoadmapId) ??
    roadmaps[0] ??
    null;

  return {
    featured,
    isSuggested: Boolean(featured && !followedRoadmapId),
    otherRoadmaps: featured
      ? roadmaps.filter((roadmap) => roadmap.id !== featured.id)
      : roadmaps,
  };
}

export function createRoadmapFollowSettingsInput(
  base: RoadmapFollowSettingsBase,
  followedRoadmapId: string | null,
  applyWhen: StudyPlanApplyWhen,
): SaveStudyPlanSettingsInput {
  return {
    ...base,
    reviewRoadmapIds: [...base.reviewRoadmapIds],
    followedRoadmapId,
    applyWhen,
  };
}
