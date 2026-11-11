import { randomUUID } from "node:crypto";
import {
  and,
  count,
  desc,
  eq,
  gt,
  inArray,
  isNull,
  ne,
  normalizeMembershipRole,
  or,
  sql,
  type PlanTier,
} from "@casefolio/db";
import { env } from "@/env";
import {
  BILLING_PLAN_CATALOG,
  cancelSubscriptionInputSchema,
  checkoutRequestSchema,
  computeTeamsPrice,
  evaluateSubscriptionLifecycle,
  getChargeAmountCents,
  getChargeAmountUsd,
  isSubscriptionLockedForQuantityChange,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  type BillingInterval,
  type PaidPlanTier,
} from "@/lib/billing/plans";
import {
  getBillingConfigStatus,
  getPaddleApiBaseUrl,
  isPaddleOverlayLiveReady,
  isRealPaddleApiKeyConfigured,
  resolveServerPaddlePriceId,
} from "@/lib/billing/server-config";
import { buildBillingInvoices, type BillingInvoiceItem } from "@/lib/billing/invoices";
import { signPaddleWebhookPayload } from "@/lib/billing/signature";
import {
  applyPersonalDowngradePublicationRules,
  handleSignedPaddleWebhookRequest,
} from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
} from "@/lib/entitlements/server";
import { consumeUploadRateLimit } from "@/lib/storage/rate-limit";

export interface BillingActor {
  id: string;
  email: string;
  name?: string | null;
}

export interface PreparedCheckoutSession {
  mode: "paddle" | "sandbox_simulated";
  environment: "sandbox" | "production";
  clientToken: string;
  priceId: string;
  plan: PaidPlanTier;
  interval: BillingInterval;
  seats: number;
  amountCents: number;
  amountUsd: number;
  customerEmail: string;
  /**
   * Organization the purchase will belong to (Teams only). Resolved server-side; never trusted
   * from the browser when the webhook arrives.
   */
  orgId: string | null;
  /**
   * What the browser forwards to Paddle as `custom_data`. It deliberately carries NO identity:
   * `operationId` points at a server-created checkout intent that binds the purchase to the
   * authenticated user/org when the webhook arrives.
   */
  customData: {
    operationId: string;
    plan: PaidPlanTier;
    interval: BillingInterval;
    seats: number;
  };
}

export type PrepareCheckoutResult =
  | {
      ok: true;
      session: PreparedCheckoutSession;
    }
  | {
      ok: false;
      code:
        | "VALIDATION_ERROR"
        | "CAPACITY_REVIEW_REQUIRED"
        | "FORBIDDEN"
        | "RATE_LIMITED"
        | "ALREADY_SUBSCRIBED"
        | "BILLING_NOT_CONFIGURED";
      error: string;
    };

export type { BillingInvoiceItem };

export interface UserSubscriptionSummary {
  id: string;
  paddleCustomerId: string | null;
  paddleSubscriptionId: string | null;
  plan: PlanTier;
  interval: BillingInterval;
  status: string;
  currentPeriodEndIso: string | null;
  pastDueSinceIso?: string | null;
  /** `null` when Paddle has not reported a card (manage it in the Paddle portal). Never invented. */
  paymentBrand: string | null;
  paymentLast4: string | null;
  paymentExpiry: string | null;
}

export interface TeamBillingSeatOverview {
  organizationId: string;
  organizationName: string;
  workspaceId: string;
  role: "owner" | "admin" | "member";
  isOwner: boolean;
  plan: PlanTier;
  status: string;
  interval: BillingInterval;
  paidSeats: number;
  activeMembers: number;
  reservedInvites: number;
  occupiedSeats: number;
  availableSeats: number;
  renewalSeats: number | null;
  currentPeriodEndIso: string | null;
  pastDueSinceIso: string | null;
  isLockedForQuantityChange: boolean;
  lockReason: string | null;
}

export interface PersonalPublicProjectChoice {
  id: string;
  name: string;
  slug: string | null;
}

export interface UserBillingOverview {
  effectivePlan: PlanTier;
  environment: "sandbox" | "production";
  hasLivePaddlePortal: boolean;
  subscription: UserSubscriptionSummary | null;
  invoices: BillingInvoiceItem[];
  teamBilling?: TeamBillingSeatOverview | null;
  keepPublicProjectId?: string | null;
  personalPublishedProjects?: PersonalPublicProjectChoice[];
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

async function resolveOrCreateOwnedTeamOrgId(actor: BillingActor): Promise<string> {
  const [existingOwned] = await db
    .select({ orgId: dbSchema.memberships.orgId })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.userId, actor.id),
        eq(dbSchema.memberships.role, "owner"),
      ),
    )
    .limit(1);

  if (existingOwned?.orgId) {
    await ensureTeamWorkspaceForOrganization(existingOwned.orgId, actor.id);
    return existingOwned.orgId;
  }

  const cleanLabel = (actor.name?.trim() || actor.email.split("@")[0] || "Studio").slice(0, 40);
  const slugBase = cleanLabel
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "") || "team";
  const orgSlug = `${slugBase}-${randomUUID().slice(0, 6)}`;

  const [createdOrg] = await db
    .insert(dbSchema.organizations)
    .values({
      name: `${cleanLabel} Team`,
      slug: orgSlug,
      seats: 1,
    })
    .returning({ id: dbSchema.organizations.id });

  await db.insert(dbSchema.memberships).values({
    userId: actor.id,
    orgId: createdOrg!.id,
    role: "owner",
  });

  await ensureTeamWorkspaceForOrganization(createdOrg!.id, actor.id);
  return createdOrg!.id;
}

