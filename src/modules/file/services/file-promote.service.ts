import path from "path";
import { Types } from "mongoose";
import FileModel from "../schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import projectSchema from "../../project/schemas/project.schema";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import groupMemberModel from "../../team/schemas/group-member.schema";
import TopicItemModel from "../../topic/schemas/topic-item.schema";
import Todo2DModel from "../../todo2d/schemas/todo2d.schema";
import { assertFileSafeToPublish } from "../../topic/utils/topic-todo-collaboration.helpers";
import { isTopicStatusUnresolvedForPublish } from "../../../constants/topic-todo-workflow";
import notificationModel from "../../notification/schemas/comment.schemas";
import { getIO } from "../../../lib/socket.lib";
import { AppError } from "../../../utils/AppError";
import {
  parseCdeWorkflowMode,
  type CdeFolderStage,
  type PromoteTargetStage,
} from "../../../constants/cde-workflow";
import ActivityService from "../../activity/services/activity.service";
import CdeAccessService from "../../permission/services/cde-access.service";
import type { IFile } from "../interfaces/file.interface";

const cdeAccess = new CdeAccessService();

type LeanFolder = {
  _id: Types.ObjectId;
  parentId?: Types.ObjectId | null;
  groupId?: Types.ObjectId | null;
  isCdeRoot?: boolean;
  cdeStage?: CdeFolderStage;
};

type FileWorkflowStatus =
  | "WIP_DRAFT"
  | "SUBMITTED_FOR_REVIEW"
  | "COORDINATED"
  | "PUBLISHED"
  | "ARCHIVED";

function isProjectAdminRole(role: unknown): boolean {
  return String(role ?? "").toLowerCase() === "admin";
}

export default class FilePromoteService {
  private activity = new ActivityService();

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

  private getCdeRootFromChain(chain: LeanFolder[]): LeanFolder | undefined {
    return chain.find((f) => f.isCdeRoot && f.cdeStage);
  }

  private getEffectiveGroupId(
    chain: LeanFolder[],
    fileGroupId?: Types.ObjectId | null
  ): Types.ObjectId | null {
    if (fileGroupId) return fileGroupId as Types.ObjectId;
    for (let i = chain.length - 1; i >= 0; i--) {
      if (chain[i].groupId) return chain[i].groupId as Types.ObjectId;
    }
    return null;
  }

  private async uniqueNameInFolder(
    fullName: string,
    folderId: Types.ObjectId,
    projectId: Types.ObjectId
  ): Promise<string> {
    const ext = path.extname(fullName);
    const base = fullName.slice(0, -ext.length);
    let n = 1;
    let candidate = fullName;
    for (;;) {
      const dup = await FileModel.findOne({
        folderId,
        name: candidate,
        projectId,
        isDeleted: false,
      });
      if (!dup) return candidate;
      candidate = `${base} (${n})${ext}`;
      n += 1;
    }
  }

  private async findCdeRoot(
    projectId: Types.ObjectId,
    stage: CdeFolderStage
  ): Promise<LeanFolder | null> {
    const doc = await FolderModel.findOne({
      projectId,
      parentId: null,
      isCdeRoot: true,
      cdeStage: stage,
      isDeleted: false,
    }).lean();
    return doc as LeanFolder | null;
  }

