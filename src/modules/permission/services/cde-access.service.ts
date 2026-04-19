import { Types } from "mongoose";
import projectSchema from "../../project/schemas/project.schema";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import groupModel from "../../team/schemas/group.schema";
import groupMemberModel from "../../team/schemas/group-member.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";
import itemAclModel from "../schemas/item-acl.schema";
import { AppError } from "../../../utils/AppError";
import {
  parseCdeWorkflowMode,
  type CdeFolderStage,
} from "../../../constants/cde-workflow";
import type { GroupMemberRole } from "../../../constants/cde-workflow";
import type { ItemAccessLevel } from "../interfaces/item-acl.interface";

export type FolderAccessAction =
  | "browse"
  | "create_child"
  | "rename"
  | "delete"
  | "move";

export type FileAccessAction = "read" | "write" | "delete" | "move";

type LeanFolder = {
  _id: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  projectId: Types.ObjectId;
  createdBy?: Types.ObjectId;
  groupId?: Types.ObjectId | null;
  isCdeRoot?: boolean;
  isCdeRootLocked?: boolean;
  cdeStage?: CdeFolderStage;
};

export type IsoAccessContext = {
  isProjectAdmin: boolean;
  groupRoles: Map<string, GroupMemberRole>;
};

const ACCESS_RANK: Record<ItemAccessLevel, number> = {
  FULL: 3,
  READ_ONLY: 2,
  NO_ACCESS: 1,
};

function maxLevel(a: ItemAccessLevel, b: ItemAccessLevel): ItemAccessLevel {
  return ACCESS_RANK[a] >= ACCESS_RANK[b] ? a : b;
}

function isProjectAdminRole(role: unknown): boolean {
  return String(role ?? "").toLowerCase() === "admin";
}

export default class CdeAccessService {
  assertAuthenticatedUser(userId?: Types.ObjectId): Types.ObjectId {
    if (!userId) throw new AppError("Unauthorized", 401);
    return userId;
  }

  private async assertProjectMember(
    projectId: string,
    userId: Types.ObjectId
  ): Promise<void> {
    const m = await projectMemberSchema.exists({ projectId, userId });
    if (!m) throw new AppError("Not a project member", 403);
  }

  async loadIsoContext(projectId: string, userId: Types.ObjectId): Promise<IsoAccessContext> {
    const pm = await projectMemberSchema
      .findOne({ projectId, userId })
      .lean();
    if (!pm) throw new AppError("Not a project member", 403);

    const pid = new Types.ObjectId(projectId);
    const groupsInProject = await groupModel.find({ projectId: pid }).select("_id").lean();
    const gids = groupsInProject.map((g) => g._id);
    const memberships = await groupMemberModel
      .find({ userId, groupId: { $in: gids } })
      .lean();

    const groupRoles = new Map<string, GroupMemberRole>();
    for (const m of memberships) {
      if (!m.groupId) continue;
      const r = (m.role as GroupMemberRole) || "GROUP_MEMBER";
      groupRoles.set(
        m.groupId.toString(),
        r === "GROUP_LEADER" ? "GROUP_LEADER" : "GROUP_MEMBER"
      );
    }

    return {
      isProjectAdmin: isProjectAdminRole(pm.role),
      groupRoles,
    };
  }

  async assertProjectAdmin(projectId: string, userId: Types.ObjectId): Promise<void> {
    const pm = await projectMemberSchema.findOne({ projectId, userId }).lean();
    if (!pm) throw new AppError("Not a project member", 403);
    if (!isProjectAdminRole(pm.role)) {
      throw new AppError("Admin permission required", 403);
    }
  }

  async assertGroupLeader(
    projectId: string,
    userId: Types.ObjectId,
    groupId: Types.ObjectId
  ): Promise<void> {
    await this.assertProjectMember(projectId, userId);
    const membership = await groupMemberModel.findOne({ userId, groupId }).lean();
    if (!membership || membership.role !== "GROUP_LEADER") {
      throw new AppError("Group leader permission required", 403);
    }
  }