export async function prepareCheckoutSessionForUser(
  actor: BillingActor,
  rawInput: unknown,
): Promise<PrepareCheckoutResult> {
  const rate = consumeUploadRateLimit(`billing-checkout:${actor.id}`, 20, 60_000);
  if (!rate.allowed) {
    return {
      ok: false,
      code: "RATE_LIMITED",
      error: `Too many billing requests. Please retry in ${rate.retryAfterSeconds}s.`,
    };
  }

  const rawObj = asRecord(rawInput);
  if (
    rawObj?.plan === "team" &&
    typeof rawObj.seats === "number" &&
    Number.isInteger(rawObj.seats) &&
    rawObj.seats > TEAMS_MAX_SELF_SERVE_SEATS
  ) {
    return {
      ok: false,
      code: "CAPACITY_REVIEW_REQUIRED",
      error: `Self-service Teams supports ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} paid seats. Above ${TEAMS_MAX_SELF_SERVE_SEATS} seats requires capacity review.`,
    };
  }

  const parsed = checkoutRequestSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: parsed.error.issues[0]?.message ?? "Invalid plan selection.",
    };
  }

  const valid = parsed.data;
  let orgId = valid.orgId ?? null;

  if (valid.plan === "pro" && orgId) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Casefolio Pro covers one personal workspace only. Choose Teams for an organization.",
    };
  }

  if (orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);

    if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
      return {
        ok: false,
        code: "FORBIDDEN",
        error: "Only the workspace Owner can purchase or modify team billing.",
      };
    }
  } else if (valid.plan === "team") {
    const [owned] = await db
      .select({ orgId: dbSchema.memberships.orgId })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.userId, actor.id),
          eq(dbSchema.memberships.role, "owner"),
        ),
      )
      .limit(1);
    orgId = owned?.orgId ?? null;
  }

  const seats =
    valid.plan === "team"
      ? (valid.seats ?? TEAMS_CALCULATOR_DEFAULT_SEATS)
      : 1;

  if (valid.plan === "team") {
    const calc = computeTeamsPrice(seats, valid.interval);
    if (!calc.ok) {
      return {
        ok: false,
        code: calc.code === "CAPACITY_REVIEW_REQUIRED" ? "CAPACITY_REVIEW_REQUIRED" : "VALIDATION_ERROR",
        error: calc.message,
      };
    }
  }

  const priceId = resolveServerPaddlePriceId(valid.plan, valid.interval);
  const overlayReady = isPaddleOverlayLiveReady(priceId);

  // Production must never silently fall back to the local simulator: fail loudly instead.
  if (env.PADDLE_ENV === "production") {
    const config = getBillingConfigStatus();
    if (!config.productionReady || !overlayReady) {
      return {
        ok: false,
        code: "BILLING_NOT_CONFIGURED",
        error:
          "Billing is temporarily unavailable. Please contact support — you have not been charged.",
      };
    }
  }

  // Teams always belong to an organization: resolve/create it BEFORE payment so the purchase can
  // never degrade into a personal "team" plan.
  if (valid.plan === "team" && !orgId) {
    orgId = await resolveOrCreateOwnedTeamOrgId(actor);
  }

  // One live subscription per scope (personal workspace / organization). A second checkout would
  // create a second Paddle subscription that we could no longer manage while it kept billing.
  const [existingScopeSub] = await db
    .select({
      status: dbSchema.subscriptions.status,
      paddleSubscriptionId: dbSchema.subscriptions.paddleSubscriptionId,
      scheduledChangeAction: dbSchema.subscriptions.scheduledChangeAction,
    })
    .from(dbSchema.subscriptions)
    .where(
      orgId
        ? eq(dbSchema.subscriptions.orgId, orgId)
        : and(
            eq(dbSchema.subscriptions.userId, actor.id),
            isNull(dbSchema.subscriptions.orgId),
          ),
    )
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (
    existingScopeSub?.paddleSubscriptionId &&
    ["active", "trialing", "past_due", "paused", "cancel_at_period_end"].includes(
      existingScopeSub.status,
    )
  ) {
    const scheduledToEnd =
      existingScopeSub.status === "cancel_at_period_end" ||
      existingScopeSub.scheduledChangeAction === "cancel";
    return {
      ok: false,
      code: "ALREADY_SUBSCRIBED",
      error: scheduledToEnd
        ? "This subscription is scheduled to end. Resume it from Billing instead of buying again."
        : existingScopeSub.status === "past_due"
          ? "Your last payment failed. Update your payment method in Billing instead of buying again."
          : "You already have an active subscription. Manage or change it from Billing — you have not been charged.",
    };
  }

  const amountCents = getChargeAmountCents(valid.plan, valid.interval, seats);
  const amountUsd = getChargeAmountUsd(valid.plan, valid.interval, seats);
  const mode = overlayReady ? "paddle" : "sandbox_simulated";

  // Server-side checkout intent: the ONLY thing that ties a brand-new Paddle subscription to a
  // Casefolio user/organization when the webhook arrives (custom_data identity is browser-controlled).
  const operationId = randomUUID();
  await db.insert(dbSchema.billingOperations).values({
    id: operationId,
    actorUserId: actor.id,
    kind: "checkout",
    status: "pending",
    targetQuantity: seats,
    previewAmountCents: amountCents,
    idempotencyKey: `checkout:${actor.id}:${operationId}`,
    meta: {
      plan: valid.plan,
      interval: valid.interval,
      seats,
      orgId,
      priceId,
      mode,
    },
  });

  return {
    ok: true,
    session: {
      mode,
      environment: env.PADDLE_ENV,
      clientToken: env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN,
      priceId,
      plan: valid.plan,
      interval: valid.interval,
      seats,
      amountCents,
      amountUsd,
      customerEmail: actor.email,
      orgId,
      customData: {
        operationId,
        plan: valid.plan,
        interval: valid.interval,
        seats,
      },
    },
  };
}

async function recoverSimulatedPastDueSubscription(
  actor: BillingActor,
  rawInput: unknown,
  nowOverride?: Date,
): Promise<
  | {
      ok: true;
      eventId: string;
      effectivePlan: PlanTier;
      subscriptionId: string | null;
      orgId: string | null;
      seats: number;
    }
  | {
      ok: false;
      code: "WEBHOOK_FAILED";
      error: string;
    }
  | null
