import cron from "node-cron";
import { DeleteObjectsCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../../lib/r2.lib";
import { env } from "../../../env";
import FileModel from "../../file/schemas/file.schema";
import FolderModel from "../../folder/schemas/folder.schema";
import ViewModel from "../../view/schemas/view.schema";

// Cron job (Keep unchanged, call the cleanup function at 24h)
export const startCleanupJob = () => {
  cron.schedule("0 * * * *", async () => {
    console.log("[Cron] Running scheduled cleanup...");
    await cleanUpSoftDeletedItems(24);
  });
};

/**
 * Core cleanup function
 * @param retentionHours Number of hours to retain deleted files. Pass 0 to delete them immediately.
 */
export const cleanUpSoftDeletedItems = async (retentionHours: number = 24) => {
  const result = {
    deletedFilesCount: 0,
    deletedFoldersCount: 0,
    deletedR2Objects: 0,
    deletedViewsCount: 0,
  };

  try {
    // Calculate the time threshold: Current time - number of hours retained
    // If retentionHours = 0 -> thresholdDate = Current time -> Delete all entries deletedAt < Current time
    const thresholdDate = new Date(
      Date.now() - retentionHours * 60 * 60 * 1000
    );

    // --- 1. FILE PROCESSING ---
    const filesToDelete = await FileModel.find({
      isDeleted: true,
      deletedAt: { $lt: thresholdDate },
    });

    console.log(
      `[Cleanup] Found ${filesToDelete.length} files to permanently delete.`
    );

    if (filesToDelete.length > 0) {
      const r2KeysToDelete: { Key: string }[] = [];
      filesToDelete.forEach((file) => {
        if (file.versions?.length) {
          file.versions.forEach((ver) => {
            if (ver.storageKey) r2KeysToDelete.push({ Key: ver.storageKey });
          });
        }
      });

      if (r2KeysToDelete.length > 0) {
        if (r2KeysToDelete.length <= 1000) {
          await s3Client.send(
            new DeleteObjectsCommand({
              Bucket: env.R2_BUCKET_NAME,
              Delete: { Objects: r2KeysToDelete, Quiet: true },
            })
          );
          result.deletedR2Objects = r2KeysToDelete.length;
        } else {
          console.warn(
            "Too many files to delete at once on R2, implementing chunking is recommended."
          );
        }
      }
      const fileIds = filesToDelete.map((f) => f._id);

      const deleteViewResult = await ViewModel.deleteMany({
        relatedFileId: { $in: fileIds },
      });
      result.deletedViewsCount = deleteViewResult.deletedCount;

      await FileModel.deleteMany({ _id: { $in: fileIds } });

      result.deletedFilesCount = fileIds.length;
    }

    // --- 2. FOLDER PROCESSING  ---
    const foldersToDelete = await FolderModel.find({
      isDeleted: true,
      deletedAt: { $lt: thresholdDate },
    });

    if (foldersToDelete.length > 0) {
      const folderIds = foldersToDelete.map((f) => f._id);
      await FolderModel.deleteMany({ _id: { $in: folderIds } });

      result.deletedFoldersCount = folderIds.length;
    }

    console.log(`[Cleanup] Finished. Result:`, result);
    return result;
  } catch (error) {
    console.error("[Cleanup Error]", error);
    throw error;
  }
};
