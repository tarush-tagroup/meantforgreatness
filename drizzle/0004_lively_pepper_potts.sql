CREATE TABLE "cron_runs" (
	"id" serial PRIMARY KEY NOT NULL,
	"job_name" varchar(100) NOT NULL,
	"status" varchar(20) DEFAULT 'running' NOT NULL,
	"message" text,
	"items_processed" integer DEFAULT 0,
	"started_at" timestamp DEFAULT now() NOT NULL,
	"finished_at" timestamp
);
--> statement-breakpoint
CREATE INDEX "cron_runs_job_name_idx" ON "cron_runs" USING btree ("job_name");--> statement-breakpoint
CREATE INDEX "cron_runs_started_at_idx" ON "cron_runs" USING btree ("started_at");