> {
  const parsed = checkoutRequestSchema.safeParse(rawInput);
  if (!parsed.success) return null;
  const valid = parsed.data;

  let orgId = valid.orgId ?? null;
  if (valid.plan === "team" && !orgId) {
    const [owned] = await db
      .select({ orgId: dbSchema.memberships.orgId })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.userId, actor.id),
          eq(dbSchema.memberships.role, "owner"),
        ),
      )
      .limit(1);
    orgId = owned?.orgId ?? null;
  }
  if (valid.plan === "pro" && orgId) return null;

  if (orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(eq(dbSchema.memberships.orgId, orgId), eq(dbSchema.memberships.userId, actor.id)),
      )
      .limit(1);
    if (!membership || normalizeMembershipRole(membership.role) !== "owner") return null;
  }

  const [sub] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(
      orgId
        ? eq(dbSchema.subscriptions.orgId, orgId)
        : and(
            eq(dbSchema.subscriptions.userId, actor.id),
            isNull(dbSchema.subscriptions.orgId),
          ),
    )
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (
    !sub ||
    sub.status !== "past_due" ||
    !sub.paddleSubscriptionId?.startsWith("sub_sdbx_")
  ) {
    return null;
  }

  const now = nowOverride ?? new Date();
  const periodDays = sub.interval === "yearly" ? 365 : 30;
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);
  const eventId = `evt_sdbx_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const priceId = resolveServerPaddlePriceId(
    sub.orgId ? "team" : "pro",
    sub.interval,
  );

  const rawBody = JSON.stringify({
    event_id: eventId,
    event_type: "subscription.updated",
    occurred_at: now.toISOString(),
    data: {
      id: sub.paddleSubscriptionId,
      customer_id: sub.paddleCustomerId,
      status: "active",
      current_billing_period: { starts_at: now.toISOString(), ends_at: periodEnd.toISOString() },
      next_billed_at: periodEnd.toISOString(),
      scheduled_change: null,
      items: [
        {
          quantity: sub.currentPaidCapacity,
          price: {
            id: priceId,
            billing_cycle: { interval: sub.interval === "yearly" ? "year" : "month", frequency: 1 },
          },
        },
      ],
    },
  });

  const result = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader: signPaddleWebhookPayload(
      rawBody,
      env.PADDLE_WEBHOOK_SECRET,
      Math.floor(now.getTime() / 1000),
    ),
    now,
  });

  if (!result.ok) {
    return { ok: false, code: "WEBHOOK_FAILED", error: result.error };
  }

  return {
    ok: true,
    eventId: result.eventId,
    effectivePlan: result.effectivePlan ?? sub.plan,
    subscriptionId: result.subscriptionId,
    orgId: sub.orgId,
    seats: sub.currentPaidCapacity,
  };
}

export async function completeSandboxCheckoutForUser(
  actor: BillingActor,
  rawInput: unknown,
  options?: {
    simulatePaymentFailure?: boolean;
    now?: Date;
  },
): Promise<
  | {
      ok: true;
      eventId: string;
      effectivePlan: PlanTier;
      subscriptionId: string | null;
      orgId: string | null;
      seats: number;
    }
  | {
      ok: false;
      code:
        | "SANDBOX_ONLY"
        | "VALIDATION_ERROR"
        | "CAPACITY_REVIEW_REQUIRED"
        | "FORBIDDEN"
        | "RATE_LIMITED"
        | "ALREADY_SUBSCRIBED"
        | "BILLING_NOT_CONFIGURED"
        | "WEBHOOK_FAILED";
      error: string;
    }
> {
  if (env.PADDLE_ENV !== "sandbox" || isRealPaddleApiKeyConfigured()) {
    return {
      ok: false,
      code: "SANDBOX_ONLY",
      error: "Simulated sandbox checkout is strictly disabled when live Paddle credentials or production mode are active.",
    };
  }

  // Sandbox "update payment method": re-running checkout on a simulated subscription that is
  // `past_due` simulates a successful retry of the payment instead of buying a second subscription.
  const recovery = await recoverSimulatedPastDueSubscription(actor, rawInput, options?.now);
  if (recovery) return recovery;

  const prepared = await prepareCheckoutSessionForUser(actor, rawInput);
  if (!prepared.ok) {
    return prepared;
  }

  if (prepared.session.mode === "paddle") {
    return {
      ok: false,
      code: "SANDBOX_ONLY",
      error: "Simulated sandbox checkout is disabled when Paddle Checkout overlay is configured.",
    };
  }

  const { session } = prepared;
  const now = options?.now ?? new Date();
  const periodDays = session.interval === "yearly" ? 365 : 30;
  const periodEnd = new Date(now.getTime() + periodDays * 24 * 60 * 60 * 1000);

  const targetOrgId = session.orgId;

  let existingSub: typeof dbSchema.subscriptions.$inferSelect | undefined;
  if (session.plan === "team" && targetOrgId) {
    await ensureTeamWorkspaceForOrganization(targetOrgId, actor.id);
    const [byOrg] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, targetOrgId))
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    existingSub = byOrg;
  } else {
    await ensurePersonalWorkspaceForUser(actor.id);
    const [byUser] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(
        and(
          eq(dbSchema.subscriptions.userId, actor.id),
          isNull(dbSchema.subscriptions.orgId),
        ),
      )
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    existingSub = byUser;
  }

  const shortScope = (targetOrgId ?? actor.id).replace(/-/g, "").slice(0, 12);
  const paddleCustomerId =
    existingSub?.paddleCustomerId ?? `ctm_sdbx_${shortScope}`;
  // A purchase always creates a NEW Paddle subscription (a live one would have been refused by
  // `prepareCheckoutSessionForUser`), so the simulator exercises the same checkout-intent path as Paddle.
  const paddleSubscriptionId = `sub_sdbx_${randomUUID().replace(/-/g, "").slice(0, 20)}`;

  const eventId = `evt_sdbx_${randomUUID().replace(/-/g, "").slice(0, 24)}`;
  const invoiceNumber = `INV-${now.getUTCFullYear()}-${randomUUID().slice(0, 6).toUpperCase()}`;

  const simulateFailure = Boolean(options?.simulatePaymentFailure);

  const webhookPayload = {
    event_id: eventId,
    event_type: simulateFailure ? "transaction.payment_failed" : "subscription.activated",
    occurred_at: now.toISOString(),
    data: {
      id: paddleSubscriptionId,
      customer_id: paddleCustomerId,
      status: simulateFailure ? "past_due" : "active",
      current_billing_period: {
        starts_at: now.toISOString(),
        ends_at: periodEnd.toISOString(),
      },
      next_billed_at: periodEnd.toISOString(),
      scheduled_change: null,
      items: [
        {
          quantity: session.seats,
          price: {
            id: session.priceId,
            billing_cycle: {
              interval: session.interval === "yearly" ? "year" : "month",
              frequency: 1,
            },
          },
        },
      ],
      custom_data: {
        operationId: session.customData.operationId,
        plan: session.plan,
        interval: session.interval,
        seats: session.seats,
        amountUsd: session.amountUsd,
        invoiceNumber,
        paymentMethod: {
          brand: "VISA",
          last4: "4242",
          expiry: "08/29",
        },
      },
    },
  };

  const rawBody = JSON.stringify(webhookPayload);
  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const result = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!result.ok) {
    return {
      ok: false,
      code: "WEBHOOK_FAILED",
      error: result.error,
    };
  }

  return {
    ok: true,
    eventId: result.eventId,
    effectivePlan: result.effectivePlan ?? (simulateFailure ? "free" : session.plan),
    subscriptionId: result.subscriptionId,
    orgId: targetOrgId,
    seats: session.seats,
  };
}

export async function getTeamBillingSeatOverviewForUser(
  userId: string,
  preferredOrgId?: string | null,
  now: Date = new Date(),
): Promise<TeamBillingSeatOverview | null> {
  const membershipsRows = await db
    .select({
      membership: dbSchema.memberships,
      org: dbSchema.organizations,
    })
    .from(dbSchema.memberships)
    .innerJoin(
      dbSchema.organizations,
      eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
    )
    .where(eq(dbSchema.memberships.userId, userId));

  if (membershipsRows.length === 0) {
    return null;
  }

  const chosen =
    (preferredOrgId
      ? membershipsRows.find((r) => r.org.id === preferredOrgId)
      : undefined) ??
    membershipsRows.find((r) => normalizeMembershipRole(r.membership.role) === "owner") ??
    membershipsRows[0]!;

  const role = normalizeMembershipRole(chosen.membership.role);
  const ensured = await ensureTeamWorkspaceForOrganization(chosen.org.id, userId);

  const [[subRow], [memberCountRow], [reservedCountRow]] = await Promise.all([
    db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, chosen.org.id))
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1),
    db
      .select({ total: count() })
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, chosen.org.id)),
    db
      .select({ total: count() })
      .from(dbSchema.seatReservations)
      .where(
        and(
          eq(dbSchema.seatReservations.organizationId, chosen.org.id),
          eq(dbSchema.seatReservations.status, "active"),
          gt(dbSchema.seatReservations.expiresAt, now),
        ),
      ),
  ]);

  const activeMembers = Number(memberCountRow?.total ?? 0);
  const reservedInvites = Number(reservedCountRow?.total ?? 0);
  const occupiedSeats = activeMembers + reservedInvites;

  const lifecycle = subRow
    ? evaluateSubscriptionLifecycle({
        status: subRow.status,
        currentPeriodEnd: subRow.currentPeriodEnd,
        pastDueSince: subRow.pastDueSince,
        now,
      })
    : null;

  const isTeamActive = Boolean(subRow && subRow.plan === "team" && lifecycle?.grantsPaidAccess);
  const paidSeats = isTeamActive ? Math.max(1, subRow!.currentPaidCapacity) : 0;
  const renewalSeats = isTeamActive ? (subRow!.renewalQuantity ?? null) : null;
  const effectiveCeiling =
    renewalSeats !== null ? Math.min(paidSeats, renewalSeats) : paidSeats;
  const availableSeats = Math.max(0, effectiveCeiling - occupiedSeats);

  const lockCheck = subRow
    ? isSubscriptionLockedForQuantityChange({
        status: subRow.status,
        scheduledChangeAction: subRow.scheduledChangeAction,
        currentPeriodEnd: subRow.currentPeriodEnd,
        now,
      })
    : { locked: false as const, reason: null };

  return {
    organizationId: chosen.org.id,
    organizationName: chosen.org.name,
    workspaceId: ensured.workspaceId,
    role,
    isOwner: role === "owner",
    plan: isTeamActive ? "team" : "free",
    status: subRow?.status ?? "free",
    interval: subRow?.interval ?? "monthly",
    paidSeats,
    activeMembers,
    reservedInvites,
    occupiedSeats,
    availableSeats,
    renewalSeats,
    currentPeriodEndIso: subRow?.currentPeriodEnd
      ? subRow.currentPeriodEnd.toISOString()
      : null,
    pastDueSinceIso: subRow?.pastDueSince ? subRow.pastDueSince.toISOString() : null,
    isLockedForQuantityChange: lockCheck.locked,
    lockReason: lockCheck.reason,
  };
}

export async function getUserBillingOverview(
  userId: string,
  now: Date = new Date(),
  activeOrgId?: string | null,
): Promise<UserBillingOverview> {
  const personal = await ensurePersonalWorkspaceForUser(userId);

  const [[userRow], [personalWs], [subRow], personalPubs, teamBilling] = await Promise.all([
    db
      .select({ plan: dbSchema.users.plan })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, userId))
      .limit(1),
    db
      .select()
      .from(dbSchema.workspaces)
      .where(eq(dbSchema.workspaces.id, personal.workspaceId))
      .limit(1),
    db
      .select()
      .from(dbSchema.subscriptions)
      .where(
        and(
          eq(dbSchema.subscriptions.userId, userId),
          isNull(dbSchema.subscriptions.orgId),
        ),
      )
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1),
    db
      .select({
        id: dbSchema.projects.id,
        name: dbSchema.projects.name,
        slug: dbSchema.projects.slug,
      })
      .from(dbSchema.projects)
      .where(
        and(
          eq(dbSchema.projects.workspaceId, personal.workspaceId),
          ne(dbSchema.projects.visibility, "private"),
        ),
      ),
    getTeamBillingSeatOverviewForUser(userId, activeOrgId, now),
  ]);

  let effectivePlan: PlanTier = userRow?.plan ?? "free";

  if (subRow) {
    const lifecycle = evaluateSubscriptionLifecycle({
      status: subRow.status,
      currentPeriodEnd: subRow.currentPeriodEnd,
      pastDueSince: subRow.pastDueSince,
      now,
    });
    const derivedPlan: PlanTier = lifecycle.grantsPaidAccess ? subRow.plan : "free";
    if (derivedPlan !== effectivePlan) {
      effectivePlan = derivedPlan;
      await db
        .update(dbSchema.users)
        .set({ plan: derivedPlan, updatedAt: now })
        .where(eq(dbSchema.users.id, userId));
    }
  } else if (effectivePlan === "team") {
    // Legacy cleanup: personal plan can only be "free" or "pro"
    effectivePlan = "free";
  }

  // Invoices are scoped by Paddle-assigned subscription / customer ids that belong to THIS user's
  // (or owned team's) subscription rows. Browser-controlled `custom_data` is never used to decide
  // whose invoice an event is, and the query is filtered in SQL so one busy tenant can never push
  // another customer's history out of a global "latest 100" window.
  const [teamSubRow] =
    teamBilling?.isOwner && teamBilling.organizationId
      ? await db
          .select({
            paddleSubscriptionId: dbSchema.subscriptions.paddleSubscriptionId,
            paddleCustomerId: dbSchema.subscriptions.paddleCustomerId,
          })
          .from(dbSchema.subscriptions)
          .where(eq(dbSchema.subscriptions.orgId, teamBilling.organizationId))
          .orderBy(desc(dbSchema.subscriptions.updatedAt))
          .limit(1)
      : [];

  const ownedSubscriptionIds = [
    subRow?.paddleSubscriptionId,
    teamSubRow?.paddleSubscriptionId,
  ].filter((value): value is string => Boolean(value));
  const ownedCustomerIds = [subRow?.paddleCustomerId, teamSubRow?.paddleCustomerId].filter(
    (value): value is string => Boolean(value),
  );

  const recentEvents =
    ownedSubscriptionIds.length === 0 && ownedCustomerIds.length === 0
      ? []
      : await db
          .select()
          .from(dbSchema.webhookEvents)
          .where(
            and(
              eq(dbSchema.webhookEvents.provider, "paddle"),
              or(
                ownedSubscriptionIds.length
                  ? inArray(
                      sql<string>`${dbSchema.webhookEvents.payload}->'data'->>'subscription_id'`,
                      ownedSubscriptionIds,
                    )
                  : undefined,
                ownedSubscriptionIds.length
                  ? inArray(
                      sql<string>`${dbSchema.webhookEvents.payload}->'data'->>'id'`,
                      ownedSubscriptionIds,
                    )
                  : undefined,
                ownedCustomerIds.length
                  ? inArray(
                      sql<string>`${dbSchema.webhookEvents.payload}->'data'->>'customer_id'`,
                      ownedCustomerIds,
                    )
                  : undefined,
              ),
            ),
          )
          .orderBy(desc(dbSchema.webhookEvents.processedAt))
          .limit(200);

  const built = buildBillingInvoices(recentEvents);
  const invoices = built.invoices;
  const detectedInterval: BillingInterval = subRow?.interval ?? built.detectedInterval ?? "monthly";
  const paymentBrand = built.paymentMethod?.brand ?? null;
  const paymentLast4 = built.paymentMethod?.last4 ?? null;
  const paymentExpiry = built.paymentMethod?.expiry ?? null;

  return {
    effectivePlan,
    environment: env.PADDLE_ENV,
    hasLivePaddlePortal: Boolean(
      subRow?.paddleCustomerId && isRealPaddleApiKeyConfigured(),
    ),
    subscription: subRow
      ? {
          id: subRow.id,
          paddleCustomerId: subRow.paddleCustomerId ?? null,
          paddleSubscriptionId: subRow.paddleSubscriptionId ?? null,
          plan: subRow.plan,
          interval: detectedInterval,
          status: subRow.status,
          currentPeriodEndIso: subRow.currentPeriodEnd
            ? subRow.currentPeriodEnd.toISOString()
            : null,
          pastDueSinceIso: subRow.pastDueSince ? subRow.pastDueSince.toISOString() : null,
          paymentBrand,
          paymentLast4,
          paymentExpiry,
        }
      : null,
    invoices,
    teamBilling,
    keepPublicProjectId: personalWs?.keepPublicProjectId ?? null,
    personalPublishedProjects: personalPubs,
  };
}

export async function createPaddlePortalSessionForUser(
  userId: string,
  orgId?: string | null,
): Promise<
  | { ok: true; mode: "paddle_portal"; url: string }
  | { ok: true; mode: "local_portal"; url: string }
  | { ok: false; error: string }
> {
  let subRow: typeof dbSchema.subscriptions.$inferSelect | undefined;

  if (orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, orgId),
          eq(dbSchema.memberships.userId, userId),
        ),
      )
      .limit(1);
    if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
      return {
        ok: false,
        error: "Only the workspace Owner can open the team billing portal.",
      };
    }

    const [teamSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, orgId))
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = teamSub;
  } else {
    const [personalSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(
        and(
          eq(dbSchema.subscriptions.userId, userId),
          isNull(dbSchema.subscriptions.orgId),
        ),
      )
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = personalSub;
  }

  if (!subRow?.paddleCustomerId) {
    return {
      ok: false,
      error: "No active billing subscription found for this workspace.",
    };
  }

  if (isRealPaddleApiKeyConfigured()) {
    try {
      const response = await fetch(
        `${getPaddleApiBaseUrl()}/customers/${encodeURIComponent(subRow.paddleCustomerId)}/portal-sessions`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${env.PADDLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            subscription_ids: subRow.paddleSubscriptionId
              ? [subRow.paddleSubscriptionId]
              : [],
          }),
        },
      );

      if (response.ok) {
        const json = (await response.json()) as {
          data?: { urls?: { general?: { overview?: string } } };
        };
        const overviewUrl = json.data?.urls?.general?.overview;
        if (overviewUrl) {
          // Never log signed portal URLs (`Spec §12 line 388`)
          return {
            ok: true,
            mode: "paddle_portal",
            url: overviewUrl,
          };
        }
      }
    } catch {
      // Fallback cleanly in local/sandbox environments
    }
  }

  return {
    ok: true,
    mode: "local_portal",
    url: "/account/billing?portal=cancel",
  };
}

export async function cancelUserSubscription(
  actor: BillingActor,
  rawInput: unknown,
): Promise<
  | {
      ok: true;
      status: "cancel_at_period_end" | "canceled";
      effectivePlan: PlanTier;
      currentPeriodEndIso: string | null;
    }
  | {
      ok: false;
      error: string;
    }
> {
  const parsed = cancelSubscriptionInputSchema.safeParse(rawInput ?? {});
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid cancellation request.",
    };
  }

  const targetOrgId = parsed.data.orgId ?? null;
  let subRow: typeof dbSchema.subscriptions.$inferSelect | undefined;

  if (targetOrgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, targetOrgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);
    if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
      return {
        ok: false,
        error: "Only the workspace Owner can cancel team billing.",
      };
    }

    const [teamSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, targetOrgId))
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = teamSub;
  } else {
    const personal = await ensurePersonalWorkspaceForUser(actor.id);
    if (parsed.data.keepPublicProjectId !== undefined) {
      await db
        .update(dbSchema.workspaces)
        .set({
          keepPublicProjectId: parsed.data.keepPublicProjectId,
          updatedAt: new Date(),
        })
        .where(eq(dbSchema.workspaces.id, personal.workspaceId));
    }

    const [personalSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(
        and(
          eq(dbSchema.subscriptions.userId, actor.id),
          isNull(dbSchema.subscriptions.orgId),
        ),
      )
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = personalSub;
  }

  if (!subRow || subRow.plan === "free") {
    return {
      ok: false,
      error: "No active paid subscription to cancel.",
    };
  }

  const now = new Date();
  const effectiveEnd = parsed.data.immediate
    ? now
    : (subRow.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000));

  if (subRow.paddleSubscriptionId && isRealPaddleApiKeyConfigured()) {
    const res = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(subRow.paddleSubscriptionId)}/cancel`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          effective_from: parsed.data.immediate
            ? "immediately"
            : "next_billing_period",
        }),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: "Paddle could not process cancellation right now. Please try again.",
      };
    }
  }

  // When talking to real Paddle API, avoid advancing `lastEventOccurredAt` ahead of Paddle's clock
  const syntheticEventDate =
    isRealPaddleApiKeyConfigured() && subRow.lastEventOccurredAt
      ? new Date(Math.min(now.getTime(), subRow.lastEventOccurredAt.getTime() + 1))
      : now;

  const eventId = `evt_cancel_${randomUUID().replace(/-/g, "").slice(0, 22)}`;
  const webhookPayload = parsed.data.immediate
    ? {
        event_id: eventId,
        event_type: "subscription.canceled",
        occurred_at: syntheticEventDate.toISOString(),
        data: {
          id: subRow.paddleSubscriptionId ?? `sub_local_${subRow.id}`,
          customer_id: subRow.paddleCustomerId ?? `ctm_local_${actor.id.slice(0, 8)}`,
          status: "canceled",
          canceled_at: now.toISOString(),
          custom_data: {
            userId: actor.id,
            orgId: targetOrgId,
            plan: subRow.plan,
            cancelReason: parsed.data.reason ?? "other",
            cancelFeedback: parsed.data.feedback ?? "",
          },
        },
      }
    : {
        event_id: eventId,
        event_type: "subscription.updated",
        occurred_at: syntheticEventDate.toISOString(),
        data: {
          id: subRow.paddleSubscriptionId ?? `sub_local_${subRow.id}`,
          customer_id: subRow.paddleCustomerId ?? `ctm_local_${actor.id.slice(0, 8)}`,
          status: "active",
          scheduled_change: {
            action: "cancel",
            effective_at: effectiveEnd.toISOString(),
          },
          current_billing_period: {
            ends_at: effectiveEnd.toISOString(),
          },
          custom_data: {
            userId: actor.id,
            orgId: targetOrgId,
            plan: subRow.plan,
            cancelReason: parsed.data.reason ?? "other",
            cancelFeedback: parsed.data.feedback ?? "",
          },
        },
      };

  const rawBody = JSON.stringify(webhookPayload);
  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const processed = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!processed.ok) {
    return {
      ok: false,
      error: processed.error,
    };
  }

  return {
    ok: true,
    status: parsed.data.immediate ? "canceled" : "cancel_at_period_end",
    effectivePlan: processed.effectivePlan ?? "free",
    currentPeriodEndIso: effectiveEnd.toISOString(),
  };
}

