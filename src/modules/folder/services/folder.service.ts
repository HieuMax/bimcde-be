import FolderModel from "../schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";
import { IFolder } from "../interfaces/folder.interface";
import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";

export default class FolderService {
  // --- Get Folder Contents ---
  async getFolderContents(projectId: string, parentId: string | null = null) {
    // const query: any = {
    //   projectId: new Types.ObjectId(projectId),
    //   isDeleted: false,
    //   parentId: parentId ? new Types.ObjectId(parentId) : null,
    // };
    // return await FolderModel.find(query).sort({ createdAt: -1 }).lean();
    const projectObjId = new Types.ObjectId(projectId);
    const parentObjId = parentId ? new Types.ObjectId(parentId) : null;

    const folders = await FolderModel.aggregate([
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
      {
        $project: {
          children: 0,
        },
      },
      { $sort: { createdAt: -1 } },
    ]);

    return folders;
  }

  // --- US36: Create folder ---
  async createFolder(data: Partial<IFolder>): Promise<IFolder> {
    let path = ",";

    if (data.parentId) {
      const parentFolder = await FolderModel.findById(data.parentId).lean();
      if (!parentFolder) throw new AppError("Parent folder not found", 404);
      path = `${parentFolder.path}${parentFolder._id},`;
    }

    const duplicate = await FolderModel.findOne({
      projectId: data.projectId,
      parentId: data.parentId || null,
      name: data.name,
      isDeleted: false,
    });
    if (duplicate)
      throw new AppError("Folder name already exists in this location", 400);

    const newFolder = new FolderModel({
      ...data,
      path: path,
      currentVersion: 1,
      versions: [
        {
          version: 1,
          name: data.name,
          updatedBy: new Types.ObjectId(data.createdBy),
          createdAt: new Date(),
        },
      ],
    });

    return await newFolder.save();
  }

  // --- US: RENAME ---
  async renameFolder(folderId: string, newName: string, userId: string) {
    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);

    if (folder.name === newName) return folder;

    const duplicate = await FolderModel.findOne({
      projectId: folder.projectId,
      parentId: folder.parentId,
      name: newName,
      isDeleted: false,
    });
    if (duplicate) throw new AppError("Folder name already exists", 400);

    const nextVersion = (folder.currentVersion || 1) + 1;
    folder.name = newName;
    folder.currentVersion = nextVersion;
    folder.versions.push({
      version: nextVersion,
      name: newName,
      updatedBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    });

    return await folder.save();
  }

  // --- US42: Delete folder / file) ---
  async deleteFolder(folderId: string, userId: string) {
    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);

    const subFolders = await FolderModel.find({
      path: { $regex: `,${folderId},` },
      isDeleted: false,
    }).select("_id");

    const allIds = [folder._id, ...subFolders.map((f) => f._id)];
    const deletePayload = { isDeleted: true, deletedAt: new Date() };

    await Promise.all([
      FolderModel.updateMany({ _id: { $in: allIds } }, { $set: deletePayload }),
      FileModel.updateMany(
        { folderId: { $in: allIds } },
        { $set: deletePayload }
      ),
    ]);
  }

  // --- US43: Move folder / file to … ---
  async moveFolder(
    folderId: string,
    destinationParentId: string | null,
    userId: string
  ) {
    const folder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!folder) throw new AppError("Folder not found", 404);

    let newPath = ",";
    let destParentIdObj: Types.ObjectId | null = null;

    if (destinationParentId) {
      if (destinationParentId === folderId)
        throw new AppError("Cannot move folder into itself", 400);

      const destFolder = await FolderModel.findOne({
        _id: destinationParentId,
        isDeleted: false,
      });
      if (!destFolder) throw new AppError("Destination folder not found", 404);

      if (destFolder.path.includes(folderId)) {
        throw new AppError("Cannot move a folder into its own sub-folder", 400);
      }

      newPath = `${destFolder.path}${destFolder._id},`;
      destParentIdObj = destFolder._id;
    }

    const duplicate = await FolderModel.findOne({
      projectId: folder.projectId,
      parentId: destParentIdObj,
      name: folder.name,
      isDeleted: false,
    });
    if (duplicate)
      throw new AppError(
        `Folder "${folder.name}" already exists in destination`,
        400
      );

    const oldPath = `${folder.path}${folder._id},`;
    const newPathWithSelf = `${newPath}${folder._id},`;

    folder.parentId = destParentIdObj;
    folder.path = newPath;
    await folder.save();

    const subFolders = await FolderModel.find({
      path: { $regex: `^${oldPath}` },
      isDeleted: false,
    });

    if (subFolders.length > 0) {
      const bulkOps = subFolders.map((sub) => ({
        updateOne: {
          filter: { _id: sub._id },
          update: {
            $set: { path: sub.path.replace(oldPath, newPathWithSelf) },
          },
        },
      }));
      await FolderModel.bulkWrite(bulkOps);
    }

    return folder;
  }

  async getAllFolders() {
    return await FolderModel.find();
  }

  // --- Bulk Assign Tags ---
  async assignTags(folderIds: string[], tagIds: string[]) {
    try {
      const objectIds = folderIds.map((id) => new Types.ObjectId(id));
      const validTagIds = tagIds.filter((id) => id);
      const tagObjectIds = validTagIds.map((id) => new Types.ObjectId(id));

      const result = await FolderModel.updateMany(
        { _id: { $in: objectIds }, isDeleted: false },
        { $set: { tags: tagObjectIds } }
      );

      // Return updated folders
      // Note: If FolderModel.tags is ref to Tag, we populate.
      // Based on FileService usage, it seems consistent.
      const updatedFolders = await FolderModel.find({
        _id: { $in: objectIds },
        isDeleted: false,
      }).populate("tags");

      return updatedFolders;
    } catch (error) {
      console.error("Folder assignTags error", error);
      throw error;
    }
  }
}
