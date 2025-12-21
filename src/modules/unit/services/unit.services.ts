import { Types } from "mongoose";
import unitModel from "../schemas/unit.schema";
import { IUnit } from "../interfaces/unit.interfaces";
import projectMemberSchema from "../../project/schemas/project-member.schema";

export default class UnitService {
  // Lấy unit theo projectId
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

      // Lấy unit theo projectId
      const unit = await unitModel.findOne({ projectId });
      if (!unit) {
        throw new Error("Unit không tồn tại.");
      }

      return unit;
    } catch (error) {
      throw error;
    }
  }

  // Cập nhật unit cho project
  async updateUnit(
    projectId: string,
    data: IUnit,
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

      // Cập nhật unit cho dự án
      const updated = await unitModel.findOneAndUpdate(
        { projectId },
        { $set: data },
        { new: true, upsert: true }
      );

      return updated;
    } catch (error) {
      throw error;
    }
  }
}
