ALTER TABLE "users" ADD COLUMN "plan" text DEFAULT 'none' NOT NULL;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN "plan_updated_at" timestamp with time zone;