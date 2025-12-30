import { Types } from "mongoose";
import projectSchema from "../schemas/project.schema";
import projectMemberSchema from "../schemas/project-member.schema";
import AccountModel from "../../account/schemas/account.schema";
import permissionsModel from "../../permission/schemas/permissions.schema";
import unitModel from "../../unit/schemas/unit.schema";
import TopicsService from "../../topic/services/topics.services";

export default class ProjectService {
  async createProject(userId: Types.ObjectId | undefined, projectData: any) {
    try {
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
      const newProject = {
        ...projectData,
        createdBy: userInfo,
        modifiedBy: userInfo,
        lastModifiedOn: new Date(),
      };

      const createdProject = await projectSchema.create(newProject);
      const newProjectMember = {
        projectId: createdProject._id,
        userId,
        role: "admin",
        invitedAt: new Date(),
      };

      await projectMemberSchema.create(newProjectMember);

      // Tạo permissions mặc định cho project (cả 2 giá trị đều false)
      await permissionsModel.create({
        projectId: createdProject._id,
        isTodosRestricted: false,
        isProjectInviteRestricted: false,
      });
      await unitModel.create({
        projectId: createdProject._id,
      });

      // Tạo default topics cho project
      const topicsService = new TopicsService();
      await topicsService.createTopicDefault(createdProject._id);

      return createdProject;
    } catch (error) {
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

      return projects;
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

  async updateVisitedOn(projectId: string) {
    try {
      const project = await projectSchema.findById(projectId);
      if (!project) {
        throw new Error("Dự án không tồn tại.");
      }
      project.lastVisitedOn = new Date();
      await project.save();
      return project;
    } catch (error) {
      throw error;
    }
  }

  async updateProject(
    projectId: string,
    userId: Types.ObjectId | undefined,
    updateData: any
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
        { new: true }
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
            "Bạn là admin duy nhất của dự án, không thể rời dự án. Hãy chuyển quyền admin cho người khác trước."
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
          "Bạn không có quyền xóa dự án này. Chỉ admin của dự án mới được phép xóa."
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
}
