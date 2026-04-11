import express from "express";
import { authenticate } from "../../../middlewares/authMiddlewares";
import TeamService from "../services/team.services";
import groupModel from "../schemas/group.schema";
import AccountModel from "../../account/schemas/account.schema";
import {
  actorFromReq,
  logActivitySafe,
  projectIdToString,
} from "../../activity/utils/auditActivity.helpers";

const TeamController = express.Router();

const teamService = new TeamService();

TeamController.get(
  "/getMemberProject/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.getByProjectId(
        req.params.projectId,
        req.userId // Truyền userId từ middleware authenticate
      );
      res.status(200).json({
        success: true,
        message: "Lấy danh sách thành viên thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy danh sách thành viên.",
        error: error.message,
      });
    }
  }
);

TeamController.get("/getGroup/:projectId", authenticate, async (req, res) => {
  try {
    const result = await teamService.getAllGroup(
      req.params.projectId,
      req.userId
    );
    res.status(200).json({
      success: true,
      message: "Lấy danh sách group thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy danh sách group.",
      error: error.message,
    });
  }
});

TeamController.post(
  "/createGroup/:projectId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.createGroup(
        req.params.projectId,
        req.userId,
        req.body.name
      );
      const actor = actorFromReq(req);
      if (actor && result?._id) {
        await logActivitySafe({
          projectId: projectIdToString(result.projectId),
          actor,
          actionGroup: "GROUP",
          actionType: "CREATE",
          target: {
            itemId: String(result._id),
            itemModel: "Group",
            itemName: result.name ?? "Group",
          },
          description: `Created group "${result.name ?? ""}"`,
        });
      }
      res.status(200).json({
        success: true,
        message: "Tạo group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi tạo group.",
        error: error.message,
      });
    }
  }
);

TeamController.put(
  "/updateGroupMemberRole/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.updateGroupMemberRole(
        req.params.groupId,
        req.body.userId,
        req.body.role,
        req.userId
      );
      const actor = actorFromReq(req);
      const group = await groupModel.findById(req.params.groupId).lean();
      const acc = await AccountModel.findById(req.body.userId)
        .select("fullName email")
        .lean();
      if (actor && group) {
        await logActivitySafe({
          projectId: projectIdToString(group.projectId),
          actor,
          actionGroup: "GROUP",
          actionType: "MEMBER_ROLE_UPDATE",
          target: {
            itemId: String(group._id),
            itemModel: "Group",
            itemName: group.name ?? "Group",
          },
          description: `Updated group member role for ${acc?.fullName ?? acc?.email ?? "user"}`,
          metaData: {
            targetUserId: req.body.userId,
            role: req.body.role,
          },
        });
      }
      res.status(200).json({
        success: true,
        message: "Cập nhật vai trò trong nhóm thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi cập nhật vai trò trong nhóm.",
        error: error.message,
      });
    }
  }
);

TeamController.post(
  "/addPeopleToGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.addPeopleToGroup(
        req.params.groupId,
        req.body,
        req.userId
      );
      const actor = actorFromReq(req);
      const group = await groupModel.findById(req.params.groupId).lean();
      if (actor && group) {
        const n = Array.isArray(result) ? result.length : 0;
        await logActivitySafe({
          projectId: projectIdToString(group.projectId),
          actor,
          actionGroup: "GROUP",
          actionType: "MEMBERS_ADD",
          target: {
            itemId: String(group._id),
            itemModel: "Group",
            itemName: group.name ?? "Group",
          },
          description: `Added ${n} member(s) to group`,
          metaData: { addedCount: n },
        });
      }
      res.status(200).json({
        success: true,
        message: "Thêm thành viên vào group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi thêm thành viên vào group.",
        error: error.message,
      });
    }
  }
);

TeamController.get(
  "/getMemberGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.getMemberGroup(
        req.params.groupId,
        req.userId
      );
      res.status(200).json({
        success: true,
        message: "Lấy danh sách thành viên thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi lấy danh sách thành viên.",
        error: error.message,
      });
    }
  }
);

