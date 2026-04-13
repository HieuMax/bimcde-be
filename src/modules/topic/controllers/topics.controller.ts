import { Request, Response } from "express";
import express from "express";
import { authenticate } from "../../../middlewares/authMiddlewares";
import { asyncHandler } from "../../../utils/asyncHandler";
import TopicsService from "../services/topics.services";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";

const TopicsController = express.Router();
const topicsService = new TopicsService();

// Update a topic
TopicsController.put(
  "/update/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const updateData = req.body;
      const result = await topicsService.updateTopic(
        req.userId,
        projectId,
        updateData,
      );
      const actor = actorFromReq(req);
      if (actor) {
        await logActivitySafe({
          projectId,
          actor,
          actionGroup: "TOPIC",
          actionType: "SETTINGS_UPDATE",
          target: {
            itemId: projectId,
            itemModel: "Project",
            itemName: "Topic type/status/priority configuration",
          },
          description: "Updated project topic configuration (types, statuses, priorities)",
        });
      }
      res.status(200).json({
        success: true,
        message: "Topic updated successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error updating topic",
        error: error.message,
      });
    }
  },
);

// Get all topics for a project
TopicsController.get(
  "/getAll/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await topicsService.getAllTopics(req.userId, projectId);
      res.status(200).json({
        success: true,
        message: "All topics retrieved successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error retrieving all topics",
        error: error.message,
      });
    }
  },
);

// Create a new topic item
TopicsController.post(
  "/items/create/:projectId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const payload = req.body;
    const result = await topicsService.createTopicItem(
      req.userId,
      projectId,
      payload,
    );
    const actor = actorFromReq(req);
    if (actor && result && (result as { _id?: unknown })._id) {
      const r = result as unknown as {
        _id: unknown;
        projectId: unknown;
        title?: string;
        code?: string;
      };
      await logActivitySafe({
        projectId: projectIdToString(r.projectId),
        actor,
        actionGroup: "TOPIC",
        actionType: "CREATE",
        target: {
          itemId: String(r._id),
          itemModel: "Topic",
          itemName: String(r.title ?? r.code ?? "Topic"),
        },
        description: `Created topic "${String(r.title ?? "")}"`,
      });
    }
    res.status(201).json({
      success: true,
      message: "Topic created successfully",
      result,
    });
  }),
);

// Update a topic item
TopicsController.put(
  "/items/:topicItemId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId } = req.params;
    const payload = req.body;
    const result = await topicsService.updateTopicItem(
      req.userId,
      topicItemId,
      payload,
    );
    const actor = actorFromReq(req);
    if (actor && result && (result as { _id?: unknown })._id) {
      const r = result as unknown as {
        _id: unknown;
        projectId: unknown;
        title?: string;
        code?: string;
      };
      await logActivitySafe({
        projectId: projectIdToString(r.projectId),
        actor,
        actionGroup: "TOPIC",
        actionType: "UPDATE",
        target: {
          itemId: String(r._id),
          itemModel: "Topic",
          itemName: String(r.title ?? "Topic"),
        },
        description: `Updated topic "${String(r.title ?? "")}"`,
        metaData: { fields: Object.keys(payload ?? {}) },
      });
    }
    res.status(200).json({
      success: true,
      message: "Topic updated successfully",
      result,
    });
  }),
);

// Get all topic instances (BCF topics)
TopicsController.get(
  "/items/getAll/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { projectId } = req.params;
      const result = await topicsService.getAllTopicItems(
        req.userId,
        projectId,
      );
      res.status(200).json({
        success: true,
        message: "Topic items retrieved successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error retrieving topic items",
        error: error.message,
      });
    }
  },
);

TopicsController.post(
  "/items/:topicItemId/attachments",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId } = req.params;
    const { attachments } = req.body;
    const result = await topicsService.addTopicAttachments(
      req.userId,
      topicItemId,
      attachments,
    );

    const actor = actorFromReq(req);
    if (actor && result?.projectId) {
      await logActivitySafe({
        projectId: projectIdToString(result.projectId),
        actor,
        actionGroup: "TOPIC",
        actionType: "ATTACHMENTS_ADD",
        target: {
          itemId: String(result._id),
          itemModel: "Topic",
          itemName: String(result.title ?? "Topic"),
        },
        description: "Added topic attachment(s)",
        metaData: {
          count: Array.isArray(attachments) ? attachments.length : 0,
        },
      });
    }

    res.status(200).json({
      success: true,
      message: "Topic attachments added successfully",
      result,
    });
  }),
);

TopicsController.delete(
  "/items/:topicItemId/attachments",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const { topicItemId } = req.params;
      const { url } = req.body ?? {};

      const result = url
        ? await topicsService.removeTopicAttachment(
            req.userId,
            topicItemId,
            url,
          )
        : await topicsService.removeAllTopicAttachments(req.userId, topicItemId);

      const actor = actorFromReq(req);
      if (actor && result && (result as { projectId?: unknown }).projectId) {
        const r = result as unknown as {
          _id?: unknown;
          projectId: unknown;
          title?: string;
        };
        await logActivitySafe({
          projectId: projectIdToString(r.projectId),
          actor,
          actionGroup: "TOPIC",
          actionType: url ? "ATTACHMENT_REMOVE" : "ATTACHMENTS_CLEAR",
          target: {
            itemId: String(r._id ?? topicItemId),
            itemModel: "Topic",
            itemName: String(r.title ?? "Topic"),
          },
          description: url
            ? "Removed topic attachment"
            : "Cleared all topic attachments",
          metaData: url ? { url } : undefined,
        });
      }

      res.status(200).json({
        success: true,
        message: url
          ? "Topic attachment removed successfully"
          : "Topic attachments removed successfully",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Error removing topic attachment(s)",
        error: error.message,
      });
    }
  },
);

export default TopicsController;
