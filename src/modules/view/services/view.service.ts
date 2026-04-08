import ViewModel from "../schemas/view.schema";
import { CreateViewDTO, IView } from "../interfaces/view.interface";
import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import groupMemberModel from "../../team/schemas/group-member.schema";
import {
  assertDescriptionWithinLimit,
  assertValidViewName,
  normalizeViewTagIds,
  sanitizeViewDescription,
  sanitizeViewName,
} from "../utils/viewInput.validation";

export default class ViewService {
  /**
   * Tạo View mới
   */
  async createView(data: CreateViewDTO, userId: string): Promise<IView> {
    // Validate logic nghiệp vụ
    if (data.type === "2D" && !data.relatedFileId) {
      throw new AppError("2D View must be associated with a file", 400);
    }

    const safeName = sanitizeViewName(data.name);
    assertValidViewName(safeName);
    if (data.description !== undefined && data.description !== null) {
      assertDescriptionWithinLimit(data.description);
    }
    const safeDescription =
      data.description === undefined || data.description === null
        ? ""
        : sanitizeViewDescription(data.description);
    const tagIds = normalizeViewTagIds(data.tags ?? []);

    const newView = new ViewModel({
      projectId: new Types.ObjectId(data.projectId),
      name: safeName,
      description: safeDescription,
      thumbnailUrl: data.thumbnailUrl,
      type: data.type,
      relatedFileId: data.relatedFileId
        ? new Types.ObjectId(data.relatedFileId)
        : undefined,
      createdBy: new Types.ObjectId(userId),
      sharedWith: {
        isPublic: data.sharedWith?.isPublic || false,
        users: data.sharedWith?.users?.map((u) => new Types.ObjectId(u)) || [],
      },
      tags: tagIds.map((id) => new Types.ObjectId(id)),
      viewState: data.viewState,
    });

    // [FIX] TS2322: Ép kiểu kết quả trả về để khớp với Interface IView
    return (await newView.save()) as unknown as IView;
  }

