import express, { Request, Response } from "express";
import multer from "multer";
import multerS3 from "multer-s3";
import { s3Client } from "../../../lib/r2.lib"; // Import client ở bước 1
import { env } from "../../../env";
import FileService from "../services/file.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { Types } from "mongoose";

const FileController = express.Router();
const fileService = new FileService();

// Multer configuration for R2
const upload = multer({
  storage: multerS3({
    s3: s3Client,
    bucket: env.R2_BUCKET_NAME || "bimbucket",
    contentType: multerS3.AUTO_CONTENT_TYPE,
    metadata: function (req, file, cb) {
      cb(null, { fieldName: file.fieldname });
    },
    key: function (req, file, cb) {
      const uniqueName = `${Date.now()}_${file.originalname}`;
      cb(null, uniqueName);
    },
  }),
});

/**
 * POST /api/files/upload
 * Query Files: files (array of files)
 * Desc: Upload multiple files to a project/folder.
 */
FileController.post(
  "/upload",
  upload.array("files"),
  asyncHandler(async (req: Request, res: Response) => {
    const files = req.files as Express.MulterS3.File[];

    if (!files || files.length === 0) {
      throw new AppError("No files uploaded", 400);
    }

    const { projectId, folderId, userId } = req.body;

    const results = await Promise.all(
      files.map((file) =>
        fileService.handleFileUpload(file, projectId, folderId, userId)
      )
    );

    res.status(201).json(results);
  })
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
  })
);

FileController.get(
  "/all",
  asyncHandler(async (req: Request, res: Response) => {
    const files = await fileService.getAllFiles();
    res.json(files);
  })
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
  })
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
      userId
    );

    res.json({
      success: true,
      message: "Moved successfully",
      data: result,
    });
  })
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
  })
);

/**
 * DELETE /api/files/:id
 * Body: { userId }
 * Desc: Delete a file.
 */
FileController.delete(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { userId } = req.body;

    await fileService.deleteFile(id, userId);
    res.json({ message: "File deleted successfully" });
  })
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
  })
);

/**
 * GET /api/files/download
 * Query: { id: "...", type: "file" | "folder" }
 * Desc: Download a file or folder.
 */
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

/**
 * PUT /api/files/:id/rename
 * Body: { name: "newName", userId: "..." }
 * Desc: Rename a file.
 */
FileController.put(
  "/:id/rename",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const { name, userId } = req.body;

    if (!name) throw new AppError("New name is required", 400);

    const updatedFile = await fileService.renameFile(id, name, userId);
    res.json(updatedFile);
  })
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
  })
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
  })
);

FileController.post(
  "/:id/views",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params; // File ID
    const { userId, ...bodyData } = req.body;

    const result = await fileService.createView({
      ...bodyData,
      fileId: id,
      userId: userId
    });

    res.status(201).json({ success: true, data: result });
  })
);

/**
 * GET /api/files/:id/views
 * Desc: Get all views of a specific file
 */
FileController.get(
  "/:id/views",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;
    const views = await fileService.getViews(id);
    res.json({ success: true, data: views });
  })
);

/**
 * GET /api/files/views/:viewId
 * Desc: Get detail of a specific view
 * Note: Route này hơi khác pattern /:id/views, cẩn thận kẻo trùng với /:id của file
 * Cách tốt nhất: dùng prefix rõ ràng
 */
FileController.get(
  "/views/:viewId",
  asyncHandler(async (req: Request, res: Response) => {
    const { viewId } = req.params;
    const view = await fileService.getViewDetail(viewId);
    res.json({ success: true, data: view });
  })
);

/**
 * DELETE /api/files/views/:viewId
 * Body: { userId }
 * Desc: Delete a view
 */
FileController.delete(
  "/views/:viewId",
  asyncHandler(async (req: Request, res: Response) => {
    const { viewId } = req.params;
    const { userId } = req.body;
    
    await fileService.deleteView(viewId, userId);
    res.json({ success: true, message: "View deleted" });
  })
);

/**
 * GET /api/files/:id
 * Desc: Get details of a specific file.
 * NOTE: Place this AFTER /download and /all routes to avoid conflict.
 */
FileController.get(
  "/:id",
  asyncHandler(async (req: Request, res: Response) => {
    const { id } = req.params;

    if (!Types.ObjectId.isValid(id)) throw new AppError("Invalid File ID", 400);

    const file = await fileService.getFileDetail(id);
    res.json(file);
  })
);



export { FileController };
