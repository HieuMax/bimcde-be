import path from "path";
import { Types } from "mongoose";
import FolderModel from "../../folder/schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";
import projectSchema from "../../project/schemas/project.schema";
import FolderService from "../../folder/services/folder.service";
import { parseCdeWorkflowMode } from "../../../constants/cde-workflow";
import { AppError } from "../../../utils/AppError";
import CdeAccessService from "../../permission/services/cde-access.service";
import ViewModel from "../../view3d/schemas/view.schemas";

export const ISO_REVOKED_CONTAINER_NAME = "Revoked";

const cdeAccess = new CdeAccessService();
const folderService = new FolderService();

export default class IsoRevokeService {
  private async assertIsoAdmin(projectId: string, userId: Types.ObjectId) {
    await cdeAccess.assertProjectAdmin(projectId, userId);
    const proj = await projectSchema
      .findById(projectId)
      .select("workflowMode")
      .lean();
    if (parseCdeWorkflowMode(proj?.workflowMode) !== "ISO_19650") {
      throw new AppError("Revoke is only available in ISO 19650 projects", 400);
    }
  }

  private async getOrCreateRevokedFolder(
    projectId: string,
    userId: string
  ): Promise<Types.ObjectId> {
    const pid = new Types.ObjectId(projectId);
    const archivedRoot = await FolderModel.findOne({
      projectId: pid,
      parentId: null,
      isCdeRoot: true,
      cdeStage: "ARCHIVED",
      isDeleted: false,
    }).lean();
    if (!archivedRoot?._id) {
      throw new AppError("Archived CDE root not found for this project", 404);
    }

    let container = await FolderModel.findOne({
      projectId: pid,
      parentId: archivedRoot._id,
      name: ISO_REVOKED_CONTAINER_NAME,
      isDeleted: false,
    }).lean();

    if (!container) {
      const created = await folderService.createFolder({
        name: ISO_REVOKED_CONTAINER_NAME,
        projectId: pid,
        parentId: archivedRoot._id,
        createdBy: new Types.ObjectId(userId),
      });
      return created._id as Types.ObjectId;
    }
    return container._id as Types.ObjectId;
  }

  private async assertSharedOrPublishedStageForFolder(folderId: string) {
    const stage = await cdeAccess.getIsoCdeRootStageForFolderId(folderId);
    if (stage !== "SHARED" && stage !== "PUBLISHED") {
      throw new AppError(
        "Revoke only applies to items located under Shared or Published",
        400
      );
    }
  }

  private async uniqueFileNameInFolder(
    projectId: Types.ObjectId,
    folderId: Types.ObjectId,
    originalName: string
  ): Promise<string> {
    const ext = path.extname(originalName);
    const base =
      ext.length > 0
        ? originalName.slice(0, -ext.length)
        : originalName;
    let candidate = originalName;
    let n = 0;
    for (;;) {
      const exists = await FileModel.exists({
        projectId,
        folderId,
        name: candidate,
        isDeleted: false,
      });
      if (!exists) return candidate;
      n += 1;
      candidate = `${base} (${n})${ext}`;
    }
  }

  private async uniqueFolderNameInParent(
    projectId: Types.ObjectId,
    parentId: Types.ObjectId,
    originalName: string
  ): Promise<string> {
    let candidate = originalName;
    let n = 0;
    for (;;) {
      const exists = await FolderModel.exists({
        projectId,
        parentId,
        name: candidate,
        isDeleted: false,
      });
      if (!exists) return candidate;
      n += 1;
      candidate = `${originalName} (revoked ${n})`;
    }
  }

