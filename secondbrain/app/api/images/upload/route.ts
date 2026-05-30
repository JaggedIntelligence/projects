import { auth } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

import { allowedImageTypes, maxImageUploadBatchSize, maxImageUploadBytes, type ImageMetadata } from "@/lib/validators";
import { listImageMetadata, writeImageMetadata } from "@/server/images/image-metadata";
import { createImageKey, sanitizeFileName } from "@/server/images/image-utils";
import { putObjectBytes } from "@/server/storage/r2";

export const runtime = "nodejs";

function errorResponse(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}

export async function POST(request: Request) {
  const session = await auth();

  if (!session.userId) {
    return errorResponse("Unauthorized", 401);
  }

  const formData = await request.formData();
  const files = formData.getAll("files").filter((value): value is File => value instanceof File);

  if (!files.length) {
    return errorResponse("Select at least one image.");
  }

  if (files.length > maxImageUploadBatchSize) {
    return errorResponse(`Upload ${maxImageUploadBatchSize} images or fewer at a time.`);
  }

  const now = new Date().toISOString();
  const uploadedImages: ImageMetadata[] = [];

  for (const file of files) {
    if (!allowedImageTypes.includes(file.type as (typeof allowedImageTypes)[number])) {
      return errorResponse(`${file.name} is not a supported image type.`);
    }

    if (file.size > maxImageUploadBytes) {
      return errorResponse(`${file.name} is too large.`);
    }

    const id = crypto.randomUUID();
    const fileName = sanitizeFileName(file.name);
    const r2Key = createImageKey(session.userId, id, fileName);
    const bytes = new Uint8Array(await file.arrayBuffer());

    await putObjectBytes(r2Key, bytes, file.type);

    uploadedImages.push({
      id,
      userId: session.userId,
      fileName,
      originalName: file.name,
      r2Key,
      contentType: file.type as (typeof allowedImageTypes)[number],
      size: file.size,
      width: null,
      height: null,
      createdAt: now,
      updatedAt: now
    });
  }

  const currentImages = await listImageMetadata(session.userId);
  const mergedImages = [...uploadedImages, ...currentImages];
  await writeImageMetadata(session.userId, mergedImages);

  return NextResponse.json({ images: uploadedImages });
}