TeamController.put("/updateGroup/:groupId", authenticate, async (req, res) => {
  try {
    const result = await teamService.updateGroup(
      req.userId,
      req.params.groupId,
      req.body.name
    );
    const actor = actorFromReq(req);
    if (actor && result?._id) {
      await logActivitySafe({
        projectId: projectIdToString(result.projectId),
        actor,
        actionGroup: "GROUP",
        actionType: "UPDATE",
        target: {
          itemId: String(result._id),
          itemModel: "Group",
          itemName: result.name ?? "Group",
        },
        description: `Renamed group to "${result.name ?? ""}"`,
      });
    }
    res.status(200).json({
      success: true,
      message: "Cập nhật group thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi cập nhật group.",
      error: error.message,
    });
  }
});

TeamController.delete(
  "/deleteGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const group = await groupModel.findById(req.params.groupId).lean();
      const result = await teamService.deleteGroup(
        req.params.groupId,
        req.userId
      );
      const actor = actorFromReq(req);
      if (actor && group?._id) {
        await logActivitySafe({
          projectId: projectIdToString(group.projectId),
          actor,
          actionGroup: "GROUP",
          actionType: "DELETE",
          target: {
            itemId: String(group._id),
            itemModel: "Group",
            itemName: group.name ?? "Group",
          },
          description: `Deleted group "${group.name ?? ""}"`,
        });
      }
      res.status(200).json({
        success: true,
        message: "Xóa group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi xóa group.",
        error: error.message,
      });
    }
  }
);

TeamController.post(
  "/removeMemberFromGroup/:groupId",
  authenticate,
  async (req, res) => {
    try {
      const group = await groupModel.findById(req.params.groupId).lean();
      const removedAcc = await AccountModel.findById(req.body.userId)
        .select("fullName email")
        .lean();
      const result = await teamService.removeMemberFromGroup(
        req.params.groupId,
        req.body.userId,
        req.userId
      );
      const actor = actorFromReq(req);
      if (actor && group) {
        await logActivitySafe({
          projectId: projectIdToString(group.projectId),
          actor,
          actionGroup: "GROUP",
          actionType: "MEMBER_REMOVE",
          target: {
            itemId: String(group._id),
            itemModel: "Group",
            itemName: group.name ?? "Group",
          },
          description: `Removed ${removedAcc?.fullName ?? removedAcc?.email ?? "member"} from group`,
          metaData: { removedUserId: req.body.userId },
        });
      }
      res.status(200).json({
        success: true,
        message: "Xóa thành viên khỏi group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi xóa thành viên khỏi group.",
        error: error.message,
      });
    }
  }
);

TeamController.post("/getAllGroupByUserId", authenticate, async (req, res) => {
  try {
    const result = await teamService.getGroupByUserId(
      req.userId,
      req.body.userId
    );
    res.status(200).json({
      success: true,
      message: "Lấy nhóm theo userId thành công.",
      result,
    });
  } catch (error: any) {
    res.status(500).json({
      success: false,
      message: "Xảy ra lỗi khi lấy nhóm theo userId.",
      error: error.message,
    });
  }
});

TeamController.post(
  "/addGroupToPeople/:userId",
  authenticate,
  async (req, res) => {
    try {
      const result = await teamService.addGroupToPeople(
        req.params.userId,
        req.body,
        req.userId
      );
      const actor = actorFromReq(req);
      if (actor && Array.isArray(result) && result.length > 0) {
        const firstGid = (result[0] as { groupId?: unknown }).groupId;
        const g = firstGid
          ? await groupModel.findById(firstGid).lean()
          : null;
        if (g) {
          await logActivitySafe({
            projectId: projectIdToString(g.projectId),
            actor,
            actionGroup: "GROUP",
            actionType: "USER_GROUPS_ADD",
            target: {
              itemId: String(g._id),
              itemModel: "Group",
              itemName: g.name ?? "Group",
            },
            description: `Linked user to ${result.length} group(s)`,
            metaData: { targetUserId: req.params.userId, groupIds: req.body?.groupIds },
          });
        }
      }
      res.status(200).json({
        success: true,
        message: "Thêm thành viên vào group thành công.",
        result,
      });
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: "Xảy ra lỗi khi thêm thành viên vào group.",
        error: error.message,
      });
    }
  }
);

export { TeamController };