export async function resumeUserSubscription(
  actor: BillingActor,
  orgId?: string | null,
): Promise<{ ok: true; effectivePlan: PlanTier } | { ok: false; error: string }> {
  let subRow: typeof dbSchema.subscriptions.$inferSelect | undefined;

  if (orgId) {
    const [membership] = await db
      .select({ role: dbSchema.memberships.role })
      .from(dbSchema.memberships)
      .where(
        and(
          eq(dbSchema.memberships.orgId, orgId),
          eq(dbSchema.memberships.userId, actor.id),
        ),
      )
      .limit(1);
    if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
      return { ok: false, error: "Only the workspace Owner can resume team billing." };
    }
    const [teamSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, orgId))
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = teamSub;
  } else {
    const [personalSub] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(
        and(
          eq(dbSchema.subscriptions.userId, actor.id),
          isNull(dbSchema.subscriptions.orgId),
        ),
      )
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1);
    subRow = personalSub;
  }

  if (!subRow || subRow.status !== "cancel_at_period_end") {
    return {
      ok: false,
      error: "No scheduled cancellation to resume.",
    };
  }

  if (subRow.paddleSubscriptionId && isRealPaddleApiKeyConfigured()) {
    const res = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(subRow.paddleSubscriptionId)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          scheduled_change: null,
        }),
      },
    );
    if (!res.ok) {
      return {
        ok: false,
        error: "Paddle could not resume your subscription right now. Please try again.",
      };
    }
  }

  const now = new Date();
  const syntheticResumeDate =
    isRealPaddleApiKeyConfigured() && subRow.lastEventOccurredAt
      ? new Date(Math.min(now.getTime(), subRow.lastEventOccurredAt.getTime() + 1))
      : now;
  const periodEnd =
    subRow.currentPeriodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
  const eventId = `evt_resume_${randomUUID().replace(/-/g, "").slice(0, 22)}`;

  const rawBody = JSON.stringify({
    event_id: eventId,
    event_type: "subscription.updated",
    occurred_at: syntheticResumeDate.toISOString(),
    data: {
      id: subRow.paddleSubscriptionId ?? `sub_local_${subRow.id}`,
      customer_id: subRow.paddleCustomerId ?? `ctm_local_${actor.id.slice(0, 8)}`,
      status: "active",
      scheduled_change: null,
      current_billing_period: {
        ends_at: periodEnd.toISOString(),
      },
      custom_data: {
        userId: actor.id,
        orgId: orgId ?? null,
        plan: subRow.plan,
      },
    },
  });

  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const processed = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!processed.ok) {
    return { ok: false, error: processed.error };
  }

  return {
    ok: true,
    effectivePlan: processed.effectivePlan ?? subRow.plan,
  };
}

