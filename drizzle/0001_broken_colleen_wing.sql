ALTER TABLE "class_logs" ADD COLUMN "ai_kids_count" integer;--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "ai_location" text;--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "ai_photo_timestamp" varchar(100);--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "ai_orphanage_match" varchar(50);--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "ai_confidence_notes" text;--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "ai_primary_photo_url" text;--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "ai_analyzed_at" timestamp;