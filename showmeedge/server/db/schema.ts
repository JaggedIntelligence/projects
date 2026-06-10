import { index, pgEnum, pgTable, text, timestamp, uniqueIndex, uuid } from "drizzle-orm/pg-core";

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

export const savedSqlQueries = pgTable(
  "saved_sql_queries",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    userId: text("user_id").notNull(),
    name: text("name").notNull(),
    sql: text("sql").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow()
      .$onUpdate(() => new Date())
  },
  (table) => ({
    userIdx: index("saved_sql_queries_user_id_idx").on(table.userId),
    userNameUniqueIdx: uniqueIndex("saved_sql_queries_user_name_unique_idx").on(table.userId, table.name)
  })
);

export type Task = typeof tasks.$inferSelect;
export type NewTask = typeof tasks.$inferInsert;
export type SavedSqlQuery = typeof savedSqlQueries.$inferSelect;
export type NewSavedSqlQuery = typeof savedSqlQueries.$inferInsert;
