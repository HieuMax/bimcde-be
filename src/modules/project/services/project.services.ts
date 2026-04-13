import { Types } from "mongoose";
import projectSchema from "../schemas/project.schema";
import projectMemberSchema from "../schemas/project-member.schema";
import AccountModel from "../../account/schemas/account.schema";
import permissionsModel from "../../permission/schemas/permissions.schema";
import unitModel from "../../unit/schemas/unit.schema";
import TopicsService from "../../topic/services/topics.services";
import groupMemberModel from "../../team/schemas/group-member.schema";
import groupModel from "../../team/schemas/group.schema";
import {
  parseCdeWorkflowMode,
  isGroupMemberRole,
} from "../../../constants/cde-workflow";
import { ensureCdeRootsInitialized } from "../../folder/services/cde-root-init.service";

export default class ProjectService {
  async createProject(userId: Types.ObjectId | undefined, projectData: any) {
    try {
      console.log("🔍 [PROJECT SERVICE] Creating project with data:", projectData);

      if (!userId) {
        throw new Error("User ID không được để trống.");
      }
      if (!projectData.name) {
        throw new Error("Tên dự án không được để trống.");
      }
      const exitingProject = await projectSchema.findOne({
        name: projectData.name,
      });
      if (exitingProject) {
        throw new Error("Tên dự án đã tồn tại.");
      }

      const user = await AccountModel.findById(userId);
      console.log("🔎 [PROJECT SERVICE] Looking for user with ID:", userId);
      console.log("🔎 [PROJECT SERVICE] User found:", user);
      if (!user) {
        throw new Error("Người dùng không tồn tại.");
      }
      const userInfo = {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      };
      const workflowMode =
        parseCdeWorkflowMode(projectData.workflowMode) ?? "NORMAL";

      const newProject = {
        ...projectData,
        workflowMode,
        cdeRootsInitialized: false,
        createdBy: userInfo,
        modifiedBy: userInfo,
        lastModifiedOn: new Date(),
      };

      console.log("💾 [PROJECT SERVICE] Saving to DB:", newProject);

      const createdProject = await projectSchema.create(newProject);
      console.log("✅ [PROJECT SERVICE] Project saved with ID:", createdProject._id);

      const newProjectMember = {
        projectId: createdProject._id,
        userId,
        role: "admin",
        invitedAt: new Date(),
        lastAccessed: new Date(),
      };

      await projectMemberSchema.create(newProjectMember);
      console.log("✅ [PROJECT SERVICE] Project member created");

      // Tạo permissions mặc định cho project (cả 2 giá trị đều false)
      await permissionsModel.create({
        projectId: createdProject._id,
        isTodosRestricted: false,
        isProjectInviteRestricted: false,
      });
      console.log("✅ [PROJECT SERVICE] Permissions created");

      await unitModel.create({
        projectId: createdProject._id,
      });
      console.log("✅ [PROJECT SERVICE] Unit created");

      // Tạo default topics cho project
      const topicsService = new TopicsService();
      await topicsService.createTopicDefault(createdProject._id);
      console.log("✅ [PROJECT SERVICE] Default topics created");
      await topicsService.createTopicItemsDefault(createdProject._id);

      await ensureCdeRootsInitialized(
        createdProject._id.toString(),
        userId,
        workflowMode
      );

      return createdProject;
    } catch (error) {
      console.error("❌ [PROJECT SERVICE] Error:", error);
      throw error;
    }
  }

  async getAllProject(userId: Types.ObjectId | undefined) {
    try {
      const projectMembers = await projectMemberSchema.find({ userId });

      if (projectMembers.length === 0) {
        return [];
      }

      const projectIds = projectMembers.map((member) => member.projectId);

      const projects = await projectSchema.find({ _id: { $in: projectIds } });

      const projectsWithLastAccessed = projects.map((project) => {
        if (!userId) {
          console.error("userId is undefined");
          return {
            ...project.toObject(),
            lastAccessed: null,
          };
        }

        const member = projectMembers.find(
          (member: any | undefined) =>
            member.projectId.toString() === project._id.toString() &&
            member.userId.toString() === userId.toString(),
        );

        return {
          ...project.toObject(),
          lastAccessed: member ? member.lastAccessed : null,
        };
      });

      return projectsWithLastAccessed;
    } catch (error) {
      throw error;
    }
  }

