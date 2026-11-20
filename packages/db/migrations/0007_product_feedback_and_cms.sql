CREATE TABLE IF NOT EXISTS "product_feedback" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
  "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
  "status" text DEFAULT 'submitted' NOT NULL,
  "rating" integer,
  "trigger_moment" text DEFAULT 'manual' NOT NULL,
  "primary_use_case" text,
  "top_feature_request" text,
  "sentiment_tags" jsonb DEFAULT '[]'::jsonb NOT NULL,
  "comment" text,
  "plan_tier" text DEFAULT 'free' NOT NULL,
  "snooze_until" timestamp with time zone,
  "created_at" timestamp with time zone DEFAULT now() NOT NULL,
  "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_feedback_user_status_idx" ON "product_feedback" ("user_id", "status");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_feedback_created_at_idx" ON "product_feedback" ("created_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "product_feedback_rating_idx" ON "product_feedback" ("rating");
