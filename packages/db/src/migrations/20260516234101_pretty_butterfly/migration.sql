CREATE TABLE "device_codes" (
	"approved_at" timestamp with time zone,
	"code" text NOT NULL UNIQUE,
	"consumed_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"user_id" uuid
);
--> statement-breakpoint
ALTER TABLE "device_codes" ADD CONSTRAINT "device_codes_user_id_users_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id");