  private async assertGroupLeader(
    groupId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<void> {
    const row = await groupMemberModel.findOne({
      groupId,
      userId,
      role: "GROUP_LEADER",
    }).lean();
    if (!row) {
      throw new AppError(
        "Only a group leader can promote files from WIP to Shared",
        403
      );
    }
  }

  private async getGroupRole(
    groupId: Types.ObjectId,
    userId: Types.ObjectId
  ): Promise<"GROUP_LEADER" | "GROUP_MEMBER" | null> {
    const row = await groupMemberModel.findOne({ groupId, userId }).lean();
    if (!row) return null;
    return row.role === "GROUP_LEADER" ? "GROUP_LEADER" : "GROUP_MEMBER";
  }

  private inferFileOwnerId(file: any): Types.ObjectId | null {
    if (file.createdBy) return file.createdBy as Types.ObjectId;
    const last = file.versions?.[file.versions.length - 1];
    if (last?.uploadedBy) return last.uploadedBy as Types.ObjectId;
    return null;
  }

  private stageToWorkflowStatus(stage: CdeFolderStage): FileWorkflowStatus {
    if (stage === "SHARED") return "COORDINATED";
    if (stage === "PUBLISHED") return "PUBLISHED";
    if (stage === "ARCHIVED") return "ARCHIVED";
    return "WIP_DRAFT";
  }

  private async assertNoOpenIssuesBeforePublish(
    projectId: string,
    fileId: string
  ): Promise<void> {
    await assertFileSafeToPublish(projectId, fileId);
  }

  /**
   * ISO: after WIP→Shared, notify topic creators linked to this file that a new version exists.
   */
  private async notifyTopicCreatorsOnFileVersionPromotedToShared(
    projectId: string,
    wipFileId: Types.ObjectId,
    newVersion: number
  ): Promise<void> {
    const pid = new Types.ObjectId(projectId);
    const fid = wipFileId.toString();
    const topics = await TopicItemModel.find({
      projectId: pid,
      $or: [{ fileId: wipFileId }, { "attachments.fileId": fid }],
      authorUserId: { $exists: true, $ne: null },
    })
      .select({ authorUserId: 1, code: 1 })
      .lean();

    const seen = new Set<string>();
    for (const t of topics) {
      const uid = (t as { authorUserId?: Types.ObjectId }).authorUserId?.toString();
      if (!uid || seen.has(uid)) continue;
      seen.add(uid);
      try {
        await notificationModel.create({
          userId: new Types.ObjectId(uid),
          title: "File updated to a new version",
          content: `File updated to a new version. Please verify if the issue is resolved. (Topic ${(t as { code?: string }).code ?? "—"}, file v${newVersion})`,
          isRead: false,
        });
      } catch (e) {
        console.error("[promote] topic creator notification failed", e);
      }
    }
  }

  /**
   * ISO: checklist for Shared→Published (open todos, resolved topics, version integrity).
   */
  async getPublishReadiness(
    fileId: string,
    userId: Types.ObjectId
  ): Promise<{
    openTodosCount: number;
    linkedTopicsTotal: number;
    linkedTopicsResolved: number;
    currentVersionIsLatestInShared: boolean;
    sharedRevisionEligibleForPublish: boolean;
    sharedCurrentVersion: number;
    canPublish: boolean;
    eligibleContext: boolean;
    contextMessage?: string;
    isProjectAdmin: boolean;
  }> {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false }).lean();
    if (!file) throw new AppError("File not found", 404);

    const projectIdStr =
      typeof file.projectId === "object"
        ? (file.projectId as Types.ObjectId).toString()
        : String(file.projectId);

    await cdeAccess.assertFileAccess(projectIdStr, userId, fileId, "read");

    const pm = await projectMemberSchema
      .findOne({ projectId: projectIdStr, userId })
      .lean();
    const isProjectAdmin = !!(pm && isProjectAdminRole(pm.role));

    const proj = await projectSchema.findById(projectIdStr).select("workflowMode").lean();
    const mode = parseCdeWorkflowMode(proj?.workflowMode) ?? "NORMAL";

    if (!file.folderId) {
      return {
        openTodosCount: 0,
        linkedTopicsTotal: 0,
        linkedTopicsResolved: 0,
        currentVersionIsLatestInShared: false,
        sharedRevisionEligibleForPublish: false,
        sharedCurrentVersion: file.currentVersion ?? 1,
        canPublish: false,
        eligibleContext: false,
        contextMessage: "File has no folder.",
        isProjectAdmin,
      };
    }

