CREATE TABLE "anthropic_usage" (
	"id" serial PRIMARY KEY NOT NULL,
	"use_case" varchar(50) NOT NULL,
	"model" varchar(100) NOT NULL,
	"input_tokens" integer DEFAULT 0 NOT NULL,
	"output_tokens" integer DEFAULT 0 NOT NULL,
	"cost_cents" integer DEFAULT 0 NOT NULL,
	"class_log_id" uuid,
	"metadata" jsonb,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "anthropic_usage_use_case_idx" ON "anthropic_usage" USING btree ("use_case");--> statement-breakpoint
CREATE INDEX "anthropic_usage_created_at_idx" ON "anthropic_usage" USING btree ("created_at");