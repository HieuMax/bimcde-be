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
import GroupModel from "../../team/schemas/group.schema";
import GroupMemberModel from "../../team/schemas/group-member.schema";
import {
  assertValidReleaseName,
  parseAndAssertFutureDueDate,
  sanitizeReleaseName,
  sanitizeReleaseNote,
} from "../utils/releaseInput.validation";
import projectSchema from "../../project/schemas/project.schema";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import { parseCdeWorkflowMode } from "../../../constants/cde-workflow";
import { migrateReleaseStatuses } from "../migrations/migrateReleaseStatuses";
import { unsetReleaseRecipientsField } from "../migrations/unsetReleaseRecipients";

export default class ReleaseService {
  private static legacyMigrationPromise: Promise<void> | null = null;

  private async ensureLegacyReleaseDataMigrated(): Promise<void> {
    if (!ReleaseService.legacyMigrationPromise) {
      ReleaseService.legacyMigrationPromise = (async () => {
        await migrateReleaseStatuses();
        await unsetReleaseRecipientsField();
      })().catch((error) => {
        ReleaseService.legacyMigrationPromise = null;
        throw error;
      });
    }
    await ReleaseService.legacyMigrationPromise;
  }

  private normalizeMemberRole(role: unknown): "admin" | "user" {
    const r = (role ?? "user").toString().toLowerCase();
    return r === "admin" ? "admin" : "user";
  }

  private async assertProjectMember(
    userId: string,
    projectId: Types.ObjectId | string,
  ) {
    await this.ensureLegacyReleaseDataMigrated();
    const m = await projectMemberSchema.findOne({
      userId: new Types.ObjectId(userId),
      projectId: new Types.ObjectId(projectId.toString()),
    });
    if (!m) {
      throw new AppError("You don't have access to this project", 403);
    }
    return { role: this.normalizeMemberRole(m.role) };
  }

  private async isUserGroupLeaderInProject(
    userId: string,
    projectId: Types.ObjectId,
  ): Promise<boolean> {
    const groups = await GroupModel.find({ projectId }).select("_id").lean();
    const gids = groups.map((g) => g._id);
    if (gids.length === 0) return false;
    const row = await GroupMemberModel.findOne({
      userId: new Types.ObjectId(userId),
      groupId: { $in: gids },
      role: "GROUP_LEADER",
    }).lean();
    return !!row;
  }

  private async assertCanCreateRelease(userId: string, projectId: Types.ObjectId) {
    const member = await this.assertProjectMember(userId, projectId);
    const project = await projectSchema.findById(projectId).lean();
    if (!project) throw new AppError("Project not found", 404);
    const mode = parseCdeWorkflowMode(project.workflowMode as any) ?? "NORMAL";
    if (mode === "ISO_19650") {
      const isLeader = await this.isUserGroupLeaderInProject(userId, projectId);
      if (member.role !== "admin" && !isLeader) {
        throw new AppError(
          "Only project administrators and group leaders can create releases in ISO projects.",
          403,
        );
      }
    }
    return member;
  }

  private canEditRelease(
    member: { role: "admin" | "user" },
    release: { createdBy: Types.ObjectId | { toString(): string } },
    userId: string,
  ): boolean {
    if (member.role === "admin") return true;
    const created = release.createdBy?.toString?.() ?? String(release.createdBy);
    return created === userId;
  }

  private assertDraftForMutation(release: { status: string }) {
    if (release.status !== "DRAFT") {
      throw new AppError("This action is only allowed while the release is a draft.", 400);
    }
  }
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
    await this.assertCanCreateRelease(userId, projectObjId);

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
      dueStartDate?: string;
      dueEndDate?: string;
    },
    currentUser?: any,
  ) {
    if (!currentUser?._id) {
      throw new AppError("Unauthorized", 401);
    }
    await this.assertProjectMember(currentUser._id.toString(), projectId);

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

    const conditions: any[] = [];

    if (filters.userIds) {
      const userObjIds = filters.userIds
        .split(",")
        .map((id) => new Types.ObjectId(id.trim()));
      conditions.push({ createdBy: { $in: userObjIds } });
    }

    if (conditions.length > 0) {
      query.$and = conditions;
    }

    return await ReleaseModel.find(query)
      .populate("createdBy", "fullName email")
      .sort({ createdAt: -1 })
      .lean();
  }

  // 3. Lấy chi tiết Release
  async getReleaseById(id: string, viewerUserId: string) {
    const release = await ReleaseModel.findById(id).lean();
    if (!release) throw new AppError("Release not found", 404);

    await this.assertProjectMember(viewerUserId, release.projectId);

    return release;
  }

  // 4. Update Release (Chỉ cho phép khi còn là DRAFT)
  async updateRelease(
    id: string,
    updateData: Partial<CreateReleaseDTO>,
    currentUser: any,
  ) {
    const release = await ReleaseModel.findById(id);
    if (!release) throw new AppError("Release not found", 404);

    const member = await this.assertProjectMember(
      currentUser._id.toString(),
      release.projectId,
    );
    if (!this.canEditRelease(member, release, currentUser._id.toString())) {
      throw new AppError(
        "Permission denied. Only the creator or a project administrator can update this release.",
        403,
      );
    }

    this.assertDraftForMutation(release);

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

    const member = await this.assertProjectMember(
      currentUser._id.toString(),
      release.projectId,
    );
    if (!this.canEditRelease(member, release, currentUser._id.toString())) {
      throw new AppError(
        "Permission denied. Only the creator or a project administrator can delete this release.",
        403,
      );
    }

    this.assertDraftForMutation(release);

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

    const member = await this.assertProjectMember(
      currentUser._id.toString(),
      release.projectId,
    );
    if (!this.canEditRelease(member, release, currentUser._id.toString())) {
      throw new AppError(
        "Permission denied. Only the creator or a project administrator can modify this release.",
        403,
      );
    }

    this.assertDraftForMutation(release);

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

    const member = await this.assertProjectMember(
      currentUser._id.toString(),
      release.projectId,
    );
    if (!this.canEditRelease(member, release, currentUser._id.toString())) {
      throw new AppError(
        "Permission denied. Only the creator or a project administrator can modify this release.",
        403,
      );
    }

    this.assertDraftForMutation(release);

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

  /** Draft → Released (view-only thereafter). */
  async finalizeRelease(id: string, currentUser: any) {
    const release = await ReleaseModel.findById(id);
    if (!release) throw new AppError("Release not found", 404);

    const member = await this.assertProjectMember(
      currentUser._id.toString(),
      release.projectId,
    );
    if (!this.canEditRelease(member, release, currentUser._id.toString())) {
      throw new AppError(
        "Permission denied. Only the creator or a project administrator can publish this release.",
        403,
      );
    }

    this.assertDraftForMutation(release);

    release.status = "RELEASED";
    release.sentAt = new Date();
    await release.save();

    return release;
  }

  // 6. Download Release (Zipping đúng version file)
  async downloadRelease(id: string, res: Response, viewerUserId: string) {
    const release = await ReleaseModel.findById(id);
    if (!release) throw new AppError("Release not found", 404);

    await this.assertProjectMember(viewerUserId, release.projectId);

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
