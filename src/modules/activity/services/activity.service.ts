import ActivityModel from "../schemas/activity.schema";
import { CreateActivityDTO, IActivity } from "../interfaces/activity.interface";
import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import groupMemberModel from "../../team/schemas/group-member.schema";
import FileModel from "../../file/schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";

export default class ActivityService {
  private async collectDescendantFolderIds(
    projectId: Types.ObjectId,
    rootFolderId: Types.ObjectId,
  ): Promise<Types.ObjectId[]> {
    const result: Types.ObjectId[] = [rootFolderId];
    let frontier: Types.ObjectId[] = [rootFolderId];
    while (frontier.length > 0) {
      const children = await FolderModel.find({
        projectId,
        parentId: { $in: frontier },
        isDeleted: false,
      })
        .select("_id")
        .lean();
      const next = children.map((c) => c._id as Types.ObjectId);
      result.push(...next);
      frontier = next;
    }
    return result;
  }

  /** Adds restoreStatus for DELETE actions (same rules as project-wide feed). */
  private async attachRestoreStatus(
    activities: any[],
    lightweight: boolean,
  ): Promise<any[]> {
    if (lightweight) {
      return activities.map((act: any) => ({ ...act, restoreStatus: "NONE" }));
    }
    return Promise.all(
      activities.map(async (act: any) => {
        let restoreStatus: "NONE" | "RESTORABLE" | "RESTORED" = "NONE";
        if (act.actionType === "DELETE") {
          let item = null;
          if (act.target.itemModel === "File") {
            item = await FileModel.findOne({ _id: act.target.itemId })
              .select("isDeleted")
              .lean();
          } else if (act.target.itemModel === "Folder") {
            item = await FolderModel.findOne({ _id: act.target.itemId })
              .select("isDeleted")
              .lean();
          }
          if (item) {
            restoreStatus = item.isDeleted ? "RESTORABLE" : "RESTORED";
          } else {
            restoreStatus = "NONE";
          }
        }
        return { ...act, restoreStatus };
      }),
    );
  }

  /** Folder id for explorer deep links (File targets only). */
  private async attachFileFolderIds(activities: any[]): Promise<any[]> {
    const fileIds = activities
      .filter((a) => a.target?.itemModel === "File")
      .map((a) => String(a.target.itemId));
    if (fileIds.length === 0) return activities;
    const unique = [...new Set(fileIds)];
    const files = await FileModel.find({
      _id: { $in: unique.map((id) => new Types.ObjectId(id)) },
    })
      .select("_id folderId")
      .lean();
    const map = new Map(
      files.map((f) => [
        String(f._id),
        f.folderId ? String(f.folderId) : null,
      ]),
    );
    return activities.map((a) => {
      if (a.target?.itemModel !== "File") return a;
      const fid = String(a.target.itemId);
      return { ...a, fileFolderId: map.get(fid) ?? null };
    });
  }

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
      /** When true, skip restoreStatus checks (faster for recent activity widget) */
      lightweight?: boolean;
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

    const withFolders = await this.attachFileFolderIds(activities);
    const processedActivities = await this.attachRestoreStatus(
      withFolders,
      !!filters.lightweight,
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

  /**
   * Activities for a single file, or for a folder + all files in its subtree.
   */
  async getActivitiesForItem(
    projectId: string,
    opts: {
      fileId?: string;
      folderId?: string;
      page?: number;
      limit?: number;
      lightweight?: boolean;
    },
  ) {
    const projectObjId = new Types.ObjectId(projectId);
    const page = opts.page || 1;
    const limit = opts.limit || 20;
    const skip = (page - 1) * limit;
    const lightweight = !!opts.lightweight;

    const query: Record<string, unknown> = { projectId: projectObjId };

    if (opts.fileId) {
      const file = await FileModel.findOne({
        _id: new Types.ObjectId(opts.fileId),
        projectId: projectObjId,
      })
        .select("_id")
        .lean();
      if (!file) {
        throw new AppError("File not found", 404);
      }
      query["target.itemModel"] = "File";
      query["target.itemId"] = new Types.ObjectId(opts.fileId);
    } else if (opts.folderId) {
      const folder = await FolderModel.findOne({
        _id: new Types.ObjectId(opts.folderId),
        projectId: projectObjId,
        isDeleted: false,
      })
        .select("_id")
        .lean();
      if (!folder) {
        throw new AppError("Folder not found", 404);
      }
      const folderIds = await this.collectDescendantFolderIds(
        projectObjId,
        new Types.ObjectId(opts.folderId),
      );
      const fileDocs = await FileModel.find({
        projectId: projectObjId,
        folderId: { $in: folderIds },
      })
        .select("_id")
        .lean();
      const fileObjectIds = fileDocs.map((f) => f._id as Types.ObjectId);
      const orConditions: Record<string, unknown>[] = [
        {
          "target.itemModel": "Folder",
          "target.itemId": { $in: folderIds },
        },
      ];
      if (fileObjectIds.length > 0) {
        orConditions.push({
          "target.itemModel": "File",
          "target.itemId": { $in: fileObjectIds },
        });
      }
      query.$or = orConditions;
    } else {
      throw new AppError("Provide fileId or folderId", 400);
    }

    const [activities, total] = await Promise.all([
      ActivityModel.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      ActivityModel.countDocuments(query),
    ]);

    const withFolders = await this.attachFileFolderIds(activities);
    const processed = await this.attachRestoreStatus(withFolders, lightweight);

    return {
      data: processed,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
