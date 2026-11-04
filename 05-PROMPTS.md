# 05 — PROMPTS (copy-paste into Antigravity, in order)
> **مقدمة:** أوامر جاهزة للنسخ واللصق في Antigravity بالترتيب، أمر لكل مرحلة، مع خطوة تحقق في نهاية كل أمر. لا تنتقل للمرحلة التالية قبل نجاح التحقق.

## Prompt 00 — Kickoff (paste once)
```
You are building Casefolio. Read these files fully before writing code: 01-MASTER-SHEET.md, 02-RULES.md, 03-CHORES.md, 04-CARDS.md, reference/figma-to-puck-prompt.md, reference/template.example.json.
Confirm Figma MCP access by calling get_metadata on file 4otk3FXD0q1TJ7aPGEIeGO (pages: All in One, Landing Page 27:6665, Admin Panel 31:6665).
Reply with: (1) a 10-line summary of the product and stack, (2) any conflicts or questions, (3) your plan for Phase 0. Do not write code yet.
```

## Prompt 01 — Phase 0: Foundation
```
Follow 02-RULES.md strictly. Execute tasks C-001 → C-005 from 03-CHORES.md in order, respecting dependencies.
Goal: Scaffold the monorepo, Tailwind+shadcn, Drizzle schema from the ERD with seed, env validation, CI.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: `pnpm db:migrate && pnpm db:seed && pnpm lint && pnpm typecheck && pnpm test` all pass; show table list.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 02 — Phase 1: Design System & Shell
```
Follow 02-RULES.md strictly. Execute tasks C-101 → C-103 from 03-CHORES.md in order, respecting dependencies.
Goal: Use Figma MCP on file `4otk3FXD0q1TJ7aPGEIeGO` (page All in One): get_variable_defs → generate `tokens.css` and Tailwind theme; map components to shadcn variants; build app/admin/marketing shells.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Open `/dev/ui`; screenshot at 1440 and 375 next to Figma screenshots; grep shows no raw hex in `components/`.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 03 — Phase 2: Auth & Onboarding
```
Follow 02-RULES.md strictly. Execute tasks C-201 → C-203 from 03-CHORES.md in order, respecting dependencies.
Goal: Better Auth (email/password, Google, magic link), roles + organizations, onboarding flow.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: E2E: sign up → verify → onboarding → dashboard; non-admin gets 403 on `/admin`.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 04 — Phase 3: Templates & Admin Import
```
Follow 02-RULES.md strictly. Execute tasks C-301 → C-305 from 03-CHORES.md in order, respecting dependencies.
Goal: Build the zod template schema from `reference/template.example.json`, Puck section components, admin upload wizard, versions publish/archive, user template library with filters and Pro badge.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Upload `reference/template.example.json` through the wizard, publish it, see Orbit in the library rendered correctly.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 05 — Phase 4: Create Wizard & Editor
```
Follow 02-RULES.md strictly. Execute tasks C-401 → C-406 from 03-CHORES.md in order, respecting dependencies.
Goal: Create-project wizard and the constrained Puck editor (fields-only), TipTap field, theme panel, Zustand+zundo undo/autosave, responsive editor.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: E2E: create Mobile project from Orbit, edit text/colors, undo/redo, reload keeps changes; confirm no way to add free components.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 06 — Phase 5: Images & Media
```
Follow 02-RULES.md strictly. Execute tasks C-501 → C-503 from 03-CHORES.md in order, respecting dependencies.
Goal: R2 presigned uploads with quotas, ImageSlotField with react-easy-crop locked to slot ratio, Cloudflare Images delivery.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Upload an image into `hero.mockup`; crop is 9:19.5; served from CDN URL.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 07 — Phase 6: Publish, Share & Export
```
Follow 02-RULES.md strictly. Execute tasks C-601 → C-603 from 03-CHORES.md in order, respecting dependencies.
Goal: Publish/unpublish with `/p/[slug]`, OG via Satori, Playwright worker with pg-boss queue for PNG long/PDF/Behance, export UI.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Publish Orbit project, open public link logged out, export PNG + PDF; fonts match editor.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 08 — Phase 7: Billing & Gating
```
Follow 02-RULES.md strictly. Execute tasks C-701 → C-703 from 03-CHORES.md in order, respecting dependencies.
Goal: Paddle Billing (sandbox) with Free/Pro/Team, webhooks, `can()` entitlements, Pro badge gating, account/billing pages.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Sandbox checkout upgrades user to Pro; Pro template unlocks; watermark removed; webhook replay is idempotent.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 09 — Phase 8: Analytics & Notifications
```
Follow 02-RULES.md strictly. Execute tasks C-801 → C-803 from 03-CHORES.md in order, respecting dependencies.
Goal: PostHog events, own page_views analytics with chart, in-app + email notifications.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Visit public page 3 times → owner chart updates; PostHog shows events; export-ready notification arrives.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 10 — Phase 9: Admin Panel
```
Follow 02-RULES.md strictly. Execute tasks C-901 → C-906 from 03-CHORES.md in order, respecting dependencies.
Goal: Build admin per Figma node `31:6665`: overview, templates list/detail, categories, users & subscriptions, moderation, settings/roles + audit log.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Screenshot each admin page vs Figma; every admin mutation appears in audit log.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 11 — Phase 10: Landing, Help & Dashboard
```
Follow 02-RULES.md strictly. Execute tasks C-1001 → C-1004 from 03-CHORES.md in order, respecting dependencies.
Goal: Landing page per Figma `27:6665`, pricing, help center, dashboard.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: Lighthouse ≥ 90 on `/`; side-by-side with Figma at 1440/375.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 12 — Phase 11: Hardening & Launch
```
Follow 02-RULES.md strictly. Execute tasks C-1101 → C-1104 from 03-CHORES.md in order, respecting dependencies.
Goal: Security review, full E2E suite, perf/a11y QA, production deploy with monitoring.
For each task: create branch feat/<id>-<name>, implement, add tests, run `pnpm lint && pnpm typecheck && pnpm test`, commit with the task id, set the card status in 04-CARDS.md.
Ask me before anything listed in 02-RULES.md §8.
VERIFY at the end: CI green; security checklist ticked; prod health checks green; ask before switching Paddle to live.
Report: tasks done, evidence (test output/screenshots), open issues. Stop and wait for my OK before the next phase.
```

## Prompt 13 — Add a new template (repeatable)
```
Using reference/figma-to-puck-prompt.md (English section), convert Figma frame <NODE_ID> in file <FILE_KEY> into template JSON. Validate it against packages/template-schema, fix any warnings, then import it through /admin/templates/new as a draft. VERIFY: preview renders, all slots have ratios, no raw colors in props.
```
