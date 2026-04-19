// bimcde-be\src\modules\project\controllers\project.controller.ts
import { Request, Response } from "express";
import express from "express";
import { JsonWebTokenError, TokenExpiredError } from "jsonwebtoken";
import { authenticate } from "../../../middlewares/authMiddlewares";
import ProjectService from "../services/project.services";
import authorize from "../../../middlewares/authorize";
import projectSchema from "../schemas/project.schema";
import AccountModel from "../../account/schemas/account.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";
import NotificationService from "../../notification/services/notification.services";

const ProjectController = express.Router();
const notificationService = new NotificationService();

const projectService = new ProjectService();
ProjectController.post("/createProject", authenticate, async (req, res) => {
  try {
    const result = await projectService.createProject(req.userId, req.body);

    const actor = actorFromReq(req);
    if (actor && result?._id) {
      await logActivitySafe({
        projectId: projectIdToString(result._id),
        actor,
        actionGroup: "PROJECT",
        actionType: "CREATE",
        target: {
          itemId: String(result._id),
          itemModel: "Project",
          itemName: (result as { name?: string }).name ?? "Project",
        },
        description: `Created project "${(result as { name?: string }).name ?? ""}"`,
      });
    }

    res.status(201).json({
      success: true,
      message: "Dự án đã được tạo thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi tạo dự án.",
      error: error.message,
    });
  }
});

ProjectController.get("/getAllProject", authenticate, async (req, res) => {
  try {
    const userId = req.userId;
    const result = await projectService.getAllProject(userId);
    res.status(200).json({
      success: true,
      message: "Lấy danh sách dự án thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy danh sách dự án.",
      error: error.message,
    });
  }
});

ProjectController.get(
  "/getProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.getProjectById(
        req.userId,
        req.params.projectId,
      );
      res.status(200).json({
        success: true,
        message: "Lấy dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy dự án.",
        error: error.message,
      });
    }
  },
);

ProjectController.put(
  "/updateVisited/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.updateProject(
        req.params.projectId,
        req.userId,
        req.body,
      );
      res.status(200).json({
        success: true,
        message: "Cập nhật dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật dự án.",
        error: error.message,
      });
    }
  },
);

ProjectController.put(
  "/updateProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.updateProject(
        req.params.projectId,
        req.userId,
        req.body,
      );
      const actor = actorFromReq(req);
      if (actor && result?._id) {
        await logActivitySafe({
          projectId: projectIdToString(result._id),
          actor,
          actionGroup: "PROJECT",
          actionType: "UPDATE",
          target: {
            itemId: String(result._id),
            itemModel: "Project",
            itemName: (result as { name?: string }).name ?? "Project",
          },
          description: "Updated project settings",
          metaData: { fields: Object.keys(req.body ?? {}) },
        });
      }
      res.status(200).json({
        success: true,
        message: "Cập nhật dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật dự án.",
        error: error.message,
      });
    }
  },
);

ProjectController.put(
  "/leaveProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.leaveProject(
        req.userId,
        req.params.projectId,
      );

      const actor = actorFromReq(req);
      if (actor) {
        await logActivitySafe({
          projectId: req.params.projectId,
          actor,
          actionGroup: "MEMBER",
          actionType: "LEAVE",
          target: {
            itemId: String(req.userId),
            itemModel: "Account",
            itemName: actor.fullName ?? "User",
          },
          description: "Left project",
        });
      }

      res.status(200).json({
        success: true,
        message: "Rời dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi rời dự án.",
        error: error.message,
      });
    }
  },
);

