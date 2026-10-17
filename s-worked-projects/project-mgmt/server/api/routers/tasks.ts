import { and, desc, eq, ilike } from "drizzle-orm";

import { taskCreateSchema, taskDeleteSchema, taskListSchema, taskUpdateSchema } from "@/lib/validators";
import { protectedProcedure, router } from "@/server/api/trpc";
import { db } from "@/server/db";
import { tasks } from "@/server/db/schema";

export const tasksRouter = router({
  list: protectedProcedure.input(taskListSchema).query(async ({ ctx, input }) => {
    const filters = [eq(tasks.userId, ctx.userId)];

    if (input.status !== "all") {
      filters.push(eq(tasks.status, input.status));
    }

    if (input.priority !== "all") {
      filters.push(eq(tasks.priority, input.priority));
    }

    if (input.search) {
      filters.push(ilike(tasks.title, `%${input.search}%`));
    }

    return db.query.tasks.findMany({
      where: and(...filters),
      orderBy: [desc(tasks.createdAt)]
    });
  }),

  create: protectedProcedure.input(taskCreateSchema).mutation(async ({ ctx, input }) => {
    const [task] = await db
      .insert(tasks)
      .values({
        userId: ctx.userId,
        title: input.title,
        description: input.description,
        priority: input.priority,
        status: input.status,
        dueDate: input.dueDate
      })
      .returning();

    return task;
  }),

  update: protectedProcedure.input(taskUpdateSchema).mutation(async ({ ctx, input }) => {
    const { id, ...values } = input;
    const [task] = await db
      .update(tasks)
      .set(values)
      .where(and(eq(tasks.id, id), eq(tasks.userId, ctx.userId)))
      .returning();

    return task;
  }),

  delete: protectedProcedure.input(taskDeleteSchema).mutation(async ({ ctx, input }) => {
    const [task] = await db
      .delete(tasks)
      .where(and(eq(tasks.id, input.id), eq(tasks.userId, ctx.userId)))
      .returning({ id: tasks.id });

    return task;
  })
});
