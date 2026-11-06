# 02 — RULES (for the Antigravity agent)

> **مقدمة:** هذه قواعد إلزامية للوكيل أثناء البناء: تقنيات مقفلة، الالتزام بنظام التصميم، لا لوحة حرة، رموز التصميم فقط، الأمان، الاختبارات، الالتزامات، متى يجب السؤال، وتعريف "منجز".

## 1. Stack locks
- Use ONLY the stack in `01-MASTER-SHEET.md §4`. Do not add a library, framework, UI kit, ORM, or service without asking.
- GSAP (`gsap` + `@gsap/react`, installed in `apps/web` only) is the ONLY animation library — no Framer Motion or other animation libraries.
- Puck `@puckeditor/core` pinned to `0.24.x`. TypeScript `strict: true`. pnpm only.
- Server Actions/Route Handlers validate every input with zod.

## 2. Design-system fidelity
- Before building any screen, read it from Figma file `4otk3FXD0q1TJ7aPGEIeGO` via Figma MCP (`get_design_context` + `get_screenshot`). Landing = `27:6665`, Admin = `31:6665`, components = page **All in One**.
- Reuse shadcn components restyled with tokens; do not invent new visual styles.
- Compare your result with the Figma screenshot at 1440px and 375px before marking done.

## 3. Tokens only
- No raw hex, px font sizes, or font names in components. Use CSS variables / Tailwind theme generated in `tokens.css` (indigo `#4F46E5`, Geist, JetBrains Mono).
- Template props store **token names** (e.g. `"background": "surface"`), never colors.

## 4. No free canvas
- The editor is fields-only on top of fixed template sections. No drag-to-add components, no absolute positioning, no arbitrary resizing.
- Image slots always crop to the ratio defined in `template.slots`.
- Section add/remove/reorder only if the template version explicitly allows it.
- Template JSON must validate against `packages/template-schema` (mirrors `reference/template.example.json`).

## 5. Security
- Authorization checked server-side on every query/mutation (owner, org role, admin role). Never trust client plan flags.
- Entitlements via single `can(user, feature)` helper.
- Paddle webhooks: verify signature, idempotent by event id.
- Uploads: presigned URLs, MIME + size checks, per-plan quotas, strip EXIF.
- Export render route requires short-lived signed token.
- Rate-limit auth, uploads, exports, tracking. Set CSP and secure headers.
- Never commit secrets; never log tokens or PII.

## 6. Testing
- Unit (Vitest) for schema, entitlements, mappers. E2E (Playwright) for each core journey.
- Each task ships with tests; `pnpm lint && pnpm typecheck && pnpm test` must pass.
- UI checked at 375 / 768 / 1440 widths; axe has no critical issues.

## 7. Commits & branches
- One branch per task: `feat/C-xxx-short-name`. Conventional Commits with task id: `feat(editor): constrained puck editor [C-402]`.
- Small commits; update the task's status in `04-CARDS.md`.

## 8. Ask before
- Adding/removing dependencies or services; changing the DB schema beyond the ERD; changing plan limits or prices.
- Anything touching production data, billing live mode, DNS, or deleting files/branches.
- Deviating from Figma design or when a Figma node is missing/ambiguous.

## 9. Definition of Done
- Acceptance criteria in `03-CHORES.md` all met and shown (screenshot or test output).
- Lint, typecheck, unit and e2e green; no TODOs left without a card.
- Matches Figma; responsive; accessible (keyboard + labels).
- Security rules respected; env vars documented.
- Card moved to Done with a short summary.

## 10. Animation (GSAP)
- Register GSAP plugins (`useGSAP`, `ScrollTrigger`) once on the client in `apps/web/src/lib/animation/gsap.ts`, and consume shared presets (`fadeUp`, `stagger`, `scaleIn`) and named duration/easing/distance constants from there — no magic numbers in components.
- Use the `useGSAP()` hook with explicit `scope` refs in `"use client"` components only; never animate in Server Components.
- Always clean up animations and triggers on unmount (via `useGSAP` context reversion).
- Always respect `prefers-reduced-motion: reduce` (disable or simplify all animations).
- Animate `transform` and `opacity` properties only.
- Never run animations inside the Puck editor canvas (`/editor/[projectId]`) or on export/render pages (`/export/[jobId]`) — exports must remain strictly static.
