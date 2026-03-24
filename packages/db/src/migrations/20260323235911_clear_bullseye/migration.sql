CREATE TABLE "babies" (
	"birth_date" date NOT NULL,
	"birth_weight_g" integer,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"household_id" uuid NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"baby_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"ended_at" timestamp with time zone,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"logged_by_id" uuid NOT NULL,
	"metadata" jsonb DEFAULT '{}' NOT NULL,
	"started_at" timestamp with time zone DEFAULT now() NOT NULL,
	"type" text NOT NULL
);
--> statement-breakpoint
CREATE TABLE "households" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"invite_code" text NOT NULL UNIQUE
);
--> statement-breakpoint
CREATE TABLE "magic_links" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"token" text NOT NULL UNIQUE,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "users" (
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"email" text NOT NULL UNIQUE,
	"household_id" uuid,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"name" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "babies" ADD CONSTRAINT "babies_household_id_households_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_baby_id_babies_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id");--> statement-breakpoint
ALTER TABLE "events" ADD CONSTRAINT "events_logged_by_id_users_id_fkey" FOREIGN KEY ("logged_by_id") REFERENCES "users"("id");--> statement-breakpoint
ALTER TABLE "users" ADD CONSTRAINT "users_household_id_households_id_fkey" FOREIGN KEY ("household_id") REFERENCES "households"("id");