import type { GroupCode } from "@/lib/types";

export const GROUP_CODES: GroupCode[] = ["G1", "G2", "G3", "G4", "G5", "G6"];
export const TARGET_COMPLETED_PER_GROUP = 4;

export interface GroupProgress {
  groupId: GroupCode;
  completedCount: number;
}

export function buildGroupProgress(completedGroupIds: string[]): GroupProgress[] {
  const counts = new Map<GroupCode, number>(GROUP_CODES.map((groupId) => [groupId, 0]));

  for (const groupId of completedGroupIds) {
    if (counts.has(groupId as GroupCode)) {
      counts.set(groupId as GroupCode, (counts.get(groupId as GroupCode) ?? 0) + 1);
    }
  }

  return GROUP_CODES.map((groupId) => ({
    groupId,
    completedCount: counts.get(groupId) ?? 0,
  }));
}

export function getRecommendedGroup(progress: GroupProgress[]): GroupCode {
  const availableGroup = progress.find((entry) => entry.completedCount < TARGET_COMPLETED_PER_GROUP);

  if (availableGroup) {
    return availableGroup.groupId;
  }

  return progress.reduce((best, current) =>
    current.completedCount < best.completedCount ? current : best,
  ).groupId;
}
