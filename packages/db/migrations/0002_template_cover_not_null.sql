UPDATE "templates"
SET "cover_url" = '/templates/orbit/cover.svg'
WHERE "slug" = 'orbit'
  AND (
    "cover_url" IS NULL
    OR btrim("cover_url") = ''
    OR "cover_url" = '/landing/orbit-home.svg'
    OR "cover_url" LIKE 'https://cdn.casefolio.app/%'
  );
--> statement-breakpoint
UPDATE "templates"
SET "cover_url" = '/templates/meridian-pro/cover.svg'
WHERE "slug" = 'meridian-pro'
  AND (
    "cover_url" IS NULL
    OR btrim("cover_url") = ''
    OR "cover_url" = '/landing/meridian-dashboard.svg'
    OR "cover_url" LIKE 'https://cdn.casefolio.app/%'
  );
--> statement-breakpoint
UPDATE "templates"
SET "cover_url" = '/templates/cinema/cover.svg'
WHERE "slug" = 'cinema'
  AND (
    "cover_url" IS NULL
    OR btrim("cover_url") = ''
    OR "cover_url" LIKE 'https://cdn.casefolio.app/%'
  );
--> statement-breakpoint
UPDATE "templates"
SET "cover_url" = '/templates/atlas/cover.svg'
WHERE "slug" = 'atlas'
  AND (
    "cover_url" IS NULL
    OR btrim("cover_url") = ''
    OR "cover_url" = '/landing/orbit-plan.svg'
    OR "cover_url" LIKE 'https://cdn.casefolio.app/%'
  );
--> statement-breakpoint
UPDATE "templates"
SET "cover_url" = '/templates/cinema/cover.svg'
WHERE "cover_url" IS NULL OR btrim("cover_url") = '';
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "cover_url" SET DEFAULT '/templates/cinema/cover.svg';
--> statement-breakpoint
ALTER TABLE "templates" ALTER COLUMN "cover_url" SET NOT NULL;

