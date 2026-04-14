import FolderModel from "../schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";
import projectSchema from "../../project/schemas/project.schema";
import { IFolder } from "../interfaces/folder.interface";
import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import { parseCdeWorkflowMode } from "../../../constants/cde-workflow";
import {
  assertFolderDepthWithinLimit,
  assertValidFolderName,
} from "../utils/folderNameValidation";
import CdeAccessService from "../../permission/services/cde-access.service";
import {
  assertIsoAllowsUserContentInParent,
  isIsoGroupHomeFolder,
} from "../utils/folderIsoPlacement";

export type CreateFolderOptions = {
  /** System use only: create the four CDE roots under parentId null in ISO projects */
  allowIsoRootCreation?: boolean;
  /** ISO: createGroup only — team home folders directly under WIP/Shared CDE roots */
  allowIsoStructuralFolder?: boolean;
};

const cdeAccess = new CdeAccessService();

export default class FolderService {
  /* =========================
   * GET FOLDER CONTENTS
   * ========================= */
  async getFolderContents(projectId: string, parentId: string | null = null) {
    const projectObjId = new Types.ObjectId(projectId);
    const parentObjId = parentId ? new Types.ObjectId(parentId) : null;

    return await FolderModel.aggregate([
      {
        $match: {
          projectId: projectObjId,
          parentId: parentObjId,
          isDeleted: false,
        },
      },
      {
        $lookup: {
          from: "folders",
          let: { id: "$_id" },
          pipeline: [
            {
              $match: {
                $expr: {
                  $and: [
                    { $eq: ["$parentId", "$$id"] },
                    { $eq: ["$isDeleted", false] },
                  ],
                },
              },
            },
            { $limit: 1 },
          ],
          as: "children",
        },
      },
      {
        $addFields: {
          hasChildren: { $gt: [{ $size: "$children" }, 0] },
        },
      },
      { $project: { children: 0 } },
      { $sort: { createdAt: -1 } },
    ]);
  }

  /* =========================
   * CREATE FOLDER
   * ========================= */
  async createFolder(
    data: Partial<IFolder>,
    options?: CreateFolderOptions
  ): Promise<IFolder> {
    const trimmedName = assertValidFolderName(data.name);

    const projectIdStr =
      data.projectId instanceof Types.ObjectId
        ? data.projectId.toString()
        : String(data.projectId);
    const parentIsRoot =
      data.parentId === null || data.parentId === undefined;

    if (parentIsRoot && !options?.allowIsoRootCreation) {
      const project = await projectSchema.findById(projectIdStr).lean();
      if (!project) throw new AppError("Project not found", 404);
      const mode = parseCdeWorkflowMode(project.workflowMode) ?? "NORMAL";
      if (mode === "ISO_19650") {
        throw new AppError(
          "Cannot create folders at project root in ISO 19650 mode",
          403
        );
      }
    }

    let path: string | null = null;
    let parentFolder: (IFolder & { path?: string | null }) | null = null;

    if (data.parentId) {
      parentFolder = (await FolderModel.findById(data.parentId).lean()) as
        | (IFolder & { path?: string | null })
        | null;
      if (!parentFolder) throw new AppError("Parent folder not found", 404);

      await assertIsoAllowsUserContentInParent(projectIdStr, parentFolder, {
        allowStructural: options?.allowIsoStructuralFolder,
      });

      path = parentFolder.path
        ? `${parentFolder.path},${parentFolder._id}`
        : `${parentFolder._id}`;
    }

    assertFolderDepthWithinLimit(parentFolder);

    if (data.parentId && data.createdBy) {
      await cdeAccess.assertFolderAccess(
        projectIdStr,
        new Types.ObjectId(data.createdBy),
        data.parentId.toString(),
        "create_child"
      );
    }

    const duplicate = await FolderModel.findOne({
      projectId: data.projectId,
      parentId: data.parentId ?? null,
      name: trimmedName,
      isDeleted: false,
    });
    if (duplicate) {
      throw new AppError("Folder name already exists in this location", 400);
    }

    const newFolder = new FolderModel({
      ...data,
      name: trimmedName,
      parentId: data.parentId ?? null,
      path,
      currentVersion: 1,
      versions: [
        {
          version: 1,
          name: trimmedName,
          updatedBy: data.createdBy
            ? new Types.ObjectId(data.createdBy)
            : undefined,
          createdAt: new Date(),
        },
      ],
    });

    return await newFolder.save();
  }

