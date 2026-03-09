ALTER TABLE "kids" ADD COLUMN "status" varchar(20) DEFAULT 'active' NOT NULL;--> statement-breakpoint
CREATE INDEX "class_log_attendance_kid_idx" ON "class_log_attendance" USING btree ("kid_id");