import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../../env";
import FileService from "../services/file.service";
import FilePromoteService from "../services/file-promote.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import {
  MAX_UPLOAD_BYTES,
  sanitizeUploadFileName,
  validateUploadedFileContent,
  parseConflictStrategy,
} from "../utils/fileUpload.validation";
import { uploadLocalFileToR2 } from "../utils/r2UploadFromDisk";
import { fileTypeFromFilePath } from "../utils/fileTypeSniff";
import {
  MAX_FILES_PER_UPLOAD,
  PROJECT_STORAGE_LIMIT_BYTES,
} from "../constants/projectStorage";

import { Types } from "mongoose";
import { parsePromoteTargetStage } from "../../../constants/cde-workflow";
import { auditLog } from "../../../middlewares/auditLog.middleware"; // Import Middleware
import { authenticate } from "../../../middlewares/authMiddlewares";
import ActivityService from "../../activity/services/activity.service";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";
import FileModel from "../schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";

const PublicFileController = express.Router();
const FileController = express.Router();
const fileService = new FileService();
const filePromoteService = new FilePromoteService();
const activityService = new ActivityService();

const UPLOAD_TMP = path.join(os.tmpdir(), "bimcde-uploads");

const diskStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    fs.mkdir(UPLOAD_TMP, { recursive: true })
      .then(() => cb(null, UPLOAD_TMP))
      .catch((err) => cb(err as Error, UPLOAD_TMP));
  },
  filename: (_req, file, cb) => {
    const unique = `${Date.now()}_${crypto.randomBytes(8).toString("hex")}${path.extname(file.originalname)}`;
    cb(null, unique);
  },
});

const uploadDisk = multer({
  storage: diskStorage,
  limits: { fileSize: MAX_UPLOAD_BYTES },
});

const handleMulterArray = (req: Request, res: Response, next: NextFunction) => {
  uploadDisk.array("files", MAX_FILES_PER_UPLOAD)(req, res, (err: unknown) => {
    if (err) {
      if (err instanceof multer.MulterError && err.code === "LIMIT_FILE_SIZE") {
        return next(new AppError("Each file must be 100MB or smaller", 400));
      }
      if (err instanceof multer.MulterError && err.code === "LIMIT_UNEXPECTED_FILE") {
        return next(
          new AppError(`You can upload at most ${MAX_FILES_PER_UPLOAD} files at once`, 400),
        );
      }
      return next(err instanceof Error ? err : new AppError("Upload failed", 400));
    }
    next();
  });
};

PublicFileController.get(
  "/public/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { shareToken } = req.query;

    console.log("👉 [Controller] Hit /public/:id", id); 

    if (!shareToken) throw new AppError("Missing Token", 401);

    const result = await fileService.getFileDetailPublic(id as string, shareToken as string);
    res.json(result);
  })
);

PublicFileController.get(
  "/public/:id/download",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { shareToken } = req.query;

    if (!shareToken) throw new AppError("Missing Token", 401);

    await fileService.downloadPublicFile(id as string, shareToken as string, res);
  })
);

/**
 * POST /api/files/upload
 * multipart: files[], projectId, folderId?, userId, conflictStrategy? ("version" | "copy")
 * Files are validated via magic bytes, streamed from disk to R2 (no memory buffer of full file).
 */
