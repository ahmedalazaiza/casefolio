ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "lifetime_projects_created" integer NOT NULL DEFAULT 0;

UPDATE "workspaces" AS w
SET "lifetime_projects_created" = GREATEST(
  w."lifetime_projects_created",
  COALESCE((SELECT count(*)::int FROM "projects" AS p WHERE p."workspace_id" = w."id"), 0)
);

UPDATE "subscriptions"
SET "max_case_studies" = 10
WHERE "plan" = 'pro' AND "max_case_studies" < 0;

UPDATE "workspaces" AS w
SET "max_case_studies" = 10
FROM "subscriptions" AS s
WHERE w."kind" = 'personal'
  AND s."user_id" = w."personal_owner_id"
  AND s."org_id" IS NULL
  AND s."plan" = 'pro'
  AND s."status" IN ('active', 'trialing', 'past_due', 'cancel_at_period_end')
  AND w."max_case_studies" < 0;
