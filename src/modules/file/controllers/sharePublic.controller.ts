import express from "express";
import ShareModel from "../schemas/share.schema";
import FileModel from "../schemas/file.schema";
import { env } from "../../../env";

const SharePublicController = express.Router();

// GET /share/public/:token
// This route is public and intended to be used by recipients clicking the email link.
SharePublicController.get("/public/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).send("Missing token");

    const share = await ShareModel.findOne({ token });
    if (!share) return res.status(404).send("Invalid or expired link");

    if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
      return res.status(410).send("Link has expired");
    }

    const file = await FileModel.findById(share.fileId);
    if (!file) return res.status(404).send("File not found");

    const fileId = file._id.toString();
    const projectId = (file as any).projectId || "";

    // Redirect to a frontend share landing page that will resolve the token and redirect to viewer
    const redirectUrl = `${env.APP_URL?.replace(/\/$/, "")}/share/${token}`;

    return res.redirect(302, redirectUrl);
  } catch (err) {
    console.error("SharePublic error:", err);
    return res.status(500).send("Internal Server Error");
  }
});

// GET /share/:token - return JSON information about the share and file
SharePublicController.get("/:token", async (req, res) => {
  try {
    const { token } = req.params;
    if (!token) return res.status(400).json({ success: false, message: "Missing token" });

    const share = await ShareModel.findOne({ token });
    if (!share) return res.status(404).json({ success: false, message: "Invalid or expired link" });

    if (share.expiresAt && new Date() > new Date(share.expiresAt)) {
      return res.status(410).json({ success: false, message: "Link has expired" });
    }

    const file = await FileModel.findById(share.fileId);
    if (!file) return res.status(404).json({ success: false, message: "File not found" });

    // Enrich file with version data similar to getFileDetail
    const hasVersions = Array.isArray(file.versions) && file.versions.length > 0;
    const currentVer = hasVersions
      ? file.versions.find((v: any) => v.version === file.currentVersion) ?? file.versions[0]
      : undefined;

    const fileObj = file.toObject?.() ?? file;
    const enrichedFile = {
      ...(fileObj as any),
      size: hasVersions ? currentVer?.size : (fileObj as any).size,
      mimeType: hasVersions ? currentVer?.mimeType : (fileObj as any).mimeType,
      fileUrl: hasVersions ? currentVer?.location : (fileObj as any).fileUrl,
      previewSrc: hasVersions ? currentVer?.location : (fileObj as any).previewSrc,
      createdBy: hasVersions && currentVer?.uploadedBy ? (typeof currentVer.uploadedBy === 'object' ? (currentVer.uploadedBy as any).fullName : currentVer.uploadedBy) : (fileObj as any).createdBy,
    };

    return res.json({ success: true, data: { share, file: enrichedFile } });
  } catch (err) {
    console.error("SharePublic JSON error:", err);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
});

export default SharePublicController;
