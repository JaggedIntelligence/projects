DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_priority') THEN
    CREATE TYPE "task_priority" AS ENUM ('low', 'medium', 'high');
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'task_status') THEN
    CREATE TYPE "task_status" AS ENUM ('todo', 'in_progress', 'done');
  END IF;
END
$$;

CREATE TABLE IF NOT EXISTS "tasks" (
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

CREATE INDEX IF NOT EXISTS "tasks_user_id_idx" ON "tasks" ("user_id");
CREATE INDEX IF NOT EXISTS "tasks_user_status_idx" ON "tasks" ("user_id", "status");
CREATE INDEX IF NOT EXISTS "tasks_user_priority_idx" ON "tasks" ("user_id", "priority");

CREATE TABLE IF NOT EXISTS "saved_sql_queries" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "name" text NOT NULL,
  "sql" text NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS "saved_sql_queries_user_id_idx" ON "saved_sql_queries" ("user_id");
CREATE UNIQUE INDEX IF NOT EXISTS "saved_sql_queries_user_name_unique_idx" ON "saved_sql_queries" ("user_id", "name");

CREATE TABLE IF NOT EXISTS "chart_rectangle_areas" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" text NOT NULL,
  "ticker" text NOT NULL,
  "timeframe" text DEFAULT '1d' NOT NULL,
  "start_time" timestamp with time zone NOT NULL,
  "end_time" timestamp with time zone NOT NULL,
  "top_price" numeric(24, 8) NOT NULL,
  "bottom_price" numeric(24, 8) NOT NULL,
  "color_key" text DEFAULT 'sky' NOT NULL,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
  CONSTRAINT "chart_rectangle_areas_valid_time_range" CHECK ("end_time" >= "start_time"),
  CONSTRAINT "chart_rectangle_areas_valid_price_range" CHECK ("top_price" > "bottom_price"),
  CONSTRAINT "chart_rectangle_areas_positive_prices" CHECK ("top_price" > 0 AND "bottom_price" > 0),
  CONSTRAINT "chart_rectangle_areas_valid_color_key" CHECK ("color_key" IN ('sky', 'amber', 'emerald', 'rose', 'violet', 'orange'))
);

CREATE INDEX IF NOT EXISTS "chart_rectangle_areas_user_ticker_timeframe_idx"
  ON "chart_rectangle_areas" ("user_id", "ticker", "timeframe");