  /**
   * Lấy danh sách Views theo Project + Phân quyền
   */
  async getViews(
    projectId: string,
    currentUser: any,
    filters: {
      type?: string;
      createdBy?: string;
      userIds?: string;
      groupIds?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const projectObjId = new Types.ObjectId(projectId);
    const userObjId = new Types.ObjectId(currentUser._id);
    const currentUserId = currentUser._id.toString();

    const matchStage: any = {
      projectId: projectObjId,
    };

    if (filters.type) {
      matchStage.type = filters.type;
    }

    // --- Users & Groups Filter Logic ---
    let targetUserIds: Types.ObjectId[] = [];

    // 1. Users Filter
    if (filters.userIds) {
      const ids = filters.userIds
        .split(",")
        .map((id) => new Types.ObjectId(id.trim()));
      targetUserIds.push(...ids);
    }

    // 2. Groups Filter
    if (filters.groupIds) {
      const groupIds = filters.groupIds
        .split(",")
        .map((id) => new Types.ObjectId(id.trim()));
      const members = await groupMemberModel
        .find({ groupId: { $in: groupIds } })
        .select("userId");
      const memberUserIds = members.map((m) => m.userId); // Ensure this is ObjectId
      targetUserIds.push(...memberUserIds);
    }

    // Apply User/Group filters to 'createdBy'
    if (targetUserIds.length > 0) {
      matchStage.createdBy = { $in: targetUserIds };
    } else if (filters.createdBy) {
      // Fallback to single createdBy if no multi-user filter provided
      matchStage.createdBy = new Types.ObjectId(filters.createdBy);
    }

    // Date Modified Filter
    if (filters.startDate || filters.endDate) {
      matchStage.updatedAt = {};
      if (filters.startDate)
        matchStage.updatedAt.$gte = new Date(filters.startDate);
      if (filters.endDate)
        matchStage.updatedAt.$lte = new Date(filters.endDate);
    }

    console.log(currentUser.role);

    if (currentUser.role === "admin") {
      // Admin: Load all
    } else {
      // User: Load related (Created by me OR Public OR Shared with me)
      const permissionQuery = {
        $or: [
          { createdBy: userObjId },
          { "sharedWith.isPublic": true },
          { "sharedWith.users": userObjId },
        ],
      };

      // Merge permission query with matchStage
      if (matchStage.$or) {
        // If matchStage already has $or (unlikely given current logic), we AND them
        matchStage.$and = [
          { $or: matchStage.$or },
          { $or: permissionQuery.$or },
        ];
        delete matchStage.$or;
      } else {
        matchStage.$or = permissionQuery.$or;
      }
      
      // If we filtered by createdBy (via Users/Groups), we need to ensure that condition is ALSO met.
      // The current matchStage structure handles properties (like createdBy) as AND with the $or condition added above?
      // Mongoose: { createdBy: ..., $or: [...] } means createdBy AND ($or condition).
      // So this works correctly.
    }

    // [LƯU Ý] Vì dùng .lean(), kết quả trả về là Plain JS Object, không phải Mongoose Document
    return await ViewModel.find(matchStage)
      .populate("createdBy", "fullName email")
      .populate("relatedFileId", "name")
      .populate("tags", "name color")
      .sort({ updatedAt: -1 })
      .lean();
  }

  /**
   * Lấy chi tiết 1 View
   */
  async getViewById(viewId: string, currentUserId: string) {
    const view = await ViewModel.findById(viewId)
      .populate("createdBy", "fullName")
      .populate("tags", "name color");
    if (!view) throw new AppError("View not found", 404);

    const isOwner = view.createdBy._id.toString() === currentUserId;

    // [FIX] TS18049: Dùng Optional Chaining (?.) để an toàn khi truy cập sharedWith
    const isPublic = view.sharedWith?.isPublic || false;
    const isShared =
      view.sharedWith?.users?.some((id) => id.toString() === currentUserId) ||
      false;

    if (!isOwner && !isPublic && !isShared) {
      throw new AppError("You do not have permission to view this", 403);
    }

    return view;
  }

  /**
   * Update View
   */
  async updateView(
    viewId: string,
    updateData: Partial<CreateViewDTO>,
    currentUserId: string,
  ) {
    const view = await ViewModel.findById(viewId);
    if (!view) throw new AppError("View not found", 404);

    if (view.createdBy.toString() !== currentUserId) {
      throw new AppError("Only the owner can modify this view", 403);
    }

    if (updateData.name !== undefined && updateData.name !== null) {
      const n = sanitizeViewName(updateData.name);
      assertValidViewName(n);
      view.name = n;
    }

    if (updateData.description !== undefined) {
      assertDescriptionWithinLimit(updateData.description);
      view.description = sanitizeViewDescription(updateData.description);
    }

    if (updateData.tags !== undefined) {
      const ids = normalizeViewTagIds(updateData.tags);
      view.tags = ids.map((id) => new Types.ObjectId(id)) as any;
    }

    // [FIX] TS2741: Việc fix Interface IViewState ở bước 1 sẽ giải quyết lỗi gán ở đây
    // Nếu vẫn lỗi, hãy đảm bảo updateData.viewState có cấu trúc khớp với Schema
    if (updateData.viewState) view.viewState = updateData.viewState as any;

    if (updateData.thumbnailUrl) view.thumbnailUrl = updateData.thumbnailUrl;

    // Update Sharing logic
    if (updateData.sharedWith) {
      // [FIX] TS18049: Đảm bảo view.sharedWith tồn tại trước khi gán
      if (!view.sharedWith) {
        view.sharedWith = { isPublic: false, users: [] };
      }

      if (updateData.sharedWith.isPublic !== undefined)
        view.sharedWith.isPublic = updateData.sharedWith.isPublic;

      if (updateData.sharedWith.users)
        view.sharedWith.users = updateData.sharedWith.users.map(
          (id) => new Types.ObjectId(id),
        );
    }

    await view.save();
    const fresh = await ViewModel.findById(view._id)
      .populate("createdBy", "fullName email")
      .populate("relatedFileId", "name")
      .populate("tags", "name color");
    return fresh as unknown as IView;
  }

  async deleteView(viewId: string, currentUserId: string) {
    const view = await ViewModel.findById(viewId);
    if (!view) throw new AppError("View not found", 404);

    if (view.createdBy.toString() !== currentUserId) {
      throw new AppError("Only the owner can delete this view", 403);
    }

    await ViewModel.deleteOne({ _id: view._id });
    return view as unknown as IView;
  }
}
