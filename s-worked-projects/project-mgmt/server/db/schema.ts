import { index, pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

export const taskPriority = pgEnum("task_priority", ["low", "medium", "high"]);
export const taskStatus = pgEnum("task_status", ["todo", "in_progress", "done"]);

export const tasks = pgTable(
  "tasks",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    title: text("title").notNull(),
    description: text("description"),
    priority: taskPriority("priority").notNull().default("medium"),
    status: taskStatus("status").notNull().default("todo"),
    dueDate: timestamp("due_date", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    userIdx: index("tasks_user_id_idx").on(table.userId),
    userStatusIdx: index("tasks_user_status_idx").on(table.userId, table.status),
    userPriorityIdx: index("tasks_user_priority_idx").on(table.userId, table.priority)
  })
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
