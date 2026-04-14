import express, { Request, Response } from "express";
import ViewService from "../services/view.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";
import View3DModel from "../schemas/view.schemas";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";

const ViewController3d = express.Router();
const viewService = new ViewService();

/**
 * GET /api/views3d?projectId=...
 */
ViewController3d.get(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { projectId, userIds, groupIds, startDate, endDate } = req.query;
        if (!projectId) throw new AppError("Project ID is required", 400);
        const views = await viewService.getAllViews(projectId as string, {
            userIds: userIds as string,
            groupIds: groupIds as string,
            startDate: startDate as string,
            endDate: endDate as string
        });
        res.json(views);
    })
);

/**
 * POST /api/views
 */
ViewController3d.post(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId;
        const viewData = { ...req.body, createdBy: userId };
        const newView = await viewService.create(viewData);
        const actor = actorFromReq(req);
        if (actor && newView?._id && newView.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(newView.projectId),
                actor,
                actionGroup: "VIEW",
                actionType: "CREATE",
                target: {
                    itemId: String(newView._id),
                    itemModel: "View",
                    itemName: String((newView as { title?: string }).title ?? "View"),
                },
                description: `Created 3D view "${String((newView as { title?: string }).title ?? "")}"`,
            });
        }
        res.status(201).json(newView);
    })
);

/**
 * PATCH /api/views/:id (Update Info Text)
 */
ViewController3d.patch(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = req.userId?.toString() as string;
        const updatedView = await viewService.updateViewInfo(id, req.body, userId);
        const actor = actorFromReq(req);
        if (actor && updatedView?._id && updatedView.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(updatedView.projectId),
                actor,
                actionGroup: "VIEW",
                actionType: "UPDATE",
                target: {
                    itemId: String(updatedView._id),
                    itemModel: "View",
                    itemName: String((updatedView as { title?: string }).title ?? "View"),
                },
                description: "Updated 3D view metadata",
            });
        }
        res.json(updatedView);
    })
);

/**
 * PUT /api/views/:id/snapshot (Update 3D State)
 */
ViewController3d.put(
    "/:id/snapshot",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = req.userId?.toString() as string;
        // Body should contain { viewState, items }
        const updatedView = await viewService.updateSnapshot(id, req.body, userId);
        const actor = actorFromReq(req);
        if (actor && updatedView?._id && updatedView.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(updatedView.projectId),
                actor,
                actionGroup: "VIEW",
                actionType: "SNAPSHOT_UPDATE",
                target: {
                    itemId: String(updatedView._id),
                    itemModel: "View",
                    itemName: String((updatedView as { title?: string }).title ?? "View"),
                },
                description: "Updated 3D view snapshot/state",
            });
        }
        res.json(updatedView);
    })
);

/**
 * DELETE /api/views/:id
 */
ViewController3d.delete(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const userId = req.userId?.toString() as string;
        const existing = await View3DModel.findById(id).lean();
        await viewService.deleteView(id, userId);
        const actor = actorFromReq(req);
        if (actor && existing?._id && existing.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(existing.projectId),
                actor,
                actionGroup: "VIEW",
                actionType: "DELETE",
                target: {
                    itemId: String(existing._id),
                    itemModel: "View",
                    itemName: String((existing as { title?: string }).title ?? "View"),
                },
                description: "Deleted 3D view",
            });
        }
        res.json({ message: "View deleted successfully" });
    })
);

export default ViewController3d;