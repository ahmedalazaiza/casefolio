ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_requested_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "users" ADD COLUMN IF NOT EXISTS "deletion_scheduled_for" timestamp with time zone;--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "app_rate_limits" (
	"key" text PRIMARY KEY NOT NULL,
	"count" integer NOT NULL,
	"window_start" bigint NOT NULL
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "support_tickets" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"code" text NOT NULL,
	"user_id" uuid,
	"email" text NOT NULL,
	"topic" text NOT NULL,
	"subject" text NOT NULL,
	"message" text NOT NULL,
	"project_ref" text,
	"status" text DEFAULT 'open' NOT NULL,
	"intake_email_delivered_at" timestamp with time zone,
	"delivery_attempts" integer DEFAULT 0 NOT NULL,
	"last_delivery_error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "support_tickets_code_unique" UNIQUE("code")
);--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "platform_settings" (
	"key" text PRIMARY KEY NOT NULL,
	"value" jsonb NOT NULL,
	"updated_by" uuid,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "support_tickets" ADD CONSTRAINT "support_tickets_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
DO $$ BEGIN
 ALTER TABLE "platform_settings" ADD CONSTRAINT "platform_settings_updated_by_users_id_fk" FOREIGN KEY ("updated_by") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_status_created_idx" ON "support_tickets" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "support_tickets_email_idx" ON "support_tickets" USING btree ("email");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_workspace_updated_idx" ON "projects" USING btree ("workspace_id","updated_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "exports_status_created_idx" ON "exports" USING btree ("status","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "page_views_at_idx" ON "page_views" USING btree ("at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "notifications_user_created_idx" ON "notifications" USING btree ("user_id","created_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "audit_logs_action_at_idx" ON "audit_logs" USING btree ("action","at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "webhook_events_processed_at_idx" ON "webhook_events" USING btree ("processed_at");--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "users_deletion_scheduled_idx" ON "users" USING btree ("deletion_scheduled_for") WHERE "deletion_scheduled_for" IS NOT NULL;