ProjectController.delete(
  "/deleteProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const projectId = req.params.projectId;
      const project = await projectSchema.findById(projectId).lean();
      const result = await projectService.deleteProject(
        req.userId,
        projectId,
      );

      const actor = actorFromReq(req);
      if (actor && project?._id) {
        await logActivitySafe({
          projectId: projectIdToString(project._id),
          actor,
          actionGroup: "PROJECT",
          actionType: "DELETE",
          target: {
            itemId: String(project._id),
            itemModel: "Project",
            itemName: (project as { name?: string }).name ?? "Project",
          },
          description: `Deleted project "${(project as { name?: string }).name ?? ""}"`,
        });
      }

      res.status(200).json({
        success: true,
        message: "Xóa dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi xóa dự án.",
        error: error.message,
      });
    }
  },
);

ProjectController.post(
  "/inviteToProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.inviteToProject(
        req.userId,
        req.params.projectId,
        req.body,
      );

      if (result && result.userId) {
        const projectDoc = await projectSchema.findById(req.params.projectId).lean();
        await notificationService.createNotification({
          userId: result.userId,
          title: "Project Invitation",
          content: `You have been added to the project ${projectDoc?.name || ""}.`,
          isRead: false,
          url: `/projects/${req.params.projectId}`,
        } as any);
      }

      const actor = actorFromReq(req);
      if (actor && result?.userId) {
        const invited = await AccountModel.findById(result.userId)
          .select("fullName email")
          .lean();
        await logActivitySafe({
          projectId: req.params.projectId,
          actor,
          actionGroup: "MEMBER",
          actionType: "INVITE",
          target: {
            itemId: String(result.userId),
            itemModel: "Account",
            itemName: invited?.fullName ?? invited?.email ?? "Member",
          },
          description: "Invited user to project",
          metaData: { role: req.body?.role ?? "member" },
        });
      }

      res.status(201).json({
        success: true,
        message: "Thêm thành viên vào dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi thêm thành viên vào dự án.",
        error: error.message,
      });
    }
  },
);

ProjectController.post(
  "/updateProjectMember/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await projectService.updateProjectMember(
        req.userId,
        req.params.projectId,
        req.body,
      );
      const actor = actorFromReq(req);
      if (actor && result?.userId) {
        const acc = await AccountModel.findById(result.userId)
          .select("fullName email")
          .lean();
        await logActivitySafe({
          projectId: req.params.projectId,
          actor,
          actionGroup: "MEMBER",
          actionType: "ROLE_UPDATE",
          target: {
            itemId: String(result.userId),
            itemModel: "Account",
            itemName: acc?.fullName ?? acc?.email ?? "Member",
          },
          metaData: { role: result.role },
        });
      }
      res.status(200).json({
        success: true,
        message: "Cập nhật thành viên dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật thành viên dự án.",
        error: error.message,
      });
    }
  },
);

ProjectController.post(
  "/removeFromProject/:projectId",
  authenticate,
  async (req: Request, res: Response) => {
    try {
      const projectId = req.params.projectId;
      const { userRemove } = req.body;

      const removedAcc = await AccountModel.findById(userRemove)
        .select("fullName email")
        .lean();

      // Xử lý logic xóa thành viên khỏi dự án
      const result = await projectService.removeFromProject(
        req.userId,
        projectId,
        userRemove,
      );

      const actor = actorFromReq(req);
      if (actor) {
        await logActivitySafe({
          projectId,
          actor,
          actionGroup: "MEMBER",
          actionType: "REMOVE",
          target: {
            itemId: String(userRemove),
            itemModel: "Account",
            itemName: removedAcc?.fullName ?? removedAcc?.email ?? "Member",
          },
          description: "Removed member from project",
        });
      }

      res.status(200).json({
        success: true,
        message: "Xoá thành viên khỏi dự án thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi xoá thành viên khỏi dự án.",
        error: error.message,
      });
    }
  },
);
ProjectController.get("/:projectId/members", authenticate, async (req, res) => {
  try {
    const result = await projectService.getProjectMembers(
      req.params.projectId,
      req.userId,
    );
    res.status(200).json({
      success: true,
      message: "Lấy danh sách thành viên thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Lỗi lấy thành viên.",
      error: error.message,
    });
  }
});

export { ProjectController };