  async getProjectById(userId: Types.ObjectId | undefined, projectId: string) {
    try {
      if (!userId) {
        throw new Error("UNAUTHORIZED");
      }

      const projectDoc = await projectSchema.findById(projectId);
      if (!projectDoc) {
        throw new Error("Dự án không tồn tại.");
      }

      const member = await projectMemberSchema.findOne({
        userId,
        projectId,
      });
      if (!member) {
        throw new Error("You don't have access to this project");
      }

      await projectMemberSchema.updateMany(
        { userId, projectId: { $in: projectId } },
        { $set: { lastAccessed: new Date() } },
      );

      const userCount = await projectMemberSchema.countDocuments({
        projectId: projectDoc._id,
      });

      const project = {
        ...projectDoc.toObject(),
        userCount,
      };
      return project;
    } catch (error) {
      throw error;
    }
  }

  async updateProject(
    projectId: string,
    userId: Types.ObjectId | undefined,
    updateData: any,
  ) {
    try {
      if (!userId) {
        throw new Error("User ID không được để trống.");
      }

      const user = await AccountModel.findById(userId);
      if (!user) {
        throw new Error("Người dùng không tồn tại.");
      }

      updateData.lastModifiedOn = new Date();
      updateData.modifiedBy = {
        userId: user._id,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt,
      };

      const updatedProject = await projectSchema.findByIdAndUpdate(
        projectId,
        updateData,
        { new: true },
      );
      if (!updatedProject) {
        throw new Error("Dự án không tồn tại.");
      }
      return updatedProject;
    } catch (error) {
      throw error;
    }
  }

  async leaveProject(userId: Types.ObjectId | undefined, projectId: string) {
    try {
      if (!userId) {
        throw new Error("User ID không được để trống.");
      }

      // Tìm thành viên trong dự án
      const member = await projectMemberSchema.findOne({
        userId,
        projectId,
      });

      if (!member) {
        throw new Error("Bạn không phải là thành viên của dự án này.");
      }

      // Nếu là admin thì kiểm tra còn admin khác không
      if (member.role === "admin") {
        const adminCount = await projectMemberSchema.countDocuments({
          projectId,
          role: "admin",
        });

        // Nếu là admin duy nhất thì không cho rời dự án
        if (adminCount <= 1) {
          throw new Error(
            "Bạn là admin duy nhất của dự án, không thể rời dự án. Hãy chuyển quyền admin cho người khác trước.",
          );
        }
      }

      // Cho phép rời dự án (xóa membership)
      await projectMemberSchema.deleteOne({ _id: member._id });

      return {
        message: "Rời dự án thành công.",
      };
    } catch (error) {
      throw error;
    }
  }

  async deleteProject(userId: Types.ObjectId | undefined, projectId: string) {
    try {
      if (!userId) {
        throw new Error("User ID không được để trống.");
      }

      const project = await projectSchema.findById(projectId);
      if (!project) {
        throw new Error("Dự án không tồn tại.");
      }

      // Kiểm tra quyền: chỉ admin trong dự án mới được xóa
      const member = await projectMemberSchema.findOne({
        userId,
        projectId,
        role: "admin",
      });

      if (!member) {
        throw new Error(
          "Bạn không có quyền xóa dự án này. Chỉ admin của dự án mới được phép xóa.",
        );
      }

      // Xóa tất cả member của dự án
      await projectMemberSchema.deleteMany({ projectId });

      // Xóa dự án
      await projectSchema.findByIdAndDelete(projectId);

      return {
        message: "Xóa dự án thành công.",
      };
    } catch (error) {
      throw error;
    }
  }

