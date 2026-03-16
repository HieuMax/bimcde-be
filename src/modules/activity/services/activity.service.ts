import ActivityModel from "../schemas/activity.schema";
import { CreateActivityDTO, IActivity } from "../interfaces/activity.interface";
import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import groupMemberModel from "../../team/schemas/group-member.schema";
import FileModel from "../../file/schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";

export default class ActivityService {
  /**
   * Ghi lại một hoạt động vào hệ thống.
   * Hàm này thường được gọi bởi các Service khác.
   */
  async logActivity(data: CreateActivityDTO): Promise<IActivity> {
    try {
      const newActivity = new ActivityModel({
        projectId: new Types.ObjectId(data.projectId),
        actor: {
          userId: new Types.ObjectId(data.actor.userId),
          fullName: data.actor.fullName,
          email: data.actor.email,
        },
        actionGroup: data.actionGroup,
        actionType: data.actionType,
        target: {
          itemId: new Types.ObjectId(data.target.itemId),
          itemModel: data.target.itemModel,
          itemName: data.target.itemName,
        },
        description: data.description,
        metaData: data.metaData,
      });

      return (await newActivity.save()) as unknown as IActivity;
    } catch (error) {
      // Lưu ý: Log activity thất bại không nên làm crash luồng chính của app
      // Chỉ nên console.error để debug
      console.error("Failed to create audit log:", error);
      throw error;
    }
  }

  /**
   * Lấy danh sách hoạt động cho trang Timeline/Audit
   * Hỗ trợ Filter theo User, Group, Date và Pagination
   */
  async getActivities(
    projectId: string,
    filters: {
      userId?: string;
      groupIds?: string;
      actionGroup?: string;
      actionTypes?: string;
      startDate?: string;
      endDate?: string;
      page?: number;
      limit?: number;
    },
  ) {
    const projectObjId = new Types.ObjectId(projectId);
    const query: any = { projectId: projectObjId };

    let targetUserIds: Types.ObjectId[] = [];

    // 1. Nếu có lọc theo User cụ thể
    if (filters.userId) {
      const ids = filters.userId.includes(",")
        ? filters.userId.split(",").map((id) => new Types.ObjectId(id.trim()))
        : [new Types.ObjectId(filters.userId)];
      targetUserIds = [...targetUserIds, ...ids];
    }

    // 2. [NEW] Nếu có lọc theo Group -> Lấy tất cả user trong group đó
    if (filters.groupIds) {
      const groupIds = filters.groupIds
        .split(",")
        .map((id) => new Types.ObjectId(id.trim()));

      // Tìm thành viên thuộc các group này
      const members = await groupMemberModel
        .find({ groupId: { $in: groupIds } })
        .select("userId");

      if (members.length === 0) {
        return {
          data: [],
          pagination: {
            total: 0,
            page: filters.page || 1,
            limit: filters.limit || 20,
            totalPages: 0,
          },
        };
      }
      const memberUserIds = members.map((m) => m.userId);

      targetUserIds = [...targetUserIds, ...memberUserIds];
    }

    // 3. Apply vào Query
    if (targetUserIds.length > 0) {
      query["actor.userId"] = { $in: targetUserIds };
    }
    if (filters.actionGroup) {
      query.actionGroup = { $in: filters.actionGroup.split(",") };
    }
    if (filters.actionTypes) {
      const typesArray = filters.actionTypes.split(",");
      query.actionType = { $in: typesArray };
    }

    if (filters.startDate || filters.endDate) {
      query.createdAt = {};
      if (filters.startDate) query.createdAt.$gte = new Date(filters.startDate);
      if (filters.endDate) query.createdAt.$lte = new Date(filters.endDate);
    }

    // 2. Pagination Setup
    const page = filters.page || 1;
    const limit = filters.limit || 20;
    const skip = (page - 1) * limit;

    // 3. Execute Query
    const [activities, total] = await Promise.all([
      ActivityModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityModel.countDocuments(query),
    ]);

    // [NEW] 4. Post-process: Kiểm tra trạng thái Restorable cho các item bị xóa
    const processedActivities = await Promise.all(
      activities.map(async (act: any) => {
        // Mặc định status là NONE
        let restoreStatus: "NONE" | "RESTORABLE" | "RESTORED" = "NONE";

        // Chỉ check logic này cho hành động DELETE
        if (act.actionType === "DELETE") {
          let item = null;

          if (act.target.itemModel === "File") {
            // Tìm file, lấy cả trường isDeleted
            item = await FileModel.findOne({ _id: act.target.itemId })
              .select("isDeleted")
              .lean();
          } else if (act.target.itemModel === "Folder") {
            item = await FolderModel.findOne({ _id: act.target.itemId })
              .select("isDeleted")
              .lean();
          }

          if (item) {
            // Nếu tìm thấy item:
            // isDeleted = true  -> Chưa restore -> RESTORABLE
            // isDeleted = false -> Đã restore -> RESTORED
            restoreStatus = item.isDeleted ? "RESTORABLE" : "RESTORED";
          } else {
            // Không tìm thấy -> Đã bị cleanup xóa vĩnh viễn -> NONE
            restoreStatus = "NONE";
          }
        }

        return { ...act, restoreStatus };
      }),
    );
    return {
      data: processedActivities,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
