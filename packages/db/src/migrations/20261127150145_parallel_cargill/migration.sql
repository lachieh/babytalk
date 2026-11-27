ALTER TABLE "device_codes" ADD COLUMN "redirect_confirmed_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "device_codes" ADD COLUMN "redirect_web_url" text;