  async inviteToProject(
    userId: Types.ObjectId | undefined,
    projectId: string,
    data: any,
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      const user = await AccountModel.findById(userId);
      if (!user) {
        throw new Error("Người dùng không tồn tại.");
      }

      const project = await projectSchema.findById(projectId);
      if (!project) {
        throw new Error("Dự án không tồn tại.");
      }

      const member = await projectMemberSchema.findOne({
        userId,
        projectId,
        role: "admin",
      });

      if (!member) {
        throw new Error(
          "Bạn không có quyền mời người dùng vào dự án này. Chỉ admin của dự án mới được phép mời.",
        );
      }

      const invitedUser = await AccountModel.findOne({ _id: data.userId });
      if (!invitedUser) {
        throw new Error("Người dùng chưa đăng ký tài khoản.");
      }

      const existingMember = await projectMemberSchema.findOne({
        userId: invitedUser._id,
        projectId,
      });

      if (existingMember) {
        throw new Error("Người dùng đã là thành viên của dự án này.");
      }

      const newMember = new projectMemberSchema({
        userId: invitedUser._id,
        projectId,
        role: data.role || "member",
        lastAccessed: new Date(),
      });

      await newMember.save();

      if (data.groupId) {
        const group = await groupModel.findById(data.groupId);
        if (!group) {
          throw new Error("Nhóm không tồn tại.");
        }

        const memberInGroup = await groupMemberModel.findOne({
          userId: invitedUser._id,
          groupId: data.groupId,
        });

        if (memberInGroup) {
          throw new Error(
            "Người dùng đã là thành viên của nhóm này trong dự án.",
          );
        }

        const newMemberInGroup = new groupMemberModel({
          userId: invitedUser._id,
          groupId: data.groupId,
          invitedAt: new Date(),
          role: isGroupMemberRole(data.groupMemberRole)
            ? data.groupMemberRole
            : "GROUP_MEMBER",
        });

        await newMemberInGroup.save();
      }

      return newMember;
    } catch (error) {
      throw error;
    }
  }
  // Lấy danh sách thành viên của dự án
  async getProjectMembers(
    projectId: string,
    userId: Types.ObjectId | undefined,
  ) {
    try {
      if (!userId) throw new Error("Unauthorized");

      // Check xem user hiện tại có trong project không
      const isMember = await projectMemberSchema.exists({ projectId, userId });
      if (!isMember) throw new Error("Access denied");

      // Lấy danh sách member và populate thông tin từ bảng Account
      const members = await projectMemberSchema
        .find({ projectId })
        .populate("userId", "fullName email avatar") // Lấy các trường cần thiết
        .lean();

      // Map lại dữ liệu cho gọn
      return members.map((m: any) => ({
        userId: m.userId._id,
        fullName: m.userId.fullName,
        email: m.userId.email,
        avatar: m.userId.avatar,
        role: m.role,
      }));
    } catch (error) {
      throw error;
    }
  }

  async updateProjectMember(
    userId: Types.ObjectId | undefined,
    projectId: string,
    data: any,
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }
      const user = await AccountModel.findById(userId);
      if (!user) {
        throw new Error("Người dùng không tồn tại.");
      }
      const project = await projectSchema.findById(projectId);
      if (!project) {
        throw new Error("Dự án không tồn tại.");
      }
      const member = await projectMemberSchema.findOne({
        userId,
        projectId,
        role: "admin",
      });
      if (!member) {
        throw new Error(
          "Bạn không có quyền cập nhật thành viên dự án này. Chỉ admin của dự án mới được phép cập nhật.",
        );
      }
      const updatedMember = await projectMemberSchema.findOneAndUpdate(
        {
          userId: data.userId,
          projectId,
        },
        {
          role: data.role,
        },
        { new: true },
      );
      if (!updatedMember) {
        throw new Error("Thành viên không tồn tại trong dự án.");
      }
      return updatedMember;
    } catch (error) {
      throw error;
    }
  }

  async removeFromProject(
    userId: Types.ObjectId | undefined,
    projectId: string,
    data: string,
  ) {
    if (!userId) {
      throw new Error("User không hợp lệ.");
    }

    const user = await AccountModel.findById(userId);
    if (!user) {
      throw new Error("Người dùng không tồn tại.");
    }

    const project = await projectSchema.findById(projectId);
    if (!project) {
      throw new Error("Dự án không tồn tại.");
    }

    // Kiểm tra xem người dùng có phải là admin của dự án không
    const adminMember = await projectMemberSchema.findOne({
      userId,
      projectId,
      role: "admin",
    });

    if (!adminMember) {
      throw new Error(
        "Bạn không có quyền xóa thành viên khỏi dự án. Chỉ admin của dự án mới có thể thực hiện.",
      );
    }

    const removedMember = await projectMemberSchema.findOneAndDelete({
      userId: data,
      projectId,
    });

    if (!removedMember) {
      throw new Error("Thành viên không tồn tại trong dự án này.");
    }

    const groups = await groupModel.find({ projectId });

    if (!groups || groups.length === 0) {
      throw new Error("Không tìm thấy nhóm cho dự án này.");
    }

    const removedGroupMembers = await groupMemberModel.deleteMany({
      userId: data,
      groupId: { $in: groups.map((group) => group._id) },
    });

    if (removedGroupMembers.deletedCount === 0) {
      console.log("Không tìm thấy thành viên trong các nhóm của dự án.");
    }

    return removedMember;
  }
}
