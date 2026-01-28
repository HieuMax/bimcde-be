// // bimcde-be\src\modules\file\services\file.service.ts
import FileModel from "../schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import ProjectModel from "../../project/schemas/project.schema";
import ShareModel from "../schemas/share.schema";
import { AppError } from "../../../utils/AppError";
import { s3Client } from "../../../lib/r2.lib";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../../../env";
// import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import mongoose, { Types } from "mongoose";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import archiver from "archiver";
import { Response } from "express";
import ViewModel from "../../view/schemas/view.schema";
import path from "path";

 console.log("📧 MAIL CONFIG CHECK:", {
  user: env.MAIL_USER,
  hasPass: !!env.MAIL_PASS
});
// --- CẤU HÌNH GỬI MAIL ---
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
});

export default class FileService {

  async shareFile(payload: {
    fileId: string;
    projectId?: string
    userId: string | null;
    type: "SPECIFIC" | "INTERNAL_LINK" | "PUBLIC_LINK";
    recipients: string[];
    note?: string;
    expiresAt?: Date;
    accessLevel: string;
    showLatestVersion: boolean;
  }) {
    // 1. Lấy thông tin file
    const file = await FileModel.findById(payload.fileId);
    
    // Fallback nếu file không tồn tại (để tránh crash luồng gửi mail nếu đang test)
    const fileName = file ? file.name : "Tài liệu";
    // const projectId = file ? file.projectId : "unknown-project";

    let finalProjectId = "unknown-project";

    if (payload.projectId && payload.projectId !== "undefined" && payload.projectId !== "null") {
        // 1. Ưu tiên lấy từ tham số truyền vào
        finalProjectId = payload.projectId;
    } else if (file && file.projectId) {
        // 2. Nếu không có tham số, lấy từ File trong DB (ép kiểu về string)
        finalProjectId = (file.projectId as any)._id 
            ? (file.projectId as any)._id.toString() 
            : file.projectId.toString();
    }
    const token = uuidv4();

    // 2. Lưu thông tin Share vào DB
    const shareRecord = await ShareModel.create({
      fileId: payload.fileId,
      projectId: finalProjectId,
      sharedBy: payload.userId,
      type: payload.type,
      recipients: payload.recipients,
      note: payload.note,
      expiresAt: payload.expiresAt,
      accessLevel: payload.accessLevel,
      showLatestVersion: payload.showLatestVersion,
      token: token,
    });

    const clientUrl = env.CLIENT_URL || "http://localhost:3000";
    const shareLink = `${clientUrl}/share/${token}`;

    console.log("🔗 Generated Share Link:", shareLink);

    // 4. Gửi Mail (Nếu có danh sách người nhận)
    if (payload.recipients && payload.recipients.length > 0) {
      // Kiểm tra cấu hình mail trước khi gửi để tránh crash
      if (!env.MAIL_USER || !env.MAIL_PASS) {
        console.error("❌ MAIL ERROR: Chưa cấu hình MAIL_USER hoặc MAIL_PASS trong .env");
      } else {
        this.sendShareEmails(
          payload.recipients,
          fileName,
          shareLink,
          payload.note
        ).catch((err) => console.error("❌ Email Delivery Error:", err));
      }
    }

    return {
      share: shareRecord,
      shareLink,
      token,
    };
  }

  // Helper gửi HTML Mail