FileController.post(
  "/upload",
  authenticate,
  handleMulterArray,
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError("No files uploaded", 400);
    }

    const { projectId, folderId } = req.body;
    const userId = req.userId?.toString();
    if (!projectId || !userId) {
      for (const f of files) await fs.unlink(f.path).catch(() => {});
      throw new AppError("projectId and authenticated user are required", 400);
    }

    const conflictStrategy = parseConflictStrategy(req.body.conflictStrategy);

    await fileService.assertIncomingUploadsFitProjectQuota(
      projectId,
      folderId,
      files.map((f) => ({
        sanitizedName: sanitizeUploadFileName(f.originalname),
        size: f.size,
      })),
      conflictStrategy,
    );

    const results: unknown[] = [];

    for (const file of files) {
      try {
        const sanitized = sanitizeUploadFileName(file.originalname);
        const detected = await fileTypeFromFilePath(file.path);
        const { mimeType } = validateUploadedFileContent(sanitized, detected);
        const storageKey = `${Date.now()}_${uuidv4()}_${sanitized.replace(/\s+/g, "_")}`;
        await uploadLocalFileToR2({
          localPath: file.path,
          key: storageKey,
          contentType: mimeType,
        });
        await fs.unlink(file.path).catch(() => {});
        const publicUrl = `https://${env.R2_PUBLIC_DOMAIN}/${storageKey}`;
        const doc = await fileService.handleFileUpload(
          {
            storageKey,
            originalname: sanitized,
            size: file.size,
            mimeType,
            location: publicUrl,
          },
          projectId,
          folderId,
          userId,
          conflictStrategy,
        );
        results.push(doc);
      } catch (e) {
        await fs.unlink(file.path).catch(() => {});
        throw e;
      }
    }

    const actor = actorFromReq(req);
    if (actor) {
      for (const doc of results as Array<{
        _id: unknown;
        name?: string;
        projectId?: unknown;
        folderId?: unknown;
      }>) {
        await logActivitySafe({
          projectId: doc.projectId
            ? projectIdToString(doc.projectId)
            : String(projectId),
          actor,
          actionGroup: "FILE",
          actionType: "UPLOAD",
          target: {
            itemId: String(doc._id),
            itemModel: "File",
            itemName: doc.name ?? "File",
          },
          description: `Uploaded file "${doc.name ?? "file"}"`,
          metaData: {
            folderId: doc.folderId ? projectIdToString(doc.folderId) : null,
          },
        });
      }
    }

    res.status(201).json(results);
  }),
);

/**
 * POST /api/files/:id/promote
 * Body: { targetStage: "SHARED" | "PUBLISHED", destinationFolderId?: string }
 * Shared→Published: optional destinationFolderId (folder under 3. Published).
 * ISO 19650: copies file (same storage) into destination stage; source unchanged.
 * To move into Archived, use folder/file move APIs to a folder under 4. Archived.
 */
FileController.post(
  "/:id/promote",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { targetStage, destinationFolderId } = req.body;
    if (!req.userId) throw new AppError("Unauthorized", 401);
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid file id", 400);
    }
    const stage = parsePromoteTargetStage(targetStage);
    if (!stage) {
      throw new AppError(
        "targetStage is required and must be SHARED or PUBLISHED",
        400,
      );
    }

    const destFolder =
      typeof destinationFolderId === "string" && destinationFolderId.length > 0
        ? destinationFolderId
        : undefined;

    const result = await filePromoteService.promoteFile(
      id,
      req.userId,
      stage,
      {
        fullName: (req.user as { fullName?: string })?.fullName ?? "User",
        email: (req.user as { email?: string })?.email,
      },
      destFolder
    );
    res.status(201).json({
      success: true,
      message: "File promoted (copy created in destination)",
      ...result,
    });
  }),
);

/**
 * POST /api/files/:id/submit-review
 * ISO 19650: Group Member in own WIP group submits owned file for review.
 */
FileController.post(
  "/:id/submit-review",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!req.userId) throw new AppError("Unauthorized", 401);
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid file id", 400);
    }

    const updated = await filePromoteService.submitForReview(id, req.userId);
    const actorSubmit = actorFromReq(req);
    if (actorSubmit && updated) {
      const pid = projectIdToString(updated.projectId);
      await logActivitySafe({
        projectId: pid,
        actor: actorSubmit,
        actionGroup: "FILE",
        actionType: "SUBMIT_FOR_REVIEW",
        target: {
          itemId: String(updated._id),
          itemModel: "File",
          itemName: updated.name,
        },
        description: `Submitted "${updated.name}" (v${updated.currentVersion}) for review`,
        metaData: { version: updated.currentVersion },
      });
    }
    res.status(200).json({
      success: true,
      message: "File submitted for review",
      result: updated,
    });
  }),
);

/**
 * GET /api/files?folderId=...
 * Query: { folderId }s)
 * Desc: Get files in a specific folder.
 */
