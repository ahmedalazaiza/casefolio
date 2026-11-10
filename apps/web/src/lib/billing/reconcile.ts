import { and, asc, desc, eq, inArray, isNotNull, lt, notLike } from "@casefolio/db";
import { env } from "@/env";
import { getPaddleApiBaseUrl, isRealPaddleApiKeyConfigured } from "@/lib/billing/server-config";
import { processValidatedPaddleWebhook } from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";

export type ReconcileOutcome =
  | { status: "synced"; paddleStatus: string }
  | { status: "skipped"; reason: "paddle_not_configured" | "simulated_subscription" | "no_subscription_id" }
  | { status: "error"; reason: string };

/**
 * Pulls the authoritative subscription state from Paddle and replays it through the exact same
 * pipeline as a webhook (`subscription.updated`). It repairs missed / dropped notifications: a
 * lost `subscription.canceled` would otherwise leave a customer on a paid plan forever, and a lost
 * `subscription.updated` could leave a paying customer on stale seat counts.
 *
 * The synthetic event id is hour-bucketed, so concurrent callers collapse to one application.
 */
export async function reconcileSubscriptionWithPaddle(
  paddleSubscriptionId: string | null | undefined,
  now: Date = new Date(),
  fetchImpl: typeof fetch = fetch,
): Promise<ReconcileOutcome> {
  if (!paddleSubscriptionId) return { status: "skipped", reason: "no_subscription_id" };
  if (paddleSubscriptionId.startsWith("sub_sdbx_")) {
    return { status: "skipped", reason: "simulated_subscription" };
  }
  if (!isRealPaddleApiKeyConfigured()) return { status: "skipped", reason: "paddle_not_configured" };

  let response: Response;
  try {
    response = await fetchImpl(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(paddleSubscriptionId)}`,
      {
        headers: { Authorization: `Bearer ${env.PADDLE_API_KEY}` },
        signal: AbortSignal.timeout(8_000),
      },
    );
  } catch {
    return { status: "error", reason: "paddle_unreachable" };
  }

  if (!response.ok) return { status: "error", reason: `paddle_http_${response.status}` };

  const json = (await response.json().catch(() => null)) as { data?: Record<string, unknown> } | null;
  const data = json?.data;
  if (!data || typeof data !== "object") return { status: "error", reason: "paddle_invalid_payload" };

  const paddleStatus = typeof data.status === "string" ? data.status : "unknown";
  const hourBucket = Math.floor(now.getTime() / 3_600_000);

  await processValidatedPaddleWebhook(
    {
      event_id: `reconcile_${paddleSubscriptionId}_${hourBucket}`,
      event_type: paddleStatus === "canceled" ? "subscription.canceled" : "subscription.updated",
      occurred_at: now.toISOString(),
      data,
    },
    now,
  );

  return { status: "synced", paddleStatus };
}

/** Live subscriptions whose paid-through date has passed without Paddle telling us what happened. */
export async function reconcileStaleSubscriptions(
  now: Date = new Date(),
  options: { limit?: number; staleAfterHours?: number } = {},
): Promise<{ checked: number; synced: number; errors: number }> {
  const staleBefore = new Date(now.getTime() - (options.staleAfterHours ?? 24) * 3_600_000);

  const candidates = await db
    .select({ paddleSubscriptionId: dbSchema.subscriptions.paddleSubscriptionId })
    .from(dbSchema.subscriptions)
    .where(
      and(
        isNotNull(dbSchema.subscriptions.paddleSubscriptionId),
        notLike(dbSchema.subscriptions.paddleSubscriptionId, "sub_sdbx_%"),
        inArray(dbSchema.subscriptions.status, ["active", "trialing", "past_due", "cancel_at_period_end"]),
        lt(dbSchema.subscriptions.currentPeriodEnd, staleBefore),
      ),
    )
    .orderBy(asc(dbSchema.subscriptions.currentPeriodEnd), desc(dbSchema.subscriptions.updatedAt))
    .limit(options.limit ?? 50);

  let synced = 0;
  let errors = 0;
  for (const candidate of candidates) {
    const outcome = await reconcileSubscriptionWithPaddle(candidate.paddleSubscriptionId, now);
    if (outcome.status === "synced") synced += 1;
    if (outcome.status === "error") errors += 1;
  }

  return { checked: candidates.length, synced, errors };
}

export async function getSubscriptionPaddleId(subscriptionId: string): Promise<string | null> {
  const [row] = await db
    .select({ id: dbSchema.subscriptions.paddleSubscriptionId })
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.id, subscriptionId))
    .limit(1);
  return row?.id ?? null;
}
