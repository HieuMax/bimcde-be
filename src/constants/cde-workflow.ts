/** ISO 19650 vs flexible CDE — project-level workflow mode */
export const CDE_WORKFLOW_MODES = ["ISO_19650", "NORMAL"] as const;
export type CdeWorkflowMode = (typeof CDE_WORKFLOW_MODES)[number];

/** Which of the four standard CDE root folders this row represents (null = not a CDE root) */
export const CDE_FOLDER_STAGES = [
  "WIP",
  "SHARED",
  "PUBLISHED",
  "ARCHIVED",
] as const;
export type CdeFolderStage = (typeof CDE_FOLDER_STAGES)[number];

/** Standard CDE root folder names and stages (order = display order) */
export const CDE_ROOT_FOLDER_DEFINITIONS = [
  { name: "1. WIP", cdeStage: "WIP" as const },
  { name: "2. Shared", cdeStage: "SHARED" as const },
  { name: "3. Published", cdeStage: "PUBLISHED" as const },
  { name: "4. Archived", cdeStage: "ARCHIVED" as const },
] as const;

/** Per-group role inside ISO workflow (distinct from project-level ProjectMember.role) */
export const GROUP_MEMBER_ROLES = ["GROUP_LEADER", "GROUP_MEMBER"] as const;
export type GroupMemberRole = (typeof GROUP_MEMBER_ROLES)[number];

export function parseCdeWorkflowMode(
  value: unknown
): CdeWorkflowMode | undefined {
  if (value === "ISO_19650" || value === "NORMAL") return value;
  return undefined;
}

export function isGroupMemberRole(value: unknown): value is GroupMemberRole {
  return (
    value === "GROUP_LEADER" ||
    value === "GROUP_MEMBER"
  );
}

/** ISO 19650 file promote destinations (POST /files/:id/promote) — copy to Shared or Published only */
export const PROMOTE_TARGET_STAGES = ["SHARED", "PUBLISHED"] as const;
export type PromoteTargetStage = (typeof PROMOTE_TARGET_STAGES)[number];

export function parsePromoteTargetStage(
  value: unknown
): PromoteTargetStage | undefined {
  if (value === "SHARED" || value === "PUBLISHED") {
    return value;
  }
  return undefined;
}
