import { Types } from "mongoose";
import View2DModel from "../schemas/view2d.schema";
import { AppError } from "../../../utils/AppError";
import nodemailer from "nodemailer";
import { env } from "../../../env";

const transporter = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: env.MAIL_USER,
    pass: env.MAIL_PASS,
  },
});

export default class View2DService {
    async createView(payload: {
      name: string;
      description?: string;
      projectId: string;
      fileId: string;
      userId: string;
      pageIndex: number;
      scale: number;
      rotation: number;
      previewSrc?: string;
      sharedWith?: {
        isPublic?: boolean;
        users?: Array<
          | string
          | {
              id?: string;
              label?: string;
              fullName?: string;
              email?: string;
              type?: string;
            }
        >;
      };
      viewState?: any;
  }) {
    try {
      console.log("💾 [VIEW SERVICE] Creating view with payload:", payload);

        const sharedWith = payload.sharedWith?.users?.map((user) => {
          if (typeof user === "string") {
            return {
              label: user,
              type: "USER",
            };
          }
          return {
            userId: user.id ? new Types.ObjectId(user.id) : undefined,
            fullName: user.fullName || user.label,
            email: user.email,
            label: user.label || user.fullName,
            type: user.type || "USER",
          };
        }) || [];

        const newView = await View2DModel.create({
          name: payload.name,
          description: payload.description,
          projectId: new Types.ObjectId(payload.projectId),
          fileId: new Types.ObjectId(payload.fileId),
          createdBy: new Types.ObjectId(payload.userId),
          updatedBy: new Types.ObjectId(payload.userId),
          sharedWith: {
            isPublic: payload.sharedWith?.isPublic || false,
            users: sharedWith,
          },
          pageIndex: payload.pageIndex ?? 1,
          scale: payload.scale ?? 1,
          rotation: payload.rotation ?? 0,
          previewSrc: payload.previewSrc,
          viewState: payload.viewState,
        });

      const createdView = await newView.populate([
        { path: "createdBy", select: "fullName email" },
        { path: "updatedBy", select: "fullName email" },
      ]);

      await this.sendSharedViewEmails(createdView.sharedWith?.users || [], payload.projectId, payload.fileId, payload.name);
      return createdView;
    } catch (error) {
      console.error("❌ [VIEW SERVICE] Error creating view:", error);
      throw new AppError("Cannot create view", 500);
    }
  }

  // 2. Lấy danh sách View theo File
  async getViewsByFile(fileId: string) {
    if (!Types.ObjectId.isValid(fileId)) {
      throw new AppError("Invalid File ID", 400);
    }

    try {
      const views = await View2DModel.find({
        fileId: new Types.ObjectId(fileId),
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .populate("createdBy", "fullName email")
        .populate("updatedBy", "fullName email");

      return views;
    } catch (error) {
      throw new AppError("Cannot fetch views", 500);
    }
  }

  async getViewsByProject(projectId: string) {
    if (!Types.ObjectId.isValid(projectId)) {
      throw new AppError("Invalid Project ID", 400);
    }

    try {
      const views = await View2DModel.find({
        projectId: new Types.ObjectId(projectId),
        isDeleted: false,
      })
        .sort({ createdAt: -1 })
        .populate("createdBy", "fullName email")
        .populate("updatedBy", "fullName email")
        .populate("fileId", "name"); 

      return views;
    } catch (error) {
      throw new AppError("Cannot fetch views by project", 500);
    }
  }

  async deleteView(viewId: string, userId: string) {
    const view = await View2DModel.findById(viewId);

    if (!view) {
      throw new AppError("View not found", 404);
    }

    if (view.createdBy.toString() !== userId) {
      throw new AppError("Permission denied", 403);
    }

    await view.deleteOne();
    return true;
  }

  async updateView(viewId: string, data: any, userId: string) {
    const updated = await View2DModel.findByIdAndUpdate(
      viewId,
      {
        $set: {
          ...data,
          updatedBy: new Types.ObjectId(userId),
        },
      },
      { new: true }
    )
      .populate("createdBy", "fullName email")
      .populate("updatedBy", "fullName email");

    if (!updated) {
      throw new AppError("View not found", 404);
    }

    return updated;
  }

  private async sendSharedViewEmails(
    recipients: Array<any>,
    projectId: string,
    fileId: string,
    viewName: string,
  ) {
    try {
      const emails = recipients
        .map((recipient) => recipient.email)
        .filter((email: string | undefined) => typeof email === "string" && email.length > 0);

      if (emails.length === 0 || !env.MAIL_USER || !env.MAIL_PASS) {
        return;
      }

      const clientUrl = env.CLIENT_URL || "";
      const viewLink = `${clientUrl}/projects/${projectId}/viewer/${fileId}`;

      const mailOptions = {
        from: `"BIM CDE" <${env.MAIL_USER}>`,
        to: Array.from(new Set(emails)).join(", "),
        subject: `A new view was shared with you: ${viewName}`,
        html: `
          <div style="font-family: Arial, sans-serif; color: #111;">
            <h2>A view has been shared with you</h2>
            <p>The view "${viewName}" was created and shared with you in BIM CDE.</p>
            <p><a href="${viewLink}" style="color:#fff;background:#2563eb;padding:10px 14px;text-decoration:none;border-radius:6px;">Open View</a></p>
            <p>If you do not expect this message, please ignore it.</p>
          </div>
        `,
      };

      await transporter.sendMail(mailOptions);
      console.log(`✅ Shared view notification sent to ${emails.join(", ")}`);
    } catch (error) {
      console.error("❌ Error sending shared view email:", error);
    }
  }

}