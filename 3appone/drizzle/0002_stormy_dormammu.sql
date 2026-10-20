CREATE TABLE "images" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"file_name" text NOT NULL,
	"original_name" text NOT NULL,
	"description" text,
	"r2_key" text NOT NULL,
	"content_type" text NOT NULL,
	"size" integer NOT NULL,
	"width" integer,
	"height" integer,
	"status" text DEFAULT 'ready' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "images_r2_key_unique" ON "images" USING btree ("r2_key");--> statement-breakpoint
CREATE INDEX "images_user_created_idx" ON "images" USING btree ("user_id","created_at","id");