import ReleaseModel from "../schemas/release.schema";
import FileModel from "../../file/schemas/file.schema";
import { CreateReleaseDTO, IRelease } from "../interfaces/release.interface";
import { Types } from "mongoose";
import { AppError } from "../../../utils/AppError";
import archiver from "archiver";
import { Response } from "express";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../../lib/r2.lib";
import { env } from "../../../env";
import UserModel from "../../account/schemas/account.schema";
import GroupModel from "../../team/schemas/group.schema";
import GroupMemberModel from "../../team/schemas/group-member.schema";
import {
  assertValidReleaseName,
  parseAndAssertFutureDueDate,
  sanitizeReleaseName,
  sanitizeReleaseNote,
} from "../utils/releaseInput.validation";

export default class ReleaseService {
  // 1. Tạo Release (Mặc định là DRAFT)
  async createRelease(
    data: CreateReleaseDTO,
    userId: string,
  ): Promise<IRelease> {
    const safeName = sanitizeReleaseName(data.name);
    assertValidReleaseName(safeName);
    const safeDescription = sanitizeReleaseNote(data.description);
    const safeDueDate = parseAndAssertFutureDueDate(data.dueDate);

    const projectObjId = new Types.ObjectId(data.projectId);

    // Xử lý danh sách items
    const processedItems = [];

    if (data.items && data.items.length > 0) {
      const fileIds = data.items.map((i) => i.fileId);
      // Populate versions.uploadedBy để lấy tên người sửa
      const files = await FileModel.find({
        _id: { $in: fileIds },
        projectId: projectObjId,
        isDeleted: false,
      })
        .populate("versions.uploadedBy", "fullName email")
        .populate("tags", "name color");

      const fileMap = new Map(files.map((f) => [f._id.toString(), f]));

      for (const item of data.items) {
        const file = fileMap.get(item.fileId);
        if (!file) continue;

        const targetVersion = item.version || file.currentVersion;
        const verExists = file.versions.find(
          (v) => v.version === targetVersion,
        );
        if (!verExists) continue;

        // Lấy thông tin người sửa từ version hoặc fallback
        const modifierName =
          (verExists.uploadedBy as any)?.fullName || "Unknown";
        const modifierId = (verExists.uploadedBy as any)?._id;

        processedItems.push({
          fileId: file._id,
          version: targetVersion,
          name: verExists.fileName || file.name,
          size: verExists.size || 0, // Snapshot size
          mimeType: verExists.mimeType,
          location: verExists.location,
          modifiedBy: modifierName, // Snapshot người sửa
          modifiedById: modifierId,
          updatedAt: verExists.createdAt, // Snapshot ngày sửa
          tags: (file.tags as any[])?.map((t) => ({
            name: t.name,
            color: t.color,
          })),
        });
      }
    }

    const newRelease = new ReleaseModel({
      projectId: projectObjId,
      name: safeName,
      description: safeDescription,
      status: "DRAFT",
      items: processedItems,
      dueDate: safeDueDate,
      recipients: data.recipients?.map((id) => new Types.ObjectId(id)) || [],
      createdBy: new Types.ObjectId(userId),
    });

    return await newRelease.save();
  }

