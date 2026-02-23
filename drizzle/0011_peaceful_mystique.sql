CREATE TABLE "invoice_misc_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"invoice_id" uuid NOT NULL,
	"description" varchar(500) NOT NULL,
	"quantity" integer DEFAULT 1 NOT NULL,
	"rate_idr" integer DEFAULT 0 NOT NULL,
	"subtotal_idr" integer DEFAULT 0 NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "from_entity" SET DEFAULT 'TransforMe Academy';--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "to_entity" SET DEFAULT 'White Light Ventures, Inc';--> statement-breakpoint
ALTER TABLE "invoices" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "invoices" ADD COLUMN "misc_total_idr" integer DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_misc_items" ADD CONSTRAINT "invoice_misc_items_invoice_id_invoices_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoices"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "misc_items_invoice_idx" ON "invoice_misc_items" USING btree ("invoice_id");--> statement-breakpoint
CREATE INDEX "invoices_status_idx" ON "invoices" USING btree ("status");