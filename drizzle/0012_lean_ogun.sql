CREATE TABLE "class_log_attendance" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"class_log_id" uuid NOT NULL,
	"kid_id" varchar(50),
	"kid_name" varchar(255) NOT NULL,
	"attendance_type" varchar(20) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "class_logs" ADD COLUMN "class_group_id" uuid;--> statement-breakpoint
ALTER TABLE "class_log_attendance" ADD CONSTRAINT "class_log_attendance_class_log_id_class_logs_id_fk" FOREIGN KEY ("class_log_id") REFERENCES "public"."class_logs"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "class_log_attendance" ADD CONSTRAINT "class_log_attendance_kid_id_kids_id_fk" FOREIGN KEY ("kid_id") REFERENCES "public"."kids"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "class_log_attendance_log_idx" ON "class_log_attendance" USING btree ("class_log_id");--> statement-breakpoint
ALTER TABLE "class_logs" ADD CONSTRAINT "class_logs_class_group_id_class_groups_id_fk" FOREIGN KEY ("class_group_id") REFERENCES "public"."class_groups"("id") ON DELETE set null ON UPDATE no action;
