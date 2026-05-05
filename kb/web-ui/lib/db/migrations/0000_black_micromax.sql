CREATE TABLE "marketplace_install_stats" (
	"marketplace_id" uuid PRIMARY KEY NOT NULL,
	"installs_total" integer DEFAULT 0 NOT NULL,
	"installs_week" integer DEFAULT 0 NOT NULL,
	"installs_month" integer DEFAULT 0 NOT NULL,
	"last_installed_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "marketplace_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"marketplace_id" uuid NOT NULL,
	"plugin_count" integer DEFAULT 0 NOT NULL,
	"skill_count" integer DEFAULT 0 NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "marketplaces" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"url" varchar(512),
	"repository" varchar(512) NOT NULL,
	"install_command" varchar(512),
	"plugin_count" integer DEFAULT 0 NOT NULL,
	"skill_count" integer DEFAULT 0 NOT NULL,
	"description" text,
	"categories" text[],
	"badges" text[],
	"maintainer_name" varchar(255),
	"maintainer_github" varchar(255),
	"stars" integer DEFAULT 0 NOT NULL,
	"installs" integer DEFAULT 0 NOT NULL,
	"verified" boolean DEFAULT false NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "marketplaces_namespace_unique" UNIQUE("namespace")
);
--> statement-breakpoint
CREATE TABLE "mcp_server_stats" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"mcp_server_id" uuid NOT NULL,
	"github_stars" integer DEFAULT 0,
	"docker_pulls" integer DEFAULT 0,
	"npm_downloads" integer DEFAULT 0,
	"recorded_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "mcp_servers" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"display_name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"description" text,
	"version" varchar(64),
	"category" varchar(128) NOT NULL,
	"tags" text[],
	"server_type" varchar(32),
	"vendor" varchar(255),
	"logo_url" varchar(512),
	"source_registry" varchar(64) NOT NULL,
	"source_url" varchar(512),
	"github_url" varchar(512),
	"docker_url" varchar(512),
	"npm_url" varchar(512),
	"documentation_url" varchar(512),
	"github_stars" integer DEFAULT 0,
	"docker_pulls" integer DEFAULT 0,
	"npm_downloads" integer DEFAULT 0,
	"packages" text,
	"remotes" text,
	"environment_variables" text,
	"installation_methods" text,
	"verification_status" varchar(32) DEFAULT 'community',
	"active" boolean DEFAULT true NOT NULL,
	"last_stats_sync" timestamp with time zone,
	"last_indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "mcp_servers_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "plugins" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"namespace" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"marketplace_id" uuid,
	"marketplace_name" varchar(255),
	"repository" varchar(512),
	"description" text,
	"version" varchar(64),
	"author" varchar(255),
	"type" varchar(64) NOT NULL,
	"categories" text[],
	"keywords" text[],
	"install_command" varchar(512),
	"stars" integer DEFAULT 0 NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"last_indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "plugins_namespace_unique" UNIQUE("namespace")
);
--> statement-breakpoint
CREATE TABLE "skills" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(255) NOT NULL,
	"slug" varchar(255) NOT NULL,
	"marketplace_id" uuid,
	"marketplace_name" varchar(255),
	"plugin_id" uuid,
	"repository" varchar(512),
	"description" text,
	"category" varchar(128),
	"allowed_tools" text[],
	"model" varchar(64),
	"active" boolean DEFAULT true NOT NULL,
	"last_indexed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "marketplace_install_stats" ADD CONSTRAINT "marketplace_install_stats_marketplace_id_marketplaces_id_fk" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "marketplace_stats" ADD CONSTRAINT "marketplace_stats_marketplace_id_marketplaces_id_fk" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "mcp_server_stats" ADD CONSTRAINT "mcp_server_stats_mcp_server_id_mcp_servers_id_fk" FOREIGN KEY ("mcp_server_id") REFERENCES "public"."mcp_servers"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "plugins" ADD CONSTRAINT "plugins_marketplace_id_marketplaces_id_fk" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_marketplace_id_marketplaces_id_fk" FOREIGN KEY ("marketplace_id") REFERENCES "public"."marketplaces"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "skills" ADD CONSTRAINT "skills_plugin_id_plugins_id_fk" FOREIGN KEY ("plugin_id") REFERENCES "public"."plugins"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "idx_marketplace_install_stats_total" ON "marketplace_install_stats" USING btree ("installs_total");--> statement-breakpoint
CREATE INDEX "idx_marketplace_stats_marketplace" ON "marketplace_stats" USING btree ("marketplace_id");--> statement-breakpoint
CREATE INDEX "idx_marketplace_stats_recorded_at" ON "marketplace_stats" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_marketplaces_name" ON "marketplaces" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_marketplaces_namespace" ON "marketplaces" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX "idx_marketplaces_stars" ON "marketplaces" USING btree ("stars");--> statement-breakpoint
CREATE INDEX "idx_marketplaces_installs" ON "marketplaces" USING btree ("installs");--> statement-breakpoint
CREATE INDEX "idx_marketplaces_active" ON "marketplaces" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_mcp_server_stats_server" ON "mcp_server_stats" USING btree ("mcp_server_id");--> statement-breakpoint
CREATE INDEX "idx_mcp_server_stats_recorded_at" ON "mcp_server_stats" USING btree ("recorded_at");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_name" ON "mcp_servers" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_slug" ON "mcp_servers" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_category" ON "mcp_servers" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_source_registry" ON "mcp_servers" USING btree ("source_registry");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_github_stars" ON "mcp_servers" USING btree ("github_stars");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_docker_pulls" ON "mcp_servers" USING btree ("docker_pulls");--> statement-breakpoint
CREATE INDEX "idx_mcp_servers_active" ON "mcp_servers" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_plugins_name" ON "plugins" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_plugins_namespace" ON "plugins" USING btree ("namespace");--> statement-breakpoint
CREATE INDEX "idx_plugins_marketplace" ON "plugins" USING btree ("marketplace_id");--> statement-breakpoint
CREATE INDEX "idx_plugins_type" ON "plugins" USING btree ("type");--> statement-breakpoint
CREATE INDEX "idx_plugins_stars" ON "plugins" USING btree ("stars");--> statement-breakpoint
CREATE INDEX "idx_plugins_active" ON "plugins" USING btree ("active");--> statement-breakpoint
CREATE INDEX "idx_skills_name" ON "skills" USING btree ("name");--> statement-breakpoint
CREATE INDEX "idx_skills_slug" ON "skills" USING btree ("slug");--> statement-breakpoint
CREATE INDEX "idx_skills_marketplace" ON "skills" USING btree ("marketplace_id");--> statement-breakpoint
CREATE INDEX "idx_skills_plugin" ON "skills" USING btree ("plugin_id");--> statement-breakpoint
CREATE INDEX "idx_skills_category" ON "skills" USING btree ("category");--> statement-breakpoint
CREATE INDEX "idx_skills_active" ON "skills" USING btree ("active");