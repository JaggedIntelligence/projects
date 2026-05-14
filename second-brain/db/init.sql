CREATE TYPE "task_priority" AS ENUM ('low', 'medium', 'high');
CREATE TYPE "task_status" AS ENUM ('todo', 'in_progress', 'done');

CREATE TABLE "tasks" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "title" text NOT NULL,
  "description" text,
  "priority" "task_priority" DEFAULT 'medium' NOT NULL,
  "status" "task_status" DEFAULT 'todo' NOT NULL,
  "due_date" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX "tasks_user_id_idx" ON "tasks" ("user_id");
CREATE INDEX "tasks_user_status_idx" ON "tasks" ("user_id", "status");
CREATE INDEX "tasks_user_priority_idx" ON "tasks" ("user_id", "priority");
