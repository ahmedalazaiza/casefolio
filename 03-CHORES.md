# 03 — CHORES (Ordered Tasks)
> **مقدمة:** هذا الملف يحتوي على المهام المرتبة على مراحل مع المعرّفات والاعتماديات ومعايير القبول. نفّذها بالترتيب.

Rules: follow `02-RULES.md`. Do tasks in order; never start a task whose dependencies are not Done. Each task ends with its acceptance criteria verified.

## Phase 0 — Foundation

### C-001 — Scaffold Next.js 15+ app (TS strict, App Router, pnpm)
- **Priority:** P0 · **Estimate:** 2h · **Depends on:** —
- **Description:** Create repo, ESLint, Prettier, Vitest, Playwright test runner.
- **Acceptance criteria:**
  - [x] `pnpm dev` runs
  - [x] `pnpm lint && pnpm typecheck && pnpm test` pass
  - [x] TS strict on

### C-002 — Tailwind v4 + shadcn/ui setup
- **Priority:** P0 · **Estimate:** 2h · **Depends on:** C-001
- **Description:** Install Tailwind, shadcn CLI, base components (button, input, dialog, dropdown, tabs, toast, sheet).
- **Acceptance criteria:**
  - [x] shadcn components render
  - [x] Dark/light class strategy works

### C-003 — Database: Postgres (Neon) + Drizzle
- **Priority:** P0 · **Estimate:** 3h · **Depends on:** C-001
- **Description:** Drizzle config, migrations folder, schema from MASTER-SHEET ERD, seed script.
- **Acceptance criteria:**
  - [x] `pnpm db:migrate` applies cleanly
  - [x] Seed creates admin + 1 template
  - [x] All ERD tables exist

### C-004 — Env validation + config
- **Priority:** P0 · **Estimate:** 1h · **Depends on:** C-001
- **Description:** `src/env.ts` with zod (t3-env) for every var in MASTER-SHEET.
- **Acceptance criteria:**
  - [x] App fails fast on missing env
  - [x] .env.example complete

### C-005 — CI pipeline (GitHub Actions) + Vercel preview
- **Priority:** P1 · **Estimate:** 2h · **Depends on:** C-001
- **Description:** Lint, typecheck, unit, e2e smoke on PR; Vercel preview deploys.
- **Acceptance criteria:**
  - [x] CI green on PR
  - [x] Preview URL posted

## Phase 1 — Design System & Shell