  /* =========================
   * RENAME FOLDER
   * ========================= */
  async renameFolder(folderId: string, newName: string, userId: string) {
    const trimmedName = assertValidFolderName(newName);

    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);

    if (folder.isCdeRoot && folder.isCdeRootLocked) {
      throw new AppError("This CDE root folder cannot be renamed", 403);
    }

    await cdeAccess.assertFolderAccess(
      folder.projectId.toString(),
      new Types.ObjectId(userId),
      folderId,
      "rename"
    );

    if (folder.name === trimmedName) return folder;

    const duplicate = await FolderModel.findOne({
      projectId: folder.projectId,
      parentId: folder.parentId,
      name: trimmedName,
      isDeleted: false,
    });
    if (duplicate) throw new AppError("Folder name already exists", 400);

    const nextVersion = (folder.currentVersion || 1) + 1;
    folder.name = trimmedName;
    folder.currentVersion = nextVersion;
    folder.versions.push({
      version: nextVersion,
      name: trimmedName,
      updatedBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    });

    return await folder.save();
  }

  /* =========================
   * DELETE FOLDER (CASCADE)
   * ========================= */
  async deleteFolder(folderId: string, userId: string) {
    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);

    if (folder.isCdeRoot && folder.isCdeRootLocked) {
      throw new AppError("This CDE root folder cannot be deleted", 403);
    }

    await cdeAccess.assertFolderAccess(
      folder.projectId.toString(),
      new Types.ObjectId(userId),
      folderId,
      "delete"
    );

    // Find all descendants by path prefix
    const prefix = folder.path
      ? `${folder.path},${folder._id}`
      : `${folder._id}`;

    const subFolders = await FolderModel.find({
      $or: [
        { path: prefix },
        { path: { $regex: `^${prefix},` } },
      ],
      isDeleted: false,
    }).select("_id");

    const allIds = [folder._id, ...subFolders.map((f) => f._id)];
    const deletePayload = {
      isDeleted: true,
      deletedAt: new Date(),
    };

    await Promise.all([
      FolderModel.updateMany(
        { _id: { $in: allIds } },
        { $set: deletePayload }
      ),
      FileModel.updateMany(
        { folderId: { $in: allIds } },
        { $set: deletePayload },
      ),
    ]);

    return folder;
  }

  /* =========================
   * MOVE FOLDER
   * ========================= */
  async moveFolder(
    folderId: string,
    destinationParentId: string | null,
    userId: string,
  ) {
    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);

    if (folder.isCdeRoot && folder.isCdeRootLocked) {
      throw new AppError("This CDE root folder cannot be moved", 403);
    }

    const projForMove = await projectSchema
      .findById(folder.projectId)
      .select("workflowMode")
      .lean();
    if (parseCdeWorkflowMode(projForMove?.workflowMode) === "ISO_19650") {
      if (await isIsoGroupHomeFolder(folder)) {
        throw new AppError("This group folder cannot be moved", 403);
      }
    }

    await cdeAccess.assertFolderAccess(
      folder.projectId.toString(),
      new Types.ObjectId(userId),
      folderId,
      "move"
    );

    let newPath: string | null = null;
    let destParentIdObj: Types.ObjectId | null = null;

    if (destinationParentId) {
      if (destinationParentId === folderId) {
        throw new AppError("Cannot move folder into itself", 400);
      }

      const destFolder = await FolderModel.findOne({
        _id: destinationParentId,
        isDeleted: false,
      });
      if (!destFolder)
        throw new AppError("Destination folder not found", 404);

      const selfPrefix = folder.path
        ? `${folder.path},${folder._id}`
        : `${folder._id}`;

      if (
        destFolder._id.equals(folder._id) ||
        (destFolder.path && destFolder.path.startsWith(selfPrefix))
      ) {
        throw new AppError(
          "Cannot move a folder into its own sub-folder",
          400
        );
      }

      await cdeAccess.assertFolderAccess(
        folder.projectId.toString(),
        new Types.ObjectId(userId),
        destinationParentId,
        "create_child"
      );

      await cdeAccess.assertIsoArchivedMoveAllowed(
        folder.projectId.toString(),
        new Types.ObjectId(userId),
        [folder._id.toString()],
        destinationParentId,
      );

      await cdeAccess.assertIsoMoveDestinationSameGroup(
        folder.projectId.toString(),
        [folder._id.toString()],
        destinationParentId,
      );

      newPath = destFolder.path
        ? `${destFolder.path},${destFolder._id}`
        : `${destFolder._id}`;
      destParentIdObj = destFolder._id;
    } else {
      const proj = await projectSchema
        .findById(folder.projectId)
        .select("workflowMode")
        .lean();
      if (parseCdeWorkflowMode(proj?.workflowMode) === "ISO_19650") {
        const ctx = await cdeAccess.loadIsoContext(
          folder.projectId.toString(),
          new Types.ObjectId(userId)
        );
        if (!ctx.isProjectAdmin) {
          throw new AppError(
            "Cannot move folder to project root in ISO 19650 mode",
            403
          );
        }
      }
      await cdeAccess.assertIsoMoveDestinationSameGroup(
        folder.projectId.toString(),
        [folder._id.toString()],
        null,
      );
    }

    const duplicate = await FolderModel.findOne({
      projectId: folder.projectId,
      parentId: destParentIdObj,
      name: folder.name,
      isDeleted: false,
    });
    if (duplicate) {
      throw new AppError(
        `Folder "${folder.name}" already exists in destination`,
        400,
      );
    }

    const oldPrefix = folder.path
      ? `${folder.path},${folder._id}`
      : `${folder._id}`;

    const newPrefix = newPath
      ? `${newPath},${folder._id}`
      : `${folder._id}`;

    folder.parentId = destParentIdObj;
    folder.path = newPath;
    await folder.save();

    const subFolders = await FolderModel.find({
      path: { $regex: `^${oldPrefix},` },
      isDeleted: false,
    });

    if (subFolders.length > 0) {
      const bulkOps = subFolders.map((sub) => ({
        updateOne: {
          filter: { _id: sub._id },
          update: {
            $set: {
              path: sub.path
                ? sub.path.replace(oldPrefix, newPrefix)
                : newPrefix,
            },
          },
        },
      }));
      await FolderModel.bulkWrite(bulkOps);
    }

    return folder;
  }

  /* =========================
   * OTHER
   * ========================= */
  async getAllFolders() {
    return await FolderModel.find();
  }

  async assignTags(folderIds: string[], tagIds: string[]) {
    const objectIds = folderIds.map((id) => new Types.ObjectId(id));
    const tagObjectIds = tagIds
      .filter(Boolean)
      .map((id) => new Types.ObjectId(id));

      const result = await FolderModel.updateMany(
        { _id: { $in: objectIds }, isDeleted: false },
        { $set: { tags: tagObjectIds } },
      );

    return await FolderModel.find({
      _id: { $in: objectIds },
      isDeleted: false,
    }).populate("tags");
  }
  // [NEW] Restore Folder
  async restoreFolder(folderId: string, userId: string) {
    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: true,
    });
    if (!folder)
      throw new AppError("Folder not found or already restored", 404);

    // Tìm tất cả subfolder đã bị xóa cùng đợt (dựa vào path)
    const subFolders = await FolderModel.find({
      path: { $regex: `,${folderId},` },
      isDeleted: true,
    }).select("_id");

    const allIds = [folder._id, ...subFolders.map((f) => f._id)];
    const restorePayload = { isDeleted: false, deletedAt: undefined };

    await Promise.all([
      FolderModel.updateMany(
        { _id: { $in: allIds } },
        { $set: restorePayload },
      ), // Restore folders
      FileModel.updateMany(
        { folderId: { $in: allIds } },
        { $set: restorePayload },
      ), // Restore files inside
    ]);

    return folder;
  }
}