  // 2. Lấy danh sách Release
  async getReleases(
    projectId: string,
    filters: {
      status?: string;
      userIds?: string;
      groupIds?: string;
      dueStartDate?: string;
      dueEndDate?: string;
    },
    currentUser?: any,
  ) {
    const query: any = { projectId: new Types.ObjectId(projectId) };

    // 1. Filter Status
    if (filters.status && filters.status !== "ALL") {
      query.status = filters.status;
    }

    // 2. Filter Date
    if (filters.dueStartDate || filters.dueEndDate) {
      query.dueDate = {};
      if (filters.dueStartDate)
        query.dueDate.$gte = new Date(filters.dueStartDate);
      if (filters.dueEndDate) query.dueDate.$lte = new Date(filters.dueEndDate);
    }

    // --- LOGIC FILTER USER & GROUP (KẾT HỢP AND) ---
    // Nếu chọn cả User và Group, ta dùng $and để lọc giao nhau (hoặc tùy nghiệp vụ, thường là lọc thêm)

    const conditions: any[] = [];

    // [NEW] Permission Check: Nếu không phải Admin, chỉ load Release liên quan
    if (currentUser && currentUser.role !== "admin") {
      const userGroups = await GroupMemberModel.find({
        userId: currentUser._id,
      }).select("groupId");
      const userGroupIds = userGroups.map((g) => g.groupId);

      conditions.push({
        $or: [
          { createdBy: new Types.ObjectId(currentUser._id) },
          { recipients: new Types.ObjectId(currentUser._id) },
          { recipients: { $in: userGroupIds } },
        ],
      });
    }

    // [UPDATE] Logic User: Tìm trong CreatedBy HOẶC Recipients
    if (filters.userIds) {
      const userObjIds = filters.userIds
        .split(",")
        .map((id) => new Types.ObjectId(id.trim()));
      conditions.push({
        $or: [
          { createdBy: { $in: userObjIds } }, // Người tạo là User này
          { recipients: { $in: userObjIds } }, // HOẶC User này là người nhận trực tiếp
        ],
      });
    }

    // [NEW] Logic Group: Tìm trong Recipients (Group ID)
    if (filters.groupIds) {
      const groupObjIds = filters.groupIds
        .split(",")
        .map((id) => new Types.ObjectId(id.trim()));
      conditions.push({
        recipients: { $in: groupObjIds }, // Release gửi cho Group này
      });
    }

    // Nếu có điều kiện user/group thì merge vào query chính bằng $and
    if (conditions.length > 0) {
      query.$and = conditions;
    }

    // Query DB
    const releases = await ReleaseModel.find(query)
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .lean();

    // Populate recipients thủ công (như đã làm ở các bước trước)
    const populatedReleases = await Promise.all(
      releases.map(async (release) => {
        const recipients = await this.populateRecipients(
          release.recipients || [],
        );
        return { ...release, recipients };
      }),
    );

    return populatedReleases;
  }

  // 3. Lấy chi tiết Release
  async getReleaseById(id: string) {
    const release = await ReleaseModel.findById(id).lean();
    if (!release) throw new AppError("Release not found", 404);

    // Populate thủ công recipients
    const recipientDetails = await this.populateRecipients(release.recipients);

    return { ...release, recipients: recipientDetails };
  }
  private async populateRecipients(ids: any[]) {
    if (!ids || ids.length === 0) return [];

    const uniqueIds = Array.from(new Set(ids.map((id) => id.toString())));

    // 1. Tìm User
    const users = await UserModel.find({ _id: { $in: uniqueIds } })
      .select("_id fullName email")
      .lean();

    // 2. Tìm Group
    const groups = await GroupModel.find({ _id: { $in: uniqueIds } })
      .select("_id name")
      .lean();

    const userMap = new Map(
      users.map((u) => [u._id.toString(), { ...u, type: "USER" }]),
    );
    // Map Group name thành fullName để Frontend dễ hiển thị chung
    const groupMap = new Map(
      groups.map((g) => [
        g._id.toString(),
        { ...g, fullName: g.name, type: "GROUP" },
      ]),
    );

    const result = [];
    for (const id of ids) {
      const idStr = id.toString();
      if (userMap.has(idStr)) {
        result.push(userMap.get(idStr));
      } else if (groupMap.has(idStr)) {
        result.push(groupMap.get(idStr));
      }
    }
    return result;
  }

  // 4. Update Release (Chỉ cho phép khi còn là DRAFT)
  async updateRelease(
    id: string,
    updateData: Partial<CreateReleaseDTO>,
    currentUser: any,
  ) {
    const release = await ReleaseModel.findById(id);
    if (!release) throw new AppError("Release not found", 404);

    if (
      currentUser.role !== "admin" &&
      release.createdBy.toString() !== currentUser._id.toString()
    ) {
      throw new AppError(
        "Permission denied. Only the creator or admin can update this release.",
        403,
      );
    }

    if (release.status === "SENT") {
      throw new AppError("Cannot update a SENT release", 400);
    }

    // Map các trường cơ bản (sanitize giống create)
    if (updateData.name !== undefined && updateData.name !== null) {
      const safeName = sanitizeReleaseName(updateData.name);
      assertValidReleaseName(safeName);
      release.name = safeName;
    }
    if (updateData.description !== undefined) {
      release.description = sanitizeReleaseNote(updateData.description);
    }
    if (updateData.dueDate !== undefined && updateData.dueDate !== null) {
      release.dueDate = parseAndAssertFutureDueDate(updateData.dueDate);
    }

    if (updateData.recipients) {
      release.recipients = updateData.recipients.map(
        (r) => new Types.ObjectId(r),
      );
    }

    // [FIX] Xử lý cập nhật Items (Thêm/Xóa file)
    if (updateData.items) {
      // Tái tạo lại danh sách snapshot item từ fileId gửi lên
      const processedItems = await this.processReleaseItems(
        updateData.items,
        release.projectId,
      );
      release.items = processedItems;
    }

    return await release.save();
  }