### C-101 — Import design tokens from Figma via MCP
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-002
- **Description:** Read Figma file 4otk3FXD0q1TJ7aPGEIeGO variables/styles; generate `tokens.css` + Tailwind theme (indigo #4F46E5, Geist, JetBrains Mono).
- **Acceptance criteria:**
  - [x] Tokens match Figma values 1:1
  - [x] No hard-coded hex in components
  - [x] Fonts self-hosted via next/font

### C-102 — Map Figma components to shadcn variants
- **Priority:** P1 · **Estimate:** 4h · **Depends on:** C-101
- **Description:** Buttons, inputs, badges (incl. Pro badge), cards, tags per Figma All in One page.
- **Acceptance criteria:**
  - [x] Visual check vs Figma screenshots
  - [x] Storybook-like /dev/ui page lists all

### C-103 — App shell: sidebar, topbar, responsive mobile nav
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-102
- **Description:** Layouts for (app), (admin), (marketing) route groups.
- **Acceptance criteria:**
  - [x] Works at 375px, 768px, 1440px
  - [x] Keyboard accessible

## Phase 2 — Auth & Onboarding

### C-201 — Better Auth: email+password, Google, magic link
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-003
- **Description:** Sessions in DB, email verification via Resend.
- **Acceptance criteria:**
  - [x] Sign up/in/out works
  - [x] Protected routes redirect
  - [x] Sessions persist

### C-202 — Roles & organizations (user, admin, superadmin; teams)
- **Priority:** P0 · **Estimate:** 3h · **Depends on:** C-201
- **Description:** Better Auth organization plugin; role guard helpers.
- **Acceptance criteria:**
  - [x] /admin blocked for non-admin (403)
  - [x] Team invites work

### C-203 — Onboarding flow
- **Priority:** P1 · **Estimate:** 3h · **Depends on:** C-201
- **Description:** Name, role, design focus (Mobile/Web/Both), avatar.
- **Acceptance criteria:**
  - [x] New user lands on onboarding once
  - [x] Data saved to profile

## Phase 3 — Templates & Admin Import

### C-301 — Template JSON schema (zod) matching figma-to-puck
- **Priority:** P0 · **Estimate:** 3h · **Depends on:** C-003
- **Description:** `src/lib/template/schema.ts` validating template.example.json shape (template + puck + warnings).
- **Acceptance criteria:**
  - [x] template.example.json validates
  - [x] Invalid ratios/tokens rejected with clear errors

### C-302 — Puck component config for section types
- **Priority:** P0 · **Estimate:** 6h · **Depends on:** C-301,C-102
- **Description:** Hero, Overview, Problem, Process, ScreensGallery, Results, Quote, CTA, Custom using tokens only.
- **Acceptance criteria:**
  - [x] Orbit example renders via <Render>
  - [x] Mobile/Web variants render

### C-303 — Admin template upload wizard
- **Priority:** P0 · **Estimate:** 6h · **Depends on:** C-301,C-202
- **Description:** Steps: upload JSON → validate → preview → metadata (category, tier, cover) → save as draft version.
- **Acceptance criteria:**
  - [x] Invalid JSON shows field-level errors
  - [x] Draft saved with version 1.0.0

### C-304 — Template versions & publish/archive
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-303
- **Description:** Semver versions, publish/archive, changelog; projects pin a version.
- **Acceptance criteria:**
  - [x] Publishing new version does not alter existing projects
  - [x] Archived hidden from library

### C-305 — Template library (user side) with filters
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-304
- **Description:** Filter by type, category, tier; Pro badge; preview modal.
- **Acceptance criteria:**
  - [x] Filters combine
  - [x] Pro templates show badge and lock for Free

## Phase 4 — Create Wizard & Editor

### C-401 — Create-project wizard
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-305
- **Description:** Type (Mobile/Web/Both) → template → name → create project copying template puck data.
- **Acceptance criteria:**
  - [x] Project created with pinned template version
  - [x] Back/next keeps state

### C-402 — Constrained Puck editor
- **Priority:** P0 · **Estimate:** 8h · **Depends on:** C-302,C-401
- **Description:** Fields-only editing; no add/remove/reorder unless template allows; sections panel toggles visibility only.
- **Acceptance criteria:**
  - [x] Cannot drag new components
  - [x] Section show/hide works
  - [x] No free-canvas features

### C-403 — TipTap rich text field
- **Priority:** P1 · **Estimate:** 4h · **Depends on:** C-402
- **Description:** Custom Puck field; limited marks (bold, italic, link, lists).
- **Acceptance criteria:**
  - [x] Output stored as JSON
  - [x] Paste sanitized

### C-404 — Theme panel: palette & fonts
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-402
- **Description:** Edit token colors (with presets), choose font pairs from curated list; live preview via CSS variables.
- **Acceptance criteria:**
  - [x] Changes apply instantly
  - [x] Contrast warning < 4.5:1

### C-405 — State, undo/redo, autosave
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-402
- **Description:** Zustand + zundo history; debounced autosave to DB; conflict check by updatedAt.
- **Acceptance criteria:**
  - [x] Ctrl+Z/Ctrl+Shift+Z work
  - [x] Autosave indicator
  - [x] No data loss on reload

### C-406 — Editor responsive behavior
- **Priority:** P1 · **Estimate:** 3h · **Depends on:** C-402
- **Description:** Mobile: preview + bottom-sheet fields; desktop: 3-panel.
- **Acceptance criteria:**
  - [x] Usable at 375px

## Phase 5 — Images & Media

### C-501 — R2 uploads via presigned URLs
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-003
- **Description:** Upload API, size/type limits, per-plan quotas, assets table.
- **Acceptance criteria:**
  - [x] Uploads > limit rejected
  - [x] Files private until published

### C-502 — Image slot field with react-easy-crop
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-501,C-402
- **Description:** Ratio locked from template.slots; save crop rect; replace/remove.
- **Acceptance criteria:**
  - [x] Crop ratio always matches slot
  - [x] Crop persisted and re-editable

### C-503 — Cloudflare Images delivery + srcset
- **Priority:** P1 · **Estimate:** 3h · **Depends on:** C-502
- **Description:** Variant URLs with crop params; next/image loader.
- **Acceptance criteria:**
  - [x] Images served via CDN with correct size

## Phase 6 — Publish, Share & Export

### C-601 — Publish & public share page
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-402
- **Description:** Slug, public/unlisted, /p/[slug] SSR via Puck <Render>, OG image via Satori.
- **Acceptance criteria:**
  - [x] Public page loads < 2s
  - [x] Unpublish returns 404

### C-602 — Playwright export worker (Fly/Railway)
- **Priority:** P0 · **Estimate:** 8h · **Depends on:** C-601
- **Description:** Queue (pg-boss), render /export/[id] page, PNG long, PDF, Behance 1400px slices; upload to R2.
- **Acceptance criteria:**
  - [x] Exports match editor fonts
  - [x] Job status visible
  - [x] Free: watermark + limits

### C-603 — Export UI & history
- **Priority:** P1 · **Estimate:** 3h · **Depends on:** C-602
- **Description:** Export dialog with presets, progress, download history.
- **Acceptance criteria:**
  - [x] User can re-download past exports

## Phase 7 — Billing & Gating

### C-701 — Paddle Billing integration
- **Priority:** P0 · **Estimate:** 6h · **Depends on:** C-202
- **Description:** Plans Free/Pro/Team (monthly/yearly), Paddle.js checkout, webhooks → subscriptions table.
- **Acceptance criteria:**
  - [ ] Sandbox checkout works
  - [ ] Webhook signature verified
  - [ ] Idempotent handling

### C-702 — Entitlements & gating
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-701,C-305
- **Description:** `can(user, feature)` helper; Pro badge/tag; gate templates, exports, watermark, team seats.
- **Acceptance criteria:**
  - [ ] Server-side checks on every gated API
  - [ ] Upgrade prompts shown

### C-703 — Account & billing pages
- **Priority:** P1 · **Estimate:** 3h · **Depends on:** C-701
- **Description:** Profile, security, plan, invoices, cancel via Paddle customer portal.
- **Acceptance criteria:**
  - [ ] Plan changes reflected after webhook

## Phase 8 — Analytics & Notifications

### C-801 — PostHog product analytics
- **Priority:** P1 · **Estimate:** 3h · **Depends on:** C-201
- **Description:** Events: signup, project_created, template_selected, published, exported, upgrade.
- **Acceptance criteria:**
  - [ ] Events visible in PostHog
  - [ ] No PII in props

### C-802 — Case-study view analytics
- **Priority:** P1 · **Estimate:** 4h · **Depends on:** C-601
- **Description:** Count views/unique visitors/referrers per published project; dashboard chart.
- **Acceptance criteria:**
  - [ ] Bots filtered
  - [ ] Owner sees chart

### C-803 — Notifications (in-app + email)
- **Priority:** P2 · **Estimate:** 4h · **Depends on:** C-201
- **Description:** Export ready, payment issues, team invites, template updates.
- **Acceptance criteria:**
  - [ ] Bell shows unread count
  - [ ] Email via Resend

## Phase 9 — Admin Panel (full)

### C-901 — Admin overview dashboard
- **Priority:** P1 · **Estimate:** 4h · **Depends on:** C-202,C-802
- **Description:** KPIs: users, MRR, publishes, exports, top templates.
- **Acceptance criteria:**
  - [ ] Numbers match DB queries

### C-902 — Admin templates list, filters & detail
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-304
- **Description:** Search, filter by status/type/category/tier, detail with versions & usage.
- **Acceptance criteria:**
  - [ ] Matches Figma Admin Panel 31:6665

### C-903 — Admin categories management
- **Priority:** P2 · **Estimate:** 2h · **Depends on:** C-902
- **Description:** CRUD + ordering.
- **Acceptance criteria:**
  - [ ] Category used in library filters

### C-904 — Admin users & subscriptions
- **Priority:** P1 · **Estimate:** 4h · **Depends on:** C-701
- **Description:** List, search, view, suspend; subscription status (read from Paddle).
- **Acceptance criteria:**
  - [ ] Suspend blocks login

### C-905 — Moderation
- **Priority:** P2 · **Estimate:** 4h · **Depends on:** C-601
- **Description:** Report public case studies, review queue, takedown.
- **Acceptance criteria:**
  - [ ] Takedown makes page 404
  - [ ] Audit log entry

### C-906 — Admin settings, roles & audit log
- **Priority:** P1 · **Estimate:** 3h · **Depends on:** C-202
- **Description:** Role management, feature flags, audit log for admin actions.
- **Acceptance criteria:**
  - [ ] Every admin mutation logged

## Phase 10 — Landing, Help & Polish

### C-1001 — Marketing landing page from Figma 27:6665
- **Priority:** P0 · **Estimate:** 6h · **Depends on:** C-102
- **Description:** Hero, features, templates showcase, pricing, FAQ, footer; SEO metadata.
- **Acceptance criteria:**
  - [ ] Pixel-close to Figma
  - [ ] Lighthouse ≥ 90

### C-1002 — Pricing page & plan comparison
- **Priority:** P1 · **Estimate:** 2h · **Depends on:** C-1001,C-701
- **Description:** Linked to Paddle prices.
- **Acceptance criteria:**
  - [ ] Prices loaded from config

### C-1003 — Help center & docs
- **Priority:** P2 · **Estimate:** 3h · **Depends on:** C-103
- **Description:** MDX articles, search, contact form.
- **Acceptance criteria:**
  - [ ] Articles render, search works

### C-1004 — Dashboard (projects grid, recent, quick create)
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-401
- **Description:** Projects list, duplicate, delete, status badges.
- **Acceptance criteria:**
  - [ ] Empty state matches Figma

## Phase 11 — Hardening & Launch

### C-1101 — Security review
- **Priority:** P0 · **Estimate:** 4h · **Depends on:** C-702
- **Description:** Authz on every route, rate limits, CSP, upload validation, webhook verification.
- **Acceptance criteria:**
  - [ ] Checklist in RULES §Security all ticked

### C-1102 — E2E tests of core journeys
- **Priority:** P0 · **Estimate:** 6h · **Depends on:** C-602,C-702
- **Description:** Signup → create → edit → publish → export → upgrade; admin import.
- **Acceptance criteria:**
  - [ ] Playwright suite green in CI

### C-1103 — Performance, a11y & responsive QA
- **Priority:** P1 · **Estimate:** 4h · **Depends on:** C-1001,C-406
- **Description:** Axe checks, Lighthouse, 375/768/1440 screenshots.
- **Acceptance criteria:**
  - [ ] No critical axe issues

### C-1104 — Production deploy & monitoring
- **Priority:** P0 · **Estimate:** 3h · **Depends on:** C-1101,C-1102
- **Description:** Vercel prod, Fly/Railway worker, Neon prod branch, Sentry, backups.
- **Acceptance criteria:**
  - [ ] Health checks green
  - [ ] Rollback documented
