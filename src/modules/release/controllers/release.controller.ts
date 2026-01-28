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
    const { projectId, status, userIds, groupIds, dueStartDate, dueEndDate } =
      req.query;
    if (!projectId) throw new AppError("Project ID is required", 400);

    const user = (req as any).user;
    const releases = await releaseService.getReleases(
      projectId as string,
      {
        status: status as string,
        userIds: userIds as string,
        groupIds: groupIds as string,
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
    const release = await releaseService.getReleaseById(req.params.id);
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
    // req.body cần: { projectId, name, items: [{fileId, version}], recipients }
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

// POST /api/releases/:id/send (Official Release)
ReleaseController.post(
  "/:id/send",
  authenticate,
  auditLog("RELEASE", "SEND", (req, resBody) => ({
    itemId: req.params.id,
    itemName: resBody.name || "Release Sent",
    itemModel: "Release",
  })),
  asyncHandler(async (req: Request, res: Response) => {
    const user = (req as any).user;
    const sentRelease = await releaseService.sendRelease(req.params.id, user);
    res.json(sentRelease);
  }),
);

// GET /api/releases/:id/download
ReleaseController.get(
  "/:id/download",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await releaseService.downloadRelease(req.params.id, res);
  }),
);

// DELETE /api/releases/:id/items/:fileId (Remove item from Release)
ReleaseController.delete(
  "/:id/items/:fileId",
  authenticate,
  auditLog("RELEASE", "UPDATE", (req, resBody) => ({
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
