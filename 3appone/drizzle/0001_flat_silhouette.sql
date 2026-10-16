CREATE TABLE "knowledgebase" (
	"id" serial PRIMARY KEY NOT NULL,
	"catlevel1" text NOT NULL,
	"catlevel2" text,
	"url1" text NOT NULL,
	"url2" text,
	"note1" text,
	"note2" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
