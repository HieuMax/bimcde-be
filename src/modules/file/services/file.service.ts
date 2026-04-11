import FileModel from "../schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import ProjectModel from "../../project/schemas/project.schema";
import ShareModel from "../schemas/share.schema";
import ViewModel from "../../view3d/schemas/view.schemas";
import { AppError } from "../../../utils/AppError";
import { s3Client } from "../../../lib/r2.lib";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { env } from "../../../env";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

import mongoose, { Types } from "mongoose";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import archiver from "archiver";
import { Response } from "express";
import path from "path";
import { ConflictStrategy } from "../utils/fileUpload.validation";
import { PROJECT_STORAGE_LIMIT_BYTES } from "../constants/projectStorage";
import { parseCdeWorkflowMode } from "../../../constants/cde-workflow";
import CdeAccessService from "../../permission/services/cde-access.service";

const cdeAccess = new CdeAccessService();

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
    if (!file) {
      throw new AppError("File không tồn tại – không thể tạo link chia sẻ", 404);
    }
    const fileName = file ? file.name : "Tài liệu";

    let finalProjectId = "unknown-project";

    if (payload.projectId && payload.projectId !== "undefined" && payload.projectId !== "null") {
        
        finalProjectId = payload.projectId;
    } else if (file && file.projectId) {
        
        finalProjectId = (file.projectId as any)._id 
            ? (file.projectId as any)._id.toString() 
            : file.projectId.toString();
    }
    const token = uuidv4();

    console.log("🧪 SHARE DEBUG", {
      payloadFileId: payload.fileId,
      fileExists: !!file,
      realFileId: file?._id.toString(),
    });

    // 2. Lưu thông tin Share vào DB
    const shareRecord = await ShareModel.create({
      fileId: file._id,
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

    const clientUrl = env.CLIENT_URL
    const shareLink = `${clientUrl}/share/${token}`;
    const apiUrl = env.APP_URL 
    const downloadLink = `${apiUrl}/files/public/${file._id}/download?shareToken=${token}`;

    console.log("🔗 Generated Share Link:", shareLink, downloadLink);

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
          payload.accessLevel, 
          downloadLink,
          payload.note,

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
    accessLevel: string,    
    downloadLink: string,   
    note?: string,          
    senderName: string = "A BIM CDE user",
    projectName: string = "a BIM CDE project",
  ) {

    // Logic kiểm tra quyền (giữ nguyên)
    const showDownloadButton = (accessLevel || "").toUpperCase() === "DOWNLOAD";

    const mailOptions = {
      from: `"BIM CDE" <${env.MAIL_USER}>`,
      to: emails.join(", "),
      subject: `${senderName} shared "${fileName}" with you`,
      html: `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>BIM CDE Share</title>
        <style>
          /* Reset CSS cơ bản cho Email */
          body { margin: 0; padding: 0; background-color: #f3f4f6; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; }
          table { border-collapse: collapse; }
          .btn-hover:hover { opacity: 0.9; }
        </style>
      </head>

      <body style="margin:0; padding:0; background-color:#f3f4f6; color:#1f2937;">
        
        <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background-color:#f3f4f6; padding: 40px 0;">
          <tr>
            <td align="center">
              
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="max-width:600px; background-color:#ffffff; border-radius:12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1); overflow:hidden;">
                
                <tr>
                  <td style="padding: 32px 40px; background-color: #ffffff; border-bottom: 1px solid #f0f0f0;">
                    <h1 style="margin:0; font-size:22px; font-weight:700; color:#2563eb; letter-spacing: -0.5px;">
                      BIM CDE
                    </h1>
                  </td>
                </tr>

                <tr>
                  <td style="padding: 40px;">
                    
                    <p style="margin:0 0 24px 0; font-size:16px; line-height:24px; color:#374151;">
                      Hi there,
                    </p>
                    <p style="margin:0 0 32px 0; font-size:16px; line-height:24px; color:#374151;">
                      <strong>${senderName}</strong> has shared a file with you from the project <strong>${projectName}</strong>.
                    </p>

                    <table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="border: 1px solid #e5e7eb; border-radius: 8px; background-color: #fafafa;">
                      <tr>
                        <td style="padding: 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0" role="presentation">
                            <tr>
                              <td width="60" valign="top" style="padding-right: 20px;">
                                <div style="width: 48px; height: 60px; background-color: #e0e7ff; border: 1px solid #c7d2fe; border-radius: 6px; position: relative;">
                                    <div style="position: absolute; top: 18px; left: 8px; right: 8px; height: 2px; background-color: #a5b4fc;"></div>
                                    <div style="position: absolute; top: 26px; left: 8px; right: 8px; height: 2px; background-color: #a5b4fc;"></div>
                                    <div style="position: absolute; top: 34px; left: 8px; width: 20px; height: 2px; background-color: #a5b4fc;"></div>
                                    <div style="position: absolute; top: 0; right: 0; width: 0; height: 0; border-style: solid; border-width: 0 16px 16px 0; border-color: transparent #ffffff transparent transparent;"></div>
                                </div>
                              </td>
                              
                              <td valign="middle">
                                <p style="margin: 0 0 4px 0; font-size: 16px; font-weight: 600; color: #111827;">
                                  ${fileName}
                                </p>
                                <p style="margin: 0; font-size: 13px; color: #6b7280;">
                                  Shared by ${senderName} • ${new Date().toLocaleDateString("en-GB")}
                                </p>
                                ${note ? `<p style="margin: 8px 0 0 0; font-size: 13px; color: #4b5563; font-style: italic; background: #f3f4f6; padding: 6px 10px; border-radius: 4px;">"${note}"</p>` : ""}
                              </td>
                            </tr>
                          </table>
                        </td>
                      </tr>
                      
                      <tr>
                        <td style="padding: 0 20px 20px 20px;">
                          <table width="100%" cellpadding="0" cellspacing="0">
                              <tr>
                                <td width="50%" style="padding-right: 8px;">
                                    <a href="${link}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #2563eb; color: #ffffff; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center; border: 1px solid #2563eb;">
                                      Open in Viewer
                                    </a>
                                </td>

                                ${showDownloadButton ? `
                                <td width="50%" style="padding-left: 8px;">
                                    <a href="${downloadLink}" target="_blank" style="display: block; width: 100%; box-sizing: border-box; background-color: #ffffff; color: #374151; text-decoration: none; padding: 12px 20px; border-radius: 6px; font-weight: 600; font-size: 14px; text-align: center; border: 1px solid #d1d5db;">
                                      Download File
                                    </a>
                                </td>
                                ` : `
                                <td width="50%"></td>
                                `}
                              </tr>
                          </table>
                        </td>
                      </tr>
                    </table>

                    <p style="margin: 32px 0 0 0; font-size: 13px; color: #9ca3af; text-align: center;">
                      You received this email because a file was shared with you via BIM CDE.
                      <br>If the button doesn't work, verify that the link has not expired.
                    </p>

                  </td>
                </tr> 
                
                <tr>
                  <td style="background-color: #f9fafb; padding: 24px; text-align: center; border-top: 1px solid #f0f0f0;">
                    <p style="margin: 0; font-size: 12px; color: #9ca3af;">
                      © ${new Date().getFullYear()} BIM CDE Platform. All rights reserved.
                    </p>
                  </td>
                </tr>

              </table>

            </td>
          </tr>
        </table>

      </body>
      </html>
      `,
    };

    await transporter.sendMail(mailOptions);
    console.log(`✅ Mail sent successfully.`);
  }

  async downloadPublicFile(fileId: string, shareToken: string, res: Response) {
    // a. Validate Token
    const share = await ShareModel.findOne({ token: shareToken, fileId: new Types.ObjectId(fileId) }).lean();
    if (!share) throw new AppError("Link chia sẻ không hợp lệ", 403);
    if (share.expiresAt && new Date() > share.expiresAt) throw new AppError("Link đã hết hạn", 410);

    // b. Validate Quyền (Quan trọng!)
    if (share.accessLevel !== "DOWNLOAD") {
        throw new AppError("Bạn không có quyền tải file này (Chỉ xem)", 403);
    }

    // c. Tìm File
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new AppError("File không tồn tại", 404);

    const latestVersion = file.versions.find(v => v.version === file.currentVersion) 
                       || file.versions[file.versions.length - 1];

    if (!latestVersion || !latestVersion.storageKey) throw new AppError("Nội dung file bị lỗi", 404);

    // d. Stream File từ R2/S3 về Client
    try {
      const command = new GetObjectCommand({
        Bucket: env.R2_BUCKET_NAME,
        Key: latestVersion.storageKey,
      });
      const s3Response = await s3Client.send(command);

      // Set Header để trình duyệt hiểu là file tải về
      res.setHeader("Content-Disposition", `attachment; filename="${file.name}"`);
      res.setHeader("Content-Type", latestVersion.mimeType || "application/octet-stream");
      
      // Pipe stream
      (s3Response.Body as any).pipe(res);

    } catch (err) {
      console.error("S3 Download Error:", err);
      throw new AppError("Lỗi khi tải file từ storage", 500);
    }
  }
  // --- HÀM VALIDATE TOKEN ---
  async getFileDetailPublic(fileId: string, shareToken: string) {
    const cleanFileId = fileId.trim();

    console.log(`🚀 [DEBUG SERVICE] Request Public File: ${cleanFileId}`);

    if (!Types.ObjectId.isValid(cleanFileId)) {
       throw new AppError("ID file không hợp lệ", 400);
    }

    
    const share = await ShareModel.findOne({ 
        token: shareToken, 
        fileId: new Types.ObjectId(cleanFileId) 
    }).lean();

    if (!share) {
        console.error("❌ [DEBUG] Share token not found or mismatch fileId");
        throw new AppError("Link chia sẻ không hợp lệ hoặc đã hết hạn", 403);
    }

    const file = await FileModel.findOne({ 
        _id: new Types.ObjectId(cleanFileId),
        isDeleted: {$ne: true}
    }).lean();

    if (!file) {
        console.error("❌ [DEBUG] File record missing in DB but Share link exists (Zombie Link)");
        throw new AppError("File không tồn tại hoặc đã bị xóa", 404);
    }

    const currentVer = file.versions?.find(v => v.version === file.currentVersion) 
                    || file.versions?.[file.versions.length - 1];

    let signedUrl = "";
    
    if (currentVer && currentVer.storageKey) {
       try {
         const command = new GetObjectCommand({
           Bucket: env.R2_BUCKET_NAME,
           Key: currentVer.storageKey,
         });
         
         signedUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
         console.log("✅ [DEBUG SERVICE] Signed URL Created Success");
       } catch (err) {
         console.error("❌ [DEBUG SERVICE] Signed URL Failed:", err);
         signedUrl = currentVer.location || ""; 
       }
    } else {
        console.warn("⚠️ [DEBUG SERVICE] No Storage Key found, using raw location");
        signedUrl = currentVer?.location || "";
    }

    return {
      _id: file._id.toString(),
      name: file.name,
      projectId: file.projectId.toString(),

      // 🔑 Signed URL 
      fileUrl: signedUrl,
      previewSrc: signedUrl,

      currentVersion: file.currentVersion,

      versions: (file.versions || []).map(v => ({
        version: v.version,
        size: v.size,
        mimeType: v.mimeType,

        location: signedUrl,
      })),

      mimeType: currentVer?.mimeType || "application/octet-stream",
      size: currentVer?.size || 0,

      permission: share.accessLevel,
    };
  }
  
  async getAllFiles() {
    return await FileModel.find();
  }

  /**
   * Get total storage used by project (sum of file sizes in bytes).
   * Used for dashboard storage bar.
   */
  async getProjectStorageUsed(projectId: string): Promise<number> {
    const projectObjId = new Types.ObjectId(projectId);
    const result = await FileModel.aggregate([
      { $match: { projectId: projectObjId, isDeleted: false } },
      {
        $project: {
          lastSize: { $ifNull: [{ $arrayElemAt: ["$versions.size", -1] }, 0] },
        },
      },
      { $group: { _id: null, total: { $sum: "$lastSize" } } },
    ]);
    return result[0]?.total ?? 0;
  }

  /**
   * Planned uploads vs {@link PROJECT_STORAGE_LIMIT_BYTES}.
   * Uses same metric as {@link getProjectStorageUsed}: sum of latest version size per file.
   * Accounts for new file (+size) vs new version (replace latest size delta).
   */
  async assertIncomingUploadsFitProjectQuota(
    projectId: string,
    folderId: string | null | undefined,
    uploads: { sanitizedName: string; size: number }[],
    conflictStrategy: ConflictStrategy = "version",
  ): Promise<void> {
    let validFolderId: Types.ObjectId | null = null;
    if (folderId && folderId !== "null" && folderId !== "undefined" && folderId !== "") {
      validFolderId = new Types.ObjectId(folderId);
    }
    const projectObjId = new Types.ObjectId(projectId);

    let virtualUsed = await this.getProjectStorageUsed(projectId);

    for (const { sanitizedName, size } of uploads) {
      let targetName = sanitizedName;

      if (conflictStrategy === "copy") {
        const sameName = await FileModel.findOne({
          folderId: validFolderId,
          name: sanitizedName,
          projectId: projectObjId,
          isDeleted: false,
        });
        if (sameName) {
          targetName = await this.generateUniqueCopyName(
            sanitizedName,
            validFolderId,
            projectObjId,
          );
        }
      }

      const existingFile = await FileModel.findOne({
        folderId: validFolderId,
        name: targetName,
        projectId: projectObjId,
        isDeleted: false,
      });

      if (existingFile) {
        const last = existingFile.versions[existingFile.versions.length - 1];
        const oldSz = last?.size ?? 0;
        virtualUsed = virtualUsed - oldSz + size;
      } else {
        virtualUsed += size;
      }

      if (virtualUsed > PROJECT_STORAGE_LIMIT_BYTES) {
        throw new AppError(
          "This upload would exceed the project storage limit (500 MB). Remove files or use smaller files.",
          413,
        );
      }
    }
  }

  /**
   * Get file type statistics for a project (count by extension).
   * Used for dashboard pie chart.
   */
  async getFileTypeStats(projectId: string): Promise<{ extension: string; count: number }[]> {
    const projectObjId = new Types.ObjectId(projectId);
    const result = await FileModel.aggregate([
      { $match: { projectId: projectObjId, isDeleted: false } },
      {
        $project: {
          ext: {
            $cond: {
              if: { $gt: [{ $size: { $split: ["$name", "."] } }, 1] },
              then: { $toLower: { $arrayElemAt: [{ $split: ["$name", "."] }, -1] } },
              else: "other",
            },
          },
        },
      },
      { $group: { _id: "$ext", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $project: { extension: "$_id", count: 1, _id: 0 } },
    ]);
    return result;
  }

  // RENAME FILE
  // async renameFile(fileId: string, newNameWithoutExt: string, userId: string) {
  //   const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
  //   if (!file) throw new Error("File not found");

  //   const ext = path.extname(file.name);
  //   const newFullName = `${newNameWithoutExt}${ext}`;

  //   if (file.name === newFullName) return file;

  //   const duplicate = await FileModel.findOne({
  //     folderId: file.folderId,
  //     name: newFullName,
  //     isDeleted: false,
  //   });
  //   if (duplicate) throw new Error("A file with this name already exists.");

  //   if (file.isLocked && file.lockedBy?.toString() !== userId) {
  //     throw new Error("File is locked by another user.");
  //   }

  //   const lastVer = file.versions[file.versions.length - 1];
  //   const nextVersion = file.currentVersion + 1;

  //   const newVersionData = {
  //     version: nextVersion,
  //     fileName: newFullName,
  //     storageKey: lastVer.storageKey,
  //     location: lastVer.location,
  //     size: lastVer.size,
  //     mimeType: lastVer.mimeType,
  //     uploadedBy: new Types.ObjectId(userId),
  //     createdAt: new Date(),
  //   };

  //   file.name = newFullName;
  //   file.currentVersion = nextVersion;
  //   file.versions.push(newVersionData);
  //   return await file.save();
  // }

  // RENAME FILE
  async renameFile(fileId: string, newNameFromClient: string, userId: string) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    const projectIdStr =
      typeof file.projectId === "object" && file.projectId !== null
        ? (file.projectId as Types.ObjectId).toString()
        : String(file.projectId);
    await cdeAccess.assertFileAccess(
      projectIdStr,
      new Types.ObjectId(userId),
      fileId,
      "write"
    );

    const ext = path.extname(file.name);
    let finalName = newNameFromClient.trim();
    
    if (ext) {
      // 1. Gọt sạch các khoảng trắng và dấu chấm ở cuối
      finalName = finalName.replace(/[\.\s]+$/, '');
      
      // 2. Vòng lặp xóa sạch TẤT CẢ các đuôi bị lặp (vd: gọt sạch .pdf.pdf.pdf)
      while (finalName.toLowerCase().endsWith(ext.toLowerCase())) {
        finalName = finalName.slice(0, -ext.length);
        finalName = finalName.replace(/[\.\s]+$/, ''); 
      }
    }

    // 🌟 ĐÃ FIX LỖI: Sử dụng 'finalName' thay vì 'newNameWithoutExt'
    const newFullName = `${finalName}${ext}`;

    // Nếu tên không thay đổi thì return luôn, không làm gì cả
    if (file.name === newFullName) return file;

    const duplicate = await FileModel.findOne({
      folderId: file.folderId,
      name: newFullName,
      projectId: file.projectId, // Đảm bảo check trùng trong cùng project
      isDeleted: false,
    });
    if (duplicate) throw new Error("A file with this name already exists.");

    if (file.isLocked && file.lockedBy?.toString() !== userId) {
      throw new Error("File is locked by another user.");
    }

    const lastVer = file.versions[file.versions.length - 1];
    const nextVersion = file.currentVersion + 1;

    // Lưu lịch sử bản Version mới
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

  /** "file (1).ext", "file (2).ext", … when keeping a separate document */
  private async generateUniqueCopyName(
    fullName: string,
    folderId: Types.ObjectId | null,
    projectId: Types.ObjectId,
  ): Promise<string> {
    const ext = path.extname(fullName);
    const base = fullName.slice(0, -ext.length);
    let n = 1;
    for (;;) {
      const candidate = `${base} (${n})${ext}`;
      const dup = await FileModel.findOne({
        folderId,
        name: candidate,
        projectId,
        isDeleted: false,
      });
      if (!dup) return candidate;
      n += 1;
    }
  }

  // HANDLE FILE UPLOAD
  async handleFileUpload(
    fileData: {
      storageKey: string;
      originalname: string;
      size: number;
      mimeType: string;
      location: string;
    },
    projectId: string,
    folderId: string | null | undefined,
    userId: string,
    conflictStrategy: ConflictStrategy = "version",
  ) {
    let validFolderId: Types.ObjectId | null = null;

    if (folderId && folderId !== "null" && folderId !== "undefined" && folderId !== "") {
      validFolderId = new Types.ObjectId(folderId);
    }

    const userOid = new Types.ObjectId(userId);
    if (validFolderId) {
      await cdeAccess.assertFolderAccess(
        projectId,
        userOid,
        validFolderId.toString(),
        "create_child"
      );
    } else {
      const proj = await ProjectModel.findById(projectId).select("workflowMode").lean();
      if (parseCdeWorkflowMode(proj?.workflowMode) === "ISO_19650") {
        const ctx = await cdeAccess.loadIsoContext(projectId, userOid);
        if (!ctx.isProjectAdmin) {
          throw new AppError(
            "Cannot upload to project root in ISO 19650 mode",
            403
          );
        }
      }
    }

    const projectObjId = new Types.ObjectId(projectId);
    let finalName = fileData.originalname;

    let existingFile = await FileModel.findOne({
      folderId: validFolderId,
      name: finalName,
      projectId: projectObjId,
      isDeleted: false,
    });

    if (existingFile && conflictStrategy === "copy") {
      finalName = await this.generateUniqueCopyName(finalName, validFolderId, projectObjId);
      existingFile = null;
    }

    if (existingFile) {
      await cdeAccess.assertFileAccess(
        projectId,
        userOid,
        existingFile._id.toString(),
        "write"
      );
      if (
        existingFile.isLocked &&
        existingFile.lockedBy?.toString() !== userId
      ) {
        throw new AppError(
          "File is locked by another user. Cannot upload new version.",
          409,
        );
      }
    }

    const newVersionData = {
      fileName: finalName,
      storageKey: fileData.storageKey,
      location: fileData.location,
      size: fileData.size,
      mimeType: fileData.mimeType,
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
      existingFile.workflowStatus = "WIP_DRAFT";
      existingFile.submittedForReviewAt = null;
      existingFile.submittedForReviewBy = null;
      existingFile.submittedForReviewVersion = null;
      existingFile.wipPromotedToSharedVersion = null;
      existingFile.sharedPromotedToPublishedVersion = null;
      return await existingFile.save();
    }

    const newFile = new FileModel({
      name: finalName,
      folderId: validFolderId,
      projectId: projectObjId,
      currentVersion: 1,
      versions: [{ ...newVersionData, version: 1 }],
      createdBy: userOid,
      workflowStatus: "WIP_DRAFT",
      submittedForReviewAt: null,
      submittedForReviewBy: null,
      submittedForReviewVersion: null,
    });
    return await newFile.save();
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

    const versionHistory = [...file.versions]
      .sort((a, b) => a.version - b.version)
      .map((v) => {
        const uploader =
          typeof v.uploadedBy === "object" && v.uploadedBy && "fullName" in v.uploadedBy
            ? {
                fullName: (v.uploadedBy as any).fullName,
                email: (v.uploadedBy as any).email,
              }
            : null;
        return {
          version: v.version,
          fileName: v.fileName,
          size: v.size,
          mimeType: v.mimeType,
          location: v.location,
          createdAt: v.createdAt,
          uploadedBy: uploader,
          origin:
            file.promotedFromFileId && v.version === 1
              ? "PROMOTION_COPY"
              : "UPLOAD_OR_UPDATE",
          promotedFromFileId: file.promotedFromFileId ?? null,
          promotedFromVersion: file.promotedFromVersion ?? null,
        };
      });

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
      workflowStatus: file.workflowStatus ?? "WIP_DRAFT",
      submittedForReviewAt: file.submittedForReviewAt ?? null,
      versionHistory,
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

    const projectIdStr =
      typeof file.projectId === "object" && file.projectId !== null
        ? (file.projectId as Types.ObjectId).toString()
        : String(file.projectId);
    const userOid = new Types.ObjectId(userId);
    await cdeAccess.assertFileAccess(
      projectIdStr,
      userOid,
      fileId,
      "move"
    );

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

    if (destFolderIdObj) {
      await cdeAccess.assertFolderAccess(
        projectIdStr,
        userOid,
        destFolderIdObj.toString(),
        "create_child"
      );
    } else {
      const proj = await ProjectModel.findById(projectIdStr)
        .select("workflowMode")
        .lean();
      if (parseCdeWorkflowMode(proj?.workflowMode) === "ISO_19650") {
        const ctx = await cdeAccess.loadIsoContext(projectIdStr, userOid);
        if (!ctx.isProjectAdmin) {
          throw new AppError(
            "Cannot move file to project root in ISO 19650 mode",
            403
          );
        }
      }
    }

    await cdeAccess.assertIsoArchivedMoveAllowed(
      projectIdStr,
      userOid,
      [file.folderId?.toString() ?? null],
      destFolderIdObj ? destFolderIdObj.toString() : null,
    );

    await cdeAccess.assertIsoMoveDestinationSameGroup(
      projectIdStr,
      [file.folderId?.toString() ?? null],
      destFolderIdObj ? destFolderIdObj.toString() : null,
    );

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
    const projectIdStr =
      typeof projectId === "object" && projectId !== null
        ? (projectId as Types.ObjectId).toString()
        : String(projectId);
    const userOid = new Types.ObjectId(userId);

    for (const f of sourceFiles) {
      await cdeAccess.assertFileAccess(
        projectIdStr,
        userOid,
        f._id.toString(),
        "move"
      );
    }

    let destFolderIdObj: Types.ObjectId | null = null;

    if (destinationFolderId && destinationFolderId !== "null" && destinationFolderId !== "") {
      if (!Types.ObjectId.isValid(destinationFolderId)) throw new Error("Invalid destination folder ID");
      const destFolder = await FolderModel.findOne({ _id: destinationFolderId, isDeleted: false });
      if (!destFolder) throw new Error("Destination folder not found");
      if (destFolder.projectId.toString() !== projectId.toString()) throw new Error("Cannot move files to another project");
      destFolderIdObj = destFolder._id;
    }

    if (destFolderIdObj) {
      await cdeAccess.assertFolderAccess(
        projectIdStr,
        userOid,
        destFolderIdObj.toString(),
        "create_child"
      );
    } else {
      const proj = await ProjectModel.findById(projectIdStr)
        .select("workflowMode")
        .lean();
      if (parseCdeWorkflowMode(proj?.workflowMode) === "ISO_19650") {
        const ctx = await cdeAccess.loadIsoContext(projectIdStr, userOid);
        if (!ctx.isProjectAdmin) {
          throw new AppError(
            "Cannot move files to project root in ISO 19650 mode",
            403
          );
        }
      }
    }

    const uniqueFolderIds = [
      ...new Set(
        sourceFiles
          .map((f) => f.folderId?.toString())
          .filter((x): x is string => !!x),
      ),
    ];
    await cdeAccess.assertIsoArchivedMoveAllowed(
      projectIdStr,
      userOid,
      uniqueFolderIds.length > 0 ? uniqueFolderIds : [null],
      destFolderIdObj ? destFolderIdObj.toString() : null,
    );

    await cdeAccess.assertIsoMoveDestinationSameGroup(
      projectIdStr,
      uniqueFolderIds.length > 0 ? uniqueFolderIds : [null],
      destFolderIdObj ? destFolderIdObj.toString() : null,
    );

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

    const projectIdStr =
      typeof file.projectId === "object" && file.projectId !== null
        ? (file.projectId as Types.ObjectId).toString()
        : String(file.projectId);
    await cdeAccess.assertFileAccess(
      projectIdStr,
      new Types.ObjectId(userId),
      fileId,
      "delete"
    );

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
  async downloadFile(
    fileId: string,
    res: Response,
    version?: number,
    userId?: string
  ) {
    const file = await FileModel.findOne({ _id: fileId, isDeleted: false });
    if (!file) throw new Error("File not found");

    if (userId) {
      const projectIdStr =
        typeof file.projectId === "object" && file.projectId !== null
          ? (file.projectId as Types.ObjectId).toString()
          : String(file.projectId);
      await cdeAccess.assertFileAccess(
        projectIdStr,
        new Types.ObjectId(userId),
        fileId,
        "read"
      );
    }

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