    const chain = await this.getFolderChainFromRoot(file.folderId.toString());
    const cdeRoot = this.getCdeRootFromChain(chain);
    const inShared = cdeRoot?.cdeStage === "SHARED";

    if (mode !== "ISO_19650" || !inShared) {
      return {
        openTodosCount: 0,
        linkedTopicsTotal: 0,
        linkedTopicsResolved: 0,
        currentVersionIsLatestInShared: false,
        sharedRevisionEligibleForPublish: false,
        sharedCurrentVersion: file.currentVersion ?? 1,
        canPublish: false,
        eligibleContext: false,
        contextMessage:
          mode !== "ISO_19650"
            ? "Publish readiness is only available in ISO 19650 mode."
            : "File must be under 2. Shared to publish to Published.",
        isProjectAdmin,
      };
    }

    const projectId = projectIdStr;
    const fidStr = fileId;

    const openTodosCount = await Todo2DModel.countDocuments({
      projectId,
      fileId: fidStr,
      isDeleted: { $ne: true },
      status: { $nin: ["Done", "Closed"] },
    });

    const pid = new Types.ObjectId(projectId);
    const topicDocs = await TopicItemModel.find({
      projectId: pid,
      $or: [
        { fileId: new Types.ObjectId(fidStr) },
        { "attachments.fileId": fidStr },
      ],
    })
      .select({ status: 1 })
      .lean();

    const linkedTopicsTotal = topicDocs.length;
    const linkedTopicsResolved = topicDocs.filter(
      (t) =>
        !isTopicStatusUnresolvedForPublish(
          String((t as { status?: string }).status ?? ""),
        ),
    ).length;

    const versions = (file.versions || []) as { version: number }[];
    const maxV = versions.length
      ? Math.max(...versions.map((v) => v.version))
      : file.currentVersion ?? 1;
    const cv = file.currentVersion ?? 1;
    const currentVersionIsLatestInShared = Number(cv) === Number(maxV);

    const pv = file.sharedPromotedToPublishedVersion;
    const sharedRevisionEligibleForPublish =
      pv == null || Number(pv) !== Number(cv);

    const gatesOk =
      openTodosCount === 0 &&
      linkedTopicsResolved === linkedTopicsTotal &&
      currentVersionIsLatestInShared &&
      sharedRevisionEligibleForPublish;

    const canPublish = isProjectAdmin && gatesOk;

