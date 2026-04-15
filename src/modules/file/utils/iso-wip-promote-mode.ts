import { Types } from "mongoose";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import groupMemberModel from "../../team/schemas/group-member.schema";

function isProjectAdminRole(role: unknown): boolean {
  return String(role ?? "").toLowerCase() === "admin";
}

export type IsoWipDirectPromoteMode =
  | "admin_direct"
  | "leader_direct"
  | "member_submit";

export function getCurrentVersionUploaderIdFromFileLean(file: {
  currentVersion?: number;
  versions?: Array<{ version?: number; uploadedBy?: Types.ObjectId }>;
  createdBy?: Types.ObjectId;
}): Types.ObjectId | null {
  const cv = Number(file.currentVersion ?? 0);
  const v = (file.versions || []).find(
    (x) => Number(x.version) === cv,
  );
  if (v?.uploadedBy) return v.uploadedBy as Types.ObjectId;
  if (file.createdBy) return file.createdBy as Types.ObjectId;
  const last = file.versions?.[file.versions.length - 1];
  if (last?.uploadedBy) return last.uploadedBy as Types.ObjectId;
  return null;
}

export async function isUserProjectAdmin(
  projectIdStr: string,
  userId: Types.ObjectId | null | undefined,
): Promise<boolean> {
  if (!userId) return false;
  const pm = await projectMemberSchema
    .findOne({ projectId: projectIdStr, userId })
    .lean();
  return !!(pm && isProjectAdminRole(pm.role));
}

/**
 * ISO WIP: who uploaded the current revision determines whether promote skips "submit for review"
 * and whether only admins vs group leaders may promote.
 */
export async function classifyIsoWipDirectPromoteMode(
  projectIdStr: string,
  effGroupId: Types.ObjectId,
  fileLean: Parameters<typeof getCurrentVersionUploaderIdFromFileLean>[0],
): Promise<IsoWipDirectPromoteMode> {
  const uid = getCurrentVersionUploaderIdFromFileLean(fileLean);
  if (!uid) return "member_submit";
  if (await isUserProjectAdmin(projectIdStr, uid)) return "admin_direct";
  const row = await groupMemberModel
    .findOne({ groupId: effGroupId, userId: uid })
    .lean();
  if (row?.role === "GROUP_LEADER") return "leader_direct";
  return "member_submit";
}
