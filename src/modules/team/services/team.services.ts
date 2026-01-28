import { Types } from "mongoose";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import AccountModel from "../../account/schemas/account.schema";
import groupModel from "../schemas/group.schema";
import groupMemberModel from "../schemas/group-member.schema";
import { IGroupMember } from "../interfaces/group-member.interfaces";

export default class TeamService {
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
      const newGroup = await groupModel.create({
        projectId: projectId,
        name: name,
      });

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

      // Gắn thêm thông tin role và lastAccessed vào member
      return {
        ...member,
        fullName: member.userId.fullName,
        email: member.userId.email,
        userId: member.userId._id, // Giữ lại _id của userId
        role: projectMember?.role, // Gắn role từ ProjectMember
        projectId: projectId,
        lastAccessed: projectMember?.lastAccessed, // Gắn lastAccessed từ ProjectMember
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

    const groupMembersToAdd = data?.userIds.map((user: IGroupMember) => ({
      groupId: groupId,
      userId: user,
      invitedAt: new Date(),
    }));

    const result = await groupMemberModel.insertMany(groupMembersToAdd);

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

      const updatedGroup = await groupModel.findByIdAndUpdate(
        groupId,
        { name },
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
      await groupMemberModel.deleteMany({ groupId: groupId });
      await groupModel.findByIdAndDelete(groupId);

      return { message: "Xóa group thành công." };
    } catch (err) {
      throw err;
    }
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

    const members = await projectMemberSchema.findOne({ userId: userId });
    if (!members) {
      throw new Error("Thành viên không hợp lệ.");
    }
    const projectId = members.projectId;

    const member = await projectMemberSchema.findOne({
      userId: userAccess,
      projectId: projectId,
    });
    if (!member) {
      throw new Error("Bạn không có quyền truy cập vào nhóm này.");
    }

    const groupMemberships = data?.groupIds.map((groupId: string) => ({
      userId: userId,
      groupId: groupId,
      inviteAt: new Date(),
    }));

    const result = await groupMemberModel.insertMany(groupMemberships);

    return result;
  }
}
