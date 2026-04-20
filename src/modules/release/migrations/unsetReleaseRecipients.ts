import ReleaseModel from "../schemas/release.schema";

/** Remove legacy `recipients` from stored documents after the field was dropped from the model. */
export async function unsetReleaseRecipientsField(): Promise<void> {
  const result = await ReleaseModel.collection.updateMany(
    { recipients: { $exists: true } },
    { $unset: { recipients: "" } },
  );
  if (result.modifiedCount > 0) {
    console.log(
      `[unsetReleaseRecipientsField] Removed recipients from ${result.modifiedCount} release document(s).`,
    );
  }
}
