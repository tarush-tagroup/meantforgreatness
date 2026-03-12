ALTER TABLE "class_logs" ADD COLUMN "class_duration" double precision DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_line_items" ADD COLUMN "total_hours" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "total_hours" double precision DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "kids" ADD COLUMN "date_registered" date;--> statement-breakpoint
UPDATE "invoice_line_items" SET "total_hours" = "class_count";--> statement-breakpoint
UPDATE "invoices" SET "total_hours" = "total_classes";--> statement-breakpoint
UPDATE "kids" SET "date_registered" = "created_at"::date;