FileController.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { folderId } = req.query;
    if (!folderId) throw new AppError("folderId is required", 400);

    const files = await fileService.getFilesInFolder(folderId as string);
    res.json(files);
  }),
);

FileController.get(
  "/all",
  asyncHandler(async (req: Request, res: Response) => {
    const files = await fileService.getAllFiles();
    res.json(files);
  }),
);

/**
 * PUT /api/files/:id/move
 * Body: { destinationFolderId: "..." }
 * Desc: Move file to another folder.
 */
FileController.put(
  "/:id/move",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { destinationFolderId } = req.body;
    const userId = req.userId?.toString();
    if (!userId) throw new AppError("Unauthorized", 401);

    const beforeMove = await FileModel.findById(id)
      .select("projectId name folderId")
      .lean();
    const result = await fileService.moveFile(id, destinationFolderId, userId);
    const actorMove = actorFromReq(req);
    if (actorMove && beforeMove) {
      await logActivitySafe({
        projectId: projectIdToString(beforeMove.projectId),
        actor: actorMove,
        actionGroup: "FILE",
        actionType: "MOVE",
        target: {
          itemId: id,
          itemModel: "File",
          itemName: beforeMove.name ?? "File",
        },
        description: `Moved file "${beforeMove.name}"`,
        metaData: {
          fromFolderId: beforeMove.folderId
            ? projectIdToString(beforeMove.folderId)
            : null,
          toFolderId: result.folderId
            ? projectIdToString(result.folderId)
            : null,
        },
      });
    }
    res.json(result);
  }),
);

/**
 * POST /api/files/move-bulk
 * Body: { fileIds: ["..."], destinationFolderId: "...", userId: "..." }
 * Desc: Move multiple files to a folder (All-or-Nothing logic).
 */
FileController.post(
  "/move-bulk",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { fileIds, destinationFolderId } = req.body;
    const userId = req.userId?.toString();
    if (!userId) throw new AppError("Unauthorized", 401);

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new AppError("fileIds must be a non-empty array", 400);
    }

    const beforeBulk = await FileModel.find({
      _id: { $in: fileIds },
      isDeleted: false,
    })
      .select("projectId name")
      .lean();
    const result = await fileService.moveManyFiles(
      fileIds,
      destinationFolderId,
      userId,
    );
    const actorBulk = actorFromReq(req);
    if (actorBulk && beforeBulk.length > 0) {
      const pid = projectIdToString(beforeBulk[0].projectId);
      await logActivitySafe({
        projectId: pid,
        actor: actorBulk,
        actionGroup: "FILE",
        actionType: "MOVE_BULK",
        target: {
          itemId: String(fileIds[0]),
          itemModel: "File",
          itemName: `${fileIds.length} file(s)`,
        },
        description: `Bulk moved ${fileIds.length} file(s)`,
        metaData: {
          fileIds,
          destinationFolderId: destinationFolderId ?? null,
          names: beforeBulk.map((f) => f.name),
        },
      });
    }
    res.json({
      success: true,
      message: "Moved successfully",
      data: result,
    });
  }),
);

/**
 * POST /api/files/:id/lock
 * Body: { action: "LOCK" | "UNLOCK" }
 * Desc: Lock or unlock a file.
 */
FileController.post(
  "/:id/lock",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action } = req.body;
    const userId = req.userId?.toString();
    if (!userId) throw new AppError("Unauthorized", 401);

    if (!["LOCK", "UNLOCK"].includes(action)) {
      throw new AppError("Invalid action. Must be LOCK or UNLOCK", 400);
    }

    const result = await fileService.toggleLock(id, userId, action);
    const actorLock = actorFromReq(req);
    if (actorLock && result) {
      await logActivitySafe({
        projectId: projectIdToString(result.projectId),
        actor: actorLock,
        actionGroup: "FILE",
        actionType: action === "LOCK" ? "LOCK" : "UNLOCK",
        target: {
          itemId: id,
          itemModel: "File",
          itemName: result.name,
        },
        description:
          action === "LOCK"
            ? `Checked out (locked) "${result.name}"`
            : `Checked in (unlocked) "${result.name}"`,
      });
    }
    res.json(result);
  }),
);

