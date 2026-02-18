CREATE TABLE "kids" (
	"id" varchar(50) PRIMARY KEY NOT NULL,
	"name" varchar(255) NOT NULL,
	"age" integer NOT NULL,
	"hobby" varchar(500),
	"location" varchar(500),
	"about" text,
	"favorite_word" text,
	"image_url" text,
	"orphanage_id" varchar(50),
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "kids" ADD CONSTRAINT "kids_orphanage_id_orphanages_id_fk" FOREIGN KEY ("orphanage_id") REFERENCES "public"."orphanages"("id") ON DELETE set null ON UPDATE no action;