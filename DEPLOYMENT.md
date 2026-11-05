# Casefolio — Production Deployment, Monitoring & Rollback Runbook (`C-1104`)

This runbook documents the production topology, environment configuration, health checks, automated backups, error monitoring, and emergency rollback procedures for **Casefolio**.

> **Billing Safety Gate:** By default, all repository configurations (`.env.example`, `.github/workflows/ci.yml`, `apps/worker/fly.toml`) keep `PADDLE_ENV="sandbox"`. **Do NOT switch `PADDLE_ENV` to `"production"`** until explicit owner approval is given after live domain verification, Paddle Merchant of Record KYC sign-off, and webhook endpoint registration.

---

## 1. Production Topology

| Service                                 | Target Platform                               | Source Path                                                                | Health Check                                    |
| --------------------------------------- | --------------------------------------------- | -------------------------------------------------------------------------- | ----------------------------------------------- |
| **Web App & API** (`@casefolio/web`)    | Vercel (Next.js 16 App Router)                | `apps/web` (`vercel.json`)                                                 | `GET /api/health` (`200 OK`)                    |
| **Export Worker** (`@casefolio/worker`) | Fly.io or Railway (Docker + Chromium)         | `apps/worker/Dockerfile`, `apps/worker/fly.toml`                           | `GET /health` (`200 OK`)                        |
| **Primary Database** (`@casefolio/db`)  | Neon Serverless PostgreSQL 16 (`main` branch) | `packages/db/drizzle`                                                      | Probed by `GET /api/health` (`SELECT 1`)        |
| **Asset & Export Storage**              | Cloudflare R2 + Cloudflare Images CDN         | `apps/web/src/lib/storage`, `apps/worker/src/storage.ts`                   | Presigned PUT + `/cdn/images/[assetId]`         |
| **Error Monitoring**                    | Sentry (`onRequestError` + Envelope API)      | `apps/web/src/instrumentation.ts`, `apps/web/src/lib/monitoring/sentry.ts` | `environment.sentryConfigured` in `/api/health` |
| **Product Analytics**                   | PostHog (zero-PII allowlist)                  | `apps/web/src/lib/analytics/posthog.ts`                                    | Strict property allowlist                       |

---

## 2. Step-by-Step Production Deployment

### 2.1 Neon PostgreSQL (`main` Production Branch)

1. Create the Neon project (`Postgres 16`) in the same region as Vercel & Fly.io (`us-east-1` / `iad`).
2. Enable **Protected Branch** on `main` and configure **Point-in-Time Restore (PITR)** retention to **14 days** (or 30 days on Scale).
3. Run schema migrations and seed default templates against the pooled/direct Neon connection string:
   ```bash
   DATABASE_URL="postgresql://<user>:<pass>@<ep-prod>.us-east-2.aws.neon.tech/casefolio?sslmode=require" \
     pnpm db:migrate && pnpm db:seed
   ```
4. For pull-request preview environments, create ephemeral Neon branches (`neonctl branches create --parent main`) so previews never mutate production data.

### 2.2 Export Worker (`@casefolio/worker` on Fly.io or Railway)

1. Provision the worker app (`apps/worker/fly.toml`) from the monorepo root:
   ```bash
   fly apps create casefolio-export-worker
   fly secrets set \
     DATABASE_URL="postgresql://..." \
     NEXT_PUBLIC_APP_URL="https://casefolio.app" \
     EXPORT_SIGNING_SECRET="<32+ random hex chars matching web>" \
     R2_ACCOUNT_ID="..." \
     R2_ACCESS_KEY_ID="..." \
     R2_SECRET_ACCESS_KEY="..." \
     R2_BUCKET="casefolio-prod" \
     --config apps/worker/fly.toml
   fly deploy --config apps/worker/fly.toml
   ```
   _(On **Railway**, point the service to root `/` with Dockerfile path `apps/worker/Dockerfile` and healthcheck path `/health` on port `4000`.)_
2. Verify worker readiness:
   ```bash
   curl -fsS https://casefolio-export-worker.fly.dev/health
   # {"ok":true,"service":"casefolio-export-worker","status":"ready","uptimeSeconds":...}
   ```

### 2.3 Web Application (`@casefolio/web` on Vercel)

1. Import the repository into Vercel using root `vercel.json` (`buildCommand`: `pnpm --filter @casefolio/web build`, `outputDirectory`: `apps/web/.next`).
2. Configure all required environment variables validated by `apps/web/src/env.ts` (keep `PADDLE_ENV="sandbox"` until owner sign-off).
3. Deploy to production and verify `GET /api/health` and HTTP security headers:
   ```bash
   curl -fsS https://casefolio.app/api/health
   curl -sI https://casefolio.app/ | grep -Ei "content-security-policy|strict-transport-security|x-frame-options"
   ```

### 2.4 Switching Paddle from `sandbox` to `production` (Requires Explicit Approval)

Only after explicit owner confirmation:

