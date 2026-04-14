import express, { Request, Response } from "express";
import Topic3DService from "../services/topic3d.service";
import { asyncHandler } from "../../../utils/asyncHandler";
import { authenticate } from "../../../middlewares/authMiddlewares";
import Topic3DModel from "../schemas/topic3d.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";

const Topic3DController = express.Router();
const topic3dService = new Topic3DService();

Topic3DController.get(
    "/project/:projectId",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        console.log("📥 [POST /topic3d] Body nhận được từ FE:", req.body);
        
        const { projectId } = req.params;
        const { status, search } = req.query;
        const topics = await topic3dService.getTopics3DByProject(projectId, { status, search });
        res.json(topics);
    })
);

Topic3DController.post(
    "/",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId;
        const topicData = { ...req.body, createdBy: userId };
        const newTopic = await topic3dService.createTopic3D(topicData);
        const actor = actorFromReq(req);
        if (actor && newTopic?._id && newTopic.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(newTopic.projectId),
                actor,
                actionGroup: "TOPIC",
                actionType: "CREATE",
                target: {
                    itemId: String(newTopic._id),
                    itemModel: "Topic",
                    itemName: String(newTopic.title ?? "Topic"),
                },
                description: `Created 3D topic "${String(newTopic.title ?? "")}"`,
            });
        }
        res.status(201).json(newTopic);
    })
);

Topic3DController.post(
    "/:id/snapshots",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId?.toString() as string;
        const { id } = req.params;
        const updatedTopic = await topic3dService.addSnapshot(id, req.body, userId);
        const actor = actorFromReq(req);
        if (actor && updatedTopic?._id && updatedTopic.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(updatedTopic.projectId),
                actor,
                actionGroup: "TOPIC",
                actionType: "SNAPSHOT_ADD",
                target: {
                    itemId: String(updatedTopic._id),
                    itemModel: "Topic",
                    itemName: String(updatedTopic.title ?? "Topic"),
                },
                description: "Added 3D topic snapshot",
            });
        }
        res.json(updatedTopic);
    })
);

Topic3DController.patch(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const userId = req.userId?.toString() as string;
        const { id } = req.params;
        const updateTopic = await topic3dService.updateTopic(id, req.body, userId);
        const actor = actorFromReq(req);
        if (actor && updateTopic?._id && updateTopic.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(updateTopic.projectId),
                actor,
                actionGroup: "TOPIC",
                actionType: "UPDATE",
                target: {
                    itemId: String(updateTopic._id),
                    itemModel: "Topic",
                    itemName: String(updateTopic.title ?? "Topic"),
                },
                description: "Updated 3D topic",
                metaData: { fields: Object.keys(req.body ?? {}) },
            });
        }
        res.json(updateTopic);
    })
)

Topic3DController.delete(
    "/:id",
    authenticate,
    asyncHandler(async (req: Request, res: Response) => {
        const { id } = req.params;
        const existing = await Topic3DModel.findById(id).lean();
        await topic3dService.deleteTopic(id);
        const actor = actorFromReq(req);
        if (actor && existing?._id && existing.projectId) {
            await logActivitySafe({
                projectId: projectIdToString(existing.projectId),
                actor,
                actionGroup: "TOPIC",
                actionType: "DELETE",
                target: {
                    itemId: String(existing._id),
                    itemModel: "Topic",
                    itemName: String((existing as { title?: string }).title ?? "Topic"),
                },
                description: "Deleted 3D topic",
            });
        }
        res.json({ message: "Topic deleted successfully" });
    })
);

export default Topic3DController;