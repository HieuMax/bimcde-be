import express, { Request, Response } from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { Types } from "mongoose";

import { s3Client } from "../../../lib/r2.lib";
import { env } from "../../../env";
import FileService from "../services/file.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";

const FileController = express.Router();
const fileService = new FileService();

/* =========================
   Multer (R2 Upload)
========================= */
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: env.R2_BUCKET_NAME || "bimbucket",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    key: (_, file, cb) => {
      cb(null, `${Date.now()}_${file.originalname}`);
    },
  }),
});

/* =========================
   Helpers
========================= */
const validateObjectId = (id: string) => {
  if (!Types.ObjectId.isValid(id)) {
    throw new AppError("Invalid ID", 400);
  }
};

/* =========================
   Upload & Query
========================= */

/**
 * POST /api/files/upload
 */
FileController.post(
  "/upload",
  upload.array("files"),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.MulterS3.File[];
    if (!files?.length) throw new AppError("No files uploaded", 400);

    const { projectId, folderId, userId } = req.body;

    const result = await Promise.all(
      files.map((file) =>
        fileService.handleFileUpload(file, projectId, folderId, userId)
      )
    );

    res.status(201).json({ success: true, data: result });
  })
);

/**
 * GET /api/files?folderId=...
 */
FileController.get(
  "/",
  asyncHandler(async (req: Request, res: Response) => {
    const { folderId } = req.query;
    if (!folderId) throw new AppError("folderId is required", 400);

    const files = await fileService.getFilesInFolder(folderId as string);
    res.json({ success: true, data: files });
  })
);

/**
 * GET /api/files/all
 */
FileController.get(
  "/all",
  asyncHandler(async (_: Request, res: Response) => {
    const files = await fileService.getAllFiles();
    res.json({ success: true, data: files });
  })
);

/* =========================
   Bulk operations
========================= */

FileController.post(
  "/move-bulk",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileIds, destinationFolderId, userId } = req.body;
    if (!Array.isArray(fileIds) || !fileIds.length) {
      throw new AppError("fileIds must be a non-empty array", 400);
    }

    const result = await fileService.moveManyFiles(
      fileIds,
      destinationFolderId,
      userId
    );

    res.json({ success: true, data: result });
  })
);

FileController.post(
  "/bulk-lock",
  asyncHandler(async (req: Request, res: Response) => {
    const { folderId, action, userId } = req.body;
    if (!["LOCK", "UNLOCK"].includes(action)) {
      throw new AppError("Invalid action", 400);
    }

    const result = await fileService.toggleLockMany(folderId, userId, action);
    res.json({ success: true, data: result });
  })
);

FileController.post(
  "/bulk-tags",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileIds, tagIds } = req.body;
    if (!Array.isArray(fileIds) || !fileIds.length) {
      throw new AppError("fileIds must be a non-empty array", 400);
    }

    const result = await fileService.assignTags(fileIds, tagIds || []);
    res.json({ success: true, data: result });
  })
);

/* =========================
   Download
========================= */

FileController.get(
  "/download",
  asyncHandler(async (req: Request, res: Response) => {
    const { id, type } = req.query;
    if (!id || !type) throw new AppError("Missing id or type", 400);

    if (type === "file") {
      await fileService.downloadFile(id as string, res);
    } else if (type === "folder") {
      await fileService.downloadFolder(id as string, res);
    } else {
      throw new AppError("Invalid type", 400);
    }
  })
);

FileController.post(
  "/download-bulk",
  asyncHandler(async (req: Request, res: Response) => {
    const { items, projectId } = req.body;
    if (!Array.isArray(items) || !items.length) {
      throw new AppError("No items selected", 400);
    }

    await fileService.downloadBulk(items, projectId, res);
  })
);


/* =========================
   File by ID
========================= */

FileController.put(
  "/:fileId/move",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { destinationFolderId, userId } = req.body;
    validateObjectId(fileId);

    const result = await fileService.moveFile(
      fileId,
      destinationFolderId,
      userId
    );
    res.json({ success: true, data: result });
  })
);

FileController.post(
  "/:fileId/lock",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { action, userId } = req.body;
    validateObjectId(fileId);

    if (!["LOCK", "UNLOCK"].includes(action)) {
      throw new AppError("Invalid action", 400);
    }

    const result = await fileService.toggleLock(fileId, userId, action);
    res.json({ success: true, data: result });
  })
);

FileController.put(
  "/:fileId/rename",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { name, userId } = req.body;
    validateObjectId(fileId);

    if (!name) throw new AppError("New name is required", 400);

    const file = await fileService.renameFile(fileId, name, userId);
    res.json({ success: true, data: file });
  })
);

FileController.delete(
  "/:fileId",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    const { userId } = req.body;
    validateObjectId(fileId);

    await fileService.deleteFile(fileId, userId);
    res.json({ success: true });
  })
);

FileController.get(
  "/:fileId",
  asyncHandler(async (req: Request, res: Response) => {
    const { fileId } = req.params;
    validateObjectId(fileId);

    const file = await fileService.getFileDetail(fileId);
    if (!file) throw new AppError("File not found", 404);

    res.json({ success: true, data: file });
  })
);

export { FileController };
