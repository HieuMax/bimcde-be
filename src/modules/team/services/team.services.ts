import { Types } from "mongoose";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import projectSchema from "../../project/schemas/project.schema";
import AccountModel from "../../account/schemas/account.schema";
import groupModel from "../schemas/group.schema";
import groupMemberModel from "../schemas/group-member.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";
import FolderService from "../../folder/services/folder.service";
import { assertValidFolderName } from "../../folder/utils/folderNameValidation";
import {
  isGroupMemberRole,
  parseCdeWorkflowMode,
} from "../../../constants/cde-workflow";
import { ensureCdeRootsInitialized } from "../../folder/services/cde-root-init.service";

export default class TeamService {
  private async assertProjectAdmin(
    projectId: Types.ObjectId | string,
    userId: Types.ObjectId
  ) {
    const actor = await projectMemberSchema.findOne({
      userId,
      projectId,
    });
    if (!actor || String(actor.role).toLowerCase() !== "admin") {
      throw new Error("Chỉ Admin dự án mới được thực hiện thao tác này.");
    }
  }

  async getByProjectId(projectId: string, userId: Types.ObjectId | undefined) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });

      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }

      const projectMembers = await projectMemberSchema.find({ projectId });

      const userIds = projectMembers.map((member) => member.userId);

      const inforMembers = await AccountModel.find({
        _id: { $in: userIds },
      });

      const result = projectMembers.map((member) => {
        const accountInfo = inforMembers.find((acc) =>
          acc._id.equals(member.userId)
        );

        const { fullName, email } = accountInfo || {};

        return {
          ...member.toObject(),
          fullName,
          email,
        };
      });

      return result;
    } catch (error) {
      console.error("Error in getByProjectId:", error);
      throw error;
    }
  }

  async getAllGroup(projectId: string, userId: Types.ObjectId | undefined) {
    if (!userId) {
      throw new Error("User không hợp lệ.");
    }

    const member = await projectMemberSchema.findOne({
      userId: userId,
      projectId: projectId,
    });

    if (!member) {
      throw new Error("Bạn không có quyền truy cập vào dự án này.");
    }

    const groups = await groupModel.find({ projectId: projectId });

    const result = await Promise.all(
      groups.map(async (group) => {
        const memberCount = await groupMemberModel.countDocuments({
          groupId: group._id,
        });

        return {
          ...group.toObject(),
          memberCount,
        };
      })
    );

    return result;
  }

  async createGroup(
    projectId: string,
    userId: Types.ObjectId | undefined,
    name: string
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });

      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }
      const existingTag = await groupModel.findOne({
        projectId: projectId,
        name: name,
      });
      if (existingTag) {
        throw new Error("Group đã tồn tại.");
      }

      const project = await projectSchema.findById(projectId).lean();
      const mode = parseCdeWorkflowMode(project?.workflowMode) ?? "NORMAL";

      if (mode === "ISO_19650" && member.role !== "admin") {
        throw new Error(
          "Chỉ Admin có thể tạo nhóm trong chế độ ISO 19650."
        );
      }

      const newGroup = await groupModel.create({
        projectId: projectId,
        name: name,
      });

      if (mode === "ISO_19650") {
        await ensureCdeRootsInitialized(projectId, userId, "ISO_19650");

        const pid = new Types.ObjectId(projectId);
        const wipRoot = await FolderModel.findOne({
          projectId: pid,
          parentId: null,
          cdeStage: "WIP",
          isCdeRoot: true,
          isDeleted: false,
        });
        const sharedRoot = await FolderModel.findOne({
          projectId: pid,
          parentId: null,
          cdeStage: "SHARED",
          isCdeRoot: true,
          isDeleted: false,
        });
        if (!wipRoot || !sharedRoot) {
          throw new Error("Không tìm thấy thư mục CDE WIP/Shared.");
        }

        const folderService = new FolderService();
        const safeName = assertValidFolderName(name);
        await folderService.createFolder(
          {
            name: safeName,
            projectId: pid,
            parentId: wipRoot._id,
            createdBy: userId,
            groupId: newGroup._id,
          },
          { allowIsoStructuralFolder: true }
        );
        await folderService.createFolder(
          {
            name: safeName,
            projectId: pid,
            parentId: sharedRoot._id,
            createdBy: userId,
            groupId: newGroup._id,
          },
          { allowIsoStructuralFolder: true }
        );
      }

      return newGroup;
    } catch (err) {
      throw err;
    }
  }

  async getMemberGroup(groupId: string, userId: Types.ObjectId | undefined) {
    if (!userId) {
      throw new Error("User không hợp lệ.");
    }

    // Check if the user is a member of the project that the group belongs to
    const group = await groupModel.findById(groupId);
    if (!group) {
      throw new Error("Group không tồn tại.");
    }
    const projectId = group.projectId;

    const member = await projectMemberSchema.findOne({
      userId: userId,
      projectId: projectId,
    });
    if (!member) {
      throw new Error("Bạn không có quyền truy cập vào nhóm này.");
    }
    const members = await groupMemberModel
      .find({ groupId: groupId })
      .populate("userId", "fullName email")
      .lean();

    const projectMembers = await projectMemberSchema
      .find({
        userId: { $in: members.map((member: any) => member.userId) },
        projectId: projectId,
      })
      .select("userId role lastAccessed");

    const result = members.map((member: any) => {
      const projectMember = projectMembers.find(
        (pm: any) => pm.userId.toString() === member.userId._id.toString()
      );

      return {
        ...member,
        fullName: member.userId.fullName,
        email: member.userId.email,
        userId: member.userId._id,
        role: projectMember?.role,
        groupMemberRole: member.role,
        projectId: projectId,
        lastAccessed: projectMember?.lastAccessed,
      };
    });

    return result;
  }

  async addPeopleToGroup(
    groupId: string,
    data: any,
    userId: Types.ObjectId | undefined
  ) {
    if (!userId) {
      throw new Error("User không hợp lệ.");
    }

    const group = await groupModel.findById(groupId);
    if (!group) {
      throw new Error("Group không tồn tại.");
    }
    const projectId = group.projectId;

    const member = await projectMemberSchema.findOne({
      userId: userId,
      projectId: projectId,
    });
    if (!member) {
      throw new Error("Bạn không có quyền truy cập vào nhóm này.");
    }

    const rows: Array<{
      groupId: string;
      userId: Types.ObjectId | string;
      role: "GROUP_LEADER" | "GROUP_MEMBER";
      invitedAt: Date;
    }> = [];

    if (Array.isArray(data?.members) && data.members.length > 0) {
      for (const m of data.members) {
        const uid = m.userId ?? m._id;
        if (!uid) continue;
        rows.push({
          groupId,
          userId: uid,
          role: isGroupMemberRole(m.role) ? m.role : "GROUP_MEMBER",
          invitedAt: new Date(),
        });
      }
    } else if (Array.isArray(data?.userIds) && data.userIds.length > 0) {
      for (const uid of data.userIds) {
        rows.push({
          groupId,
          userId: uid,
          role: "GROUP_MEMBER",
          invitedAt: new Date(),
        });
      }
    }

    if (rows.length === 0) {
      throw new Error("Thiếu danh sách thành viên (userIds hoặc members).");
    }

    const result = await groupMemberModel.insertMany(rows);

    return result;
  }

  async updateGroup(
    userId: Types.ObjectId | undefined,
    groupId: string,
    name: string
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      const group = await groupModel.findById(groupId);
      if (!group) {
        throw new Error("Group không tồn tại.");
      }
      const projectId = group.projectId;

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào nhóm này.");
      }
      await this.assertProjectAdmin(projectId, userId as Types.ObjectId);

      const trimmedName = assertValidFolderName(name);

      const duplicateGroup = await groupModel.findOne({
        projectId: group.projectId,
        name: trimmedName,
        _id: { $ne: group._id },
      });
      if (duplicateGroup) {
        throw new Error("Group name already exists in this project.");
      }

      const project = await projectSchema.findById(projectId).lean();
      const mode = parseCdeWorkflowMode(project?.workflowMode) ?? "NORMAL";

      if (mode === "ISO_19650") {
        await ensureCdeRootsInitialized(
          projectId.toString(),
          userId,
          "ISO_19650"
        );
        const pid = new Types.ObjectId(projectId);
        const wipRoot = await FolderModel.findOne({
          projectId: pid,
          parentId: null,
          cdeStage: "WIP",
          isCdeRoot: true,
          isDeleted: false,
        });
        const sharedRoot = await FolderModel.findOne({
          projectId: pid,
          parentId: null,
          cdeStage: "SHARED",
          isCdeRoot: true,
          isDeleted: false,
        });
        if (wipRoot && sharedRoot) {
          const homeFolders = await FolderModel.find({
            projectId: pid,
            groupId: group._id,
            parentId: { $in: [wipRoot._id, sharedRoot._id] },
            isDeleted: false,
          }).lean();

          const folderService = new FolderService();
          for (const f of homeFolders) {
            await folderService.renameFolder(
              f._id.toString(),
              trimmedName,
              userId.toString()
            );
          }
        }
      }

      const updatedGroup = await groupModel.findByIdAndUpdate(
        groupId,
        { name: trimmedName },
        { new: true }
      );

      return updatedGroup;
    } catch (err) {
      throw err;
    }
  }

  async deleteGroup(groupId: string, userId: Types.ObjectId | undefined) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }
      const group = await groupModel.findById(groupId);
      if (!group) {
        throw new Error("Group không tồn tại.");
      }
      const projectId = group.projectId;

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào nhóm này.");
      }
      await this.assertProjectAdmin(projectId, userId as Types.ObjectId);

      const pid = new Types.ObjectId(projectId);
      const project = await projectSchema.findById(projectId).lean();
      const mode = parseCdeWorkflowMode(project?.workflowMode) ?? "NORMAL";

      if (mode === "ISO_19650") {
        await ensureCdeRootsInitialized(projectId.toString(), userId, "ISO_19650");

        const wipRoot = await FolderModel.findOne({
          projectId: pid,
          parentId: null,
          cdeStage: "WIP",
          isCdeRoot: true,
          isDeleted: false,
        }).lean();
        const sharedRoot = await FolderModel.findOne({
          projectId: pid,
          parentId: null,
          cdeStage: "SHARED",
          isCdeRoot: true,
          isDeleted: false,
        }).lean();

        const homeFolders = await FolderModel.find({
          projectId: pid,
          groupId: group._id,
          parentId: {
            $in: [wipRoot?._id, sharedRoot?._id].filter(Boolean) as Types.ObjectId[],
          },
          isDeleted: false,
        }).lean();

        const folderIdsToDelete: Types.ObjectId[] = [];
        for (const home of homeFolders) {
          const prefix = home.path ? `${home.path},${home._id}` : `${home._id}`;
          const descendants = await FolderModel.find({
            $or: [{ path: prefix }, { path: { $regex: `^${prefix},` } }],
            isDeleted: false,
          })
            .select("_id")
            .lean();
          folderIdsToDelete.push(
            home._id as Types.ObjectId,
            ...descendants.map((f) => f._id as Types.ObjectId),
          );
        }

        const uniqueFolderIds = [
          ...new Map(
            folderIdsToDelete.map((id) => [id.toString(), id]),
          ).values(),
        ];

        if (uniqueFolderIds.length > 0) {
          const existingFile = await FileModel.findOne({
            projectId: pid,
            folderId: { $in: uniqueFolderIds },
            isDeleted: false,
          })
            .select("_id")
            .lean();
          if (existingFile) {
            throw new Error(
              "Cannot delete this group because its WIP/Shared folders still contain files.",
            );
          }

          await FolderModel.updateMany(
            { _id: { $in: uniqueFolderIds } },
            { $set: { isDeleted: true, deletedAt: new Date() } },
          );
        }
      }

      await groupMemberModel.deleteMany({ groupId: groupId });
      await groupModel.findByIdAndDelete(groupId);

      return { message: "Group deleted successfully." };
    } catch (err) {
      throw err;
    }
  }

  /**
   * Admin only: set GROUP_LEADER vs GROUP_MEMBER for a user in this group (ISO CDE).
   */
  async updateGroupMemberRole(
    groupId: string,
    targetUserId: string,
    newRole: unknown,
    actingUserId: Types.ObjectId | undefined
  ) {
    if (!actingUserId) {
      throw new Error("User không hợp lệ.");
    }
    if (!Types.ObjectId.isValid(targetUserId)) {
      throw new Error("userId không hợp lệ.");
    }
    const roleParsed = isGroupMemberRole(newRole) ? newRole : null;
    if (!roleParsed) {
      throw new Error("role phải là GROUP_LEADER hoặc GROUP_MEMBER.");
    }

    const group = await groupModel.findById(groupId);
    if (!group) {
      throw new Error("Group không tồn tại.");
    }
    const projectId = group.projectId;

    const actor = await projectMemberSchema.findOne({
      userId: actingUserId,
      projectId,
    });
    if (!actor || String(actor.role).toLowerCase() !== "admin") {
      throw new Error(
        "Chỉ Admin dự án mới được phân quyền Leader/Member trong nhóm."
      );
    }

    const updated = await groupMemberModel.findOneAndUpdate(
      {
        groupId: new Types.ObjectId(groupId),
        userId: new Types.ObjectId(targetUserId),
      },
      { $set: { role: roleParsed } },
      { new: true }
    );
    if (!updated) {
      throw new Error("Thành viên không thuộc nhóm này.");
    }

    return updated;
  }

  async removeMemberFromGroup(
    groupId: string,
    memberId: string,
    userId: Types.ObjectId | undefined
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }
      const group = await groupModel.findById(groupId);
      if (!group) {
        throw new Error("Group không tồn tại.");
      }
      const projectId = group.projectId;

      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào nhóm này.");
      }
      await this.assertProjectAdmin(projectId, userId as Types.ObjectId);
      await groupMemberModel.deleteOne({ groupId: groupId, userId: memberId });

      return { message: "Xóa thành viên khỏi group thành công." };
    } catch (err) {
      throw err;
    }
  }

  async getGroupByUserId(
    userAccess: Types.ObjectId | undefined,
    userId: string
  ) {
    if (!userAccess) {
      throw new Error("User không hợp lệ.");
    }
    const actorId = userAccess;

    const groupIds = await groupMemberModel
      .find({ userId })
      .populate("groupId");
    const result = groupModel.find({
      _id: { $in: groupIds.map((g) => g.groupId) },
    });
    return result;
  }

  async addGroupToPeople(
    userId: string,
    data: any,
    userAccess: Types.ObjectId | undefined
  ) {
    if (!userId) {
      throw new Error("User không hợp lệ.");
    }
    if (!userAccess) {
      throw new Error("User không hợp lệ.");
    }
    const actorId: Types.ObjectId = userAccess;

    const members = await projectMemberSchema.findOne({ userId: userId });
    if (!members) {
      throw new Error("Thành viên không hợp lệ.");
    }
    const projectId = members.projectId;
    if (!projectId) {
      throw new Error("Không xác định được project của thành viên.");
    }

    const member = await projectMemberSchema.findOne({
      userId: actorId,
      projectId: projectId,
    });
    if (!member) {
      throw new Error("Bạn không có quyền truy cập vào nhóm này.");
    }
    await this.assertProjectAdmin(projectId, actorId);

    const groupMemberships = data?.groupIds.map((gid: string) => ({
      userId: userId,
      groupId: gid,
      invitedAt: new Date(),
      role: "GROUP_MEMBER" as const,
    }));

    const result = await groupMemberModel.insertMany(groupMemberships);

    return result;
  }
}
