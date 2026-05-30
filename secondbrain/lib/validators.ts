import { z } from "zod";

export const allowedImageTypes = ["image/jpeg", "image/png", "image/webp", "image/gif"] as const;
export const maxImageUploadBytes = 10 * 1024 * 1024;
export const maxImageUploadBatchSize = 20;

export const taskPrioritySchema = z.enum(["low", "medium", "high"]);
export const taskStatusSchema = z.enum(["todo", "in_progress", "done"]);

export const taskCreateSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(120, "Keep titles under 120 characters"),
  description: z.string().trim().max(2000).optional().nullable(),
  priority: taskPrioritySchema.default("medium"),
  status: taskStatusSchema.default("todo"),
  dueDate: z.coerce.date().optional().nullable()
});

export const taskUpdateSchema = taskCreateSchema.partial().extend({
  id: z.string().uuid()
});

export const taskDeleteSchema = z.object({
  id: z.string().uuid()
});

export const taskListSchema = z.object({
  search: z.string().trim().max(120).optional(),
  status: z.union([taskStatusSchema, z.literal("all")]).default("all"),
  priority: z.union([taskPrioritySchema, z.literal("all")]).default("all")
});

export const imageUploadRequestSchema = z.object({
  files: z
    .array(
      z.object({
        fileName: z.string().trim().min(1, "File name is required").max(180, "Keep file names under 180 characters"),
        contentType: z.enum(allowedImageTypes),
        size: z.number().int().positive().max(maxImageUploadBytes)
      })
    )
    .min(1, "Select at least one image")
    .max(maxImageUploadBatchSize, `Upload ${maxImageUploadBatchSize} images or fewer at a time`)
});

export const imageMetadataSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().trim().min(1).max(180),
  originalName: z.string().trim().min(1).max(180),
  r2Key: z.string().trim().min(1),
  contentType: z.enum(allowedImageTypes),
  size: z.number().int().positive().max(maxImageUploadBytes),
  width: z.number().int().positive().nullable(),
  height: z.number().int().positive().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime()
});

export const imageConfirmUploadsSchema = z.object({
  images: z.array(imageMetadataSchema).min(1).max(maxImageUploadBatchSize)
});

export const imageRenameSchema = z.object({
  id: z.string().uuid(),
  fileName: z.string().trim().min(1, "File name is required").max(180, "Keep file names under 180 characters")
});

export const imageDeleteSchema = z.object({
  id: z.string().uuid()
});

export const imageViewSchema = z.object({
  id: z.string().uuid()
});

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskFormValues = z.infer<typeof taskCreateSchema>;
export type ImageMetadata = z.infer<typeof imageMetadataSchema> & { userId: string };
