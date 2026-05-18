import { z } from "zod";

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

export type TaskPriority = z.infer<typeof taskPrioritySchema>;
export type TaskStatus = z.infer<typeof taskStatusSchema>;
export type TaskFormValues = z.infer<typeof taskCreateSchema>;