/**
 * Selects which personal project remains public when Pro downgrades to Free (`Spec §11.7`).
 */
export async function selectPersonalKeepPublicProject(args: {
  actorUserId: string;
  projectId: string | null;
  now?: Date;
}): Promise<{ ok: true; keepPublicProjectId: string | null } | { ok: false; error: string }> {
  const now = args.now ?? new Date();
  const personal = await ensurePersonalWorkspaceForUser(args.actorUserId);

  if (args.projectId) {
    const [proj] = await db
      .select({ id: dbSchema.projects.id })
      .from(dbSchema.projects)
      .where(
        and(
          eq(dbSchema.projects.id, args.projectId),
          eq(dbSchema.projects.workspaceId, personal.workspaceId),
        ),
      )
      .limit(1);

    if (!proj) {
      return {
        ok: false,
        error: "Selected project was not found in your personal workspace.",
      };
    }
  }

  await db
    .update(dbSchema.workspaces)
    .set({
      keepPublicProjectId: args.projectId,
      updatedAt: now,
    })
    .where(eq(dbSchema.workspaces.id, personal.workspaceId));

  const [userRow] = await db
    .select({ plan: dbSchema.users.plan })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, args.actorUserId))
    .limit(1);

  if ((userRow?.plan ?? "free") === "free") {
    await applyPersonalDowngradePublicationRules(personal.workspaceId, now);
  }

  return {
    ok: true,
    keepPublicProjectId: args.projectId,
  };
}

/**
 * Previews an immediate prorated seat increase for a Teams workspace (`Spec §8`).
 * Owner-only; rejects > 25 seats, `past_due`, renewal lock window, or pending decrease.
 */
export async function previewTeamSeatIncrease(args: {
  actorUserId: string;
  organizationId: string;
  targetSeats: number;
  now?: Date;
}): Promise<
  | {
      ok: true;
      operationId: string;
      currentSeats: number;
      targetSeats: number;
      addedSeats: number;
      immediateChargeCents: number;
      immediateChargeUsd: number;
      renewalChargeCents: number;
      renewalChargeUsd: number;
      currency: string;
      interval: BillingInterval;
      nextRenewalIso: string | null;
    }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "CAPACITY_REVIEW_REQUIRED"
        | "VALIDATION_ERROR"
        | "QUANTITY_LOCKED"
        | "PENDING_DECREASE_CONFLICT";
      error: string;
    }
