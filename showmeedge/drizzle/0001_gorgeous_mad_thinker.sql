CREATE TABLE "saved_sql_queries" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"sql" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "saved_sql_queries_user_id_idx" ON "saved_sql_queries" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "saved_sql_queries_user_name_unique_idx" ON "saved_sql_queries" USING btree ("user_id","name");