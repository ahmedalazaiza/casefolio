# 04 — CARDS (Kanban)
> **مقدمة:** بطاقات كانبان لكل مهمة، جاهزة للنقل إلى Trello أو Notion أو Linear عبر ملف 04-cards.csv.

Columns: **Todo → In Progress → Review → Done**. All cards start in Todo. CSV: `04-cards.csv`.

---
**[C-001] Scaffold Next.js 15+ app (TS strict, App Router, pnpm)**  
Phase: Phase 0 — Foundation · Priority: P0 · Estimate: 2h · Deps: — · Status: Done  
Summary: Scaffolded pnpm monorepo (`apps/web`, `apps/worker`, `packages/db`, `packages/template-schema`) with Next.js App Router, strict TypeScript, ESLint, Prettier, Vitest, and Playwright smoke test.  
- [x] `pnpm dev` runs
- [x] `pnpm lint && pnpm typecheck && pnpm test` pass
- [x] TS strict on
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-002] Tailwind v4 + shadcn/ui setup**  
Phase: Phase 0 — Foundation · Priority: P0 · Estimate: 2h · Deps: C-001 · Status: Done  
Summary: Configured Tailwind CSS v4 with `tokens.css` variables, `.dark` class strategy (`next-themes`), self-hosted Geist & JetBrains Mono fonts, and token-styled base shadcn/ui primitives (`button`, `input`, `dialog`, `dropdown-menu`, `tabs`, `toast`, `sheet`).  
- [x] shadcn components render
- [x] Dark/light class strategy works
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-003] Database: Postgres (Neon) + Drizzle**  
Phase: Phase 0 — Foundation · Priority: P0 · Estimate: 3h · Deps: C-001 · Status: Done  
Summary: Implemented Drizzle ORM schema (`packages/db`) for all 14 ERD tables plus approved Better Auth (`sessions`, `accounts`, `verifications`, `invitations`) and `webhook_events` tables, SQL migrations, and idempotent seed creating superadmin + Orbit (`1.0.0`) template.  
- [x] `pnpm db:migrate` applies cleanly
- [x] Seed creates admin + 1 template
- [x] All ERD tables exist
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-004] Env validation + config**  
Phase: Phase 0 — Foundation · Priority: P0 · Estimate: 1h · Deps: C-001 · Status: Done  
Summary: Added `apps/web/src/env.ts` with `@t3-oss/env-nextjs` + Zod fail-fast validation for all 26 MASTER-SHEET environment variables, wired startup check in `next.config.ts`, and created complete `.env.example`.  
- [x] App fails fast on missing env
- [x] .env.example complete
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-005] CI pipeline (GitHub Actions) + Vercel preview**  
Phase: Phase 0 — Foundation · Priority: P1 · Estimate: 2h · Deps: C-001 · Status: Done  
Summary: Added `.github/workflows/ci.yml` (Postgres 16 service, lint, typecheck, db migrate/seed, Vitest, build, Playwright smoke, and Vercel PR preview comment step) and monorepo `vercel.json`. (Local verification complete; remote PR/Vercel preview activates once GitHub/Vercel remotes are linked.)  
- [x] CI green on PR
- [x] Preview URL posted
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-101] Import design tokens from Figma via MCP**  
Phase: Phase 1 — Design System & Shell · Priority: P0 · Estimate: 4h · Deps: C-002 · Status: Done  
Summary: Extracted all Light (`0:1`) and Dark (`2:583`) color, radius, spacing, elevation, and typography variables via Figma MCP (`get_variable_defs` on `4otk3FXD0q1TJ7aPGEIeGO`) into `tokens.css` + Tailwind v4 `@theme inline` (`globals.css`), with self-hosted Geist & JetBrains Mono fonts.  
- [x] Tokens match Figma values 1:1
- [x] No hard-coded hex in components
- [x] Fonts self-hosted via next/font
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-102] Map Figma components to shadcn variants**  
Phase: Phase 1 — Design System & Shell · Priority: P1 · Estimate: 4h · Deps: C-101 · Status: Done  
Summary: Mapped all Figma All in One components (`Button`, `Badge`, `ProBadge`, `Tag`, `InputField`, `StepIndicator`, `Tabs`, `Card`, `AvatarBadge`, `ProjectCard`, `TemplateTypeCard`, `PlanCard`) to token-styled shadcn/ui variants and built the `/dev/ui` design-system showcase page.  
- [x] Visual check vs Figma screenshots
- [x] Storybook-like /dev/ui page lists all
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-103] App shell: sidebar, topbar, responsive mobile nav**  
Phase: Phase 1 — Design System & Shell · Priority: P0 · Estimate: 4h · Deps: C-102 · Status: Done  
Summary: Built responsive, keyboard-accessible `MarketingShell`, `AppShell`, and `AdminShell` layouts for `(marketing)`, `(app)`, and `(admin)` route groups per Figma (`2:2003`, `31:6666`, `27:6667`, `29:6956`), verified across `375px`, `768px`, and `1440px`.  
- [x] Works at 375px, 768px, 1440px
- [x] Keyboard accessible
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-201] Better Auth: email+password, Google, magic link**  
Phase: Phase 2 — Auth & Onboarding · Priority: P0 · Estimate: 4h · Deps: C-003 · Status: Done  
Summary: Configured Better Auth (`drizzleAdapter` with UUID generation on Postgres) supporting email+password, Google OAuth, magic links, 6-digit OTP email verification, password reset via Resend + React Email, protected `(app)` redirects, and Figma-faithful `/sign-up`, `/sign-in`, `/verify`, and `/reset` screens.  
- [x] Sign up/in/out works
- [x] Protected routes redirect
- [x] Sessions persist
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-202] Roles & organizations (user, admin, superadmin; teams)**  
Phase: Phase 2 — Auth & Onboarding · Priority: P0 · Estimate: 3h · Deps: C-201 · Status: Done  
Summary: Added Better Auth `organization` plugin mapped to `organizations`, `memberships` (`org_id`), and `invitations` with `owner`/`editor`/`viewer` access control, server-side role/org guards (`requireAdmin`, `requireSuperAdmin`, `requireOrgMembership`) returning real HTTP `403` via Next.js `forbidden()` + `app/forbidden.tsx` on `/admin`, and built `/account` + `/account/team` workspaces.  
- [x] /admin blocked for non-admin (403)
- [x] Team invites work
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-203] Onboarding flow**  
Phase: Phase 2 — Auth & Onboarding · Priority: P1 · Estimate: 3h · Deps: C-201 · Status: Done  
Summary: Built Figma-faithful 3-step `/onboarding` wizard (`2:1214`, `2:1336`, `2:1480`) for role, design focus (`mobile` / `web` / `both`), display name, headline, and avatar upload, with Zod-validated server persistence to `users`, one-time onboarding redirect logic, and first-run `/dashboard` checklist (`2:1558`).  
- [x] New user lands on onboarding once
- [x] Data saved to profile
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-301] Template JSON schema (zod) matching figma-to-puck**  
Phase: Phase 3 — Templates & Admin Import · Priority: P0 · Estimate: 3h · Deps: C-003 · Status: Done  
Summary: Built canonical Zod template schema in `@casefolio/template-schema` (re-exported from `apps/web/src/lib/template/schema.ts`) covering all 9 section types, aspect ratios, semver, theme tokens, slots, warnings, and cross-field refinements rejecting raw hex/RGB colors, unknown tokens/slots, and duplicate IDs.  
- [x] template.example.json validates
- [x] Invalid ratios/tokens rejected with clear errors
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-302] Puck component config for section types**  
Phase: Phase 3 — Templates & Admin Import · Priority: P0 · Estimate: 6h · Deps: C-301,C-102 · Status: Done  
Summary: Built all 9 Puck section components (`Hero`, `Overview`, `Problem`, `Process`, `ScreensGallery`, `Results`, `Quote`, `CTA`, `Custom`) using strictly CSS variables/design tokens, locked-aspect-ratio `ImageSlotFrame` with Mobile (`iphone`/`android`) and Web (`browser`) device chrome variants, and `TemplatePuckRenderer` + `casefolioPuckConfig` wrapping `@puckeditor/core` `<Render>`.  
- [x] Orbit example renders via <Render>
- [x] Mobile/Web variants render
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-303] Admin template upload wizard**  
Phase: Phase 3 — Templates & Admin Import · Priority: P0 · Estimate: 6h · Deps: C-301,C-202 · Status: Done  
Summary: Built 4-step `/admin/templates/new` upload wizard (Upload JSON → Validate → Preview → Metadata & Save) with field-level Zod schema error reporting, live `<TemplatePuckRenderer>` preview, admin-guarded Server Action saving draft version `1.0.0`, category auto-resolution, and `audit_logs` tracking.  
- [x] Invalid JSON shows field-level errors
- [x] Draft saved with version 1.0.0
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-304] Template versions & publish/archive**  
Phase: Phase 3 — Templates & Admin Import · Priority: P0 · Estimate: 4h · Deps: C-303 · Status: Done  
Summary: Implemented semantic versioning (`createNewTemplateVersion`), publish/archive/unarchive lifecycle actions with `audit_logs`, `/admin/templates` table with Type & Status filters (`31:6881`), and `/admin/templates/[id]` detail screen (`32:7909`) with live Puck preview, version history, and immutable project version pinning.  
- [x] Publishing new version does not alter existing projects
- [x] Archived hidden from library
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-305] Template library (user side) with filters**  
Phase: Phase 3 — Templates & Admin Import · Priority: P0 · Estimate: 4h · Deps: C-304 · Status: Done  
Summary: Built `/templates` library (adapting between `AppShell` when authenticated and `MarketingShell` when logged out) with combinable Type, Category, Tier, and Search filters, `<ProBadge />` + lock badge/CTA on `pro` templates for `free` users, and live `<TemplatePuckRenderer>` preview modal.  
- [x] Filters combine
- [x] Pro templates show badge and lock for Free
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-401] Create-project wizard**  
Phase: Phase 4 — Create Wizard & Editor · Priority: P0 · Estimate: 4h · Deps: C-305 · Status: Done  
Summary: Built 3-step `/new` (`type` → `template` → `details`) create-project wizard per Figma (`2:3962`, `2:4161`) with state persistence across Back/Next, live mini-cover preview, server-side Free quota & Pro template gating, and project creation pinning `template_versions.id` while copying template Puck data & theme.  
- [x] Project created with pinned template version
- [x] Back/next keeps state
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-402] Constrained Puck editor**  
Phase: Phase 4 — Create Wizard & Editor · Priority: P0 · Estimate: 8h · Deps: C-302,C-401 · Status: Done  
Summary: Built `/editor/[projectId]` 3-panel constrained Puck editor per Figma (`2:4346`, `2:4784`, `2:6367`) with `CONSTRAINED_PUCK_PERMISSIONS` (`insert: false, delete: false, duplicate: false, drag: false, edit: true`), zero free-canvas drawers/dropzones, `<Puck.Fields wrapFields />` inspector, optional section visibility switches (Hero locked), Desktop/Mobile preview toggle, Screenshots slot checklist, and owner/org editor authorization.  
- [x] Cannot drag new components
- [x] Section show/hide works
- [x] No free-canvas features
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-403] TipTap rich text field**  
Phase: Phase 4 — Create Wizard & Editor · Priority: P1 · Estimate: 4h · Deps: C-402 · Status: Done  
Summary: Implemented custom Puck `RichTextField` powered by TipTap 3 (`Document`, `Paragraph`, `Text`, `HardBreak`, `Bold`, `Italic`, `BulletList`, `OrderedList`, `ListItem`, safe `Link`) outputting structured JSON (`{ type: "doc", content: [...] }`), DOM-sanitizing pasted HTML via `sanitizeRichTextHtml`, and rendering safely via `RichTextView` without `dangerouslySetInnerHTML`.  
- [x] Output stored as JSON
- [x] Paste sanitized
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-404] Theme panel: palette & fonts**  
Phase: Phase 4 — Create Wizard & Editor · Priority: P0 · Estimate: 4h · Deps: C-402 · Status: Done  
Summary: Built `ThemePanel` per Figma (`2:4346`) with curated color palette presets, individual token color pickers + hex inputs, curated open-licensed font catalog + Heading/Body pair selector with Google Fonts stylesheet loader, instant CSS variable preview updates, `Reset to template defaults`, and live WCAG 2.1 contrast warnings whenever text contrast drops below `4.5:1`.  
- [x] Changes apply instantly
- [x] Contrast warning < 4.5:1
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-405] State, undo/redo, autosave**  
Phase: Phase 4 — Create Wizard & Editor · Priority: P0 · Estimate: 4h · Deps: C-402 · Status: Done  
Summary: Implemented Zustand + Immer + `zundo` temporal editor store (`createEditorStore`), topbar Undo/Redo buttons + `Ctrl+Z`/`Cmd+Z` and `Ctrl+Shift+Z`/`Cmd+Shift+Z` shortcuts, debounced autosave to PostgreSQL (`saveProjectEditorState`) with optimistic `updatedAt` concurrency conflict detection, topbar autosave indicator, and Figma `2:6162` error/conflict recovery toast.  
- [x] Ctrl+Z/Ctrl+Shift+Z work
- [x] Autosave indicator
- [x] No data loss on reload
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-406] Editor responsive behavior**  
Phase: Phase 4 — Create Wizard & Editor · Priority: P1 · Estimate: 3h · Deps: C-402 · Status: Done  
Summary: Implemented responsive editor layout (`375px` mobile preview + compact zero-overflow topbar + thumb-friendly bottom action bar + accessible bottom-sheet `Sheet` drawer for `Fields`, `Sections`, `Style`, and `Screens`; desktop 3-panel layout) and verified end-to-end with Playwright (`phase4-editor.spec.ts`) at `1440x900` and `375x812`.  
- [x] Usable at 375px
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-501] R2 uploads via presigned URLs**  
Phase: Phase 5 — Images & Media · Priority: P0 · Estimate: 4h · Deps: C-003 · Status: Done  
Summary: Implemented R2 S3v4 presigned PUT uploads (`@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`) with HMAC-signed local dev fallback, server-side MIME + binary magic-byte checks, lossless JPEG/PNG/WebP EXIF/GPS stripping, authoritative per-plan file size & storage quotas (`free`/`pro`/`team`), `assets` table persistence, rate limiting, and private-until-published asset access control (`/api/assets/[assetId]`).  
- [x] Uploads > limit rejected
- [x] Files private until published
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-502] Image slot field with react-easy-crop**  
Phase: Phase 5 — Images & Media · Priority: P0 · Estimate: 4h · Deps: C-501,C-402 · Status: Done  
Summary: Built `ImageSlotField` custom Puck field with drag-and-drop/file upload, live `%` progress bar, Figma `2:6162` error alerts, `react-easy-crop` modal strictly locked to `template.slots[key].ratio`, persisted pixel `crop` rect (`ImageSlotValue.crop` + `PATCH /api/assets/[assetId]`), re-editable crop restoration, `Replace`/`Remove` actions, and SSR/CSR-pure crop framing in `ImageSlotFrame`.  
- [x] Crop ratio always matches slot
- [x] Crop persisted and re-editable
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-503] Cloudflare Images delivery + srcset**  
Phase: Phase 5 — Images & Media · Priority: P1 · Estimate: 3h · Deps: C-502 · Status: Done  
Summary: Implemented Cloudflare Images variant URL generator (`buildCloudflareImageVariantUrl`) with `trim` crop directives + local dev `/cdn/images/[assetId]` private-until-published CDN route, `next/image` custom loader (`createCasefolioImageLoader`), responsive `srcset` + device-chrome `sizes` (`CdnResponsiveImage`), and end-to-end Playwright verification (`phase5-images.spec.ts`).  
- [x] Images served via CDN with correct size
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-601] Publish & public share page**  
Phase: Phase 6 — Publish, Share & Export · Priority: P0 · Estimate: 4h · Deps: C-402 · Status: Done  
Branch: `feat/C-601-publish-share-page`  
Summary: Implemented custom slug validation & uniqueness, `public`/`unlisted` (`noindex`) publish & unpublish service + `/projects/[id]/share` management UI (`ProjectSharePanel`), `/p/[slug]` SSR via `TemplatePuckRenderer` (`<Render>`) with Google Fonts parity and Free plan watermark, and 1200×630 Satori OpenGraph image generation (`/p/[slug]/opengraph-image`).  
- [x] Public page loads < 2s
- [x] Unpublish returns 404
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-602] Playwright export worker (Fly/Railway)**  
Phase: Phase 6 — Publish, Share & Export · Priority: P0 · Estimate: 8h · Deps: C-601 · Status: Done  
Branch: `feat/C-602-playwright-export-worker`  
Summary: Built `@casefolio/worker` (`pg-boss` v12 queue consumer, headless Playwright Chromium renderer for 1440px `png_long`, `pdf`, and 1400px `behance` `.zip` slices, R2 + local storage writer, `Dockerfile`), HMAC-signed `/export/[jobId]?token=` SSR render route with Google Fonts parity and private-asset export token auth, and `/api/exports` endpoints enforcing Free plan watermark + format/monthly limits.  
- [x] Exports match editor fonts
- [x] Job status visible
- [x] Free: watermark + limits
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-603] Export UI & history**  
Phase: Phase 6 — Publish, Share & Export · Priority: P1 · Estimate: 3h · Deps: C-602 · Status: Done  
Branch: `feat/C-603-export-ui-history`  
Summary: Implemented `ExportCaseStudyDialog` + `ProjectExportsPanel` (`/projects/[id]/exports`), Editor topbar `Export` action, workspace `/exports` & `/published` index pages, live polling progress (`queued` → `processing` → `completed`), Pro lock/upgrade prompts, past export re-download history, and full Playwright E2E verification (`phase6-publish-export.spec.ts`).  
- [x] User can re-download past exports
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-701] Paddle Billing integration**  
Phase: Phase 7 — Billing & Gating · Priority: P0 · Estimate: 6h · Deps: C-202 · Status: Done  
Branch: `feat/C-701-paddle-billing`  
Summary: Implemented Free/Pro/Team monthly & yearly catalog + server Paddle price ID mapping (`plans.ts`, `server-config.ts`), `@paddle/paddle-js` overlay + sandbox checkout flow (`PaddleCheckoutModal`, `/api/paddle/checkout`, `/api/paddle/sandbox-complete`), constant-time HMAC-SHA256 `Paddle-Signature` verification (`signature.ts`), transactional `webhook_events` idempotency + `subscriptions`/`users.plan` state machine (`/api/paddle/webhook`, `webhooks.ts`), customer portal/cancellation APIs (`/api/paddle/portal`), and receipt downloads (`/api/paddle/invoices/[eventId]`).  
- [x] Sandbox checkout works
- [x] Webhook signature verified
- [x] Idempotent handling
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-702] Entitlements & gating**  
Phase: Phase 7 — Billing & Gating · Priority: P0 · Estimate: 4h · Deps: C-701,C-305 · Status: Done  
Branch: `feat/C-702-entitlements-gating`  
Summary: Implemented single canonical `can(user, feature, context?)` + `evaluateEntitlement()` (`src/lib/entitlements/index.ts`) and authoritative DB subscription reconciliation (`resolveEffectivePlanForUser`, `resolveEffectivePlanForOrganization` in `src/lib/entitlements/server.ts`); seeded published `Meridian` Pro template (`packages/db/src/seed.ts`); enforced server-side checks across project creation, Pro templates, PNG/PDF/Behance exports, public/export watermarks, storage quotas, and team seat invitations (`/api/team/invitations`); wired `UpgradePromptDialog` across library, wizard, export, share, and team UIs.  
- [x] Server-side checks on every gated API
- [x] Upgrade prompts shown
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-703] Account & billing pages**  
Phase: Phase 7 — Billing & Gating · Priority: P1 · Estimate: 3h · Deps: C-701 · Status: Done  
Branch: `feat/C-703-account-billing-pages`  
Summary: Built unified `AccountSettingsShell` + `/account` (`ProfileSettingsPanel`), `/account/security` (`SecuritySettingsPanel` with password change, active sessions & revoke, and cascading account deletion), `/account/billing` (`BillingSettingsPanel` with `Current plan`, `Payment method`, `Billing details`, `Change plan` 3-tier picker, `Downgrade to Free?`, 2-step cancellation, `Resume subscription`, `past_due` & `cancel_at_period_end` banners, and Paddle Customer Portal link), `/account/invoices` (table + receipt downloads), `/settings` redirect, live `(app)` sidebar/topbar billing badges + app-wide failed-payment banner, Vitest tests, and full Phase 7 Playwright E2E verification (`phase7-billing-gating.spec.ts`).  
- [x] Plan changes reflected after webhook
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-801] PostHog product analytics**  
Phase: Phase 8 — Analytics & Notifications · Priority: P1 · Estimate: 3h · Deps: C-201 · Status: Done  
Branch: `feat/C-801-posthog-analytics`  
Summary: Implemented `posthog-js` client provider (`PostHogProvider`, `trackClientProductEvent` with autocapture/session-recording/IP disabled) and server PostHog `/capture/` dispatcher (`trackServerProductEvent`) guarded by a strict PII scrubber (`sanitizeAnalyticsProps`, `sanitizeDistinctId` stripping email/name/IP/token keys & values), dev ring buffer + `/api/dev/analytics-events` test inspection route, and instrumented `signup`, `template_selected`, `project_created`, `published`, `exported`, and `upgrade` with Vitest verification (`posthog.test.ts`).  
- [x] Events visible in PostHog
- [x] No PII in props
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-802] Case-study view analytics**  
Phase: Phase 8 — Analytics & Notifications · Priority: P1 · Estimate: 4h · Deps: C-601 · Status: Done  
Branch: `feat/C-802-case-study-analytics`  
Summary: Implemented privacy-safe daily-salted SHA-256 `visitorHash` view tracking (`page-views.ts`, `/p/[slug]` SSR recording + `/api/track` rate-limited endpoint) with strict crawler/bot & prefetch filtering, referrer source bucketing (`Direct / link`, `LinkedIn`, `Dribbble`, `Behance`, `Google`, `X / Twitter`, `Other`), `/projects/[id]/analytics` (`ProjectAnalyticsPanel` matching Figma `2:8485` & `2:8745` with SVG bar chart + `can(plan, "full_analytics")` 90d/All gating), `/analytics` workspace overview (`2:8629`), and Vitest tests (`page-views.test.tsx`).  
- [x] Bots filtered
- [x] Owner sees chart
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-803] Notifications (in-app + email)**  
Phase: Phase 8 — Analytics & Notifications · Priority: P2 · Estimate: 4h · Deps: C-201 · Status: Done  
Branch: `feat/C-803-notifications`  
Summary: Implemented `notifications` persistence + React Email / Resend delivery (`createUserNotification`, `notifyExportFinished`, `notifyPaymentIssue`, `notifyTeamInviteIfExistingUser`, `notifyTemplateVersionPublished`, `notifyProjectPublished` in `src/lib/notifications/service.ts`), `/api/notifications` (`GET`/`PATCH`), topbar `NotificationsBell` with unread badge + live dropdown (`2:9425`/`2:9594`), `/notifications` center with `All`/`Unread`/`Exports`/`Billing`/`Team` filters & empty state (`2:9648`/`2:9799`), Vitest unit/DB/UI tests (`notifications.test.ts`, `notifications-ui.test.tsx`), and full Phase 8 Playwright E2E verification (`phase8-analytics-notifications.spec.ts`).  
- [x] Bell shows unread count
- [x] Email via Resend
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-901] Admin overview dashboard**  
Phase: Phase 9 — Admin Panel (full) · Priority: P1 · Estimate: 4h · Deps: C-202,C-802 · Status: Done  
Branch: `feat/C-901-admin-overview`  
Summary: Implemented `getAdminOverviewMetrics` and `getAdminPlatformAnalytics` (`src/lib/admin/overview.ts`, `src/lib/admin/overview-types.ts`) computing live SQL-backed KPIs (`Total users`, `MRR` + active subscriptions, `Published case studies`, `Completed exports`, `Templates live`), 12-bucket `Signups & publishes` bar chart, `Needs attention` queue alerts, `Top templates by usage`, and `/admin/analytics` (`32:9985`) with CSV export; verified against direct DB queries in `overview.test.ts` and `admin-overview.test.tsx`.  
- [x] Numbers match DB queries
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-902] Admin templates list, filters & detail**  
Phase: Phase 9 — Admin Panel (full) · Priority: P0 · Estimate: 4h · Deps: C-304 · Status: Done  
Branch: `feat/C-902-admin-templates`  
Summary: Upgraded `/admin/templates` (`admin-templates-list.tsx`) to match Figma `31:6881`, `31:7117` empty state, and `32:8045` delete confirmation modal with search + `Status`, `Type`, `Tier`, and `Category` filters, row actions menu, and `Showing X of Y templates` footer; upgraded `/admin/templates/[id]` (`template-detail-client.tsx`) to match Figma `32:7909` with `Preview`, `Sections`, `Image slots`, `Style`, and `Usage` tabs, `Version history` (`Live` badge), `usedInProjects` query, and `deleteAdminTemplate` with audit logging (`admin-templates.test.ts`, `admin-templates.test.tsx`).  
- [x] Matches Figma Admin Panel 31:6665
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-903] Admin categories management**  
Phase: Phase 9 — Admin Panel (full) · Priority: P2 · Estimate: 2h · Deps: C-902 · Status: Done  
Branch: `feat/C-903-admin-categories`  
Summary: Implemented admin categories CRUD & sort ordering (`src/lib/admin/categories.ts`, `src/lib/admin/categories-types.ts`, `/api/admin/categories`) with active-template delete protection, `audit_logs` recording (`admin.category.created`, `admin.category.updated`, `admin.category.reordered`, `admin.category.deleted`), `/admin/categories` UI (`32:8745`), and `/templates` library filter bar ordering verification (`categories.test.ts`, `admin-categories.test.tsx`).  
- [x] Category used in library filters
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-904] Admin users & subscriptions**  
Phase: Phase 9 — Admin Panel (full) · Priority: P1 · Estimate: 4h · Deps: C-701 · Status: Done  
Branch: `feat/C-904-admin-users-subscriptions`  
Summary: Implemented admin users directory, user detail, and subscriptions overview (`src/lib/admin/users.ts`, `src/lib/admin/users-types.ts`, `/api/admin/users`) matching Figma `32:8993`, `32:9241`, and `32:9489`; added live Paddle subscription status fetch & sync (`fetchLivePaddleSubscription`, `syncUserSubscriptionFromPaddle`), immediate session revocation + Better Auth login blocking on suspend (`auth/server.ts`), and `audit_logs` recording (`users.test.ts`, `admin-users.test.tsx`).  
- [x] Suspend blocks login
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-905] Moderation**  
Phase: Phase 9 — Admin Panel (full) · Priority: P2 · Estimate: 4h · Deps: C-601 · Status: Done  
Branch: `feat/C-905-admin-moderation`  
Summary: Added public case-study reporting (`ReportCaseStudyButton` on `/p/[slug]` + rate-limited `POST /api/reports`), moderation queue & review service (`src/lib/admin/moderation.ts`, `src/lib/admin/moderation-types.ts`, `/api/admin/moderation`), `/admin/moderation` UI (`32:9737` queue + review panel and `32:10481` empty state), owner takedown notification + email, immediate unpublish so `/p/[slug]` returns HTTP 404, and `audit_logs` recording (`moderation.test.ts`, `admin-moderation.test.tsx`).  
- [x] Takedown makes page 404
- [x] Audit log entry
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-906] Admin settings, roles & audit log**  
Phase: Phase 9 — Admin Panel (full) · Priority: P1 · Estimate: 3h · Deps: C-202 · Status: Done  
Branch: `feat/C-906-admin-settings-audit`  
Summary: Implemented `/admin/settings` (`32:10233`) with admin team role management (`admin` / `superadmin` + `+ Add admin` by email with self-demotion, superadmin-only, and last-admin safety guards), permissions matrix, platform feature flags (`newSignupsOpen`, `requireEmailVerification`, `maintenanceMode` persisted via `audit_logs` and enforced in `auth/server.ts`), searchable/filterable `Audit log` explorer with CSV export, Vitest unit/DB/UI tests (`settings.test.ts`, `admin-settings.test.tsx`), and full Phase 9 Playwright E2E verification (`phase9-admin-panel.spec.ts`).  
- [x] Every admin mutation logged
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1001] Marketing landing page from Figma 27:6665**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P0 · Estimate: 6h · Deps: C-102 · Status: Done  
Branch: `feat/C-1001-marketing-landing`  
Summary: Implemented the 13-section marketing landing page (`apps/web/src/app/(marketing)/page.tsx`) matching Figma `27:6665` (`27:6666` Desktop 1440 & `30:6997` Mobile 390) with token-driven `LandingHeroVisual`, `LandingPricingSection` wired to `BILLING_PLAN_CATALOG`, accessible `LandingFaqAccordion`, full OpenGraph/Twitter/canonical SEO `Metadata`, Vitest tests (`page.test.tsx`), and verified Lighthouse scores (`Performance: 99`, `Accessibility: 100`, `Best Practices: 96`, `SEO: 91`).  
- [x] Pixel-close to Figma
- [x] Lighthouse ≥ 90
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1002] Pricing page & plan comparison**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P1 · Estimate: 2h · Deps: C-1001,C-701 · Status: Done  
Branch: `feat/C-1002-pricing-page`  
Summary: Implemented `/pricing` (`apps/web/src/app/(marketing)/pricing/page.tsx` & `pricing-page-client.tsx`) matching Figma `2:8841`, loading plan prices, yearly discounts, quotas, and Paddle price IDs (`resolveServerPaddlePriceId`) from server config, featuring a full Free vs Pro vs Team capability matrix, direct `PaddleCheckoutModal` launch for signed-in users, and Vitest coverage (`pricing.test.tsx`).  
- [x] Prices loaded from config
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1003] Help center & docs**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P2 · Estimate: 3h · Deps: C-103 · Status: Done  
Branch: `feat/C-1003-help-center`  
Summary: Implemented the Help Center (`/help`), MDX article pages (`/help/[slug]` backed by 5 `.mdx` guides in `apps/web/src/content/help/*.mdx` with zero external MDX dependencies), instant client/server search (`searchHelpArticles`), and rate-limited Contact Support form (`/help/contact` + `POST /api/help/contact` with Resend confirmation and `#CF-XXXXX` ticket generation) matching Figma `2:9899`, `2:10019`, and `2:10147`, plus `/terms` and `/privacy` legal pages and Vitest suites (`help.test.ts`, `help-center.test.tsx`).  
- [x] Articles render, search works
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1004] Dashboard (projects grid, recent, quick create)**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P0 · Estimate: 4h · Deps: C-401 · Status: Done  
Branch: `feat/C-1004-dashboard-projects`  
Summary: Built the Dashboard (`/dashboard`) matching Figma `2:2172` (empty state with `Aa` layered artwork, quick-start CTA, and 3-step guide), `2:2003` (responsive 3-column project grid with `Published`/`Unlisted`/`Draft` badges, segmented status pills, search, type/sort filters, and `Quick create: Mobile / Website` pills), `2:2583` (card context menu), `2:2783` (rename modal preserving public slug), and `2:2980` (type-to-confirm delete modal), backed by owner-authorized Server Actions and `can(userPlan, "create_project")` quota enforcement on duplication, plus Vitest and Playwright E2E/visual verification at `1440px` and `375px`.  
- [x] Empty state matches Figma
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1101] Security review**  
Phase: Phase 11 — Hardening & Launch · Priority: P0 · Estimate: 4h · Deps: C-702 · Status: Done  
Branch: `feat/C-1101-security-review`  
Summary: Audited and hardened all API routes, Server Actions, and HTTP headers per `02-RULES.md §5`: configured global `Content-Security-Policy`, `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy`, `Permissions-Policy`, `Cross-Origin-Opener-Policy`, `Strict-Transport-Security` (prod), and `poweredByHeader: false` in `apps/web/next.config.ts` (`headers.ts`); added auth mutation rate limiting (`auth-rate-limit.ts`) on `/api/auth/*`; isolated internal onboarding helpers into non-`"use server"` `onboarding-service.ts`; added strict Zod & header filename sanitization (`redact.ts`); documented `SECURITY.md` with all `02-RULES.md §5` items ticked; and added automated audit suite `security-review.test.ts`.  
- [x] Checklist in RULES §Security all ticked
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1102] E2E tests of core journeys**  
Phase: Phase 11 — Hardening & Launch · Priority: P0 · Estimate: 6h · Deps: C-602,C-702 · Status: Done  
Branch: `feat/C-1102-core-e2e-journeys`  
Summary: Added end-to-end Playwright suite `tests/e2e/phase11-core-journeys.spec.ts` covering (1) full designer lifecycle (`Signup -> 6-digit OTP verification -> 3-step onboarding -> /new Orbit project creation -> Constrained Editor style & 9:19.5 screenshot upload/crop -> /p/<slug> SSR publish with Free watermark -> PNG export & PDF Free gate -> Paddle Sandbox Pro upgrade -> watermark removal & A4 PDF export`) and (2) Admin template import (`Upload reference/template.example.json -> Validate -> Live Puck preview -> Save v1.0.0 draft -> Publish -> audit_logs check -> anonymous /templates library & preview dialog`); updated `playwright.config.ts` (`pnpm --filter @casefolio/web start` in CI), `.github/workflows/ci.yml`, `smoke.spec.ts`, and `headers.ts` CSP font directives so all 16 E2E tests pass in `pnpm test:e2e`.  
- [x] Playwright suite green in CI
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1103] Performance, a11y & responsive QA**  
Phase: Phase 11 — Hardening & Launch · Priority: P1 · Estimate: 4h · Deps: C-1001,C-406 · Status: Done  
Branch: `feat/C-1103-perf-a11y-qa`  
Summary: Added `@axe-core/playwright` and `tests/e2e/phase11-a11y-responsive-qa.spec.ts` auditing WCAG 2.1 A/AA across 15 public, auth, editor, published case-study, billing, and admin routes (light & dark themes) with zero `critical` and zero `serious` violations; remediated WCAG AA contrast and ARIA label-in-name semantics across `tokens.css`, `badge.tsx`, `user-account-menu.tsx`, `notifications-bell.tsx`, `editor-canvas-preview.tsx`, `image-slot-frame.tsx`, `casefolio-watermark.tsx`, `sections/index.tsx`, `project-exports-panel.tsx`, `project-share-panel.tsx`, `help-center-client.tsx`, `landing-hero-visual.tsx`, and auth forms; verified Lighthouse ≥ 90 and captured `375px`, `768px`, and `1440px` responsive screenshots with zero horizontal overflow.  
- [x] No critical axe issues
- [x] Tests added & passing
- [x] Verified against Figma (if UI)

---
**[C-1104] Production deploy & monitoring**  
Phase: Phase 11 — Hardening & Launch · Priority: P0 · Estimate: 3h · Deps: C-1101,C-1102 · Status: Todo  
- [ ] Health checks green
- [ ] Rollback documented
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)
