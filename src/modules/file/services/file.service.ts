import FileModel from "../schemas/file.schema";
import { IFile } from "../interfaces/file.interface";
import { Types } from "mongoose";
import { env } from "../../../env";
import FolderModel from "../../folder/schemas/folder.schema";
import { s3Client } from "../../../lib/r2.lib";
import archiver from "archiver";
import { Response } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import path from "path";

export default class FileService {
  async getAllFiles() {
    return await FileModel.find();
  }
  async getFileById(fileId: string) {
    const file = await FileModel.findOne({
      _id: fileId,
      isDeleted: false,
    })
      .populate("versions.uploadedBy", "fullName email")
      .populate("lockedBy", "fullName email")
      .populate("tags")
      .lean();

    if (!file) return null;

    const latestVer = file.versions[file.versions.length - 1];
    const uploader = latestVer?.uploadedBy as any;

    return {
      _id: file._id,
      name: file.name,
      folderId: file.folderId,
      currentVersion: file.currentVersion,
      updatedAt: file.updatedAt,
      isLocked: file.isLocked,
      lockedBy: file.lockedBy,
      size: latestVer?.size || 0,
      mimeType: latestVer?.mimeType,
      location: latestVer?.location,
      thumbnail: latestVer?.location,
      modifiedBy: uploader?.fullName || "Unknown",
      tags: file.tags,
      versions: file.versions.map((v) => ({
        version: v.version,
        fileName: v.fileName,
        size: v.size,
        location: v.location,
        mimeType: v.mimeType,
        uploadedBy: (v.uploadedBy as any)?.fullName || "Unknown",
        createdAt: v.createdAt,
      })),
    };
  }


  // RENAME FILE
  async renameFile(fileId: string, newNameWithoutExt: string, userId: string) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    const ext = path.extname(file.name);
    const newFullName = `${newNameWithoutExt}${ext}`;

    if (file.name === newFullName) return file;

    const duplicate = await FileModel.findOne({
      folderId: file.folderId,
      name: newFullName,
      isDeleted: false,
    });
    if (duplicate) throw new Error("A file with this name already exists.");

    if (file.isLocked && file.lockedBy?.toString() !== userId) {
      throw new Error("File is locked by another user.");
    }

    const lastVer = file.versions[file.versions.length - 1];
    const nextVersion = file.currentVersion + 1;

    file.name = newFullName;
    file.currentVersion = nextVersion;

    const newVersionData = {
      version: nextVersion,
      fileName: newFullName,

      storageKey: lastVer.storageKey,
      location: lastVer.location,
      size: lastVer.size,
      mimeType: lastVer.mimeType,

      uploadedBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    };

    file.name = newFullName;
    file.currentVersion = nextVersion;

