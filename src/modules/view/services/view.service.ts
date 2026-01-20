import { Types } from "mongoose";
import { ViewModel } from "../schemas/view.schema";
import { AppError } from "../../../utils/AppError";
import { CreateView} from "../interfaces/view.interface";

export default class ViewService {
  async create(view: CreateView) {
    return ViewModel.create({
      name: view.name,
      description: view.description,
      projectId: view.projectId,
      fileId: view.fileId,
      createdBy: view.userId,
      annotations: view.annotations,
      viewportState: view.viewportState,
      previewSrc: view.previewSrc,
      assignedTo: view.assignedTo,
    });
  }

  async getById(viewId: string) {
    if (!Types.ObjectId.isValid(viewId)) {
      throw new AppError("Invalid view id", 400);
    }

    const view = await ViewModel.findOne({
      _id: viewId,
      isDeleted: false,
    })
      .populate("createdBy", "name email avatar")
      .lean();

    if (!view) throw new AppError("View not found", 404);
    return view;
  }

  async getByFile(fileId: string) {
    if (!Types.ObjectId.isValid(fileId)) {
      throw new AppError("Invalid file id", 400);
    }

    return ViewModel.find({
      fileId,
      isDeleted: false,
    })
      .sort({ createdAt: -1 })
      .lean();
  }

  async softDelete(viewId: string, userId: string) {
    const view = await ViewModel.findById(viewId);
    if (!view || view.isDeleted) {
      throw new AppError("View not found", 404);
    }

    if (view.createdBy.toString() !== userId) {
      throw new AppError("Permission denied", 403);
    }

    view.isDeleted = true;
    view.deletedAt = new Date();
    await view.save();
  }
}
