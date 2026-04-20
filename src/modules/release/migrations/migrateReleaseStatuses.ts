import ReleaseModel from "../schemas/release.schema";

/** One-time data fix: legacy SENT → RELEASED (runs at startup). */
export async function migrateReleaseStatuses(): Promise<void> {
  const result = await ReleaseModel.collection.updateMany(
    { status: "SENT" },
    { $set: { status: "RELEASED" } },
  );
  if (result.modifiedCount > 0) {
    console.log(
      `[migrateReleaseStatuses] Updated ${result.modifiedCount} release(s) from SENT to RELEASED.`,
    );
  }
}