    file.versions.push(newVersionData);
    return await file.save();
  }

  // --- US44: Control history version of folder / file ---
  async handleFileUpload(
    fileData: Express.MulterS3.File,
    projectId: string,
    folderId: string | null | undefined,
    userId: string
  ) {
    let validFolderId: Types.ObjectId | null = null;

    if (
      folderId &&
      folderId !== "null" &&
      folderId !== "undefined" &&
      folderId !== ""
    ) {
      validFolderId = new Types.ObjectId(folderId);
    }

    const publicUrl = `https://${env.R2_PUBLIC_DOMAIN}/${fileData.key}`;

    let existingFile = await FileModel.findOne({
      folderId: validFolderId,
      name: fileData.originalname,
      projectId: new Types.ObjectId(projectId),
      isDeleted: false,
    });

    if (existingFile) {
      if (
        existingFile.isLocked &&
        existingFile.lockedBy?.toString() !== userId
      ) {
        throw new Error(
          "File is locked by another user. Cannot upload new version."
        );
      }
    }

    const newVersionData = {
      fileName: fileData.originalname,
      storageKey: fileData.key,
      location: publicUrl,
      size: fileData.size,
      mimeType: fileData.mimetype,
      uploadedBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    };

    if (existingFile) {
      const nextVersion = existingFile.currentVersion + 1;
      existingFile.versions.push({
        ...newVersionData,
        version: nextVersion,
      });
      existingFile.currentVersion = nextVersion;

      return await existingFile.save();
    } else {
      const newFile = new FileModel({
        name: fileData.originalname,
        folderId: validFolderId,
        projectId: new Types.ObjectId(projectId),
        currentVersion: 1,
        versions: [
          {
            ...newVersionData,
            version: 1,
          },
        ],
      });
      return await newFile.save();
    }
  }

  // --- US39: Details of folder / file ---
  async getFilesInFolder(folderId: string) {
    return await FileModel.find({
      folderId: folderId,
      isDeleted: false,
    }).populate("tags");
  }

  // --- US43: Move folder / file to … ---
  async moveFile(
    fileId: string,
    destinationFolderId: string | null,
    userId: string
  ) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found"); // Hoặc throw new AppError("File not found", 404);

    let destFolderIdObj: Types.ObjectId | null = null;

    if (
      destinationFolderId &&
      destinationFolderId !== "null" &&
      destinationFolderId !== ""
    ) {
      if (!Types.ObjectId.isValid(destinationFolderId)) {
        throw new Error("Invalid destination folder ID");
      }

      const destFolder = await FolderModel.findOne({
        _id: destinationFolderId,
        isDeleted: false,
      });

      if (!destFolder) throw new Error("Destination folder not found");

      destFolderIdObj = destFolder._id;
    }

    const duplicate = await FileModel.findOne({
      folderId: destFolderIdObj,
      name: file.name,
      projectId: file.projectId,
      isDeleted: false,
    });

    if (duplicate) {
      throw new Error(
        `A file with name "${file.name}" already exists in the destination folder.`
      );
    }

    if (file.isLocked && file.lockedBy?.toString() !== userId) {
      throw new Error("File is locked by another user. Cannot move.");
    }

    file.folderId = destFolderIdObj;
    return await file.save();
  }

  // --- US43: Bulk Move Files (All-or-Nothing) ---
  async moveManyFiles(
    fileIds: string[],
    destinationFolderId: string | null,
    userId: string
  ) {
    const sourceFiles = await FileModel.find({
      _id: { $in: fileIds },
      isDeleted: false,
    });

    if (sourceFiles.length === 0)
      throw new Error("No valid files found to move");

    const projectId = sourceFiles[0].projectId;

    let destFolderIdObj: Types.ObjectId | null = null;

    if (
      destinationFolderId &&
      destinationFolderId !== "null" &&
      destinationFolderId !== ""
    ) {
      if (!Types.ObjectId.isValid(destinationFolderId)) {
        throw new Error("Invalid destination folder ID");
      }
      const destFolder = await FolderModel.findOne({
        _id: destinationFolderId,
        isDeleted: false,
      });

      if (!destFolder) throw new Error("Destination folder not found");

      if (destFolder.projectId.toString() !== projectId.toString()) {
        throw new Error("Cannot move files to another project");
      }

      destFolderIdObj = destFolder._id;
    }

    const sourceFileNames = sourceFiles.map((f) => f.name);

    const duplicateFiles = await FileModel.find({
      folderId: destFolderIdObj,
      projectId: projectId, // Check trong cùng project
      name: { $in: sourceFileNames }, // So khớp danh sách tên
      isDeleted: false,
    });

    if (duplicateFiles.length > 0) {
      const duplicateNames = duplicateFiles.map((f) => f.name).join(", ");
      throw new Error(
        `Destination already contains files with names: ${duplicateNames}. Move cancelled.`
      );
    }

    const lockedFile = sourceFiles.find(
      (f) => f.isLocked && f.lockedBy?.toString() !== userId
    );
    if (lockedFile) {
      throw new Error(`File "${lockedFile.name}" is locked. Move cancelled.`);
    }

    const result = await FileModel.updateMany(
      { _id: { $in: fileIds } },
      { $set: { folderId: destFolderIdObj } }
    );

    return result;
  }

  // --- US51: Check in / check out folder / file ---
  async toggleLock(fileId: string, userId: string, action: "LOCK" | "UNLOCK") {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    if (action === "LOCK") {
      if (file.isLocked) throw new Error("File is already locked");

      file.isLocked = true;
      file.lockedBy = new Types.ObjectId(userId);
      file.lockedAt = new Date();
    } else {
      if (!file.isLocked) throw new Error("File is not locked");
      if (file.lockedBy?.toString() !== userId)
        throw new Error("You do not have permission to unlock this file");

      file.isLocked = false;
      file.lockedBy = undefined;
      file.lockedAt = undefined;
    }

    return await file.save();
  }

  // --- US42: Delete folder / file ---
  async deleteFile(fileId: string, userId: string) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    if (file.isLocked && file.lockedBy?.toString() !== userId) {
      throw new Error("File is locked. Cannot delete.");
    }

    file.isDeleted = true;
    file.deletedAt = new Date();
    return await file.save();
  }

  // --- US51: Bulk Check in / check out folder / file  ---
  async toggleLockMany(
    folderId: string,
    userId: string,
    action: "LOCK" | "UNLOCK"
  ) {
    const subFolders = await FolderModel.find({
      path: { $regex: `,${folderId},` },
      isDeleted: false,
    }).select("_id");

    const targetFolderIds = [
      new Types.ObjectId(folderId),
      ...subFolders.map((f) => f._id),
    ];

    if (action === "LOCK") {
      const result = await FileModel.updateMany(
        {
          folderId: { $in: targetFolderIds },
          isDeleted: false,
          isLocked: false,
        },
        {
          $set: {
            isLocked: true,
            lockedBy: new Types.ObjectId(userId),
            lockedAt: new Date(),
          },
        }
      );
      return {
        modifiedCount: result.modifiedCount,
        message: `Locked ${result.modifiedCount} files recursively.`,
      };
    } else {
      const result = await FileModel.updateMany(
        {
          folderId: { $in: targetFolderIds },
          isDeleted: false,
          isLocked: true,
          lockedBy: new Types.ObjectId(userId),
        },
        {
          $set: { isLocked: false },
          $unset: { lockedBy: 1, lockedAt: 1 },
        }
      );
      return {
        modifiedCount: result.modifiedCount,
        message: `Unlocked ${result.modifiedCount} files recursively.`,
      };
    }
  }

  // --- US45: Download Single File ---
  async downloadFile(fileId: string, res: Response) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    const latestVersion = file.versions[file.versions.length - 1];
    if (!latestVersion || !latestVersion.storageKey) {
      throw new Error("File content not found");
    }

    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: latestVersion.storageKey,
    });
    const s3Response = await s3Client.send(command);

    res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
    res.setHeader(
      "Content-Type",
      latestVersion.mimeType || "application/octet-stream"
    );

    (s3Response.Body as any).pipe(res);
  }

  // --- US45: Download file / folder ---
  async downloadFolder(folderId: string, res: Response) {
    const rootFolder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!rootFolder) throw new Error("Folder not found");

    const allFolders = await FolderModel.find({
      $or: [{ _id: folderId }, { path: { $regex: `,${folderId},` } }],
      isDeleted: false,
    }).lean();

    const folderMap = new Map(allFolders.map((f) => [f._id.toString(), f]));

    const allFolderIds = allFolders.map((f) => f._id);
    const allFiles = await FileModel.find({
      folderId: { $in: allFolderIds },
      isDeleted: false,
    }).lean();

    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${rootFolder.name}.zip"`
    );
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(res);

    for (const file of allFiles) {
      const latestVer = file.versions[file.versions.length - 1];
      if (!latestVer || !latestVer.storageKey) continue;

      let filePathInZip = file.name;
      let currentParentId = file.folderId?.toString();

      const pathParts = [];
      while (currentParentId && currentParentId !== folderId) {
        const parent = folderMap.get(currentParentId);
        if (parent) {
          pathParts.unshift(parent.name);
          currentParentId = parent.parentId?.toString() ?? "";
        } else {
          break;
        }
      }

      if (pathParts.length > 0) {
        filePathInZip = `${pathParts.join("/")}/${file.name}`;
      }

      try {
        const command = new GetObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: latestVer.storageKey,
        });
        const s3Item = await s3Client.send(command);

        archive.append(s3Item.Body as any, { name: filePathInZip });
      } catch (err) {
        console.error(`Failed to append file ${file.name} to zip`, err);
      }
    }

    await archive.finalize();
  }

  // US45: Download file / folders in bulk
  async downloadBulk(
    items: { id: string; type: "file" | "folder" }[],
    projectId: string,
    res: Response
  ) {
    let projectName = "Project";
    try {
    } catch (e) {}

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const zipFileName = `${projectName}_${timestamp}`;

    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFileName}.zip"`
    );
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(res);

    for (const item of items) {
      if (item.type === "file") {
        await this.addFileToArchive(archive, item.id, "");
      } else {
        await this.addFolderToArchive(archive, item.id);
      }
    }

    await archive.finalize();
  }

  // --- HELPER: Add 1 file to ZIP ---
  private async addFileToArchive(
    archive: archiver.Archiver,
    fileId: string,
    folderPathInZip: string
  ) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) return;

    const latestVer = file.versions[file.versions.length - 1];
    if (!latestVer || !latestVer.storageKey) return;

    try {
      const command = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: latestVer.storageKey,
      });
      const s3Item = await s3Client.send(command);

      const fileNameInZip = folderPathInZip
        ? `${folderPathInZip}/${file.name}`
        : file.name;

      archive.append(s3Item.Body as any, { name: fileNameInZip });
    } catch (err) {
      console.error(`Error zipping file ${file.name}:`, err);
    }
  }

  // --- HELPER: Add 1 folder to ZIP ---
  private async addFolderToArchive(
    archive: archiver.Archiver,
    folderId: string
  ) {
    const rootFolder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!rootFolder) return;

    const allFolders = await FolderModel.find({
      $or: [{ _id: folderId }, { path: { $regex: `,${folderId},` } }],
      isDeleted: false,
    }).lean();

    const folderMap = new Map(allFolders.map((f) => [f._id.toString(), f]));
    const allFolderIds = allFolders.map((f) => f._id);

    const allFiles = await FileModel.find({
      folderId: { $in: allFolderIds },
      isDeleted: false,
    }).lean();

    for (const file of allFiles) {
      const latestVer = file.versions[file.versions.length - 1];
      if (!latestVer || !latestVer.storageKey) continue;

      let currentParentId: string | undefined = file.folderId?.toString();

      const pathParts = [];

      while (currentParentId) {
        const parent = folderMap.get(currentParentId);
        if (parent) {
          pathParts.unshift(parent.name);
          if (parent._id.toString() === folderId) break;
          currentParentId = parent.parentId?.toString();
        } else {
          break;
        }
      }

      const filePathInZip = `${pathParts.join("/")}/${file.name}`;

      try {
        const command = new GetObjectCommand({
          Bucket: env.R2_BUCKET_NAME,
          Key: latestVer.storageKey,
        });
        const s3Item = await s3Client.send(command);
        archive.append(s3Item.Body as any, { name: filePathInZip });
      } catch (err) {
        console.error(err);
      }
    }
  }

  // --- USXX: Bulk Assign Tags ---
  async assignTags(fileIds: string[], tagIds: string[]) {
    try {
      const objectIds = fileIds.map((id) => new Types.ObjectId(id));
      // Filter clean IDs for tags
      const validTagIds = tagIds.filter((id) => id);
      const tagObjectIds = validTagIds.map((id) => new Types.ObjectId(id));

      const result = await FileModel.updateMany(
        { _id: { $in: objectIds }, isDeleted: false },
        { $set: { tags: tagObjectIds } }
      );

      // Return the updated files with populated tags
      const updatedFiles = await FileModel.find({
        _id: { $in: objectIds },
        isDeleted: false,
      }).populate("tags");

      return updatedFiles;
    } catch (error) {
      console.error("DEBUG: Error in assignTags:", error);
      throw error;
    }
  }
}