  private async getFolderChainFromRoot(folderId: string): Promise<LeanFolder[]> {
    const chain: LeanFolder[] = [];
    let current = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    }).lean();
    while (current) {
      chain.unshift(current as LeanFolder);
      if (!current.parentId) break;
      current = await FolderModel.findOne({
        _id: current.parentId,
        isDeleted: false,
      }).lean();
    }
    return chain;
  }

  private getEffectiveGroupId(chain: LeanFolder[]): Types.ObjectId | null {
    for (let i = chain.length - 1; i >= 0; i--) {
      const g = chain[i].groupId;
      if (g) return g as Types.ObjectId;
    }
    return null;
  }

  private getCdeRootFromChain(chain: LeanFolder[]): LeanFolder | undefined {
    return chain.find((f) => f.isCdeRoot && f.cdeStage);
  }

  private async getFolderCdeRootStage(
    folderId: string
  ): Promise<CdeFolderStage | undefined> {
    const chain = await this.getFolderChainFromRoot(folderId);
    const root = this.getCdeRootFromChain(chain);
    return root?.cdeStage;
  }

  /** Public: CDE stage of the root (1. WIP … 4. Archived) containing this folder. */
  async getIsoCdeRootStageForFolderId(
    folderId: string
  ): Promise<CdeFolderStage | undefined> {
    return this.getFolderCdeRootStage(folderId);
  }

  private async isFolderUnderArchivedStage(folderId: string): Promise<boolean> {
    const s = await this.getFolderCdeRootStage(folderId);
    return s === "ARCHIVED";
  }

  /**
   * ISO 19650: moving into Archived is allowed only for project admins, from Shared or Published.
   */
  async assertIsoArchivedMoveAllowed(
    projectId: string,
    userId: Types.ObjectId,
    sourceFolderIds: Array<string | null | undefined>,
    destinationFolderId: string | null | undefined
  ): Promise<void> {
    const proj = await projectSchema
      .findById(projectId)
      .select("workflowMode")
      .lean();
    if (parseCdeWorkflowMode(proj?.workflowMode) !== "ISO_19650") return;

    if (
      !destinationFolderId ||
      destinationFolderId === "null" ||
      destinationFolderId === ""
    ) {
      return;
    }

    const destStage = await this.getFolderCdeRootStage(destinationFolderId);
    if (destStage !== "ARCHIVED") return;

    const ctx = await this.loadIsoContext(projectId, userId);
    if (!ctx.isProjectAdmin) {
      throw new AppError(
        "Only a project administrator can move items into Archived",
        403
      );
    }

    const resolved = sourceFolderIds.filter(
      (x): x is string => !!x && x !== "null" && x !== ""
    );
    if (resolved.length === 0) {
      throw new AppError(
        "Cannot determine source folder for this move",
        400
      );
    }

    for (const sid of resolved) {
      const srcStage = await this.getFolderCdeRootStage(sid);
      if (srcStage !== "SHARED" && srcStage !== "PUBLISHED") {
        throw new AppError(
          "In ISO 19650 mode, only items in Shared or Published can be moved into Archived",
          403
        );
      }
    }
  }

  /** Owner for ISO “member may only edit own content” */
  getFileOwnerId(file: {
    createdBy?: Types.ObjectId;
    versions?: Array<{ uploadedBy?: Types.ObjectId }>;
  }): Types.ObjectId | null {
    if (file.createdBy) return file.createdBy as Types.ObjectId;
    const last = file.versions?.[file.versions.length - 1];
    if (last?.uploadedBy) return last.uploadedBy as Types.ObjectId;
    return null;
  }

  private async resolveNormalItemAccess(
    projectId: string,
    userId: Types.ObjectId,
    resourceType: "folder" | "file",
    resourceId: string,
    isAdmin?: boolean
  ): Promise<ItemAccessLevel> {
    if (isAdmin) return "FULL";

    const pid = new Types.ObjectId(projectId);
    const rid = new Types.ObjectId(resourceId);

    const doc = await itemAclModel
      .findOne({ projectId: pid, resourceType, resourceId: rid })
      .lean();

    const groupsInProject = await groupModel.find({ projectId: pid }).select("_id").lean();
    const gids = groupsInProject.map((g) => g._id);
    const memberships = await groupMemberModel
      .find({ userId, groupId: { $in: gids } })
      .select("groupId")
      .lean();
    const userGroupIdStr = new Set(
      memberships.filter((m) => m.groupId).map((m) => m.groupId!.toString())
    );

    let best: ItemAccessLevel = doc?.defaultAccess ?? "FULL";

    if (!doc) {
      if (resourceType === "file") {
        const file = await FileModel.findOne({ _id: rid, projectId: pid, isDeleted: false })
          .select("folderId")
          .lean();
        if (file?.folderId) {
          return this.resolveNormalItemAccess(
            projectId,
            userId,
            "folder",
            file.folderId.toString()
          );
        }
      }
      return "FULL";
    }

    for (const g of doc.grants ?? []) {
      if (g.subjectType === "USER" && g.subjectId.equals(userId)) {
        best = maxLevel(best, g.access);
      }
      if (g.subjectType === "GROUP" && userGroupIdStr.has(g.subjectId.toString())) {
        best = maxLevel(best, g.access);
      }
    }

    return best;
  }

  async assertFolderAccess(
    projectId: string,
    userId: Types.ObjectId,
    folderId: string,
    action: FolderAccessAction
  ): Promise<void> {
    await this.assertProjectMember(projectId, userId);

    const exists = await FolderModel.exists({
      _id: folderId,
      projectId: new Types.ObjectId(projectId),
      isDeleted: false,
    });
    if (!exists) throw new AppError("Folder not found", 404);

    const proj = await projectSchema.findById(projectId).select("workflowMode").lean();
    const mode = parseCdeWorkflowMode(proj?.workflowMode) ?? "NORMAL";

    if (mode === "NORMAL") {
      const pm = await projectMemberSchema.findOne({ projectId, userId }).lean();
      const isAdmin = pm ? isProjectAdminRole(pm.role) : false;

      const level = await this.resolveNormalItemAccess(
        projectId,
        userId,
        "folder",
        folderId,
        isAdmin
      );
      if (level === "NO_ACCESS") {
        throw new AppError("No access to this folder", 403);
      }
      if (level === "READ_ONLY" && action !== "browse") {
        throw new AppError("This folder is read-only for you", 403);
      }
      return;
    }

    const ctx = await this.loadIsoContext(projectId, userId);
    const ok = await this.checkIsoFolderAccess(projectId, userId, folderId, action, ctx);
    if (!ok) {
      throw new AppError("You do not have permission for this folder action", 403);
    }
  }

  async assertFileAccess(
    projectId: string,
    userId: Types.ObjectId,
    fileId: string,
    action: FileAccessAction
  ): Promise<void> {
    await this.assertProjectMember(projectId, userId);

    const file = await FileModel.findOne({
      _id: fileId,
      projectId,
      isDeleted: false,
    }).lean();
    if (!file) throw new AppError("File not found", 404);

    const proj = await projectSchema.findById(projectId).select("workflowMode").lean();
    const mode = parseCdeWorkflowMode(proj?.workflowMode) ?? "NORMAL";

    if (mode === "NORMAL") {
      const pm = await projectMemberSchema.findOne({ projectId, userId }).lean();
      const isAdmin = pm ? isProjectAdminRole(pm.role) : false;

      const level = await this.resolveNormalItemAccess(
        projectId,
        userId,
        "file",
        fileId,
        isAdmin
      );
      if (level === "NO_ACCESS") {
        throw new AppError("No access to this file", 403);
      }
      if (level === "READ_ONLY" && action !== "read") {
        throw new AppError("This file is read-only for you", 403);
      }
      return;
    }

    const ctx = await this.loadIsoContext(projectId, userId);
    const ok = await this.checkIsoFileAccess(projectId, userId, file, action, ctx);
    if (!ok) {
      throw new AppError("You do not have permission for this file", 403);
    }
  }

  async annotateFilesIso(
    projectId: string,
    userId: Types.ObjectId,
    files: Array<Record<string, any>>
  ): Promise<Array<Record<string, any>>> {
    const ctx = await this.loadIsoContext(projectId, userId);
    const out: Array<Record<string, any>> = [];
    for (const f of files) {
      // Ép kiểu lại để checkIsoFileAccess dùng được toán tử .equals() của ObjectId
      const mockFile = {
        folderId: f.folderId,
        createdBy: f.createdBy ? new Types.ObjectId(f.createdBy as string) : undefined,
        versions: (f.versions as any[])?.map((v: any) => ({
          uploadedBy: v.uploadedBy?._id ? new Types.ObjectId(v.uploadedBy._id) : undefined
        }))
      };

      const allowed = await this.checkIsoFileAccess(projectId, userId, mockFile, "read", ctx);
      out.push({ ...f, cdeAccessible: allowed });
    }
    return out;
  }

  async annotateFilesNormal(
    projectId: string,
    userId: Types.ObjectId,
    files: Array<Record<string, any>>
  ): Promise<Array<Record<string, any>>> {
    const pm = await projectMemberSchema.findOne({ projectId, userId }).lean();
    const isAdmin = pm ? isProjectAdminRole(pm.role) : false;

    const out: Array<Record<string, any>> = [];
    for (const f of files) {
      const id = f._id.toString();
      const level = await this.resolveNormalItemAccess(
        projectId,
        userId,
        "file",
        id,
        isAdmin // Đã truyền isAdmin bypass lúc trước
      );
      out.push({
        ...f,
        cdeAccessible: level !== "NO_ACCESS",
      });
    }
    return out;
  }

  private async checkIsoFileAccess(
    projectId: string,
    userId: Types.ObjectId,
    file: any,
    action: FileAccessAction,
    ctx: IsoAccessContext
  ): Promise<boolean> {
    if (ctx.isProjectAdmin) return true;

    if (!file.folderId) {
      return action === "read";
    }

    const folderOk = await this.checkIsoFolderAccess(
      projectId,
      userId,
      file.folderId.toString(),
      "browse",
      ctx
    );
    if (!folderOk) return false;

    if (action === "read") return true;

    const chain = await this.getFolderChainFromRoot(file.folderId.toString());
    const cdeRoot = this.getCdeRootFromChain(chain);
    if (
      cdeRoot?.cdeStage === "PUBLISHED" ||
      cdeRoot?.cdeStage === "ARCHIVED"
    ) {
      return false;
    }

    const effGroup = this.getEffectiveGroupId(chain);
    if (!effGroup) return false;

    const role = ctx.groupRoles.get(effGroup.toString());
    if (!role) return false;

    if (role === "GROUP_LEADER") return true;

    const owner = this.getFileOwnerId(file);
    if (!owner || !owner.equals(userId)) return false;
    return true;
  }

  private async checkIsoFolderAccess(
    projectId: string,
    userId: Types.ObjectId,
    folderId: string,
    action: FolderAccessAction,
    ctx: IsoAccessContext
  ): Promise<boolean> {
    if (ctx.isProjectAdmin) {
      const folder = await FolderModel.findOne({
        _id: folderId,
        isDeleted: false,
      }).lean();
      if (folder?.isCdeRoot && folder.isCdeRootLocked) {
        if (action === "rename" || action === "delete" || action === "move") {
          return false;
        }
      }
      return true;
    }

    const folder = await FolderModel.findOne({
      _id: folderId,
      projectId,
      isDeleted: false,
    }).lean();
    if (!folder) return false;

    const chain = await this.getFolderChainFromRoot(folderId);
    const cdeRoot = this.getCdeRootFromChain(chain);

    if (cdeRoot?.cdeStage === "PUBLISHED" || cdeRoot?.cdeStage === "ARCHIVED") {
      if (action === "browse") return true;
      return false;
    }

    // Under "2. Shared": every project member may browse any group's folders/files.
    if (cdeRoot?.cdeStage === "SHARED" && action === "browse") {
      return true;
    }

    if (cdeRoot?.cdeStage === "WIP" || cdeRoot?.cdeStage === "SHARED") {
      if (chain.length === 1) {
        if (action === "browse") return true;
        if (action === "create_child") return false;
        return false;
      }
    }

    const effGroup = this.getEffectiveGroupId(chain);
    if (
      (cdeRoot?.cdeStage === "WIP" || cdeRoot?.cdeStage === "SHARED") &&
      chain.length > 1 &&
      !effGroup
    ) {
      return false;
    }

    if (!effGroup) {
      if (action === "browse") return true;
      return false;
    }

    const role = ctx.groupRoles.get(effGroup.toString());
    if (!role) {
      return action === "browse" ? false : false;
    }

    if (role === "GROUP_LEADER") return true;

    if (role === "GROUP_MEMBER") {
      if (action === "browse" || action === "create_child") return true;
      const createdBy = folder.createdBy;
      if (createdBy && createdBy.equals(userId)) return true;
      return false;
    }

    return false;
  }

  /** For explorer list: ISO browse visibility (WIP: group-scoped; Shared: all members). */
  async isoFolderBrowseAllowed(
    projectId: string,
    userId: Types.ObjectId,
    folderId: string,
    ctx: IsoAccessContext
  ): Promise<boolean> {
    return this.checkIsoFolderAccess(projectId, userId, folderId, "browse", ctx);
  }

  async annotateExplorerIso(
    projectId: string,
    userId: Types.ObjectId,
    folders: Array<Record<string, unknown>>
  ): Promise<Array<Record<string, unknown>>> {
    const ctx = await this.loadIsoContext(projectId, userId);
    const out: Array<Record<string, unknown>> = [];
    for (const f of folders) {
      const id = (f._id as Types.ObjectId).toString();
      const allowed = await this.isoFolderBrowseAllowed(projectId, userId, id, ctx);
      out.push({ ...f, cdeAccessible: allowed });
    }
    return out;
  }

  async annotateExplorerNormal(
    projectId: string,
    userId: Types.ObjectId,
    folders: Array<Record<string, unknown>>
  ): Promise<Array<Record<string, unknown>>> {
    const pm = await projectMemberSchema.findOne({ projectId, userId }).lean();
    const isAdmin = pm ? isProjectAdminRole(pm.role) : false;

    const out: Array<Record<string, unknown>> = [];
    for (const f of folders) {
      const id = (f._id as Types.ObjectId).toString();
      const level = await this.resolveNormalItemAccess(
        projectId,
        userId,
        "folder",
        id,
        isAdmin
      );
      out.push({
        ...f,
        cdeAccessible: level !== "NO_ACCESS",
      });
    }
    return out;
  }

  /** Walk up from folder to first groupId (ISO effective group). */
  async getEffectiveGroupIdForFolder(folderId: string): Promise<string | null> {
    let current = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    })
      .select("parentId groupId")
      .lean();
    while (current) {
      if (current.groupId) return current.groupId.toString();
      if (!current.parentId) break;
      current = await FolderModel.findOne({
        _id: current.parentId,
        isDeleted: false,
      })
        .select("parentId groupId")
        .lean();
    }
    return null;
  }

  /**
   * ISO 19650: moves must stay within the same group subtree (same effective group on source folder(s) and destination).
   */
  async assertIsoMoveDestinationSameGroup(
    projectId: string,
    sourceFolderIds: Array<string | null | undefined>,
    destinationFolderId: string | null | undefined
  ): Promise<void> {
    const proj = await projectSchema
      .findById(projectId)
      .select("workflowMode")
      .lean();
    if (parseCdeWorkflowMode(proj?.workflowMode) !== "ISO_19650") return;

    if (
      destinationFolderId &&
      destinationFolderId !== "null" &&
      destinationFolderId !== "" &&
      (await this.isFolderUnderArchivedStage(destinationFolderId))
    ) {
      return;
    }

    const resolved: (string | null)[] = [];
    for (const fid of sourceFolderIds) {
      if (!fid) {
        resolved.push(null);
        continue;
      }
      resolved.push(await this.getEffectiveGroupIdForFolder(fid.toString()));
    }
    const keys = new Set(
      resolved.map((x) => (x === null ? "__NULL__" : x))
    );
    if (keys.size > 1) {
      throw new AppError(
        "In ISO 19650 mode, selected items must belong to the same group to move together",
        400
      );
    }
    const sourceEff = resolved[0];

    let destEff: string | null = null;
    if (
      destinationFolderId &&
      destinationFolderId !== "null" &&
      destinationFolderId !== ""
    ) {
      destEff = await this.getEffectiveGroupIdForFolder(destinationFolderId);
    }

    if (sourceEff === null && destEff === null) return;
    if (sourceEff === null || destEff === null) {
      throw new AppError(
        "In ISO 19650 mode, you can only move items within the same group folder tree",
        403
      );
    }
    if (sourceEff !== destEff) {
      throw new AppError(
        "In ISO 19650 mode, you can only move items within the same group folder tree",
        403
      );
    }
  }
}