1. Create corresponding `Pro` (monthly/yearly) and `Team` (monthly/yearly) prices in Paddle Live dashboard.
2. Register `https://casefolio.app/api/paddle/webhook` in Paddle Live Notifications (`subscription.*`, `transaction.completed`, `transaction.payment_failed`) and copy the live `pdl_ntfset_...` secret.
3. Update `PADDLE_ENV="production"`, `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN="live_..."`, `PADDLE_API_KEY="pdl_live_apikey_..."`, `PADDLE_WEBHOOK_SECRET`, and `PADDLE_PRICE_*` in Vercel, then redeploy.

---

## 3. Monitoring, Health Checks & Backups

### 3.1 Health Check Endpoints

- **Web (`GET /api/health`):** Executes `SELECT 1` and counts published templates in PostgreSQL. Returns HTTP `200` (`{"ok":true,"status":"healthy",...}`) when healthy, or HTTP `503` (`{"ok":false,"status":"unhealthy",...}`) if database connectivity fails. Configure Better Stack / Checkly / UptimeRobot at `60s` intervals alerting on `status != 200` or `latencyMs > 1500`.
- **Worker (`GET /health`):** Returns HTTP `200` (`{"ok":true,"service":"casefolio-export-worker","status":"ready"}`) once the `pg-boss` export consumer is connected and listening. Fly.io restarts unhealthy machines automatically via `[[http_service.checks]]`.

### 3.2 Error Monitoring & PII Redaction (Sentry)

- Unhandled server errors in App Router RSCs, Route Handlers, and Server Actions flow through `apps/web/src/instrumentation.ts` (`onRequestError`) -> `captureServerException` (`apps/web/src/lib/monitoring/sentry.ts`).
- Client-side root render failures display the token-styled recovery boundary in `apps/web/src/app/global-error.tsx`.
- Every error message, stack trace, route path, and extra tag is scrubbed through `sanitizeErrorForLogging` / `redactSensitiveText` (`apps/web/src/lib/security/redact.ts`) before transmission so emails, JWTs, Bearer tokens, and Paddle/Resend API keys never leave the server.

### 3.3 Database & Storage Backups

1. **Continuous PITR (Primary):** Neon maintains continuous write-ahead log (WAL) history on `main`, allowing sub-second Point-in-Time Restore to any timestamp within the 14-day window.
2. **Nightly Logical Snapshots (Off-Provider):** Schedule a nightly `pg_dump --format=custom --no-owner` cron job writing encrypted `.dump` archives to a restricted Cloudflare R2 bucket (`casefolio-db-backups`) with a 30-day lifecycle rule:
   ```bash
   pg_dump "$DATABASE_URL" --format=custom --file="/tmp/casefolio-$(date -u +%Y%m%dT%H%MZ).dump"
   ```
3. **Asset Durability:** Cloudflare R2 stores user uploads and rendered exports with 11 nines durability; enable R2 Object Lifecycle cleanup for expired temporary export artifacts while retaining published project assets.

---

## 4. Rollback Runbook

### 4.1 Web App Instant Rollback (Vercel — Target RTO: `< 1 min`)

If a web deployment introduces regressions or elevated 5xx errors in Sentry:

1. List recent production deployments or open **Vercel Dashboard → Deployments**:
   ```bash
   npx vercel rollback --token="$VERCEL_TOKEN"
   ```
2. Promote the previous known-good deployment alias (`instant rollback` re-points edge routing without rebuilding).
3. Verify recovery immediately:
   ```bash
   curl -fsS https://casefolio.app/api/health
   ```

### 4.2 Export Worker Rollback (Fly.io / Railway — Target RTO: `< 2 min`)

If export jobs fail or Chromium rendering regresses:

1. Inspect release history and redeploy the previous container image digest:
   ```bash
   fly releases --image --config apps/worker/fly.toml
   fly deploy --image <previous-registry-image-ref> --config apps/worker/fly.toml
   ```
2. Verify `GET /health` returns `200` and check `exports` rows in `/admin` (`pg-boss` automatically retries any in-flight `queued`/`processing` jobs safely).

### 4.3 Database Rollback (Neon PITR Branch Swap — Target RTO: `< 5 min`)

All Drizzle migrations follow **expand-and-contract** (additive columns/tables first) so web/worker rollbacks remain compatible with the current schema. If a data-corrupting write or migration occurs:

1. Enable **Maintenance Mode** in `/admin/settings` (or pause writes) to prevent split-brain writes.
2. Create a clean Neon branch from `main` at the exact pre-incident timestamp:
   ```bash
   neonctl branches create \
     --project-id "$NEON_PROJECT_ID" \
     --parent main \
     --name "restore-$(date -u +%Y%m%d-%H%M)" \
     --timestamp "2026-11-06T00:00:00Z"
   ```
3. Verify row counts and `/api/health` against the restored branch connection URI, then update `DATABASE_URL` in Vercel and Fly.io (or promote the restored branch to primary in Neon) and disable Maintenance Mode.

### 4.4 Template & Content Incident Containment

- **Broken Template Version:** Template versions (`template_versions`) are immutable; existing projects remain pinned to their `template_version_id`. In `/admin/templates/[id]`, publish a patched `semver` version or set the template status to `Deprecated` to hide it from new projects without breaking published `/p/[slug]` pages.
- **Abusive Public Case Study:** Use `/admin/moderation` **Take down** action — immediately unpublishes the project (`404` on `/p/[slug]`), notifies the owner, and records an immutable `audit_logs` entry.
