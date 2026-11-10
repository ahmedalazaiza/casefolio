# Casefolio — Staging Runbook & Payment Verification

> Scope: **staging only.** `PADDLE_ENV` stays `sandbox`; nothing here touches production. Production go-live is a separate, owner-approved step (see `DEPLOYMENT.md §2.4`).

## 1. Staging environment matrix

| Variable | Staging value | Notes |
|---|---|---|
| `PADDLE_ENV` | `sandbox` | Never `production` on staging. |
| `NEXT_PUBLIC_PADDLE_CLIENT_TOKEN` | `test_…` (sandbox client-side token) | `live_` tokens are rejected for sandbox (`/api/health` → `billingConfigured:false`). |
| `PADDLE_API_KEY` | `pdl_sdbx_apikey_…` | Needed for portal sessions, cancel/resume, seat changes, reconciliation. |
| `PADDLE_WEBHOOK_SECRET` | `pdl_ntfset_…` from the sandbox notification destination | |
| `PADDLE_PRICE_PRO_MONTHLY / _YEARLY`, `PADDLE_PRICE_TEAM_MONTHLY / _YEARLY` | four **distinct** real sandbox `pri_01…` ids | Prices must match `/pricing` (Pro \$12/mo · \$120/yr, Teams per-seat). Unknown price ids are ignored by the webhook — never guessed. |
| `DATABASE_URL` | **its own Neon branch/database** | ⚠️ `vercel.json` runs `db:migrate && db:seed` on every build. Never point staging at the production database. |
| `SEED_ADMIN_EMAIL` | a mailbox you control | Bootstrap superadmin created by `db:seed` (defaults to `admin@casefolio.app`). |
| `CRON_SECRET` | 16+ random chars | Enables `/api/cron/billing-reconcile` (daily, Vercel Cron). Returns 503 until set. |
| `BETTER_AUTH_URL`, `NEXT_PUBLIC_APP_URL` | the staging URL | Preview/branch URLs are auto-trusted via `VERCEL_URL`. |

Paddle **sandbox** dashboard → Developer Tools → Notifications → destination `https://<staging-host>/api/paddle/webhook`, subscribed to:
`subscription.created`, `subscription.activated`, `subscription.updated`, `subscription.resumed`, `subscription.trialing`, `subscription.past_due`, `subscription.paused`, `subscription.canceled`, `transaction.completed`, `transaction.payment_failed`, `transaction.past_due`.
(Other events are safe — they are stored and ignored — but unnecessary.)

## 2. How payment integrity works (what to expect)

1. **Checkout intent.** `POST /api/paddle/checkout` authenticates the user, resolves/creates the Teams org, refuses duplicates, and stores a server-side intent (`billing_operations.kind="checkout"`). Only its random `operationId` is sent to Paddle as `custom_data`.
2. **Webhook.** Signature verified → idempotent by `event_id` → only subscription lifecycle events and settled/failed transactions can change state (`transaction.created/updated/billed…` are ignored) → ownership comes from the intent (never from browser `custom_data`) → the plan comes from the **exact** configured price id → one live subscription per scope.
3. **UI.** After the overlay reports payment, the UI polls `GET /api/paddle/status` and shows the **verified** plan. If the webhook is slow it says so honestly and never asks the customer to pay again.
4. **Safety nets.** Daily reconciliation against the Paddle API; an `active` subscription more than 14 days past its paid-through date stops granting access; duplicate purchases are blocked (and a duplicate that slips through is quarantined and scheduled to cancel).

## 3. Sandbox payment test script (run before every release)

Use a **fresh** user per scenario. Sandbox test card: `4242 4242 4242 4242`, any future expiry, CVC `100`. Declined card: `4000 0000 0000 0002`.

| # | Scenario | Steps | Expected |
|---|---|---|---|
| 1 | Pro monthly | Free user → Upgrade → Pro Monthly → pay | Toast "Payment received — activating…" then "You're on Casefolio Pro"; `/account/billing` shows Pro · Monthly, next renewal date, **one** invoice with the real number/amount, card ending 4242; branding removed on projects. |
| 2 | Pro yearly | Same with Yearly | Pro · Yearly, \$120 invoice, renewal ≈ +1 year. |
| 3 | Teams (N seats) | Choose Teams, 5 seats → pay | Org created before payment; org plan Team with 5 paid seats; **personal** plan stays Free; owner can invite up to 5. |
| 4 | Already subscribed | Pro user opens Upgrade → Pro again | Blocked with 409 + "Go to Billing"; no second charge. Second tab opened before paying → second payment is quarantined (see Sentry alert) and its subscription scheduled to cancel. |
| 5 | Declined card | Use `4000 0000 0000 0002` | Error toast, still Free, no subscription row. Retry with 4242 in the same overlay → Pro. |
| 6 | Abandon checkout | Open overlay, close it | Still Free; no subscription row (draft/ready transactions are ignored). |
| 7 | Cancel at period end | Billing → Cancel → confirm | Status "cancel_at_period_end", keeps Pro until the period end; Resume works. |
| 8 | Period end / cancel webhook | Sandbox: simulate `subscription.canceled` | Drops to Free; publications follow the Free rules (select one to keep). |
| 9 | Payment failure on renewal | Sandbox: make a renewal fail | `past_due` banner, 7-day grace keeps access, then read-only; recovered by a successful retry. |
| 10 | Seat increase / decrease (Teams) | Billing → Seats | Increase is prorated and immediate; decrease takes effect at renewal; locked while past-due/within 30 min of renewal. |
| 11 | Webhook replay | Resend a delivered event from Paddle | `deduplicated:true`, no state change. |

Verify after each: `/api/health` → `environment.billingConfigured:true` (once real sandbox ids/keys are set), and Paddle dashboard subscription id equals the one in the app.

## 4. Local verification (no Paddle account needed)

`PADDLE_ENV=sandbox` with placeholder ids runs the **signed local simulator** (same webhook pipeline, same intent flow): `pnpm test` covers the matrix in `apps/web/src/lib/billing/*.test.ts`; `pnpm test:e2e` covers the UI flows.

## 5. Rollback

Vercel → Deployments → promote the previous staging deployment. Schema changes are additive (expand-only); no rollback migration needed. If billing misbehaves, pause the Paddle notification destination — the daily reconciliation will converge state once re-enabled.

## 6. Owner-only checklist before production go-live

- [ ] Real **live** Paddle prices created and matching `/pricing`; KYC/MoR sign-off.
- [ ] Production notification destination registered with the event list in §1.
- [ ] `PADDLE_ENV=production`, `live_` token, `pdl_live_` API key, four live `pri_01…` ids → `/api/health` shows `billingConfigured:true` (production refuses to take payment otherwise: `BILLING_NOT_CONFIGURED`).
- [ ] Production DB is separate from staging; `SEED_ADMIN_EMAIL` set to a real mailbox.
- [ ] `CRON_SECRET` set; first cron run observed in Vercel logs.
- [ ] Resend sending domain verified (auth emails).
- [ ] Sentry DSN real (billing alerts are reported as Sentry events: forged identity, duplicate purchase, unknown price).

