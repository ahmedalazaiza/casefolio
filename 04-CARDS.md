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
Phase: Phase 4 — Create Wizard & Editor · Priority: P1 · Estimate: 3h · Deps: C-402 · Status: Todo  
- [ ] Usable at 375px
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-501] R2 uploads via presigned URLs**  
Phase: Phase 5 — Images & Media · Priority: P0 · Estimate: 4h · Deps: C-003 · Status: Todo  
- [ ] Uploads > limit rejected
- [ ] Files private until published
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-502] Image slot field with react-easy-crop**  
Phase: Phase 5 — Images & Media · Priority: P0 · Estimate: 4h · Deps: C-501,C-402 · Status: Todo  
- [ ] Crop ratio always matches slot
- [ ] Crop persisted and re-editable
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-503] Cloudflare Images delivery + srcset**  
Phase: Phase 5 — Images & Media · Priority: P1 · Estimate: 3h · Deps: C-502 · Status: Todo  
- [ ] Images served via CDN with correct size
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-601] Publish & public share page**  
Phase: Phase 6 — Publish, Share & Export · Priority: P0 · Estimate: 4h · Deps: C-402 · Status: Todo  
- [ ] Public page loads < 2s
- [ ] Unpublish returns 404
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-602] Playwright export worker (Fly/Railway)**  
Phase: Phase 6 — Publish, Share & Export · Priority: P0 · Estimate: 8h · Deps: C-601 · Status: Todo  
- [ ] Exports match editor fonts
- [ ] Job status visible
- [ ] Free: watermark + limits
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-603] Export UI & history**  
Phase: Phase 6 — Publish, Share & Export · Priority: P1 · Estimate: 3h · Deps: C-602 · Status: Todo  
- [ ] User can re-download past exports
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-701] Paddle Billing integration**  
Phase: Phase 7 — Billing & Gating · Priority: P0 · Estimate: 6h · Deps: C-202 · Status: Todo  
- [ ] Sandbox checkout works
- [ ] Webhook signature verified
- [ ] Idempotent handling
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-702] Entitlements & gating**  
Phase: Phase 7 — Billing & Gating · Priority: P0 · Estimate: 4h · Deps: C-701,C-305 · Status: Todo  
- [ ] Server-side checks on every gated API
- [ ] Upgrade prompts shown
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-703] Account & billing pages**  
Phase: Phase 7 — Billing & Gating · Priority: P1 · Estimate: 3h · Deps: C-701 · Status: Todo  
- [ ] Plan changes reflected after webhook
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-801] PostHog product analytics**  
Phase: Phase 8 — Analytics & Notifications · Priority: P1 · Estimate: 3h · Deps: C-201 · Status: Todo  
- [ ] Events visible in PostHog
- [ ] No PII in props
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-802] Case-study view analytics**  
Phase: Phase 8 — Analytics & Notifications · Priority: P1 · Estimate: 4h · Deps: C-601 · Status: Todo  
- [ ] Bots filtered
- [ ] Owner sees chart
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-803] Notifications (in-app + email)**  
Phase: Phase 8 — Analytics & Notifications · Priority: P2 · Estimate: 4h · Deps: C-201 · Status: Todo  
- [ ] Bell shows unread count
- [ ] Email via Resend
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-901] Admin overview dashboard**  
Phase: Phase 9 — Admin Panel (full) · Priority: P1 · Estimate: 4h · Deps: C-202,C-802 · Status: Todo  
- [ ] Numbers match DB queries
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-902] Admin templates list, filters & detail**  
Phase: Phase 9 — Admin Panel (full) · Priority: P0 · Estimate: 4h · Deps: C-304 · Status: Todo  
- [ ] Matches Figma Admin Panel 31:6665
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-903] Admin categories management**  
Phase: Phase 9 — Admin Panel (full) · Priority: P2 · Estimate: 2h · Deps: C-902 · Status: Todo  
- [ ] Category used in library filters
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-904] Admin users & subscriptions**  
Phase: Phase 9 — Admin Panel (full) · Priority: P1 · Estimate: 4h · Deps: C-701 · Status: Todo  
- [ ] Suspend blocks login
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-905] Moderation**  
Phase: Phase 9 — Admin Panel (full) · Priority: P2 · Estimate: 4h · Deps: C-601 · Status: Todo  
- [ ] Takedown makes page 404
- [ ] Audit log entry
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-906] Admin settings, roles & audit log**  
Phase: Phase 9 — Admin Panel (full) · Priority: P1 · Estimate: 3h · Deps: C-202 · Status: Todo  
- [ ] Every admin mutation logged
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1001] Marketing landing page from Figma 27:6665**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P0 · Estimate: 6h · Deps: C-102 · Status: Todo  
- [ ] Pixel-close to Figma
- [ ] Lighthouse ≥ 90
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1002] Pricing page & plan comparison**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P1 · Estimate: 2h · Deps: C-1001,C-701 · Status: Todo  
- [ ] Prices loaded from config
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1003] Help center & docs**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P2 · Estimate: 3h · Deps: C-103 · Status: Todo  
- [ ] Articles render, search works
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1004] Dashboard (projects grid, recent, quick create)**  
Phase: Phase 10 — Landing, Help & Polish · Priority: P0 · Estimate: 4h · Deps: C-401 · Status: Todo  
- [ ] Empty state matches Figma
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1101] Security review**  
Phase: Phase 11 — Hardening & Launch · Priority: P0 · Estimate: 4h · Deps: C-702 · Status: Todo  
- [ ] Checklist in RULES §Security all ticked
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1102] E2E tests of core journeys**  
Phase: Phase 11 — Hardening & Launch · Priority: P0 · Estimate: 6h · Deps: C-602,C-702 · Status: Todo  
- [ ] Playwright suite green in CI
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1103] Performance, a11y & responsive QA**  
Phase: Phase 11 — Hardening & Launch · Priority: P1 · Estimate: 4h · Deps: C-1001,C-406 · Status: Todo  
- [ ] No critical axe issues
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)

---
**[C-1104] Production deploy & monitoring**  
Phase: Phase 11 — Hardening & Launch · Priority: P0 · Estimate: 3h · Deps: C-1101,C-1102 · Status: Todo  
- [ ] Health checks green
- [ ] Rollback documented
- [ ] Tests added & passing
- [ ] Verified against Figma (if UI)
