import mongoose, { Types } from "mongoose";
import FolderModel from "../../folder/schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";
import ProjectModel from "../../project/schemas/project.schema";
import projectMemberSchema from "../../project/schemas/project-member.schema";
import groupModel from "../../team/schemas/group.schema";
import groupMemberModel from "../../team/schemas/group-member.schema";
import {
  CDE_FOLDER_STAGES,
  parseCdeWorkflowMode,
  type CdeFolderStage,
} from "../../../constants/cde-workflow";
import { ensureCdeRootsInitialized } from "../../folder/services/cde-root-init.service";
import CdeAccessService from "../../permission/services/cde-access.service";

const cdeAccess = new CdeAccessService();

export default class ExplorerService {
  private folderStageCache = new Map<string, CdeFolderStage | null>();

  private async getCdeRootStageFromFolderId(
    folderId: string
  ): Promise<CdeFolderStage | null> {
    if (this.folderStageCache.has(folderId)) {
      return this.folderStageCache.get(folderId) ?? null;
    }
    let current = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    }).lean();
    const chain: Array<{ isCdeRoot?: boolean; cdeStage?: CdeFolderStage }> =
      [];
    while (current) {
      chain.unshift(current);
      if (!current.parentId) break;
      current = await FolderModel.findOne({
        _id: current.parentId,
        isDeleted: false,
      }).lean();
    }
    const root = chain.find((f) => f.isCdeRoot && f.cdeStage);
    const stage = root?.cdeStage ?? null;
    this.folderStageCache.set(folderId, stage);
    return stage;
  }

  /** First groupId found walking from this folder up toward project root (matches ISO effective group). */
  private async getEffectiveGroupIdFromFolderId(
    folderId: string
  ): Promise<string | null> {
    let current = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    })
      .select("parentId groupId")
      .lean();
    while (current) {
      if (current.groupId) return current.groupId.toString();
      if (!current.parentId) break;
      current = await FolderModel.findOne({
        _id: current.parentId,
        isDeleted: false,
      })
        .select("parentId groupId")
        .lean();
    }
    return null;
  }

  private async getCdeCapabilities(
    projectId: string,
    userId: Types.ObjectId
  ): Promise<{
    isProjectAdmin: boolean;
    isGroupLeader: boolean;
    leaderGroupIds: string[];
  }> {
    const pm = await projectMemberSchema
      .findOne({ projectId, userId })
      .lean();
    const isProjectAdmin =
      String(pm?.role ?? "").toLowerCase() === "admin";
    const pid = new Types.ObjectId(projectId);
    const groups = await groupModel.find({ projectId: pid }).select("_id").lean();
    const gids = groups.map((g) => g._id);
    const leaders = await groupMemberModel
      .find({
        userId,
        groupId: { $in: gids },
        role: "GROUP_LEADER",
      })
      .select("groupId")
      .lean();
    const leaderGroupIds = leaders
      .map((l) => l.groupId?.toString())
      .filter((x): x is string => !!x);
    return {
      isProjectAdmin,
      isGroupLeader: leaderGroupIds.length > 0,
      leaderGroupIds,
    };
  }

  async getExplorerContent(
    projectId: string,
    folderId: string | null,
    sortBy: string = "name",
    sortOrder: "asc" | "desc" = "asc",
    userId?: Types.ObjectId,
    restrictMoveToEffectiveGroupId?: string | null
  ) {
    this.folderStageCache.clear();

    if (!folderId && userId) {
      const proj = await ProjectModel.findById(projectId)
        .select("workflowMode cdeRootsInitialized")
        .lean();
      if (proj && !proj.cdeRootsInitialized) {
        const mode = parseCdeWorkflowMode(proj.workflowMode) ?? "NORMAL";
        await ensureCdeRootsInitialized(projectId, userId, mode);
      }
    }

    if (folderId && userId) {
      await cdeAccess.assertFolderAccess(
        projectId,
        userId,
        folderId,
        "browse"
      );
    }

    const projectObjId = new Types.ObjectId(projectId);
    const parentObjId = folderId ? new Types.ObjectId(folderId) : null;
    const sortDirection = sortOrder === "asc" ? 1 : -1;
    const sortOptions: any = { [sortBy]: sortDirection };
    const collationOptions = { locale: "en", numericOrdering: true };

    // 1. Breadcrumb & Current Folder
    let currentFolder = null;
    let ancestors: any[] = [];

    if (folderId) {
      currentFolder = await FolderModel.findOne({
        _id: parentObjId,
        isDeleted: false,
      })
        .select("_id name parentId path")
        .lean();

      if (currentFolder?.path) {
        const ancestorIds = currentFolder.path.split(",").filter(Boolean);
        if (ancestorIds.length > 0) {
          // Chỉ lấy field cần thiết
          const foldersFound = await FolderModel.find({
            _id: { $in: ancestorIds },
            isDeleted: false,
          })
            .select("_id name")
            .lean();

          // Sắp xếp lại theo đúng thứ tự path
          const folderMap = new Map(
            foldersFound.map((f) => [f._id.toString(), f])
          );
          ancestors = ancestorIds
            .map((id) => folderMap.get(id))
            .filter(Boolean);
        }
      }
    }

    // 2. Query Folders & Files (Parallel)
    const [subFolders, files] = await Promise.all([
      FolderModel.find({
        projectId: projectObjId,
        parentId: parentObjId,
        isDeleted: false,
      })
        .populate("createdBy", "fullName email")
        .populate("tags")
        .collation(collationOptions)
        .sort(sortOptions)
        .lean(),
      FileModel.find({
        projectId: projectObjId,
        folderId: parentObjId,
        isDeleted: false,
      })
        .populate("versions.uploadedBy", "fullName email")
        .populate("tags")
        .collation(collationOptions)
        .sort(sortOptions)
        .lean(),
    ]);

    // 3. [TỐI ƯU] Tính tổng dung lượng Folder bằng Aggregation
    // Thay vì lặp từng folder con -> query DB (N+1), ta gom ID lại và tính 1 lần.

    // Lấy danh sách ID của các subFolder đang hiển thị
    const subFolderIds = subFolders.map((f) => f._id);

    // Map lưu trữ size: { folderId: size }
    const folderSizeMap = new Map<string, number>();

    if (subFolderIds.length > 0) {
      const stats = await FileModel.aggregate([
        {
          $match: {
            // Tìm file thuộc về các sub-folders này HOẶC con cháu của chúng
            // Để làm việc này hiệu quả, ta cần biết path của subFolders.
            // Tuy nhiên, Regex query trên mảng lớn ID khá chậm.
            // Cách tốt hơn: Query folder con cháu trước.
            projectId: projectObjId,
            isDeleted: false,
          },
        },
        // Lookup ngược lại Folder để check path (Hơi phức tạp).
        // CÁCH ĐƠN GIẢN HƠN:
        // Với mỗi subFolder, ta biết path của nó là: currentPath + subFolderId + ","
        // Ta có thể dùng $regex trong $match. Nhưng $regex với $or array perform không tốt lắm.
      ]);

      // DO CẤU TRÚC PATH, TỐI ƯU NHẤT LÀ:
      // Loop nhẹ ở đây vẫn chấp nhận được nếu số lượng folder/trang ít (phân trang).
      // Nhưng nếu không phân trang, ta dùng cách sau:

      const sizePromises = subFolders.map(async (folder) => {
        // Chỉ tính tổng size của file nằm TRỰC TIẾP hoặc GIÁN TIẾP trong folder này
        // Tận dụng index { path: 1 }

        // B1: Tìm tất cả folder ID con cháu
        const descendantIds = await FolderModel.distinct("_id", {
          path: { $regex: `,${folder._id},` },
          isDeleted: false,
        });

        // B2: Tính tổng size file trong các folder đó + folder hiện tại
        const allIds = [folder._id, ...descendantIds];

        const result = await FileModel.aggregate([
          { $match: { folderId: { $in: allIds }, isDeleted: false } },
          {
            $project: { latestSize: { $arrayElemAt: ["$versions.size", -1] } },
          },
          { $group: { _id: null, total: { $sum: "$latestSize" } } },
        ]);

        return { id: folder._id.toString(), size: result[0]?.total || 0 };
      });

      // Chạy song song
      const sizes = await Promise.all(sizePromises);
      sizes.forEach((s) => folderSizeMap.set(s.id, s.size));
    }

    // 4. Map dữ liệu trả về
    const foldersWithStats = subFolders.map((folder) => ({
      ...folder,
      createdById:
        (folder.createdBy as any)?._id != null
          ? (folder.createdBy as any)._id.toString()
          : folder.createdBy
            ? String(folder.createdBy)
            : undefined,
      createdBy: (folder.createdBy as any)?.fullName || "Unknown",
      totalSize: folderSizeMap.get(folder._id.toString()) || 0,
      tags: folder.tags,
      // Map versions gọn lại
      versions:
        folder.versions?.map((v) => ({
          version: v.version,
          name: v.name,
          updatedBy: (v.updatedBy as any)?.fullName || "Unknown",
          createdAt: v.createdAt,
        })) || [],
    }));

    let mergedFolders = foldersWithStats as Array<Record<string, unknown>>;
    if (userId) {
      const wf = await ProjectModel.findById(projectId)
        .select("workflowMode")
        .lean();
      const mode = parseCdeWorkflowMode(wf?.workflowMode) ?? "NORMAL";
      if (mode === "ISO_19650") {
        mergedFolders = await cdeAccess.annotateExplorerIso(
          projectId,
          userId,
          foldersWithStats as Array<Record<string, unknown>>
        );
      } else {
        mergedFolders = await cdeAccess.annotateExplorerNormal(
          projectId,
          userId,
          foldersWithStats as Array<Record<string, unknown>>
        );
      }
    }

    const processedFolders = await Promise.all(
      mergedFolders.map(async (folder) => {
        const f = folder as Record<string, unknown>;
        const id = (f._id as Types.ObjectId).toString();
        const [parentCdeRootStage, effectiveGroupId] = await Promise.all([
          this.getCdeRootStageFromFolderId(id),
          this.getEffectiveGroupIdFromFolderId(id),
        ]);

        /** Folder tạo cùng lúc với group (con trực tiếp của 1. WIP / 2. Shared, có groupId). */
        let isGroupHomeFolder = false;
        const groupIdRaw = f.groupId as Types.ObjectId | undefined | null;
        const parentIdRaw = f.parentId as Types.ObjectId | undefined | null;
        if (groupIdRaw && parentIdRaw) {
          const parent = await FolderModel.findOne({
            _id: parentIdRaw,
            isDeleted: false,
          })
            .select("isCdeRoot cdeStage")
            .lean();
          isGroupHomeFolder = !!(
            parent &&
            parent.isCdeRoot &&
            (parent.cdeStage === "WIP" || parent.cdeStage === "SHARED")
          );
        }

        return {
          ...f,
          parentCdeRootStage,
          effectiveGroupId,
          isGroupHomeFolder,
        };
      })
    );

    let locationName = "";
    if (folderId && currentFolder) {
      locationName = currentFolder.name;
    } else {
      const project = await ProjectModel.findById(projectId).select("name").lean();
      locationName = project?.name || "Project Root";
    }

    const processedFiles = await Promise.all(
      files.map(async (file) => {
        const latestVer = file.versions?.[file.versions.length - 1];
        const uploader = latestVer?.uploadedBy as any;

        let parentCdeRootStage: CdeFolderStage | null = null;
        let effectiveGroupId: string | null = null;
        if (file.folderId) {
          parentCdeRootStage = await this.getCdeRootStageFromFolderId(
            file.folderId.toString()
          );
          effectiveGroupId = await this.getEffectiveGroupIdFromFolderId(
            file.folderId.toString()
          );
        }

        return {
          _id: file._id,
          name: file.name,
          createdBy: file.createdBy ? file.createdBy.toString() : undefined,
          folderId: file.folderId,
          locationName: locationName,
          currentVersion: file.currentVersion,
          workflowStatus: file.workflowStatus,
          submittedForReviewVersion: file.submittedForReviewVersion ?? null,
          wipPromotedToSharedVersion: file.wipPromotedToSharedVersion ?? null,
          sharedPromotedToPublishedVersion:
            file.sharedPromotedToPublishedVersion ?? null,
          updatedAt: file.updatedAt,
          isLocked: file.isLocked,
          lockedBy: file.lockedBy,
          size: latestVer?.size || 0,
          mimeType: latestVer?.mimeType || "unknown",
          location: latestVer?.location || "",
          thumbnail: latestVer?.location || "",
          modifiedBy: uploader?.fullName || "Unknown",
          tags: file.tags,
          cdeStage: file.cdeStage,
          parentCdeRootStage,
          effectiveGroupId,
          versions: file.versions.map((v) => ({
            version: v.version,
            fileName: v.fileName,
            size: v.size,
            location: v.location,
            createdAt: v.createdAt,
            uploadedBy: v.uploadedBy
              ? {
                  _id: (v.uploadedBy as any)._id?.toString?.() || "",
                  fullName: (v.uploadedBy as any).fullName || "Unknown",
                  email: (v.uploadedBy as any).email,
                }
              : "Unknown",
          })),
        };
      })
    );

    const wf = await ProjectModel.findById(projectId)
      .select("workflowMode")
      .lean();
    const workflowMode = parseCdeWorkflowMode(wf?.workflowMode) ?? "NORMAL";

    let cdeCapabilities: {
      isProjectAdmin: boolean;
      isGroupLeader: boolean;
      leaderGroupIds: string[];
    } = {
      isProjectAdmin: false,
      isGroupLeader: false,
      leaderGroupIds: [],
    };
    if (userId) {
      cdeCapabilities = await this.getCdeCapabilities(projectId, userId);
    }

    let subFoldersOut = processedFolders;
    if (
      restrictMoveToEffectiveGroupId &&
      workflowMode === "ISO_19650"
    ) {
      subFoldersOut = processedFolders.filter((f) => {
        const eff = (f as { effectiveGroupId?: string | null }).effectiveGroupId;
        if (eff == null || eff === "") return true;
        return eff === restrictMoveToEffectiveGroupId;
      });
    }

    return {
      currentFolder,
      ancestors,
      subFolders: subFoldersOut,
      files: processedFiles,
      workflowMode,
      cdeCapabilities,
    };
  }

  /**
   * ISO: direct child of a CDE root (e.g. 1. WIP / 2. Shared) with this groupId — “group home” folder.
   * Used to open Move-to navigation at the group root.
   */
  async getGroupHomeFolderId(
    projectId: string,
    groupId: string,
    cdeStage: string,
    userId: Types.ObjectId
  ): Promise<{ folderId: string | null }> {
    if (!Types.ObjectId.isValid(groupId)) {
      return { folderId: null };
    }
    const stage = CDE_FOLDER_STAGES.includes(cdeStage as CdeFolderStage)
      ? (cdeStage as CdeFolderStage)
      : null;
    if (!stage) {
      return { folderId: null };
    }

    const pid = new Types.ObjectId(projectId);
    const gid = new Types.ObjectId(groupId);

    const root = await FolderModel.findOne({
      projectId: pid,
      parentId: null,
      isCdeRoot: true,
      cdeStage: stage,
      isDeleted: false,
    }).lean();
    if (!root) {
      return { folderId: null };
    }

    const home = await FolderModel.findOne({
      projectId: pid,
      parentId: root._id,
      groupId: gid,
      isDeleted: false,
    }).lean();
    if (!home) {
      return { folderId: null };
    }

    await cdeAccess.assertFolderAccess(
      projectId,
      userId,
      home._id.toString(),
      "browse"
    );

    return { folderId: home._id.toString() };
  }

  /** ISO: id of the CDE root folder (e.g. 3. Published / 4. Archived). */
  async getCdeRootFolderId(
    projectId: string,
    cdeStage: string,
    userId: Types.ObjectId
  ): Promise<{ folderId: string | null }> {
    const stage = CDE_FOLDER_STAGES.includes(cdeStage as CdeFolderStage)
      ? (cdeStage as CdeFolderStage)
      : null;
    if (!stage) {
      return { folderId: null };
    }

    const pid = new Types.ObjectId(projectId);

    const root = await FolderModel.findOne({
      projectId: pid,
      parentId: null,
      isCdeRoot: true,
      cdeStage: stage,
      isDeleted: false,
    }).lean();
    if (!root) {
      return { folderId: null };
    }

    await cdeAccess.assertFolderAccess(
      projectId,
      userId,
      root._id.toString(),
      "browse"
    );

    return { folderId: root._id.toString() };
  }
}
