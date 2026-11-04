# Casefolio — Antigravity Build Package

> **مقدمة:** هذه الحزمة تحتوي كل ما يحتاجه وكيل Antigravity لبناء Casefolio خطوة بخطوة. ابدأ بقراءة هذا الملف ثم اتبع الترتيب أدناه.

## Order of use
1. **01-MASTER-SHEET.md** — read first: vision, scope, architecture, ERD, routes, folders, env vars.
2. **02-RULES.md** — rules the agent must follow; attach it to the Antigravity workspace (e.g. as an agent rule/knowledge file).
3. **03-CHORES.md** — 48 ordered tasks (C-001 … C-1104) in 12 phases with dependencies and acceptance criteria.
4. **04-CARDS.md / 04-cards.csv** — the same tasks as Kanban cards; import the CSV into Trello, Notion or Linear to track progress.
5. **05-PROMPTS.md** — paste Prompt 00 (kickoff), then one prompt per phase. Do not advance until the phase's VERIFY step passes.
6. **reference/** — `figma-to-puck-prompt.md` (Figma → template JSON converter) and `template.example.json` (Orbit sample used in tests and the admin import).

## Before you start
- Put this folder at the root of a new empty repo and open it in Antigravity.
- Connect **Figma MCP** in Antigravity and make sure file `4otk3FXD0q1TJ7aPGEIeGO` is accessible.
- Create accounts: Neon, Cloudflare (R2 + Images), Paddle (sandbox), Resend, PostHog, Vercel, Fly.io or Railway, Sentry. Fill `.env` from MASTER-SHEET §9.
- Paddle: apply early — seller review takes time.
