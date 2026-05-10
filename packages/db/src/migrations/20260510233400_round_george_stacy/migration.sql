CREATE TABLE "agent_threads" (
	"activity_key" text NOT NULL,
	"baby_id" uuid NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"state" jsonb DEFAULT '{}' NOT NULL,
	"tambo_last_run_id" text,
	"tambo_thread_id" text,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "agent_threads_baby_activity_idx" ON "agent_threads" ("baby_id","activity_key");--> statement-breakpoint
ALTER TABLE "agent_threads" ADD CONSTRAINT "agent_threads_baby_id_babies_id_fkey" FOREIGN KEY ("baby_id") REFERENCES "babies"("id");