  private async sendShareEmails(
    emails: string[],
    fileName: string,
    link: string,
    note?: string,
    senderName: string = "A BIM CDE user",
    projectName: string = "a BIM CDE project"
  ) {
    const mailOptions = {
      from: `"BIM CDE" <${env.MAIL_USER}>`,
      to: emails.join(", "),
      subject: `${senderName} shared a document with you`,
      html: `
  <!DOCTYPE html>
  <html>
  <head>
    <meta charset="UTF-8" />
    <title>BIM CDE Share</title>
  </head>

  <body style="margin:0; padding:0; background:#ffffff; font-family: Arial, Helvetica, sans-serif; color:#1f2937;">
  <table width="100%" cellpadding="0" cellspacing="0" style="max-width:680px; margin:0 auto; padding:32px;">

    <!-- HEADER -->
    <tr>
      <td style="padding-bottom:24px;">
        <h1 style="margin:0; font-size:24px; color:#0b5ed7;">
          BIM CDE
        </h1>
      </td>
    </tr>

    <!-- GREETING -->
    <tr>
      <td style="padding-bottom:12px;">
        <p style="margin:0; font-size:15px;">
          Hi,
        </p>
      </td>
    </tr>

    <!-- MAIN MESSAGE -->
    <tr>
      <td style="padding-bottom:24px;">
        <p style="margin:0; font-size:15px; line-height:1.6;">
          <strong>${senderName}</strong> has shared the following item with you in a project titled:
          <strong>${projectName}</strong>
        </p>
      </td>
    </tr>

    <!-- DIVIDER -->
    <tr>
      <td style="border-top:1px solid #e5e7eb; padding-top:24px;"></td>
    </tr>

    <!-- FILE CARD -->
    <tr>
      <td>
        <table width="100%" cellpadding="0" cellspacing="0"
          style="border:1px solid #e5e7eb; border-radius:6px; padding:16px;">

          <tr>
            <!-- THUMBNAIL -->
            <td width="72" valign="top">
              <div style="
                width:64px;
                height:80px;
                border:1px solid #d1d5db;
                border-radius:4px;
                background:#f9fafb;
                text-align:center;
                font-size:12px;
                color:#6b7280;
                line-height:80px;
              ">
                PDF
              </div>
            </td>

            <!-- FILE INFO -->
            <td valign="top" style="padding-left:16px;">
              <p style="margin:0; font-size:15px; font-weight:600;">
                ${fileName}
              </p>

              <p style="margin:6px 0 0 0; font-size:13px; color:#6b7280;">
                ${senderName}
              </p>

              <p style="margin:4px 0 0 0; font-size:13px; color:#6b7280;">
                ${new Date().toLocaleString("en-GB", {
                  day: "2-digit",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>

              ${
                note
                  ? `<p style="margin:8px 0 0 0; font-size:13px; color:#374151;">
                      Note: ${note}
                    </p>`
                  : ""
              }
            </td>

            <!-- OPEN BUTTON -->
            <td valign="middle" align="right">
              <a href="${link}" style="
                display:inline-block;
                padding:10px 18px;
                border:1px solid #cfd4dc;
                border-radius:4px;
                font-size:14px;
                font-weight:600;
                text-decoration:none;
                color:#111827;
                background:#f9fafb;
              ">
                Open
              </a>
            </td>
          </tr>
        </table>
      </td>
    </tr>

    <!-- DIVIDER -->
    <tr>
      <td style="border-top:1px solid #e5e7eb; padding-top:24px;"></td>
    </tr>

    <!-- FALLBACK -->
    <tr>
      <td>
        <p style="margin:0; font-size:13px; color:#6b7280;">
          If the button above does not work, copy and paste this link into your browser:
        </p>
        <p style="margin-top:6px; font-size:13px;">
          <a href="${link}" style="color:#0b5ed7; word-break:break-all;">
            ${link}
          </a>
        </p>
      </td>
    </tr>

  </table>
  </body>
  </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Mail sent successfully to: ${emails.length} recipients.`);
  }

  // --- HÀM VALIDATE TOKEN ---

