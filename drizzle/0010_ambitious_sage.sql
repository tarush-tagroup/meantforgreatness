ALTER TABLE "class_logs" ADD COLUMN "ai_time_match" varchar(20);--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "ai_time_notes" text;--> statement-breakpoint
ALTER TABLE "kids" ADD COLUMN "class_group_id" uuid;--> statement-breakpoint
ALTER TABLE "kids" ADD CONSTRAINT "kids_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;