  async deleteRelease(id: string, currentUser: any) {
    const release = await ReleaseModel.findById(id);
    if (!release) throw new AppError("Release not found", 404);

    if (
      currentUser.role !== "admin" &&
      release.createdBy.toString() !== currentUser._id.toString()
    ) {
      throw new AppError(
        "Permission denied. Only the creator or admin can delete this release.",
        403,
      );
    }

    // Chỉ cho phép xóa khi còn là DRAFT hoặc nếu là Admin (tùy logic)
    // if (release.status === "SENT") throw new AppError("Cannot delete a SENT release", 400);

    await ReleaseModel.deleteOne({ _id: id });
    return true;
  }

  // New Method: Remove single item from release
  async removeItemFromRelease(
    releaseId: string,
    fileId: string,
    currentUser: any,
  ) {
    const release = await ReleaseModel.findById(releaseId);
    if (!release) throw new AppError("Release not found", 404);

    if (
      currentUser.role !== "admin" &&
      release.createdBy.toString() !== currentUser._id.toString()
    ) {
      throw new AppError(
        "Permission denied. Only the creator or admin can modify this release.",
        403,
      );
    }

    if (release.status === "SENT") {
      throw new AppError("Cannot modify a SENT release", 400);
    }

    // Filter out the item
    // Note: item.fileId is an ObjectId
    const initialLength = release.items.length;
    release.items = release.items.filter(
      (item) => item.fileId.toString() !== fileId,
    );

    if (release.items.length === initialLength) {
      throw new AppError("File not found in this release", 404);
    }

    return await release.save();
  }

  // New Method: Bulk remove items from release
  async removeItemsFromRelease(
    releaseId: string,
    fileIds: string[],
    currentUser: any,
  ) {
    const release = await ReleaseModel.findById(releaseId);
    if (!release) throw new AppError("Release not found", 404);

    if (
      currentUser.role !== "admin" &&
      release.createdBy.toString() !== currentUser._id.toString()
    ) {
      throw new AppError(
        "Permission denied. Only the creator or admin can modify this release.",
        403,
      );
    }

    if (release.status === "SENT") {
      throw new AppError("Cannot modify a SENT release", 400);
    }

    const initialLength = release.items.length;
    // Filter out items that match any of the provided fileIds
    release.items = release.items.filter(
      (item) => !fileIds.includes(item.fileId.toString()),
    );

    if (release.items.length === initialLength) {
      throw new AppError("No items were removed (files not found in release)", 404);
    }

    return await release.save();
  }

  // 5. Gửi Release (Chuyển trạng thái sang SENT)
  async sendRelease(id: string, currentUser: any) {
    // 1. Lấy Release
    const release = await ReleaseModel.findById(id);
    if (!release) throw new AppError("Release not found", 404);

    if (
      currentUser.role !== "admin" &&
      release.createdBy.toString() !== currentUser._id.toString()
    ) {
      throw new AppError(
        "Permission denied. Only the creator or admin can send this release.",
        403,
      );
    }

    if (release.status === "SENT")
      throw new AppError("Release already sent", 400);

    const rawRecipientIds = release.recipients.map((id) => id.toString());

    if (rawRecipientIds.length === 0) {
      throw new AppError("No recipients to send", 400);
    }

    // 2. Phân loại: Tìm xem trong list ID đó, cái nào là Group
    const groupsFound = await GroupModel.find({
      _id: { $in: rawRecipientIds },
    }).select("_id");

    const groupIds = groupsFound.map((g) => g._id.toString());

    // Những ID không nằm trong bảng Group thì ta coi là User ID trực tiếp
    const directUserIds = rawRecipientIds.filter(
      (id) => !groupIds.includes(id),
    );

    // 3. Lấy thành viên của các Group
    let groupMemberUserIds: string[] = [];
    if (groupIds.length > 0) {
      const members = await GroupMemberModel.find({
        groupId: { $in: groupIds },
      }).select("userId");
      groupMemberUserIds = members.map((m) => m.userId.toString());
    }

    // 4. Gộp và Deduplicate (Loại bỏ trùng lặp)
    // Set sẽ tự động loại bỏ các ID trùng nhau
    const uniqueUserIds = new Set([...directUserIds, ...groupMemberUserIds]);
    const finalRecipientList = Array.from(uniqueUserIds);

    // 5. Lấy thông tin email của các User này để gửi
    const usersToSend = await UserModel.find({
      _id: { $in: finalRecipientList },
    }).select("email fullName");

    // 6. Gửi Email (Ví dụ)
    // Bạn có thể dùng Promise.all để gửi song song hoặc dùng Queue
    const emailPromises = usersToSend.map((user) => {
      // Gọi hàm send email của bạn ở đây
      // Ví dụ: return sendEmail(user.email, "New Release", `Hello ${user.fullName}...`);
      console.log(`Sending release to: ${user.email} (User ID: ${user._id})`);
      return Promise.resolve(); // Mock
    });

    await Promise.all(emailPromises);

    // 7. Cập nhật trạng thái Release
    release.status = "SENT";
    release.sentAt = new Date();
    await release.save();

    return release;
  }

