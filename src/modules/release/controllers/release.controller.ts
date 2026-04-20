import express, { Request, Response } from "express";
import ReleaseService from "../services/release.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { auditLog } from "../../../middlewares/auditLog.middleware";
import { authenticate } from "../../../middlewares/authMiddlewares";

const ReleaseController = express.Router();
const releaseService = new ReleaseService();

// GET /api/releases?projectId=...
ReleaseController.get(
  "/",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId, status, userIds, dueStartDate, dueEndDate } = req.query;
    if (!projectId) throw new AppError("Project ID is required", 400);

    const user = (req as any).user;
    const normalizedStatus =
      status === "SENT" ? "RELEASED" : (status as string | undefined);
    const releases = await releaseService.getReleases(
      projectId as string,
      {
        status: normalizedStatus,
        userIds: userIds as string,
        dueStartDate: dueStartDate as string,
        dueEndDate: dueEndDate as string,
      },
      user,
    );
    res.json(releases);
  }),
);

// GET /api/releases/:id
ReleaseController.get(
  "/:id",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const release = await releaseService.getReleaseById(
      req.params.id,
      user._id.toString(),
    );
    res.json(release);
  }),
);

// POST /api/releases (Create Draft)
ReleaseController.post(
  "/",
  authenticate,
  // AUTO LOG
  auditLog("RELEASE", "CREATE", (req, resBody) => ({
    itemId: resBody._id,
    itemName: resBody.name,
    itemModel: "Release",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    // req.body: { projectId, name, items: [{fileId, version}], dueDate, description? }
    const newRelease = await releaseService.createRelease(
      req.body,
      user._id.toString(),
    );
    res.status(201).json(newRelease);
  }),
);

// DELETE /api/releases (Delete Release)
ReleaseController.delete(
  "/:id",
  authenticate,
  auditLog("RELEASE", "DELETE", (req, resBody) => ({
    itemId: req.params.id,
    itemName: "Release Deleted",
    itemModel: "Release",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    await releaseService.deleteRelease(req.params.id, user);
    res.json({ message: "Release deleted successfully" });
  }),
);

// PUT /api/releases/:id (Update Draft)
ReleaseController.put(
  "/:id",
  authenticate,
  auditLog("RELEASE", "UPDATE", (req, resBody) => ({
    itemId: resBody._id,
    itemName: resBody.name,
    itemModel: "Release",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const updated = await releaseService.updateRelease(
      req.params.id,
      req.body,
      user,
    );
    res.json(updated);
  }),
);

// POST /api/releases/:id/release (Draft → Released)
ReleaseController.post(
  "/:id/release",
  authenticate,
  auditLog("RELEASE", "RELEASE", (req, resBody) => ({
    itemId: req.params.id,
    itemName: resBody.name || "Release published",
    itemModel: "Release",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const finalized = await releaseService.finalizeRelease(req.params.id, user);
    res.json(finalized);
  }),
);

// GET /api/releases/:id/download
ReleaseController.get(
  "/:id/download",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    await releaseService.downloadRelease(
      req.params.id,
      res,
      user._id.toString(),
    );
  }),
);

// DELETE /api/releases/:id/items (Bulk remove items)
ReleaseController.delete(
  "/:id/items",
  authenticate,
  auditLog("RELEASE", "ITEMS_REMOVE_BULK", (req, resBody) => ({
    itemId: req.params.id,
    itemName: "Bulk Remove Items from Release",
    itemModel: "Release",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const { fileIds } = req.body; // Expecting { fileIds: string[] }
    
    if (!fileIds || !Array.isArray(fileIds) || fileIds.length === 0) {
       throw new AppError("fileIds array is required", 400);
    }

    const updatedRelease = await releaseService.removeItemsFromRelease(
      req.params.id,
      fileIds,
      user,
    );
    res.json(updatedRelease);
  }),
);

// DELETE /api/releases/:id/items/:fileId (Remove item from Release)
ReleaseController.delete(
  "/:id/items/:fileId",
  authenticate,
  auditLog("RELEASE", "ITEM_REMOVE", (req, resBody) => ({
    itemId: req.params.id,
    itemName: "Remove Item from Release",
    itemModel: "Release",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const updatedRelease = await releaseService.removeItemFromRelease(
      req.params.id,
      req.params.fileId,
      user,
    );
    res.json(updatedRelease);
  }),
);

export { ReleaseController };
