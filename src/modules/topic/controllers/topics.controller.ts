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

const handleUpdateTopicItem = async (req: Request, res: Response) => {
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
};

// IFC viewer + legacy 3D client: same TopicItem collection as /items/getAll
TopicsController.get(
  "/items/viewer/:projectId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const { status, search } = req.query;
    const topics = await topicsService.getTopicItemsForViewer(
      req.userId,
      projectId,
      {
        status: status ? String(status) : undefined,
        search: search ? String(search) : undefined,
      },
    );
    res.json(topics);
  }),
);

TopicsController.get(
  "/items/linkable/:projectId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { projectId } = req.params;
    const topics = await topicsService.getLinkableTopicItemsForUser(
      projectId,
      req.userId,
    );
    res.json(topics);
  }),
);

TopicsController.get(
  "/items/open-linked-todos-count/:topicItemId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId } = req.params;
    const count =
      await topicsService.getOpenLinkedTodoCountForTopicItem(topicItemId);
    res.json({ count });
  }),
);

TopicsController.get(
  "/items/detail/:topicItemId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId } = req.params;
    const topic = await topicsService.getTopicItemDetailForViewer(
      req.userId,
      topicItemId,
    );
    res.json(topic);
  }),
);

TopicsController.post(
  "/items/:topicItemId/snapshots",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId } = req.params;
    const updated = await topicsService.addTopicItemSnapshot(
      req.userId,
      topicItemId,
      req.body ?? {},
    );
    const actor = actorFromReq(req);
    if (actor && updated && (updated as { _id?: unknown })._id) {
      const r = updated as unknown as {
        _id: unknown;
        projectId: unknown;
        title?: string;
      };
      await logActivitySafe({
        projectId: projectIdToString(r.projectId),
        actor,
        actionGroup: "TOPIC",
        actionType: "SNAPSHOT_ADD",
        target: {
          itemId: String(r._id),
          itemModel: "Topic",
          itemName: String(r.title ?? "Topic"),
        },
        description: "Added topic snapshot (viewer)",
      });
    }
    res.json(updated);
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

// Generic item routes last (avoid shadowing /items/viewer, /items/detail, etc.)
TopicsController.put(
  "/items/:topicItemId",
  authenticate,
  asyncHandler(handleUpdateTopicItem),
);

TopicsController.patch(
  "/items/:topicItemId",
  authenticate,
  asyncHandler(handleUpdateTopicItem),
);

TopicsController.delete(
  "/items/:topicItemId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId } = req.params;
    const existing = await topicsService.getTopicItemDetailForViewer(
      req.userId,
      topicItemId,
    );
    await topicsService.deleteTopicItem(req.userId, topicItemId);
    const actor = actorFromReq(req);
    if (actor && existing && (existing as { _id?: unknown })._id) {
      await logActivitySafe({
        projectId: projectIdToString(
          (existing as { projectId: unknown }).projectId,
        ),
        actor,
        actionGroup: "TOPIC",
        actionType: "DELETE",
        target: {
          itemId: String((existing as { _id: unknown })._id),
          itemModel: "Topic",
          itemName: String((existing as { title?: string }).title ?? "Topic"),
        },
        description: "Deleted topic",
      });
    }
    res.json({ message: "Topic deleted successfully" });
  }),
);

TopicsController.delete(
  "/items/:topicItemId/snapshots/:snapshotId",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId, snapshotId } = req.params;

    const topicItem = await topicsService.removeSnapshot(
      String(req.userId),
      topicItemId,
      snapshotId
    );

    res.json(topicItem);
  })
);

TopicsController.delete(
  "/items/:topicItemId/snapshots",
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { topicItemId } = req.params;

    const topicItem = await topicsService.removeAllSnapshots(
      String(req.userId),
      topicItemId
    );

    res.json(topicItem);
  })
);

export default TopicsController;