    return {
      openTodosCount,
      linkedTopicsTotal,
      linkedTopicsResolved,
      currentVersionIsLatestInShared,
      sharedRevisionEligibleForPublish,
      sharedCurrentVersion: cv,
      canPublish,
      eligibleContext: true,
      isProjectAdmin,
    };
  }

  async submitForReview(fileId: string, userId: Types.ObjectId): Promise<IFile> {
    const latest = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!latest) throw new AppError("File not found", 404);
    if (!latest.folderId) {
      throw new AppError("Cannot submit a file without a folder", 400);
    }

    const projectIdStr =
      typeof latest.projectId === "object"
        ? (latest.projectId as Types.ObjectId).toString()
        : String(latest.projectId);
    const proj = await projectSchema.findById(projectIdStr).select("workflowMode").lean();
    const mode = parseCdeWorkflowMode(proj?.workflowMode) ?? "NORMAL";
    if (mode !== "ISO_19650") {
      throw new AppError("Submit for review is only available in ISO 19650 mode", 400);
    }

    const chain = await this.getFolderChainFromRoot(latest.folderId.toString());
    const cdeRoot = this.getCdeRootFromChain(chain);
    if (cdeRoot?.cdeStage !== "WIP") {
      throw new AppError("Submit for review is only allowed for files in WIP", 403);
    }

    const effGroup = this.getEffectiveGroupId(chain, latest.groupId as Types.ObjectId | undefined);
    if (!effGroup) {
      throw new AppError("File is not associated with a group in WIP", 400);
    }

    const role = await this.getGroupRole(effGroup, userId);
    if (role !== "GROUP_MEMBER") {
      throw new AppError("Only Group Members can submit files for review", 403);
    }

    const owner = this.inferFileOwnerId(latest);
    if (!owner || !owner.equals(userId)) {
      throw new AppError("Group Members can submit only their own files", 403);
    }
    if (
      latest.submittedForReviewVersion != null &&
      latest.submittedForReviewVersion === latest.currentVersion
    ) {
      throw new AppError("This file version has already been submitted for review.", 409);
    }

    latest.workflowStatus = "SUBMITTED_FOR_REVIEW";
    latest.submittedForReviewAt = new Date();
    latest.submittedForReviewBy = userId;
    latest.submittedForReviewVersion = latest.currentVersion;
    await latest.save();

    const leaders = await groupMemberModel
      .find({ groupId: effGroup, role: "GROUP_LEADER" })
      .select("userId")
      .lean();
    if (leaders.length > 0) {
      const notifs = leaders
        .map((l) => l.userId)
        .filter((id) => id && !id.equals(userId))
        .map((leaderId) => ({
          userId: leaderId,
          title: "File submitted for review",
          content: `${latest.name} (v${latest.currentVersion}) was submitted for review.`,
          isRead: false,
        }));
      if (notifs.length > 0) {
        await notificationModel.insertMany(notifs);
        const io = getIO();
        notifs.forEach((n) => {
          io.to(`user_${n.userId}`).emit("new_notification", n);
        });
      }
    }

    return latest as unknown as IFile;
  }

  private async assertProjectAdmin(
    projectId: string,
    userId: Types.ObjectId
  ): Promise<void> {
    const pm = await projectMemberSchema
      .findOne({ projectId, userId })
      .lean();
    if (!pm || !isProjectAdminRole(pm.role)) {
      throw new AppError(
        "Only a project administrator can promote to Published",
        403
      );
    }
  }

  /**
   * ISO 19650: copy file metadata (+ same R2 object) into destination stage folder.
   * Source file in WIP is unchanged.
   */
  async promoteFile(
    fileId: string,
    userId: Types.ObjectId,
    targetStage: PromoteTargetStage,
    actor: { fullName: string; email?: string },
    destinationFolderId?: string | null
  ): Promise<{ sourceFileId: string; promotedFile: IFile }> {
    if (!["SHARED", "PUBLISHED"].includes(targetStage)) {
      throw new AppError("Invalid targetStage", 400);
    }

    const file = await FileModel.findOne({
      _id: fileId,
      isDeleted: false,
    }).lean();
    if (!file) throw new AppError("File not found", 404);
    if (!file.folderId) {
      throw new AppError("Cannot promote a file without a folder", 400);
    }

    const projectIdStr =
      typeof file.projectId === "object"
        ? (file.projectId as Types.ObjectId).toString()
        : String(file.projectId);
    const pid = new Types.ObjectId(projectIdStr);

    const proj = await projectSchema.findById(projectIdStr).select("workflowMode").lean();
    const mode = parseCdeWorkflowMode(proj?.workflowMode) ?? "NORMAL";
    if (mode !== "ISO_19650") {
      throw new AppError("Promote is only available in ISO 19650 workflow mode", 400);
    }

    const chain = await this.getFolderChainFromRoot(file.folderId.toString());
    const cdeRoot = this.getCdeRootFromChain(chain);
    const sourceStage = cdeRoot?.cdeStage;
    if (!sourceStage) {
      throw new AppError("File is not under a standard CDE root", 400);
    }

    const effGroup = this.getEffectiveGroupId(
      chain,
      file.groupId as Types.ObjectId | undefined
    );

    let destFolderId: Types.ObjectId;

    if (sourceStage === "WIP" && targetStage === "SHARED") {
      if (!effGroup) {
        throw new AppError(
          "File must belong to a group folder to promote to Shared",
          400
        );
      }
      await this.assertGroupLeader(effGroup, userId);

      const sharedRoot = await this.findCdeRoot(pid, "SHARED");
      if (!sharedRoot) {
        throw new AppError("Shared CDE root folder not found", 404);
      }
      const destFolder = await FolderModel.findOne({
        projectId: pid,
        parentId: sharedRoot._id,
        groupId: effGroup,
        isDeleted: false,
      }).lean();
      if (!destFolder) {
        throw new AppError(
          "Matching group folder not found under Shared. Ensure the group exists.",
          404
        );
      }
      destFolderId = destFolder._id as Types.ObjectId;
    } else if (sourceStage === "SHARED" && targetStage === "PUBLISHED") {
      await this.assertProjectAdmin(projectIdStr, userId);
      await this.assertNoOpenIssuesBeforePublish(projectIdStr, file._id.toString());

      const destRoot = await this.findCdeRoot(pid, targetStage);
      if (!destRoot) {
        throw new AppError(`${targetStage} CDE root folder not found`, 404);
      }

      if (
        destinationFolderId &&
        destinationFolderId !== "" &&
        Types.ObjectId.isValid(destinationFolderId)
      ) {
        const destFolder = await FolderModel.findOne({
          _id: destinationFolderId,
          projectId: pid,
          isDeleted: false,
        }).lean();
        if (!destFolder) {
          throw new AppError("Destination folder not found", 404);
        }
        const destChain = await this.getFolderChainFromRoot(destinationFolderId);
        const destCdeRoot = this.getCdeRootFromChain(destChain);
        if (!destCdeRoot?.cdeStage || destCdeRoot.cdeStage !== targetStage) {
          throw new AppError(
            `Destination must be a folder under the ${targetStage} CDE area`,
            400
          );
        }
        await cdeAccess.assertFolderAccess(
          projectIdStr,
          userId,
          destinationFolderId,
          "create_child"
        );
        destFolderId = destFolder._id as Types.ObjectId;
      } else {
        destFolderId = destRoot._id as Types.ObjectId;
      }
    } else {
      throw new AppError(
        `Invalid promote: from ${sourceStage} to ${targetStage}. Use WIP→Shared (group leader) or Shared→Published (admin). To move an item into Archived, use Move to Archived under 4. Archived.`,
        400
      );
    }

    /** Fresh read so currentVersion + versions[] always match (avoids copying stale version). */
    const source = await FileModel.findOne({
      _id: fileId,
      isDeleted: false,
    }).lean();
    if (!source) throw new AppError("File not found", 404);

    if (sourceStage === "WIP" && targetStage === "SHARED") {
      const ws = source.workflowStatus as FileWorkflowStatus | undefined;
      const sver = source.submittedForReviewVersion;
      const cv = source.currentVersion;
      if (
        ws !== "SUBMITTED_FOR_REVIEW" ||
        sver == null ||
        sver !== cv
      ) {
        throw new AppError(
          "Promote to Shared is only available after the file owner submits this version for review",
          403
        );
      }
      const promotedVer = source.wipPromotedToSharedVersion;
      if (promotedVer != null && promotedVer === cv) {
        throw new AppError(
          "This version has already been promoted to Shared",
          409
        );
      }
    }

    if (sourceStage === "SHARED" && targetStage === "PUBLISHED") {
      const pv = source.sharedPromotedToPublishedVersion;
      const cv = source.currentVersion;
      if (pv != null && pv === cv) {
        throw new AppError(
          "This Shared revision has already been promoted to Published",
          409
        );
      }
    }

    const sortedVersions = [...(source.versions || [])].sort(
      (a, b) => a.version - b.version,
    );
    const sourceLatest = sortedVersions.find(
      (v) => v.version === source.currentVersion,
    );
    if (!sourceLatest) {
      throw new AppError(
        `Cannot promote: missing stored payload for version ${source.currentVersion}. The file may be out of sync; try re-uploading this version.`,
        409,
      );
    }

    const existingDest = await FileModel.findOne({
      folderId: destFolderId,
      projectId: pid,
      name: source.name,
      isDeleted: false,
    });

    /** Align Shared file version numbers with the WIP source revision (not a separate 1,2,3 counter). */
    const sourceVersion = source.currentVersion;

    let newDoc: IFile;
    if (existingDest) {
      const dup = (existingDest.versions || []).some(
        (v) => v.version === sourceVersion,
      );
      if (dup) {
        throw new AppError(
          "This WIP revision is already present on the Shared copy of this file",
          409,
        );
      }
      existingDest.currentVersion = sourceVersion;
      existingDest.versions.push({
        version: sourceVersion,
        fileName: sourceLatest.fileName || source.name,
        storageKey: sourceLatest.storageKey,
        location: sourceLatest.location,
        size: sourceLatest.size,
        mimeType: sourceLatest.mimeType,
        uploadedBy: userId,
        createdAt: new Date(),
      });
      existingDest.workflowStatus = this.stageToWorkflowStatus(targetStage);
      existingDest.promotedFromFileId = source._id as Types.ObjectId;
      existingDest.promotedFromVersion = sourceVersion;
      /** WIP→Shared only: new revision on the Shared copy → allow Shared→Published again for that file */
      if (targetStage === "SHARED") {
        existingDest.sharedPromotedToPublishedVersion = null;
      }
      await existingDest.save();
      newDoc = existingDest as unknown as IFile;
    } else {
      newDoc = (await FileModel.create({
        name: source.name,
        folderId: destFolderId,
        projectId: pid,
        tags: source.tags ?? [],
        currentVersion: sourceVersion,
        versions: [
          {
            version: sourceVersion,
            fileName: sourceLatest.fileName || source.name,
            storageKey: sourceLatest.storageKey,
            location: sourceLatest.location,
            size: sourceLatest.size,
            mimeType: sourceLatest.mimeType,
            uploadedBy: userId,
            createdAt: new Date(),
          },
        ],
        isLocked: false,
        createdBy: userId,
        groupId: effGroup ?? source.groupId ?? null,
        cdeStage: targetStage,
        workflowStatus: this.stageToWorkflowStatus(targetStage),
        promotedFromFileId: source._id,
        promotedFromVersion: sourceVersion,
      })) as unknown as IFile;
    }

    try {
      await this.activity.logActivity({
        projectId: projectIdStr,
        actor: {
          userId,
          fullName: actor.fullName,
          email: actor.email,
        },
        actionGroup: "FILE",
        actionType: "PROMOTE",
        target: {
          itemId: newDoc._id,
          itemModel: "File",
          itemName: newDoc.name,
        },
        description: `Promoted copy from file ${source._id} (${sourceStage} → ${targetStage})`,
        metaData: {
          sourceFileId: source._id.toString(),
          sourceStage,
          targetStage,
          promotedFromVersion: source.currentVersion,
        },
      });
    } catch (e) {
      console.error("[promote] activity log failed", e);
    }

    if (sourceStage === "WIP" && targetStage === "SHARED") {
      await FileModel.updateOne(
        { _id: source._id },
        { $set: { wipPromotedToSharedVersion: source.currentVersion } },
      );
      await this.notifyTopicCreatorsOnFileVersionPromotedToShared(
        projectIdStr,
        source._id as Types.ObjectId,
        source.currentVersion,
      );
    }

    if (sourceStage === "SHARED" && targetStage === "PUBLISHED") {
      await FileModel.updateOne(
        { _id: source._id },
        { $set: { sharedPromotedToPublishedVersion: source.currentVersion } },
      );
    }

    return {
      sourceFileId: source._id.toString(),
      promotedFile: newDoc as unknown as IFile,
    };
  }
}
