import { createReadStream } from "fs";
import { PutObjectCommand } from "@aws-sdk/client-s3";
import { s3Client } from "../../../lib/r2.lib";
import { env } from "../../../env";

export async function uploadLocalFileToR2(params: {
  localPath: string;
  key: string;
  contentType: string;
}): Promise<void> {
  await s3Client.send(
    new PutObjectCommand({
      Bucket: env.R2_BUCKET_NAME || "bimbucket",
      Key: params.key,
      Body: createReadStream(params.localPath),
      ContentType: params.contentType,
    }),
  );
}
