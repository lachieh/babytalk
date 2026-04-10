CREATE TABLE "measurements" (
	"baby_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"head_mm" integer,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"length_mm" integer,
	"logged_by_id" uuid NOT NULL,
	"measured_at" timestamp with time zone DEFAULT now() NOT NULL,
	"notes" text,
	"weight_g" integer
);
--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_baby_id_babies_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id");--> statement-breakpoint
ALTER TABLE "measurements" ADD CONSTRAINT "measurements_logged_by_id_users_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "users"("id");