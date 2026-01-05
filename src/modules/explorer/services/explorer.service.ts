import mongoose, { Types } from "mongoose";
import FolderModel from "../../folder/schemas/folder.schema";
import FileModel from "../../file/schemas/file.schema";

export default class ExplorerService {
  async getExplorerContent(
    projectId: string,
    folderId: string | null,
    sortBy: string = "name",
    sortOrder: "asc" | "desc" = "asc"
  ) {
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

    const processedFiles = files.map((file) => {
      const latestVer = file.versions?.[file.versions.length - 1];
      const uploader = latestVer?.uploadedBy as any;

      return {
        _id: file._id,
        name: file.name,
        folderId: file.folderId,
        currentVersion: file.currentVersion,
        updatedAt: file.updatedAt,
        isLocked: file.isLocked,
        lockedBy: file.lockedBy,
        size: latestVer?.size || 0,
        mimeType: latestVer?.mimeType || "unknown",
        location: latestVer?.location || "",
        thumbnail: latestVer?.location || "", // Với ảnh thì là location, file khác cần logic thumbnail riêng
        modifiedBy: uploader?.fullName || "Unknown",
        tags: file.tags,
        versions: file.versions.map((v) => ({
          version: v.version,
          fileName: v.fileName,
          size: v.size,
          location: v.location,
          createdAt: v.createdAt,
          uploadedBy: (v.uploadedBy as any)?.fullName || "Unknown",
        })),
      };
    });

    return {
      currentFolder,
      ancestors,
      subFolders: foldersWithStats,
      files: processedFiles,
    };
  }

  
}
