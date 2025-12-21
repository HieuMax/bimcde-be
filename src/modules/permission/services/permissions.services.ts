import { Types } from "mongoose";
import permissionsModel from "../schemas/permissions.schema";
import projectMemberSchema from "../../project/schemas/project-member.schema";

export default class PermissionsService {
  // Lấy permission theo projectId
  async getByProjectId(projectId: string, userId: Types.ObjectId | undefined) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      // Kiểm tra người dùng có phải là thành viên của dự án không
      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }

      // Lấy permissions của dự án
      const permissions = await permissionsModel.findOne({ projectId });
      if (!permissions) {
        throw new Error("Permissions không tồn tại.");
      }

      return permissions;
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật permission cho project
  async updatePermissions(
    projectId: string,
    data: Partial<{
      isTodosRestricted: boolean;
      isProjectInviteRestricted: boolean;
    }>,
    userId: Types.ObjectId | undefined
  ) {
    try {
      if (!userId) {
        throw new Error("User không hợp lệ.");
      }

      // Kiểm tra người dùng có phải là thành viên của dự án không
      const member = await projectMemberSchema.findOne({
        userId: userId,
        projectId: projectId,
      });
      if (!member) {
        throw new Error("Bạn không có quyền truy cập vào dự án này.");
      }

      // Cập nhật permissions cho dự án
      const updated = await permissionsModel.findOneAndUpdate(
        { projectId },
        {
          $set: {
            ...(data.isTodosRestricted !== undefined && {
              isTodosRestricted: data.isTodosRestricted,
            }),
            ...(data.isProjectInviteRestricted !== undefined && {
              isProjectInviteRestricted: data.isProjectInviteRestricted,
            }),
          },
        },
        { new: true, upsert: true }
      );

      return updated;
    } catch (error) {
      throw error;
    }
  }
}
