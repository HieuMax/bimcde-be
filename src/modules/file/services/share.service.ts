import ShareModel from "../schemas/share.schema";
import nodemailer from "nodemailer";
import { v4 as uuidv4 } from "uuid";
import { AppError } from "../../../utils/AppError";
import FileModel from "../schemas/file.schema";

// Cấu hình Transporter (Nên tách ra file config riêng)
const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.MAIL_USER, // Email của bạn
    pass: process.env.MAIL_PASS, // App Password (Không phải pass đăng nhập thường)
  },
});

export default class FileService {
  async shareFile(payload: {
    fileId: string;
    userId: string;
    type: "SPECIFIC" | "INTERNAL_LINK" | "PUBLIC_LINK";
    recipients: string[]; // Mảng email
    note?: string;
    expiresAt?: Date;
    accessLevel: string;
    showLatestVersion: boolean;
  }) {
    const file = await FileModel.findById(payload.fileId);
    if (!file) throw new AppError("File not found", 404);

    // 1. Tạo Record Share trong DB
    const token = uuidv4(); // Tạo token duy nhất cho link

    const shareRecord = await ShareModel.create({
      fileId: payload.fileId,
      sharedBy: payload.userId,
      type: payload.type,
      recipients: payload.recipients,
      note: payload.note,
      expiresAt: payload.expiresAt,
      accessLevel: payload.accessLevel,
      showLatestVersion: payload.showLatestVersion,
      token: token,
    });

    // 2. Xử lý Gửi Mail (Chỉ gửi nếu có danh sách người nhận)
    if (payload.recipients && payload.recipients.length > 0) {
      // Tạo Link Share (Logic tùy loại)
      let shareLink = "";
      if (payload.type === "PUBLIC_LINK") {
        shareLink = `${process.env.APP_URL}/share/public/${token}`;
      } else {
        shareLink = `${process.env.APP_URL}/explorer?fileId=${payload.fileId}`;
      }

      // Gửi mail bất đồng bộ (không await để tránh user phải đợi lâu)
      this.sendShareEmails(
        payload.recipients,
        file.name,
        shareLink,
        payload.note
      ).catch((err) => console.error("Email error:", err));
    }

    return shareRecord;
  }

  // Helper gửi mail
  private async sendShareEmails(
    emails: string[],
    fileName: string,
    link: string,
    note?: string
  ) {
    const mailOptions = {
      from: '"BIM CDE System" <no-reply@cde.com>',
      to: emails.join(", "), // Gửi cho nhiều người
      subject: `[BIM CDE] File Shared: ${fileName}`,
      html: `
        <h3>A file has been shared with you</h3>
        <p><strong>File:</strong> ${fileName}</p>
        ${note ? `<p><strong>Note:</strong> ${note}</p>` : ""}
        <br/>
        <a href="${link}" style="padding: 10px 20px; background: #005F9E; color: white; text-decoration: none; border-radius: 5px;">
          Open File
        </a>
        <p style="font-size: 12px; color: gray; margin-top: 20px;">Link: ${link}</p>
      `,
    };

    await transporter.sendMail(mailOptions);
  }
}