> {
  const now = args.now ?? new Date();

  if (!Number.isInteger(args.targetSeats) || args.targetSeats < TEAMS_MIN_SEATS) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Target seats must be a whole number of at least 1.",
    };
  }
  if (args.targetSeats > TEAMS_MAX_SELF_SERVE_SEATS) {
    return {
      ok: false,
      code: "CAPACITY_REVIEW_REQUIRED",
      error: `Self-service Teams supports up to ${TEAMS_MAX_SELF_SERVE_SEATS} paid seats. Contact support for capacity review.`,
    };
  }

  const [membership] = await db
    .select({ role: dbSchema.memberships.role })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, args.organizationId),
        eq(dbSchema.memberships.userId, args.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Only the workspace Owner can purchase additional seats.",
    };
  }

  const ensured = await ensureTeamWorkspaceForOrganization(
    args.organizationId,
    args.actorUserId,
  );

  const [subRow] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.orgId, args.organizationId))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (!subRow || subRow.plan !== "team") {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "No active Casefolio Teams subscription found for this workspace.",
    };
  }

  const lockCheck = isSubscriptionLockedForQuantityChange({
    status: subRow.status,
    scheduledChangeAction: subRow.scheduledChangeAction,
    currentPeriodEnd: subRow.currentPeriodEnd,
    now,
  });
  if (lockCheck.locked) {
    return {
      ok: false,
      code: "QUANTITY_LOCKED",
      error: lockCheck.reason,
    };
  }

  if (subRow.renewalQuantity !== null && subRow.renewalQuantity < subRow.currentPaidCapacity) {
    return {
      ok: false,
      code: "PENDING_DECREASE_CONFLICT",
      error:
        "Cancel the pending seat decrease before previewing a seat increase so billing quantities stay synchronized.",
    };
  }

  if (args.targetSeats <= subRow.currentPaidCapacity) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: `Target seats (${args.targetSeats}) must be greater than current paid seats (${subRow.currentPaidCapacity}).`,
    };
  }

  const interval: BillingInterval = subRow.interval ?? "monthly";
  const unitCents =
    interval === "yearly"
      ? BILLING_PLAN_CATALOG.team.yearlyTotalCents
      : BILLING_PLAN_CATALOG.team.monthlyPriceCents;
  const addedSeats = args.targetSeats - subRow.currentPaidCapacity;

  // Compute minute-accurate remaining period fraction (or live Paddle preview if configured)
  const totalPeriodMs =
    (interval === "yearly" ? 365 : 30) * 24 * 60 * 60 * 1000;
  const remainingMs = subRow.currentPeriodEnd
    ? Math.max(60_000, Math.min(totalPeriodMs, subRow.currentPeriodEnd.getTime() - now.getTime()))
    : totalPeriodMs;

  let immediateChargeCents = Math.max(
    1,
    Math.round((addedSeats * unitCents * remainingMs) / totalPeriodMs),
  );
  const renewalChargeCents = args.targetSeats * unitCents;

  if (subRow.paddleSubscriptionId && isRealPaddleApiKeyConfigured()) {
    const priceId = resolveServerPaddlePriceId("team", interval);
    const previewRes = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(subRow.paddleSubscriptionId)}/preview`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: args.targetSeats }],
          proration_billing_mode: "prorated_immediately",
          on_payment_failure: "prevent_change",
        }),
      },
    );
    if (previewRes.ok) {
      const previewJson = (await previewRes.json()) as {
        data?: { immediate_transaction?: { details?: { totals?: { total?: string } } } };
      };
      const rawTotal = previewJson.data?.immediate_transaction?.details?.totals?.total;
      if (rawTotal && /^\d+$/.test(rawTotal)) {
        immediateChargeCents = Number(rawTotal);
      }
    }
  }

  const operationId = randomUUID();
  await db.insert(dbSchema.billingOperations).values({
    id: operationId,
    workspaceId: ensured.workspaceId,
    subscriptionId: subRow.id,
    actorUserId: args.actorUserId,
    kind: "seat_increase",
    status: "previewed",
    previousQuantity: subRow.currentPaidCapacity,
    targetQuantity: args.targetSeats,
    previewAmountCents: immediateChargeCents,
    renewalAmountCents: renewalChargeCents,
    currency: "USD",
    idempotencyKey: `seat-inc-preview:${subRow.id}:${operationId}`,
    meta: {
      interval,
      prorationBillingMode: "prorated_immediately",
      onPaymentFailure: "prevent_change",
    },
    createdAt: now,
    updatedAt: now,
  });

  return {
    ok: true,
    operationId,
    currentSeats: subRow.currentPaidCapacity,
    targetSeats: args.targetSeats,
    addedSeats,
    immediateChargeCents,
    immediateChargeUsd: Math.round(immediateChargeCents) / 100,
    renewalChargeCents,
    renewalChargeUsd: Math.round(renewalChargeCents) / 100,
    currency: "USD",
    interval,
    nextRenewalIso: subRow.currentPeriodEnd ? subRow.currentPeriodEnd.toISOString() : null,
  };
}

/**
 * Confirms a previewed seat increase (`prorated_immediately` + `prevent_change`, `Spec §8`).
 * Grants seats ONLY after verified funding; failed payment leaves `currentPaidCapacity` unchanged.
 */
export async function confirmTeamSeatIncrease(args: {
  actorUserId: string;
  organizationId: string;
  operationId: string;
  simulatePaymentFailure?: boolean;
  now?: Date;
}): Promise<
  | {
      ok: true;
      paidSeats: number;
      chargedCents: number;
      chargedUsd: number;
    }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "NOT_FOUND"
        | "QUANTITY_LOCKED"
        | "PAYMENT_FAILED"
        | "PROVIDER_ERROR";
      error: string;
    }
> {
  const now = args.now ?? new Date();

  const [membership] = await db
    .select({ role: dbSchema.memberships.role })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, args.organizationId),
        eq(dbSchema.memberships.userId, args.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Only the workspace Owner can confirm seat purchases.",
    };
  }

  // Lock subscription + operation inside transaction before dispatching provider update
  const lockedState = await db.transaction(async (tx) => {
    const subRows = await tx.execute<{
      id: string;
      paddle_subscription_id: string | null;
      paddle_customer_id: string | null;
      status: string;
      interval: BillingInterval;
      current_paid_capacity: number;
      renewal_quantity: number | null;
      scheduled_change_action: string | null;
      current_period_end: Date | null;
    }>(sql`
      SELECT
        id,
        paddle_subscription_id,
        paddle_customer_id,
        status,
        interval,
        current_paid_capacity,
        renewal_quantity,
        scheduled_change_action,
        current_period_end
      FROM subscriptions
      WHERE org_id = ${args.organizationId}
      ORDER BY updated_at DESC
      LIMIT 1
      FOR UPDATE
    `);

    const sub = subRows.rows[0];
    if (!sub) return { error: "NOT_FOUND" as const, message: "Subscription not found." };

    const [op] = await tx
      .select()
      .from(dbSchema.billingOperations)
      .where(
        and(
          eq(dbSchema.billingOperations.id, args.operationId),
          eq(dbSchema.billingOperations.subscriptionId, sub.id),
          eq(dbSchema.billingOperations.kind, "seat_increase"),
        ),
      )
      .limit(1);

    if (!op || !op.targetQuantity) {
      return { error: "NOT_FOUND" as const, message: "Seat increase preview was not found." };
    }

    if (op.status === "completed") {
      return {
        alreadyCompleted: true as const,
        paidSeats: sub.current_paid_capacity,
        chargedCents: op.previewAmountCents ?? 0,
      };
    }

    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const lockCheck = isSubscriptionLockedForQuantityChange({
      status: sub.status,
      scheduledChangeAction: sub.scheduled_change_action,
      currentPeriodEnd: periodEnd,
      now,
    });
    if (lockCheck.locked) {
      return { error: "QUANTITY_LOCKED" as const, message: lockCheck.reason };
    }

    await tx
      .update(dbSchema.billingOperations)
      .set({ status: "pending", updatedAt: now })
      .where(eq(dbSchema.billingOperations.id, op.id));

    return {
      alreadyCompleted: false as const,
      sub,
      op,
      periodEnd,
    };
  });

  if ("error" in lockedState && lockedState.error) {
    return {
      ok: false,
      code: lockedState.error,
      error: lockedState.message,
    };
  }

  if (lockedState.alreadyCompleted) {
    return {
      ok: true,
      paidSeats: lockedState.paidSeats,
      chargedCents: lockedState.chargedCents,
      chargedUsd: Math.round(lockedState.chargedCents) / 100,
    };
  }

  const { sub, op, periodEnd } = lockedState;
  const targetSeats = op.targetQuantity!;
  const interval: BillingInterval = sub.interval ?? "monthly";
  const priceId = resolveServerPaddlePriceId("team", interval);

  if (sub.paddle_subscription_id && isRealPaddleApiKeyConfigured()) {
    const patchRes = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: targetSeats }],
          proration_billing_mode: "prorated_immediately",
          on_payment_failure: "prevent_change",
        }),
      },
    );

    if (!patchRes.ok) {
      await db
        .update(dbSchema.billingOperations)
        .set({ status: "failed", updatedAt: now })
        .where(eq(dbSchema.billingOperations.id, op.id));
      return {
        ok: false,
        code: "PAYMENT_FAILED",
        error: "Payment failed (`prevent_change`); your paid seat count was not modified.",
      };
    }
  }

  const simulateFail = Boolean(args.simulatePaymentFailure);
  const eventId = `evt_seat_inc_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const rawBody = JSON.stringify({
    event_id: eventId,
    event_type: simulateFail ? "transaction.payment_failed" : "subscription.updated",
    occurred_at: now.toISOString(),
    data: {
      id: sub.paddle_subscription_id ?? `sub_local_${sub.id}`,
      customer_id: sub.paddle_customer_id ?? `ctm_local_${args.organizationId.slice(0, 8)}`,
      status: simulateFail ? "past_due" : "active",
      current_billing_period: {
        ends_at: (
          periodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)
        ).toISOString(),
      },
      items: [
        {
          quantity: targetSeats,
          price: {
            id: priceId,
            billing_cycle: {
              interval: interval === "yearly" ? "year" : "month",
              frequency: 1,
            },
          },
        },
      ],
      custom_data: {
        userId: args.actorUserId,
        orgId: args.organizationId,
        operationId: op.id,
        plan: "team",
        interval,
        seats: targetSeats,
        amountUsd: Math.round(op.previewAmountCents ?? 0) / 100,
        prorationBillingMode: "prorated_immediately",
      },
    },
  });

  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );
  const processed = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!processed.ok) {
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      error: processed.error,
    };
  }

  if (simulateFail) {
    return {
      ok: false,
      code: "PAYMENT_FAILED",
      error: "Payment failed; additional seats were not granted.",
    };
  }

  return {
    ok: true,
    paidSeats: processed.currentPaidCapacity ?? targetSeats,
    chargedCents: op.previewAmountCents ?? 0,
    chargedUsd: Math.round(op.previewAmountCents ?? 0) / 100,
  };
}

