import express, { Request, Response } from "express";
import ClashService from "../services/clash.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { AppError } from "../../../utils/AppError";
import { authenticate } from "../../../middlewares/authMiddlewares";
import ClashModel from "../schemas/clash.schemas";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";

const ClashController = express.Router();
const clashService = new ClashService();

/**
 * GET /api/clash-sets?projectId=...
 */
ClashController.get(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { projectId } = req.query;
        if (!projectId) throw new AppError("Project ID is required", 400);
        const data = await clashService.getAll(projectId as string);
        res.json(data);
    })
);

/**
 * GET /api/clash-sets/:id
 */
ClashController.get(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const data = await clashService.getById(id);
        res.json(data);
    })
);

/**
 * POST /api/clash-sets
 */
ClashController.post(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId?.toString() as string;
        const newData = await clashService.create(req.body, userId);
        const actor = actorFromReq(req);
        if (actor && newData?._id && newData.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(newData.projectId),
                actor,
                actionGroup: "CLASH",
                actionType: "CREATE",
                target: {
                    itemId: String(newData._id),
                    itemModel: "ClashSet",
                    itemName: newData.name ?? "Clash set",
                },
                description: `Created clash set "${newData.name ?? ""}"`,
            });
        }
        res.status(201).json(newData);
    })
);

/**
 * PATCH /api/clash-sets/:id
 */
ClashController.patch(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const updatedData = await clashService.update(id, req.body);
        const actor = actorFromReq(req);
        if (actor && updatedData?._id && updatedData.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(updatedData.projectId),
                actor,
                actionGroup: "CLASH",
                actionType: "UPDATE",
                target: {
                    itemId: String(updatedData._id),
                    itemModel: "ClashSet",
                    itemName: updatedData.name ?? "Clash set",
                },
                description: `Updated clash set "${updatedData.name ?? ""}"`,
                metaData: { keys: Object.keys(req.body ?? {}) },
            });
        }
        res.json(updatedData);
    })
);

/**
 * DELETE /api/clash-sets/:id
 */
ClashController.delete(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const existing = await ClashModel.findById(id).lean();
        await clashService.delete(id);
        const actor = actorFromReq(req);
        if (actor && existing?._id && existing.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(existing.projectId),
                actor,
                actionGroup: "CLASH",
                actionType: "DELETE",
                target: {
                    itemId: String(existing._id),
                    itemModel: "ClashSet",
                    itemName: (existing as { name?: string }).name ?? "Clash set",
                },
                description: `Deleted clash set "${(existing as { name?: string }).name ?? ""}"`,
            });
        }
        res.json({ message: "Clash set deleted successfully" });
    })
);

export default ClashController;