  async getFileDetailPublic(fileId: string, shareToken: string) {
    // 1. Check Token
    const share = await ShareModel.findOne({ token: shareToken, fileId });
    if (!share) throw new AppError("Link không hợp lệ", 403);

    // 2. Lấy File
    const file = await FileModel.findById(fileId).lean();
    if (!file) throw new AppError("File không tồn tại", 404);

    // 3. Tìm key file trên S3/R2
    const ver = file.versions?.find(v => v.version === file.currentVersion) || file.versions?.[0];
    
    let signedUrl = "";
    if (ver && ver.storageKey) {
        // 4. TẠO SIGNED URL (Link xem file sống 1 giờ)
        const command = new GetObjectCommand({
            Bucket: env.R2_BUCKET_NAME,
            Key: ver.storageKey,
        });
        signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
    }

    // 5. Trả về dữ liệu kèm Signed URL
    return {
        ...file,
        _id: file._id.toString(),
        fileUrl: signedUrl, // FE sẽ dùng cái này
        previewSrc: signedUrl,
        permission: share.accessLevel
    };
  }
  
  async getAllFiles() {
    return await FileModel.find();
  }

  // RENAME FILE
  async renameFile(fileId: string, newNameWithoutExt: string, userId: string) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    const ext = path.extname(file.name);
    const newFullName = `${newNameWithoutExt}${ext}`;

    if (file.name === newFullName) return file;

    const duplicate = await FileModel.findOne({
      folderId: file.folderId,
      name: newFullName,
      isDeleted: false,
    });
    if (duplicate) throw new Error("A file with this name already exists.");

    if (file.isLocked && file.lockedBy?.toString() !== userId) {
      throw new Error("File is locked by another user.");
    }

    const lastVer = file.versions[file.versions.length - 1];
    const nextVersion = file.currentVersion + 1;

    const newVersionData = {
      version: nextVersion,
      fileName: newFullName,
      storageKey: lastVer.storageKey,
      location: lastVer.location,
      size: lastVer.size,
      mimeType: lastVer.mimeType,
      uploadedBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    };

