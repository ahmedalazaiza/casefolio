-- Additive, idempotent performance indexes (expand-only; safe to re-run).
CREATE INDEX IF NOT EXISTS "projects_space_updated_idx" ON "projects" ("space_id", "updated_at");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "projects_template_version_idx" ON "projects" ("template_version_id");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "memberships_org_idx" ON "memberships" ("org_id");