/**
 * Schedules a seat decrease at next renewal (`do_not_bill`, zero current-period credit, `Spec §8 lines 269-273`).
 * Preserves `currentPaidCapacity` until verified renewal while recording `renewalQuantity = targetSeats`.
 */
export async function scheduleTeamSeatDecrease(args: {
  actorUserId: string;
  organizationId: string;
  targetSeats: number;
  now?: Date;
}): Promise<
  | {
      ok: true;
      operationId: string;
      currentPaidSeats: number;
      renewalSeats: number;
      effectiveAtIso: string | null;
    }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "VALIDATION_ERROR"
        | "SEATS_IN_USE"
        | "QUANTITY_LOCKED"
        | "PROVIDER_ERROR";
      error: string;
    }
> {
  const now = args.now ?? new Date();

  if (!Number.isInteger(args.targetSeats) || args.targetSeats < TEAMS_MIN_SEATS) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Teams workspaces require at least 1 paid seat (including the Owner).",
    };
  }

  const [membership] = await db
    .select({ role: dbSchema.memberships.role })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, args.organizationId),
        eq(dbSchema.memberships.userId, args.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Only the workspace Owner can schedule seat decreases.",
    };
  }

  const ensured = await ensureTeamWorkspaceForOrganization(
    args.organizationId,
    args.actorUserId,
  );

  const prep = await db.transaction(async (tx) => {
    await tx.execute(sql`
      SELECT id FROM workspaces WHERE id = ${ensured.workspaceId} FOR UPDATE
    `);

    const subRows = await tx.execute<{
      id: string;
      paddle_subscription_id: string | null;
      paddle_customer_id: string | null;
      status: string;
      interval: BillingInterval;
      current_paid_capacity: number;
      scheduled_change_action: string | null;
      current_period_end: Date | null;
    }>(sql`
      SELECT
        id,
        paddle_subscription_id,
        paddle_customer_id,
        status,
        interval,
        current_paid_capacity,
        scheduled_change_action,
        current_period_end
      FROM subscriptions
      WHERE org_id = ${args.organizationId}
      ORDER BY updated_at DESC
      LIMIT 1
      FOR UPDATE
    `);

    const sub = subRows.rows[0];
    if (!sub) {
      return {
        error: "VALIDATION_ERROR" as const,
        message: "No active Casefolio Teams subscription found.",
      };
    }

    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const lockCheck = isSubscriptionLockedForQuantityChange({
      status: sub.status,
      scheduledChangeAction: sub.scheduled_change_action,
      currentPeriodEnd: periodEnd,
      now,
    });
    if (lockCheck.locked) {
      return { error: "QUANTITY_LOCKED" as const, message: lockCheck.reason };
    }

    if (args.targetSeats >= sub.current_paid_capacity) {
      return {
        error: "VALIDATION_ERROR" as const,
        message: `Target seats (${args.targetSeats}) must be lower than current paid seats (${sub.current_paid_capacity}).`,
      };
    }

    const [[mRow], [rRow]] = await Promise.all([
      tx
        .select({ total: count() })
        .from(dbSchema.memberships)
        .where(eq(dbSchema.memberships.orgId, args.organizationId)),
      tx
        .select({ total: count() })
        .from(dbSchema.seatReservations)
        .where(
          and(
            eq(dbSchema.seatReservations.organizationId, args.organizationId),
            eq(dbSchema.seatReservations.status, "active"),
            gt(dbSchema.seatReservations.expiresAt, now),
          ),
        ),
    ]);

    const occupied = Number(mRow?.total ?? 0) + Number(rRow?.total ?? 0);
    if (args.targetSeats < occupied) {
      return {
        error: "SEATS_IN_USE" as const,
        message: `Cannot decrease to ${args.targetSeats} seat${args.targetSeats === 1 ? "" : "s"} while ${occupied} seat${occupied === 1 ? " is" : "s are"} occupied by active members or pending invitations.`,
      };
    }

    const interval: BillingInterval = sub.interval ?? "monthly";
    const unitCents =
      interval === "yearly"
        ? BILLING_PLAN_CATALOG.team.yearlyTotalCents
        : BILLING_PLAN_CATALOG.team.monthlyPriceCents;
    const operationId = randomUUID();

    await tx.insert(dbSchema.billingOperations).values({
      id: operationId,
      workspaceId: ensured.workspaceId,
      subscriptionId: sub.id,
      actorUserId: args.actorUserId,
      kind: "seat_decrease",
      status: "pending",
      previousQuantity: sub.current_paid_capacity,
      targetQuantity: args.targetSeats,
      previewAmountCents: 0,
      renewalAmountCents: args.targetSeats * unitCents,
      currency: "USD",
      idempotencyKey: `seat-dec:${sub.id}:${operationId}`,
      meta: {
        prorationBillingMode: "do_not_bill",
      },
      createdAt: now,
      updatedAt: now,
    });

    return {
      sub,
      periodEnd,
      interval,
      operationId,
    };
  });

  if ("error" in prep && prep.error) {
    return {
      ok: false,
      code: prep.error,
      error: prep.message,
    };
  }

  const { sub, periodEnd, interval, operationId } = prep;
  const priceId = resolveServerPaddlePriceId("team", interval);

  if (sub.paddle_subscription_id && isRealPaddleApiKeyConfigured()) {
    const patchRes = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: args.targetSeats }],
          proration_billing_mode: "do_not_bill",
        }),
      },
    );
    if (!patchRes.ok) {
      await db
        .update(dbSchema.billingOperations)
        .set({ status: "failed", updatedAt: now })
        .where(eq(dbSchema.billingOperations.id, operationId));
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        error: "Paddle could not schedule the renewal quantity update right now.",
      };
    }
  }

  const eventId = `evt_seat_dec_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const effectivePeriodEnd =
    periodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const rawBody = JSON.stringify({
    event_id: eventId,
    event_type: "subscription.updated",
    occurred_at: now.toISOString(),
    data: {
      id: sub.paddle_subscription_id ?? `sub_local_${sub.id}`,
      customer_id: sub.paddle_customer_id ?? `ctm_local_${args.organizationId.slice(0, 8)}`,
      status: "active",
      current_billing_period: {
        ends_at: effectivePeriodEnd.toISOString(),
      },
      items: [
        {
          quantity: args.targetSeats,
          price: {
            id: priceId,
            billing_cycle: {
              interval: interval === "yearly" ? "year" : "month",
              frequency: 1,
            },
          },
        },
      ],
      custom_data: {
        userId: args.actorUserId,
        orgId: args.organizationId,
        operationId,
        plan: "team",
        interval,
        seats: args.targetSeats,
        prorationBillingMode: "do_not_bill",
      },
    },
  });

  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const processed = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!processed.ok) {
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      error: processed.error,
    };
  }

  return {
    ok: true,
    operationId,
    currentPaidSeats: processed.currentPaidCapacity ?? sub.current_paid_capacity,
    renewalSeats: processed.renewalQuantity ?? args.targetSeats,
    effectiveAtIso: effectivePeriodEnd.toISOString(),
  };
}

/**
 * Cancels a pending renewal seat decrease (`do_not_bill` back to `currentPaidCapacity`, `Spec §8 line 273`).
 * Locked with `FOR UPDATE` so a simultaneous renewal vs cancel-decrease race resolves deterministically.
 */
export async function cancelPendingTeamSeatDecrease(args: {
  actorUserId: string;
  organizationId: string;
  now?: Date;
}): Promise<
  | {
      ok: true;
      currentPaidSeats: number;
      renewalSeats: null;
    }
  | {
      ok: false;
      code:
        | "FORBIDDEN"
        | "NO_PENDING_DECREASE"
        | "QUANTITY_LOCKED"
        | "PROVIDER_ERROR";
      error: string;
    }
> {
  const now = args.now ?? new Date();

  const [membership] = await db
    .select({ role: dbSchema.memberships.role })
    .from(dbSchema.memberships)
    .where(
      and(
        eq(dbSchema.memberships.orgId, args.organizationId),
        eq(dbSchema.memberships.userId, args.actorUserId),
      ),
    )
    .limit(1);

  if (!membership || normalizeMembershipRole(membership.role) !== "owner") {
    return {
      ok: false,
      code: "FORBIDDEN",
      error: "Only the workspace Owner can cancel a pending seat decrease.",
    };
  }

  const ensured = await ensureTeamWorkspaceForOrganization(
    args.organizationId,
    args.actorUserId,
  );

  const locked = await db.transaction(async (tx) => {
    const subRows = await tx.execute<{
      id: string;
      paddle_subscription_id: string | null;
      paddle_customer_id: string | null;
      status: string;
      interval: BillingInterval;
      current_paid_capacity: number;
      renewal_quantity: number | null;
      pending_operation_id: string | null;
      scheduled_change_action: string | null;
      current_period_end: Date | null;
    }>(sql`
      SELECT
        id,
        paddle_subscription_id,
        paddle_customer_id,
        status,
        interval,
        current_paid_capacity,
        renewal_quantity,
        pending_operation_id,
        scheduled_change_action,
        current_period_end
      FROM subscriptions
      WHERE org_id = ${args.organizationId}
      ORDER BY updated_at DESC
      LIMIT 1
      FOR UPDATE
    `);

    const sub = subRows.rows[0];
    if (!sub || sub.renewal_quantity === null) {
      return {
        error: "NO_PENDING_DECREASE" as const,
        message: "There is no pending seat decrease to cancel (renewal may have already completed).",
      };
    }

    const periodEnd = sub.current_period_end ? new Date(sub.current_period_end) : null;
    const lockCheck = isSubscriptionLockedForQuantityChange({
      status: sub.status,
      scheduledChangeAction: sub.scheduled_change_action,
      currentPeriodEnd: periodEnd,
      now,
    });
    if (lockCheck.locked) {
      return { error: "QUANTITY_LOCKED" as const, message: lockCheck.reason };
    }

    if (sub.pending_operation_id) {
      await tx
        .update(dbSchema.billingOperations)
        .set({ status: "canceled", updatedAt: now })
        .where(eq(dbSchema.billingOperations.id, sub.pending_operation_id));
    }

    const cancelOpId = randomUUID();
    await tx.insert(dbSchema.billingOperations).values({
      id: cancelOpId,
      workspaceId: ensured.workspaceId,
      subscriptionId: sub.id,
      actorUserId: args.actorUserId,
      kind: "cancel_seat_decrease",
      status: "completed",
      previousQuantity: sub.renewal_quantity,
      targetQuantity: sub.current_paid_capacity,
      previewAmountCents: 0,
      currency: "USD",
      idempotencyKey: `cancel-seat-dec:${sub.id}:${cancelOpId}`,
      meta: { prorationBillingMode: "do_not_bill" },
      createdAt: now,
      updatedAt: now,
    });

    return {
      sub,
      periodEnd,
      cancelOpId,
    };
  });

  if ("error" in locked && locked.error) {
    return {
      ok: false,
      code: locked.error,
      error: locked.message,
    };
  }

  const { sub, periodEnd, cancelOpId } = locked;
  const interval: BillingInterval = sub.interval ?? "monthly";
  const priceId = resolveServerPaddlePriceId("team", interval);

  if (sub.paddle_subscription_id && isRealPaddleApiKeyConfigured()) {
    const patchRes = await fetch(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(sub.paddle_subscription_id)}`,
      {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${env.PADDLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          items: [{ price_id: priceId, quantity: sub.current_paid_capacity }],
          proration_billing_mode: "do_not_bill",
        }),
      },
    );
    if (!patchRes.ok) {
      return {
        ok: false,
        code: "PROVIDER_ERROR",
        error: "Paddle could not restore the recurring seat quantity right now.",
      };
    }
  }

  const eventId = `evt_cancel_dec_${randomUUID().replace(/-/g, "").slice(0, 20)}`;
  const effectivePeriodEnd =
    periodEnd ?? new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);

  const rawBody = JSON.stringify({
    event_id: eventId,
    event_type: "subscription.updated",
    occurred_at: now.toISOString(),
    data: {
      id: sub.paddle_subscription_id ?? `sub_local_${sub.id}`,
      customer_id: sub.paddle_customer_id ?? `ctm_local_${args.organizationId.slice(0, 8)}`,
      status: "active",
      current_billing_period: {
        ends_at: effectivePeriodEnd.toISOString(),
      },
      items: [
        {
          quantity: sub.current_paid_capacity,
          price: {
            id: priceId,
            billing_cycle: {
              interval: interval === "yearly" ? "year" : "month",
              frequency: 1,
            },
          },
        },
      ],
      custom_data: {
        userId: args.actorUserId,
        orgId: args.organizationId,
        operationId: cancelOpId,
        plan: "team",
        interval,
        seats: sub.current_paid_capacity,
        prorationBillingMode: "do_not_bill",
      },
    },
  });

  const signatureHeader = signPaddleWebhookPayload(
    rawBody,
    env.PADDLE_WEBHOOK_SECRET,
    Math.floor(now.getTime() / 1000),
  );

  const processed = await handleSignedPaddleWebhookRequest({
    rawBody,
    signatureHeader,
    now,
  });

  if (!processed.ok) {
    return {
      ok: false,
      code: "PROVIDER_ERROR",
      error: processed.error,
    };
  }

  return {
    ok: true,
    currentPaidSeats: processed.currentPaidCapacity ?? sub.current_paid_capacity,
    renewalSeats: null,
  };
}
