import { NoSuchKey } from "@aws-sdk/client-s3";

import { imageMetadataSchema, type ImageMetadata } from "@/lib/validators";
import { getObjectText, putObjectText } from "@/server/storage/r2";

const metadataKey = (userId: string) => `metadata/${userId}/images.json`;

function isMissingMetadataFile(error: unknown) {
  if (!error || typeof error !== "object") return false;

  const namedError = error as { Code?: string; name?: string; $metadata?: { httpStatusCode?: number } };

  if (namedError.name === "NoSuchBucket" || namedError.Code === "NoSuchBucket") {
    return false;
  }

  return namedError instanceof NoSuchKey || namedError.name === "NoSuchKey" || namedError.Code === "NoSuchKey" || namedError.$metadata?.httpStatusCode === 404;
}

export async function listImageMetadata(userId: string): Promise<ImageMetadata[]> {
  try {
    const body = await getObjectText(metadataKey(userId));
    if (!body.trim()) return [];

    const parsed = JSON.parse(body);
    return imageMetadataSchema
      .array()
      .parse(parsed)
      .map((image) => ({ ...image, userId }));
  } catch (error) {
    if (isMissingMetadataFile(error)) {
      return [];
    }

    throw error;
  }
}

export async function writeImageMetadata(userId: string, images: ImageMetadata[]) {
  const payload = images
    .map(({ userId: _userId, ...image }) => image)
    .sort((left, right) => Date.parse(right.createdAt) - Date.parse(left.createdAt));

  await putObjectText(metadataKey(userId), JSON.stringify(payload, null, 2));
}