    file.name = newFullName;
    file.currentVersion = nextVersion;
    file.versions.push(newVersionData);
    return await file.save();
  }

  // HANDLE FILE UPLOAD
  async handleFileUpload(
    fileData: Express.MulterS3.File,
    projectId: string,
    folderId: string | null | undefined,
    userId: string,
  ) {
    let validFolderId: Types.ObjectId | null = null;

    if (folderId && folderId !== "null" && folderId !== "undefined" && folderId !== "") {
      validFolderId = new Types.ObjectId(folderId);
    }

    const publicUrl = `https://${env.R2_PUBLIC_DOMAIN}/${fileData.key}`;

    let existingFile = await FileModel.findOne({
      folderId: validFolderId,
      name: fileData.originalname,
      projectId: new Types.ObjectId(projectId),
      isDeleted: false,
    });

    if (existingFile) {
      if (
        existingFile.isLocked &&
        existingFile.lockedBy?.toString() !== userId
      ) {
        throw new Error(
          "File is locked by another user. Cannot upload new version.",
        );
      }
    }

    const newVersionData = {
      fileName: fileData.originalname,
      storageKey: fileData.key,
      location: publicUrl,
      size: fileData.size,
      mimeType: fileData.mimetype,
      uploadedBy: new Types.ObjectId(userId),
      createdAt: new Date(),
    };

    if (existingFile) {
      const nextVersion = existingFile.currentVersion + 1;
      existingFile.versions.push({
        ...newVersionData,
        version: nextVersion,
      });
      existingFile.currentVersion = nextVersion;
      return await existingFile.save();
    } else {
      const newFile = new FileModel({
        name: fileData.originalname,
        folderId: validFolderId,
        projectId: new Types.ObjectId(projectId),
        currentVersion: 1,
        versions: [{ ...newVersionData, version: 1 }],
      });
      return await newFile.save();
    }
  }

  async getFilesInFolder(folderId: string) {
    return await FileModel.find({
      folderId: folderId,
      isDeleted: false,
    }).populate("tags");
  }

  // GET FILE DETAIL (Logic cũ, dùng cho nội bộ)
  async getFileDetail(fileId: string) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false })
      .populate("tags")
      .populate("lockedBy", "fullName avatar email")
      .populate("versions.uploadedBy", "fullName avatar email")
      .populate("folderId", "name path projectId")
      .populate("projectId", "_id name");

    if (!file) throw new AppError("File not found", 404);

    const currentVersion = file.versions.find(
      (v) => v.version === file.currentVersion
    );

    if (!currentVersion) {
      throw new AppError("Current version not found", 500);
    }

    const projectObjectId = new Types.ObjectId(
      typeof file.projectId === "object"
        ? (file.projectId as any)._id
        : file.projectId
    );

    const folderObjectId = file.folderId
      ? new Types.ObjectId((file.folderId as any)._id)
      : null;
    const location = await buildFolderBreadcrumb(
      projectObjectId,
      folderObjectId
    );

    const createdBy =
      typeof currentVersion.uploadedBy === "object" &&
      "fullName" in currentVersion.uploadedBy
        ? currentVersion.uploadedBy.fullName
        : "--";

    return {
      _id: file._id.toString(),
      name: file.name,
      projectId: file.projectId,
      projectName: (file.projectId as any)?.name,
      folderId: file.folderId?._id ?? null,
      folderName: (file.folderId as any)?.name ?? null,
      currentVersion: file.currentVersion,
      size: currentVersion.size,
      mimeType: currentVersion.mimeType,
      fileUrl: currentVersion.location,
      location: location,
      createdAt: currentVersion.createdAt,
      createdBy,
      updatedAt: file.updatedAt,
      modifiedBy: createdBy,
      isLocked: file.isLocked,
      lockedBy:
        file.isLocked && file.lockedBy && typeof file.lockedBy === "object"
          ? (file.lockedBy as any).fullName
          : undefined,
      tags: file.tags ?? [],
    };
  }

  // --- US43: Move folder / file to … ---
  async moveFile(
    fileId: string,
    destinationFolderId: string | null,
    userId: string,
  ) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    let destFolderIdObj: Types.ObjectId | null = null;
    if (destinationFolderId && destinationFolderId !== "null" && destinationFolderId !== "") {
      if (!Types.ObjectId.isValid(destinationFolderId)) throw new Error("Invalid destination folder ID");
      const destFolder = await FolderModel.findOne({ _id: destinationFolderId, isDeleted: false });
      if (!destFolder) throw new Error("Destination folder not found");
      destFolderIdObj = destFolder._id;
    }

    const duplicate = await FileModel.findOne({
      folderId: destFolderIdObj,
      name: file.name,
      projectId: file.projectId,
      isDeleted: false,
    });
    if (duplicate) throw new Error(`A file with name "${file.name}" already exists in the destination folder.`);

    if (duplicate) {
      throw new Error(
        `A file with name "${file.name}" already exists in the destination folder.`,
      );
    }

    if (file.isLocked && file.lockedBy?.toString() !== userId) {
      throw new Error("File is locked by another user. Cannot move.");
    }

    file.folderId = destFolderIdObj;
    return await file.save();
  }

  // --- US43: Bulk Move Files (All-or-Nothing) ---
  async moveManyFiles(
    fileIds: string[],
    destinationFolderId: string | null,
    userId: string,
  ) {
    const sourceFiles = await FileModel.find({
      _id: { $in: fileIds },
      isDeleted: false,
    });

    if (sourceFiles.length === 0)
      throw new Error("No valid files found to move");

    const projectId = sourceFiles[0].projectId;
    let destFolderIdObj: Types.ObjectId | null = null;

    if (destinationFolderId && destinationFolderId !== "null" && destinationFolderId !== "") {
      if (!Types.ObjectId.isValid(destinationFolderId)) throw new Error("Invalid destination folder ID");
      const destFolder = await FolderModel.findOne({ _id: destinationFolderId, isDeleted: false });
      if (!destFolder) throw new Error("Destination folder not found");
      if (destFolder.projectId.toString() !== projectId.toString()) throw new Error("Cannot move files to another project");
      destFolderIdObj = destFolder._id;
    }

    const sourceFileNames = sourceFiles.map((f) => f.name);
    const duplicateFiles = await FileModel.find({
      folderId: destFolderIdObj,
      projectId: projectId,
      name: { $in: sourceFileNames },
      isDeleted: false,
    });

    if (duplicateFiles.length > 0) {
      const duplicateNames = duplicateFiles.map((f) => f.name).join(", ");
      throw new Error(
        `Destination already contains files with names: ${duplicateNames}. Move cancelled.`,
      );
    }

    const lockedFile = sourceFiles.find(
      (f) => f.isLocked && f.lockedBy?.toString() !== userId,
    );
    if (lockedFile) {
      throw new Error(`File "${lockedFile.name}" is locked. Move cancelled.`);
    }

    const result = await FileModel.updateMany(
      { _id: { $in: fileIds } },
      { $set: { folderId: destFolderIdObj } },
    );

    return result;
  }

  async toggleLock(fileId: string, userId: string, action: "LOCK" | "UNLOCK") {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    if (action === "LOCK") {
      if (file.isLocked) throw new Error("File is already locked");
      file.isLocked = true;
      file.lockedBy = new Types.ObjectId(userId);
      file.lockedAt = new Date();
    } else {
      if (!file.isLocked) throw new Error("File is not locked");
      if (file.lockedBy?.toString() !== userId) throw new Error("You do not have permission to unlock this file");
      file.isLocked = false;
      file.lockedBy = undefined;
      file.lockedAt = undefined;
    }
    return await file.save();
  }

  async deleteFile(fileId: string, userId: string) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");
    if (file.isLocked && file.lockedBy?.toString() !== userId) throw new Error("File is locked. Cannot delete.");
    file.isDeleted = true;
    file.deletedAt = new Date();
    await file.save();
    // 2. [NEW] Cascade Delete
    try {
      await ViewModel.deleteMany({ relatedFileId: file._id });
    } catch (error) {
      console.error(`Failed to cascade delete views for file ${fileId}`, error);
    }

    return file;
  }
  async restoreFile(fileId: string, userId: string) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: true });
    if (!file) throw new AppError("File not found or already restored", 404);

    // Kiểm tra quyền (nếu cần)
    // if (file.isLocked && ...)

    file.isDeleted = false;
    file.deletedAt = undefined;
    await file.save();
    return file;
  }
  // --- US51: Bulk Check in / check out folder / file  ---
  async toggleLockMany(
    folderId: string,
    userId: string,
    action: "LOCK" | "UNLOCK",
  ) {
    const subFolders = await FolderModel.find({
      path: { $regex: `,${folderId},` },
      isDeleted: false,
    }).select("_id");

    const targetFolderIds = [
      new Types.ObjectId(folderId),
      ...subFolders.map((f) => f._id),
    ];

    if (action === "LOCK") {
      const result = await FileModel.updateMany(
        {
          folderId: { $in: targetFolderIds },
          isDeleted: false,
          isLocked: false,
        },
        {
          $set: {
            isLocked: true,
            lockedBy: new Types.ObjectId(userId),
            lockedAt: new Date(),
          },
        },
      );
      return { modifiedCount: result.modifiedCount, message: `Locked ${result.modifiedCount} files.` };
    } else {
      const result = await FileModel.updateMany(
        {
          folderId: { $in: targetFolderIds },
          isDeleted: false,
          isLocked: true,
          lockedBy: new Types.ObjectId(userId),
        },
        {
          $set: { isLocked: false },
          $unset: { lockedBy: 1, lockedAt: 1 },
        },
      );
      return { modifiedCount: result.modifiedCount, message: `Unlocked ${result.modifiedCount} files.` };
    }
  }

  // --- US45: Download Single File ---
  async downloadFile(fileId: string, res: Response, version?: number) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    let targetVersion;

    if (version) {
      // 1. Nếu có version cụ thể, tìm trong mảng versions
      targetVersion = file.versions.find((v) => v.version === version);
      if (!targetVersion) throw new Error(`Version ${version} not found`);
    } else {
      // 2. Nếu không, lấy version mới nhất (Logic cũ)
      targetVersion = file.versions[file.versions.length - 1];
    }

    if (!targetVersion || !targetVersion.storageKey) {
      throw new Error("File content not found");
    }

    const command = new GetObjectCommand({
      Bucket: env.R2_BUCKET_NAME,
      Key: targetVersion.storageKey,
    });
    const s3Response = await s3Client.send(command);

    // Thêm version vào tên file khi download để dễ phân biệt
    const fileName = version ? `v${version}_${file.name}` : file.name;

    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);
    res.setHeader(
      "Content-Type",
      targetVersion.mimeType || "application/octet-stream",
    );

    (s3Response.Body as any).pipe(res);
  }

  async downloadFolder(folderId: string, res: Response) {
    const rootFolder = await FolderModel.findOne({ _id: folderId, isDeleted: false });
    if (!rootFolder) throw new Error("Folder not found");

    const allFolders = await FolderModel.find({
      $or: [{ _id: folderId }, { path: { $regex: `,${folderId},` } }],
      isDeleted: false,
    }).lean();

    const folderMap = new Map(allFolders.map((f) => [f._id.toString(), f]));
    const allFolderIds = allFolders.map((f) => f._id);
    const allFiles = await FileModel.find({ folderId: { $in: allFolderIds }, isDeleted: false }).lean();

    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${rootFolder.name}.zip"`,
    );
    res.setHeader("Content-Type", "application/zip");
    archive.pipe(res);

    for (const file of allFiles) {
      const latestVer = file.versions[file.versions.length - 1];
      if (!latestVer || !latestVer.storageKey) continue;
      let filePathInZip = file.name;
      let currentParentId = file.folderId?.toString();
      const pathParts = [];
      while (currentParentId && currentParentId !== folderId) {
        const parent = folderMap.get(currentParentId);
        if (parent) {
          pathParts.unshift(parent.name);
          currentParentId = parent.parentId?.toString() ?? "";
        } else {
          break;
        }
      }
      if (pathParts.length > 0) filePathInZip = `${pathParts.join("/")}/${file.name}`;
      try {
        const command = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: latestVer.storageKey });
        const s3Item = await s3Client.send(command);
        archive.append(s3Item.Body as any, { name: filePathInZip });
      } catch (err) {
        console.error(`Failed to append ${file.name}`, err);
      }
    }
    await archive.finalize();
  }

  // US45: Download file / folders in bulk
  async downloadBulk(
    items: { id: string; type: "file" | "folder" }[],
    projectId: string,
    res: Response,
  ) {
    let projectName = "Project";
    try {
    } catch (e) {}

    const timestamp = new Date()
      .toISOString()
      .replace(/[:.]/g, "-")
      .slice(0, 19);
    const zipFileName = `${projectName}_${timestamp}`;

    const archive = archiver("zip", { zlib: { level: 9 } });

    res.setHeader(
      "Content-Disposition",
      `attachment; filename="${zipFileName}.zip"`,
    );
    res.setHeader("Content-Type", "application/zip");
    archive.pipe(res);

    for (const item of items) {
      if (item.type === "file") await this.addFileToArchive(archive, item.id, "");
      else await this.addFolderToArchive(archive, item.id);
    }
    await archive.finalize();
  }

  // --- HELPER: Add 1 file to ZIP ---
  private async addFileToArchive(
    archive: archiver.Archiver,
    fileId: string,
    folderPathInZip: string,
  ) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) return;
    const latestVer = file.versions[file.versions.length - 1];
    if (!latestVer || !latestVer.storageKey) return;
    try {
      const command = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: latestVer.storageKey });
      const s3Item = await s3Client.send(command);
      const fileNameInZip = folderPathInZip ? `${folderPathInZip}/${file.name}` : file.name;
      archive.append(s3Item.Body as any, { name: fileNameInZip });
    } catch (err) {
      console.error(err);
    }
  }

  // --- HELPER: Add 1 folder to ZIP ---
  private async addFolderToArchive(
    archive: archiver.Archiver,
    folderId: string,
  ) {
    const rootFolder = await FolderModel.findOne({
      _id: folderId,
      isDeleted: false,
    });
    if (!rootFolder) return;
    const allFolders = await FolderModel.find({ $or: [{ _id: folderId }, { path: { $regex: `,${folderId},` } }], isDeleted: false }).lean();
    const folderMap = new Map(allFolders.map((f) => [f._id.toString(), f]));
    const allFolderIds = allFolders.map((f) => f._id);
    const allFiles = await FileModel.find({ folderId: { $in: allFolderIds }, isDeleted: false }).lean();

    for (const file of allFiles) {
      const latestVer = file.versions[file.versions.length - 1];
      if (!latestVer || !latestVer.storageKey) continue;
      let currentParentId: string | undefined = file.folderId?.toString();
      const pathParts = [];
      while (currentParentId) {
        const parent = folderMap.get(currentParentId);
        if (parent) {
          pathParts.unshift(parent.name);
          if (parent._id.toString() === folderId) break;
          currentParentId = parent.parentId?.toString();
        } else break;
      }
      const filePathInZip = `${pathParts.join("/")}/${file.name}`;
      try {
        const command = new GetObjectCommand({ Bucket: env.R2_BUCKET_NAME, Key: latestVer.storageKey });
        const s3Item = await s3Client.send(command);
        archive.append(s3Item.Body as any, { name: filePathInZip });
      } catch (err) {
        console.error(err);
      }
    }
  }

  async assignTags(fileIds: string[], tagIds: string[]) {
    try {
      const objectIds = fileIds.map((id) => new Types.ObjectId(id));
      const validTagIds = tagIds.filter((id) => id);
      const tagObjectIds = validTagIds.map((id) => new Types.ObjectId(id));

      const result = await FileModel.updateMany(
        { _id: { $in: objectIds }, isDeleted: false },
        { $set: { tags: tagObjectIds } },
      );

      // Return the updated files with populated tags
      const updatedFiles = await FileModel.find({
        _id: { $in: objectIds },
        isDeleted: false,
      }).populate("tags");

      return updatedFiles;
    } catch (error) {
      console.error("Error in assignTags:", error);
      throw error;
    }
  }
}

// --- HELPER FUNCTION ---
export async function buildFolderBreadcrumb(projectId: Types.ObjectId, folderId: Types.ObjectId | null): Promise<string> {
  const project = await ProjectModel.findById(projectId).select("name").lean();
  const projectName = project?.name ?? "Project";
  if (!folderId) return projectName;

  const folder = await FolderModel.findById(folderId).select("name path").lean();
  if (!folder) return projectName;
  if (!folder.path || folder.path.trim() === "") return `${projectName} / ${folder.name}`;

  const ids = folder.path.split(",").filter((id) => Types.ObjectId.isValid(id)).map((id) => new Types.ObjectId(id));
  if (ids.length === 0) return `${projectName} / ${folder.name}`;

  const parents = await FolderModel.find({ _id: { $in: ids } }, { name: 1 }).lean();
  const map = new Map(parents.map((p) => [p._id.toString(), p.name]));
  const breadcrumb = ids.map((id) => map.get(id.toString())).filter(Boolean);
  return [projectName, ...breadcrumb, folder.name].join(" / ");
}
// bimcde-be\src\modules\file\services\file.service.ts