/**
 * DELETE /api/files/:id
 * Body: { userId }
 * Desc: Delete a file.
 */
FileController.delete(
  "/:id",
  authenticate,
  auditLog("FILE", "DELETE", (req, resBody) => ({
    itemId: req.params.id,
    itemName: resBody?.fileName || "File Deleted",
    itemModel: "File",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId?.toString();
    if (!userId) throw new AppError("Unauthorized", 401);

    const deletedFile = await fileService.deleteFile(id, userId);
    res.json({
      message: "File deleted successfully",
      projectId: deletedFile.projectId,
      fileName: deletedFile.name,
    });
  }),
);

/**
 * POST /api/files/bulk-lock
 * Body: { folderId: "...", action: "LOCK" | "UNLOCK", userId: "..." }
 * Desc: Lock or unlock all files in a folder.
 */
FileController.post(
  "/bulk-lock",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { folderId, action } = req.body;
    const userId = req.userId?.toString();
    if (!userId) throw new AppError("Unauthorized", 401);

    if (!["LOCK", "UNLOCK"].includes(action)) {
      throw new AppError("Invalid action", 400);
    }

    const result = await fileService.toggleLockMany(folderId, userId, action);
    const folderMeta = await FolderModel.findById(folderId)
      .select("projectId name")
      .lean();
    const actorFolderLock = actorFromReq(req);
    if (actorFolderLock && folderMeta) {
      await logActivitySafe({
        projectId: projectIdToString(folderMeta.projectId),
        actor: actorFolderLock,
        actionGroup: "FOLDER",
        actionType:
          action === "LOCK" ? "BULK_LOCK_FILES" : "BULK_UNLOCK_FILES",
        target: {
          itemId: folderId,
          itemModel: "Folder",
          itemName: folderMeta.name ?? "Folder",
        },
        description:
          action === "LOCK"
            ? `Locked files under folder "${folderMeta.name}"`
            : `Unlocked files under folder "${folderMeta.name}"`,
        metaData: { modifiedCount: result.modifiedCount },
      });
    }
    res.json(result);
  }),
);

/**
 * GET /api/files/download
 * Query: { id: "...", type: "file" | "folder" }
 * Desc: Download a file or folder.
 */
FileController.get(
  "/download",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id, type, version } = req.query;
    if (!id || !type) throw new AppError("Missing id or type", 400);

    const actor = actorFromReq(req);
    if (type === "file") {
      const versionNum = version ? parseInt(version as string) : undefined;
      const uid = req.userId?.toString();
      await fileService.downloadFile(
        id as string,
        res,
        versionNum,
        uid,
        actor ?? undefined,
      );
    } else if (type === "folder") {
      await fileService.downloadFolder(id as string, res, actor ?? undefined);
    } else {
      throw new AppError("Invalid type", 400);
    }
  }),
);

/**
 * PUT /api/files/:id/rename
 * Body: { name: "newName", userId: "..." }
 * Desc: Rename a file.
 */
FileController.put(
  "/:id/rename",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name } = req.body;

    if (!name) throw new AppError("New name is required", 400);

    // 1. Lấy file cũ để biết tên cũ
    const oldFile = await fileService.getFileDetail(id);
    const oldName = oldFile.name;

    // 2. Thực hiện Rename
    const uid = req.userId?.toString();
    if (!uid) throw new AppError("Unauthorized", 401);
    const updatedFile = await fileService.renameFile(id, name, uid);

    // 3. Ghi Log thủ công có MetaData
    await activityService.logActivity({
      projectId: updatedFile.projectId,
      actor: {
        userId: req.user!._id,
        fullName: req.user!.fullName,
        email: req.user!.email,
      },
      actionGroup: "FILE",
      actionType: "RENAME",
      target: {
        itemId: updatedFile._id,
        itemModel: "File",
        itemName: updatedFile.name, // Tên mới
      },
      description: `Renamed file from "${oldName}" to "${updatedFile.name}"`,
      metaData: {
        oldName: oldName,
        newName: updatedFile.name,
      },
    });

    res.json(updatedFile);
  }),
);