  // 6. Download Release (Zipping đúng version file)
  async downloadRelease(id: string, res: Response) {
    const release = await ReleaseModel.findById(id);
    if (!release) throw new AppError("Release not found", 404);

    // Lấy thông tin các file gốc để lấy StorageKey
    const fileIds = release.items.map((i) => i.fileId);
    const files = await FileModel.find({ _id: { $in: fileIds } });
    const fileMap = new Map(files.map((f) => [f._id.toString(), f]));

    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${release.name}.zip"`,
    );
    res.setHeader("Content-Type", "application/zip");

    archive.pipe(res);

    for (const item of release.items) {
      const fileDoc = fileMap.get(item.fileId.toString());
      if (!fileDoc) continue; // File gốc bị xóa cứng (hiếm gặp nếu dùng soft delete)

      // QUAN TRỌNG: Lấy đúng version đã lưu trong Release
      const versionData = fileDoc.versions.find(
        (v) => v.version === item.version,
      );

      if (versionData && versionData.storageKey) {
        try {
          const command = new GetObjectCommand({
            Bucket: env.R2_BUCKET_NAME,
            Key: versionData.storageKey,
          });
          const s3Item = await s3Client.send(command);

          // Tên file trong zip = Tên snapshot trong release
          archive.append(s3Item.Body as any, { name: item.name });
        } catch (err) {
          console.error(`Error fetching file version ${item.version}`, err);
        }
      }
    }

    await archive.finalize();
  }
  // --- HELPER: Xử lý logic Snapshot Item ---
  // Tách logic này ra để dùng chung cho cả Create và Update
  private async processReleaseItems(
    itemsInput: { fileId: string; version?: number }[],
    projectId: Types.ObjectId,
  ) {
    const processedItems = [];

    if (itemsInput && itemsInput.length > 0) {
      const fileIds = itemsInput.map((i) => i.fileId);

      // Populate versions.uploadedBy để lấy tên người sửa
      const files = await FileModel.find({
        _id: { $in: fileIds },
        projectId: projectId,
        isDeleted: false,
      })
        .populate("versions.uploadedBy", "fullName email")
        .populate("tags", "name color");

      const fileMap = new Map(files.map((f) => [f._id.toString(), f]));

      for (const item of itemsInput) {
        const file = fileMap.get(item.fileId.toString());
        if (!file) continue;

        const targetVersion = item.version || file.currentVersion;
        const verExists = file.versions.find(
          (v) => v.version === targetVersion,
        );
        if (!verExists) continue;

        const modifierName =
          (verExists.uploadedBy as any)?.fullName || "Unknown";
        const modifierId = (verExists.uploadedBy as any)?._id;

        processedItems.push({
          fileId: file._id,
          version: targetVersion,
          name: verExists.fileName || file.name,
          size: verExists.size || 0,
          mimeType: verExists.mimeType,
          location: verExists.location,
          modifiedBy: modifierName,
          modifiedById: modifierId,
          updatedAt: verExists.createdAt,
          tags: (file.tags as any[])?.map((t) => ({
            name: t.name,
            color: t.color,
          })),
        });
      }
    }
    return processedItems;
  }
}
