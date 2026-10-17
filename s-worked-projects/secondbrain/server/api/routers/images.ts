import { TRPCError } from "@trpc/server";

import {
  imageConfirmUploadsSchema,
  imageDeleteSchema,
  imageRenameSchema,
  imageUploadRequestSchema,
  imageViewSchema,
  type ImageMetadata
} from "@/lib/validators";
import { protectedProcedure, router } from "@/server/api/trpc";
import { listImageMetadata, writeImageMetadata } from "@/server/images/image-metadata";
import { createImageKey, sanitizeFileName } from "@/server/images/image-utils";
import { checkBucketAccess, createUploadUrl, createViewUrl, deleteObject } from "@/server/storage/r2";

async function withViewUrls(images: ImageMetadata[]) {
  return Promise.all(
    images.map(async (image) => ({
      ...image,
      url: await createViewUrl(image.r2Key)
    }))
  );
}

export const imagesRouter = router({
  health: protectedProcedure.query(async () => {
    const result = await checkBucketAccess();
    return {
      ok: true,
      bucketName: result.bucketName
    };
  }),

  list: protectedProcedure.query(async ({ ctx }) => {
    const images = await listImageMetadata(ctx.userId);
    return withViewUrls(images);
  }),

  createUploadUrls: protectedProcedure.input(imageUploadRequestSchema).mutation(async ({ ctx, input }) => {
    const now = new Date().toISOString();

    return Promise.all(
      input.files.map(async (file) => {
        const id = crypto.randomUUID();
        const fileName = sanitizeFileName(file.fileName);
        const r2Key = createImageKey(ctx.userId, id, fileName);

        return {
          image: {
            id,
            fileName,
            originalName: file.fileName,
            r2Key,
            contentType: file.contentType,
            size: file.size,
            width: null,
            height: null,
            createdAt: now,
            updatedAt: now
          },
          uploadUrl: await createUploadUrl(r2Key, file.contentType)
        };
      })
    );
  }),

  confirmUploads: protectedProcedure.input(imageConfirmUploadsSchema).mutation(async ({ ctx, input }) => {
    const currentImages = await listImageMetadata(ctx.userId);
    const existingIds = new Set(currentImages.map((image) => image.id));

    const uploadedImages = input.images.map((image) => {
      if (!image.r2Key.startsWith(`images/${ctx.userId}/`)) {
        throw new TRPCError({ code: "FORBIDDEN", message: "Image key is not scoped to the current user." });
      }

      return {
        ...image,
        fileName: sanitizeFileName(image.fileName),
        originalName: sanitizeFileName(image.originalName),
        userId: ctx.userId
      };
    });

    const mergedImages = [...uploadedImages.filter((image) => !existingIds.has(image.id)), ...currentImages];
    await writeImageMetadata(ctx.userId, mergedImages);

    return withViewUrls(mergedImages);
  }),

  rename: protectedProcedure.input(imageRenameSchema).mutation(async ({ ctx, input }) => {
    const images = await listImageMetadata(ctx.userId);
    const index = images.findIndex((image) => image.id === input.id);

    if (index === -1) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Image not found." });
    }

    images[index] = {
      ...images[index],
      fileName: sanitizeFileName(input.fileName),
      updatedAt: new Date().toISOString()
    };

    await writeImageMetadata(ctx.userId, images);
    return { ...images[index], url: await createViewUrl(images[index].r2Key) };
  }),

  delete: protectedProcedure.input(imageDeleteSchema).mutation(async ({ ctx, input }) => {
    const images = await listImageMetadata(ctx.userId);
    const image = images.find((item) => item.id === input.id);

    if (!image) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Image not found." });
    }

    await deleteObject(image.r2Key);
    await writeImageMetadata(
      ctx.userId,
      images.filter((item) => item.id !== input.id)
    );

    return { id: input.id };
  }),

  getViewUrl: protectedProcedure.input(imageViewSchema).query(async ({ ctx, input }) => {
    const images = await listImageMetadata(ctx.userId);
    const image = images.find((item) => item.id === input.id);

    if (!image) {
      throw new TRPCError({ code: "NOT_FOUND", message: "Image not found." });
    }

    return { url: await createViewUrl(image.r2Key) };
  })
});
