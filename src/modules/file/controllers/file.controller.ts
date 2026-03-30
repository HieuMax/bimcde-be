import express, { Request, Response, NextFunction } from "express";
import multer from "multer";
import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import os from "os";
import { v4 as uuidv4 } from "uuid";
import { env } from "../../../env";
import FileService from "../services/file.service";
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
import { auditLog } from "../../../middlewares/auditLog.middleware"; // Import Middleware
import { authenticate } from "../../../middlewares/authMiddlewares";
import ActivityService from "../../activity/services/activity.service";

const PublicFileController = express.Router();
const FileController = express.Router();
const fileService = new FileService();
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
  handleMulterArray,
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      throw new AppError("No files uploaded", 400);
    }

    const { projectId, folderId, userId } = req.body;
    if (!projectId || !userId) {
      for (const f of files) await fs.unlink(f.path).catch(() => {});
      throw new AppError("projectId and userId are required", 400);
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

    res.status(201).json(results);
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
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { destinationFolderId, userId } = req.body;

    const result = await fileService.moveFile(id, destinationFolderId, userId);
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
  asyncHandler(async (req: Request, res: Response) => {
    const { fileIds, destinationFolderId, userId } = req.body;

    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
      throw new AppError("fileIds must be a non-empty array", 400);
    }

    const result = await fileService.moveManyFiles(
      fileIds,
      destinationFolderId,
      userId,
    );

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
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { action, userId } = req.body;

    if (!["LOCK", "UNLOCK"].includes(action)) {
      throw new AppError("Invalid action. Must be LOCK or UNLOCK", 400);
    }

    const result = await fileService.toggleLock(id, userId, action);
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
    const userId = req.userId?.toString() || req.body.userId;

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
  asyncHandler(async (req: Request, res: Response) => {
    const { folderId, action, userId } = req.body;

    if (!["LOCK", "UNLOCK"].includes(action)) {
      throw new AppError("Invalid action", 400);
    }

    const result = await fileService.toggleLockMany(folderId, userId, action);
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
  asyncHandler(async (req: Request, res: Response) => {
    const { id, type, version } = req.query;
    if (!id || !type) throw new AppError("Missing id or type", 400);

    if (type === "file") {
      // Chuyển version sang number nếu có
      const versionNum = version ? parseInt(version as string) : undefined;
      await fileService.downloadFile(id as string, res, versionNum);
    } else if (type === "folder") {
      await fileService.downloadFolder(id as string, res);
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
    const { name, userId } = req.body;

    if (!name) throw new AppError("New name is required", 400);

    // 1. Lấy file cũ để biết tên cũ
    const oldFile = await fileService.getFileDetail(id);
    const oldName = oldFile.name;

    // 2. Thực hiện Rename
    const updatedFile = await fileService.renameFile(id, name, userId);

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
  asyncHandler(async (req: Request, res: Response) => {
    const { items, projectId } = req.body;

    if (!items || !Array.isArray(items) || items.length === 0) {
      throw new AppError("No items selected", 400);
    }

    await fileService.downloadBulk(items, projectId, res);
  }),
);

/**
 * POST /api/files/bulk-tags
 * Body: { fileIds: ["..."], tagIds: ["..."] }
 * Desc: Assign tags to multiple files.
 */
FileController.post(
  "/bulk-tags",
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
    const userId = req.userId?.toString() || req.body.userId;
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