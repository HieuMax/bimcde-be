import { Types } from "mongoose";
import View2DModel from "../schemas/view2d.schema";
import { AppError } from "../../../utils/AppError";

export default class View2DService {
    async createView(payload: {
      name: string;
      description?: string;
      projectId: string;
      fileId: string;
      userId: string;
      pageIndex: number;
      scale: number;
      rotation: number;
      previewSrc?: string;
  }) {
    try {
      console.log("💾 [VIEW SERVICE] Creating view with payload:", payload);

        const newView = await View2DModel.create({
          name: payload.name,
          description: payload.description,
          projectId: new Types.ObjectId(payload.projectId),
          fileId: new Types.ObjectId(payload.fileId),
          createdBy: new Types.ObjectId(payload.userId),
          updatedBy: new Types.ObjectId(payload.userId),
          pageIndex: payload.pageIndex ?? 1,
          scale: payload.scale ?? 1,
          rotation: payload.rotation ?? 0,
          previewSrc: payload.previewSrc,
        });

      return await newView.populate([
        { path: "createdBy", select: "fullName email" },
        { path: "updatedBy", select: "fullName email" },
      ]);
    } catch (error) {
      console.error("❌ [VIEW SERVICE] Error creating view:", error);
      throw new AppError("Cannot create view", 500);
    }
  }

  // 2. Lấy danh sách View theo File
  async getViewsByFile(fileId: string) {
    if (!Types.ObjectId.isValid(fileId)) {
      throw new AppError("Invalid File ID", 400);
    }

    try {
      const views = await View2DModel.find({
        fileId: new Types.ObjectId(fileId),
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .populate("createdBy", "fullName email")
        .populate("updatedBy", "fullName email");

      return views;
    } catch (error) {
      throw new AppError("Cannot fetch views", 500);
    }
  }

  async deleteView(viewId: string, userId: string) {
    const view = await View2DModel.findById(viewId);

    if (!view) {
      throw new AppError("View not found", 404);
    }

    if (view.createdBy.toString() !== userId) {
      throw new AppError("Permission denied", 403);
    }

    await view.deleteOne();
    return true;
  }

  async updateView(viewId: string, data: any, userId: string) {
    const updated = await View2DModel.findByIdAndUpdate(
      viewId,
      {
        $set: {
          ...data,
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true }
    )
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email");

    if (!updated) {
      throw new AppError("View not found", 404);
    }

    return updated;
  }

}