  /** Soft-delete one file (admin restore path; bypasses ISO Shared/Published delete rule). */
  private async softDeleteSingleFile(fileId: string): Promise<void> {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) return;
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();
    try {
      await ViewModel.deleteMany({ relatedFileId: file._id });
    } catch {
      // ignore
    }
  }

  /** Cascade soft-delete folder + descendants (admin restore overwrite). */
  private async softDeleteFolderTree(folderId: string): Promise<void> {
    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!folder) return;
    const pref = folder.path
      ? `${folder.path},${folder._id}`
      : `${folder._id}`;
    const subFolders = await FolderModel.find({
      $or: [{ path: pref }, { path: { $regex: `^${pref},` } }],
      isDeleted: false,
    }).select("_id");
    const allIds = [folder._id, ...subFolders.map((f) => f._id)];
    const del = { isDeleted: true, deletedAt: new Date() };
    await Promise.all([
      FolderModel.updateMany({ _id: { $in: allIds } }, { $set: del }),
      FileModel.updateMany({ folderId: { $in: allIds } }, { $set: del }),
    ]);
  }

  async revokeFile(projectId: string, fileId: string, userId: string) {
    const uid = new Types.ObjectId(userId);
    await this.assertIsoAdmin(projectId, uid);

    const file = await FileModel.findOne({
      _id: fileId,
      projectId: new Types.ObjectId(projectId),
      isDeleted: false,
    });
    if (!file) throw new AppError("File not found", 404);
    if (!file.folderId) throw new AppError("File has no folder", 400);
    if (file.isoRevokeOriginalFolderId) {
      throw new AppError("File is already in Revoked state", 400);
    }

    await cdeAccess.assertFileAccess(projectId, uid, fileId, "move");
    await this.assertSharedOrPublishedStageForFolder(
      file.folderId.toString()
    );

    const revokedParentId = await this.getOrCreateRevokedFolder(
      projectId,
      userId
    );
    const pid = file.projectId as Types.ObjectId;
    const originalNameBeforeRevoke = file.name;
    const newName = await this.uniqueFileNameInFolder(
      pid,
      revokedParentId,
      file.name
    );

    file.isoRevokeOriginalFolderId = file.folderId as Types.ObjectId;
    file.isoRevokeOriginalName = originalNameBeforeRevoke;
    file.folderId = revokedParentId;
    file.name = newName;
    await file.save();
    return file;
  }

  async revokeFolder(projectId: string, folderId: string, userId: string) {
    const uid = new Types.ObjectId(userId);
    await this.assertIsoAdmin(projectId, uid);

    const folder = await FolderModel.findOne({
      _id: folderId,
      projectId: new Types.ObjectId(projectId),
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);
    if (folder.isoRevokeOriginalParentId) {
      throw new AppError("Folder is already in Revoked state", 400);
    }
    if (!folder.parentId) {
      throw new AppError("Cannot revoke a root-level folder", 400);
    }

    await cdeAccess.assertFolderAccess(projectId, uid, folderId, "move");
    await this.assertSharedOrPublishedStageForFolder(folderId);

    const revokedParentId = await this.getOrCreateRevokedFolder(
      projectId,
      userId
    );
    const pid = folder.projectId as Types.ObjectId;
    const newName = await this.uniqueFolderNameInParent(
      pid,
      revokedParentId,
      folder.name
    );

    if (newName !== folder.name) folder.name = newName;
    folder.isoRevokeOriginalParentId =
      folder.parentId as Types.ObjectId;
    await folder.save();

    await folderService.moveFolder(folderId, revokedParentId.toString(), userId);
    return folder;
  }

  async restoreFile(
    projectId: string,
    fileId: string,
    userId: string,
    overwrite: boolean
  ) {
    const uid = new Types.ObjectId(userId);
    await this.assertIsoAdmin(projectId, uid);

    const file = await FileModel.findOne({
      _id: fileId,
      projectId: new Types.ObjectId(projectId),
      isDeleted: false,
    });
    if (!file) throw new AppError("File not found", 404);
    if (!file.isoRevokeOriginalFolderId) {
      throw new AppError("File is not revoked; nothing to restore", 400);
    }

    await cdeAccess.assertFileAccess(projectId, uid, fileId, "move");

    const dest = file.isoRevokeOriginalFolderId;
    const restoreName =
      file.isoRevokeOriginalName &&
      String(file.isoRevokeOriginalName).length > 0
        ? String(file.isoRevokeOriginalName)
        : file.name;

    const conflict = await FileModel.findOne({
      projectId: file.projectId,
      folderId: dest,
      name: restoreName,
      isDeleted: false,
      _id: { $ne: file._id },
    }).lean();

    if (conflict && !overwrite) {
      throw new AppError(
        "RESTORE_NAME_CONFLICT",
        409
      );
    }
    if (conflict && overwrite) {
      await this.softDeleteSingleFile(conflict._id.toString());
    }

    file.name = restoreName;
    file.folderId = dest;
    file.isoRevokeOriginalFolderId = null;
    file.isoRevokeOriginalName = null;
    await file.save();
    return file;
  }

  async restoreFolder(
    projectId: string,
    folderId: string,
    userId: string,
    overwrite: boolean
  ) {
    const uid = new Types.ObjectId(userId);
    await this.assertIsoAdmin(projectId, uid);

    const folder = await FolderModel.findOne({
      _id: folderId,
      projectId: new Types.ObjectId(projectId),
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);
    if (!folder.isoRevokeOriginalParentId) {
      throw new AppError("Folder is not revoked; nothing to restore", 400);
    }

    await cdeAccess.assertFolderAccess(projectId, uid, folderId, "move");

    const destParent = folder.isoRevokeOriginalParentId.toString();
    const conflict = await FolderModel.findOne({
      projectId: folder.projectId,
      parentId: folder.isoRevokeOriginalParentId,
      name: folder.name,
      isDeleted: false,
      _id: { $ne: folder._id },
    }).lean();

    if (conflict && !overwrite) {
      throw new AppError(
        "RESTORE_NAME_CONFLICT",
        409
      );
    }
    if (conflict && overwrite) {
      await this.softDeleteFolderTree(conflict._id.toString());
    }

    await folderService.moveFolder(folderId, destParent, userId);
    await FolderModel.updateOne(
      { _id: folder._id },
      { $unset: { isoRevokeOriginalParentId: 1 } }
    );
    return await FolderModel.findById(folderId);
  }
}
