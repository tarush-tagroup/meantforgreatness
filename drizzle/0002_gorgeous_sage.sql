CREATE TABLE IF NOT EXISTS "app_logs" (
	"id" serial PRIMARY KEY NOT NULL,
	"level" varchar(10) NOT NULL,
	"source" varchar(100) NOT NULL,
	"message" text NOT NULL,
	"meta" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_logs_created_idx" ON "app_logs" USING btree ("created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "app_logs_level_created_idx" ON "app_logs" USING btree ("level","created_at");
