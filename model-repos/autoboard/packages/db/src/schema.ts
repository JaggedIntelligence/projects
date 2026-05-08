import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";

export const projects = sqliteTable("projects", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  filePath: text("file_path").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const kanbanCards = sqliteTable("kanban_cards", {
  id: text("id").primaryKey(),
  title: text("title"),
  description: text("description"),
  columnId: text("column_id").notNull(),
  projectId: text("project_id"),
  sessionId: text("session_id"),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
  archivedAt: integer("archived_at", { mode: "timestamp" }),
});

export const cardLogs = sqliteTable("card_logs", {
  id: text("id").primaryKey(),
  cardId: text("card_id").notNull(),
  type: text("type").notNull(),
  content: text("content").notNull(),
  sequence: integer("sequence").notNull(),
  createdAt: integer("created_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});

export const autoModeSettings = sqliteTable("auto_mode_settings", {
  projectId: text("project_id").primaryKey(),
  enabled: integer("enabled", { mode: "boolean" }).notNull().default(false),
  maxConcurrency: integer("max_concurrency").notNull().default(1),
  updatedAt: integer("updated_at", { mode: "timestamp" })
    .notNull()
    .$defaultFn(() => new Date()),
});
