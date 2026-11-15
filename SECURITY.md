# Casefolio Security Review & Hardening Checklist (`C-1101`)

This document records the security audit and controls enforced across `@casefolio/web`, `@casefolio/worker`, and `@casefolio/db` per `02-RULES.md §5`.

## `02-RULES.md §5` Checklist

- [x] **1. Server-side authorization on every query & mutation (owner, org role, admin role); never trust client plan flags**
  - Every `(app)` page, Server Action (`onboarding-actions.ts`, `projects/actions.ts`, `account/actions.ts`), and user API route resolves identity exclusively via `getServerSession()` (`apps/web/src/lib/auth/session.ts`).
  - Every `(admin)` page, Server Action (`template/admin-actions.ts`), and `/api/admin/*` route enforces `requireAdmin` / `hasAdminRole` (`apps/web/src/lib/auth/guards.ts`), returning HTTP `403` for non-admin sessions.
  - Effective subscription tier is resolved server-side via `resolveEffectivePlanForUser(userId)` (`apps/web/src/lib/entitlements/server.ts`) — client payloads never supply or override plan flags.
  - All `"use server"` files export only session-guarded actions; internal helpers live in non-`"use server"` service modules (`onboarding-service.ts`, `projects/service.ts`, `projects/dashboard.ts`, `template/service.ts`).

- [x] **2. Entitlements enforced via single `can(user, feature)` helper**
  - Single source of truth in `apps/web/src/lib/entitlements/index.ts` (`can(planOrContext, feature)`), governing project quotas, Pro templates, PNG/PDF/Behance exports, watermark removal, custom slugs, analytics breakdowns, and Team seats/invitations.

- [x] **3. Paddle webhooks: verify HMAC signature & idempotent by `event_id`**
  - `POST /api/paddle/webhook` (`apps/web/src/app/api/paddle/webhook/route.ts`) verifies `Paddle-Signature` (`ts=...;h1=...`) using constant-time `timingSafeEqual` HMAC-SHA256 and a 300-second replay tolerance (`apps/web/src/lib/billing/signature.ts`).
  - Processed webhook `event_id`s are recorded atomically in `subscription_events` so duplicate deliveries short-circuit with `deduplicated: true` (`apps/web/src/lib/billing/webhooks.ts`).

- [x] **4. Uploads: presigned URLs, MIME + size checks, per-plan quotas, strip EXIF**
  - `POST /api/uploads/presign` & `POST /api/uploads/complete` validate inputs with Zod, allow only `image/png`, `image/jpeg`, and `image/webp`, enforce per-plan file size (`10 MB` Free / `15 MB` Pro / `25 MB` Team), total storage (`200 MB` / `2 GB` / `10 GB`), and per-project asset count quotas (`apps/web/src/lib/storage/quotas.ts`, `apps/web/src/lib/storage/service.ts`).
  - Binary magic-byte inspection (`detectImageMimeFromMagicBytes`) rejects disguised SVG/HTML/polyglot payloads, and `stripImageExifAndMetadata` (`apps/web/src/lib/storage/exif.ts`) strips JPEG `APP1`/`APP13`/`COM` EXIF GPS & camera metadata and PNG `eXIf`/`tEXt`/`zTXt`/`iTXt` chunks on upload.
  - Private project assets return HTTP `403` with `Cache-Control: private, no-store` unless accessed by the project owner, org member, admin, or valid short-lived export render token.

- [x] **5. Export render route requires short-lived signed token**
  - `/export/[jobId]` (`apps/web/src/app/export/[jobId]/page.tsx`) verifies a 5-minute HMAC-SHA256 token (`signExportRenderToken` / `verifyExportRenderToken` in `apps/worker/src/token.ts`) bound to both `exportId` and `projectId`, rejecting missing, expired, or cross-job tokens with HTTP `403`.

- [x] **6. Rate-limit auth, uploads, exports, tracking; set CSP and secure headers**
  - Sliding-window rate limiters guard:
    - Auth mutations: `POST /api/auth/*` (`apps/web/src/lib/security/auth-rate-limit.ts`)
    - Uploads: `POST /api/uploads/presign` & `POST /api/uploads/complete` (`apps/web/src/lib/storage/rate-limit.ts`)
    - Exports: `POST /api/exports` (`apps/web/src/lib/exports/service.ts`)
    - Page-view tracking: `POST /api/track` (`apps/web/src/lib/analytics/page-views.ts` — SHA-256 salted daily visitor hash, zero raw IP storage)
    - Public abuse & support endpoints: `POST /api/reports`, `POST /api/help/contact`, `POST /api/paddle/webhook`
  - Global security headers & `Content-Security-Policy` configured in `apps/web/next.config.ts` via `buildSecurityHeaders` (`apps/web/src/lib/security/headers.ts`), including `frame-ancestors 'none'`, `object-src 'none'`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security` (prod), and `poweredByHeader: false`.

- [x] **7. Never commit secrets; never log tokens or PII**
  - `.env*` (except `.env.example` placeholder template) is excluded via `.gitignore`; startup validates env schema via `@t3-oss/env-nextjs` (`apps/web/src/env.ts`).
  - `redactSensitiveText` & `sanitizeErrorForLogging` (`apps/web/src/lib/security/redact.ts`) scrub Bearer tokens, signed query tokens (`?token=`, `?exportToken=`), API keys, and email addresses before logging or telemetry capture.
  - Analytics payloads pass through `sanitizeAnalyticsProps` (`apps/web/src/lib/analytics/posthog.ts`) stripping PII keys (`email`, `password`, `token`, `secret`, `ip`, etc.).


## Edge protection, CSP trade-off & cross-origin headers (`S1b`, `S6`, `S7`)

- **CSRF / origin guard** (`apps/web/src/proxy.ts`, pure logic in `src/lib/security/edge-guard.ts`): non-`GET/HEAD/OPTIONS` requests to `/api/**` must carry an `Origin` (or `Sec-Fetch-Site: same-origin`) matching the app origin or a trusted origin. Exempt (own authentication): `/api/paddle/webhook` (HMAC signature), `/api/auth/**` (Better Auth), `/api/cron/**` (bearer secret), `/api/uploads/local-put` (signed token).
- **Default-deny without a session cookie**: `/admin/**`, `/api/admin/**` and the authenticated app areas redirect (pages) or return `401` (APIs) when no session cookie exists at all. This is a cheap presence check only; real session/role validation stays in the handlers.
- **Shared rate limits**: auth flood guard, uploads, exports and the Paddle invalid-signature counter use the DB-backed `consumeSharedRateLimit`, so limits hold across serverless instances.
- **CSP trade-off**: `script-src` keeps `'unsafe-inline'`. A nonce-based CSP forces every page to render dynamically (the nonce must change per request) which would defeat ISR/static caching of marketing, `/templates` and public case studies (`/p/[slug]`). Mitigations: `'unsafe-eval'` is only present in development, `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'`, a strict script host allow-list, React's output escaping, and no user-supplied HTML rendered unsanitised. Revisit if hash-based CSP (SRI) becomes practical for Next inline bootstrap scripts.
- **Cross-origin headers**: `Cross-Origin-Opener-Policy: same-origin`; `Permissions-Policy` denies camera, microphone, geolocation and (self only, for Paddle checkout) payment.
- **Billing environment gate**: simulated billing needs `ALLOW_SIMULATED_BILLING=1` and is refused on `VERCEL_ENV=production`/`PADDLE_ENV=production`; production deployments fail to boot with sandbox/placeholder billing configuration (`assertProductionBillingEnvironment`).