/**
 * POST /api/files/download-bulk
 * Body: { items: [{ id: "...", type: "file" | "folder" }], projectId: "..." }
 * Desc: Download multiple files/folders as a zip.
 */
FileController.post(
  "/download-bulk",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { items, projectId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError("No items selected", 400);
    }

    const actor = actorFromReq(req);
    await fileService.downloadBulk(
      items,
      projectId,
      res,
      actor ?? undefined,
    );
  }),
);

/**
 * POST /api/files/bulk-tags
 * Body: { fileIds: ["..."], tagIds: ["..."] }
 * Desc: Assign tags to multiple files.
 */
FileController.post(
  "/bulk-tags",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { fileIds, tagIds } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new AppError("No files selected", 400);
    }
    // tagIds can be empty if we want to clear tags, but usually we just replace.
    // Let's assume this is a SET operation (replace existing tags).
    // Or it could be ADD.
    // Based on "Add tags", usually it's merge, but "Manage tags" implies setting the state.
    // Trimble Connect usually has check boxes. If you uncheck, it removes. So it's a SET operation.

    const result = await fileService.assignTags(fileIds, tagIds || []);
    const actorTags = actorFromReq(req);
    if (actorTags && Array.isArray(result) && result.length > 0) {
      for (const f of result as Array<{
        _id: unknown;
        name: string;
        projectId: unknown;
      }>) {
        await logActivitySafe({
          projectId: projectIdToString(f.projectId),
          actor: actorTags,
          actionGroup: "FILE",
          actionType: "TAG_SET",
          target: {
            itemId: String(f._id),
            itemModel: "File",
            itemName: f.name,
          },
          metaData: { tagIds: tagIds || [] },
        });
      }
    }
    res.json(result);
  }),
);

FileController.post(
  "/:id/restore",
  authenticate,
  auditLog("FILE", "RESTORE", (req, resBody) => ({
    itemId: req.params.id,
    itemName: resBody?.fileName || "File Restored",
    itemModel: "File",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const userId = req.userId?.toString();
    if (!userId) throw new AppError("Unauthorized", 401);
    const restoredFile = await fileService.restoreFile(id, userId);
    res.json({
      message: "File restored successfully",
      projectId: restoredFile.projectId,
      fileName: restoredFile.name,
    });
  }),
);

/**
 * GET /api/files/stats/storage?projectId=...
 * Desc: Get total storage used (bytes) for dashboard storage bar.
 */
FileController.get(
  "/stats/storage",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.query;
    if (!projectId) throw new AppError("projectId is required", 400);
    const totalBytes = await fileService.getProjectStorageUsed(projectId as string);
    res.json({
      totalBytes,
      limitBytes: PROJECT_STORAGE_LIMIT_BYTES,
    });
  }),
);

/**
 * GET /api/files/stats/file-types?projectId=...
 * Desc: Get file type distribution (by extension) for dashboard pie chart.
 */
FileController.get(
  "/stats/file-types",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.query;
    if (!projectId) throw new AppError("projectId is required", 400);
    const stats = await fileService.getFileTypeStats(projectId as string);
    res.json(stats);
  }),
);

/**
 * GET /api/files/:id/publish-readiness
 * ISO: automatic checklist before Shared→Published (todos, topics, version).
 */
FileController.get(
  "/:id/publish-readiness",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    if (!req.userId) throw new AppError("Unauthorized", 401);
    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid file id", 400);
    }
    const result = await filePromoteService.getPublishReadiness(
      id,
      req.userId,
    );
    res.json(result);
  }),
);

/**
 * GET /api/files/:id
 * Desc: Get details of a specific file.
 * NOTE: MUST be AFTER /:id/detail
 */
FileController.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) {
      throw new AppError("Invalid File ID", 400);
    }

    const file = await fileService.getFileDetail(id);
    console.log("🔥🔥🔥 HIT GET FILE DETAIL", id);

    res.json(file);
  }),
);

export { FileController };

// bimcde-be\src\modules\file\controllers\file.controller.ts