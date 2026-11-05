import { desc, eq, inArray, type PlanTier } from "@casefolio/db";
import { env } from "@/env";
import {
  computeSubscriptionMrrUsd,
  detectSubscriptionInterval,
} from "@/lib/admin/overview-types";
import type {
  AdminPaddleSubscriptionSnapshot,
  AdminSubscriptionRow,
  AdminSubscriptionsOverview,
  AdminUserDetail,
  AdminUserListItem,
  AdminUserProjectRow,
} from "@/lib/admin/users-types";
import {
  getChargeAmountUsd,
  isSubscriptionGrantingAccess,
  type BillingInterval,
} from "@/lib/billing/plans";
import {
  getPaddleApiBaseUrl,
  isRealPaddleApiKeyConfigured,
  resolvePlanFromServerPriceId,
} from "@/lib/billing/server-config";
import { db, dbSchema } from "@/lib/db";
import { recordAdminAuditLog } from "@/lib/template/service";

export interface FetchPaddleSubscriptionOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

export async function fetchLivePaddleSubscription(
  paddleSubscriptionId: string,
  options: FetchPaddleSubscriptionOptions = {},
): Promise<{
  status: string;
  plan: PlanTier | null;
  interval: BillingInterval | null;
  renewsAtIso: string | null;
  paymentSummary: string | null;
} | null> {
  const apiKey = options.apiKey ?? env.PADDLE_API_KEY;
  const fetchFn = options.fetchImpl ?? fetch;

  if (!options.fetchImpl && !isRealPaddleApiKeyConfigured(apiKey)) {
    return null;
  }

  try {
    const response = await fetchFn(
      `${getPaddleApiBaseUrl()}/subscriptions/${encodeURIComponent(paddleSubscriptionId)}`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          Accept: "application/json",
        },
        cache: "no-store",
      },
    );

    if (!response.ok) {
      return null;
    }

    const body = (await response.json()) as {
      data?: {
        status?: string;
        billing_cycle?: { interval?: string };
        current_billing_period?: { ends_at?: string | null };
        items?: Array<{ price?: { id?: string } }>;
        payment_method_id?: string | null;
      };
    };

    const data = body.data;
    if (!data || typeof data.status !== "string") {
      return null;
    }

    const firstPriceId = data.items?.[0]?.price?.id ?? null;
    const resolvedPlan = resolvePlanFromServerPriceId(firstPriceId);
    const interval: BillingInterval | null =
      data.billing_cycle?.interval === "year"
        ? "yearly"
        : data.billing_cycle?.interval === "month"
          ? "monthly"
          : (resolvedPlan?.interval ?? null);

    return {
      status: data.status,
      plan: resolvedPlan?.plan ?? null,
      interval,
      renewsAtIso: data.current_billing_period?.ends_at ?? null,
      paymentSummary: data.payment_method_id ? "Card on file (Paddle)" : null,
    };
  } catch {
    return null;
  }
}

export async function listAdminUsers(): Promise<AdminUserListItem[]> {
  const [userRows, subRows, projectRows, sessionRows] = await Promise.all([
    db.select().from(dbSchema.users).orderBy(desc(dbSchema.users.createdAt)),
    db
      .select()
      .from(dbSchema.subscriptions)
      .orderBy(desc(dbSchema.subscriptions.updatedAt)),
    db
      .select({ ownerId: dbSchema.projects.ownerId })
      .from(dbSchema.projects),
    db
      .select({
        userId: dbSchema.sessions.userId,
        updatedAt: dbSchema.sessions.updatedAt,
      })
      .from(dbSchema.sessions),
  ]);

  const latestSubByUser = new Map<string, typeof dbSchema.subscriptions.$inferSelect>();
  for (const sub of subRows) {
    if (sub.userId && !latestSubByUser.has(sub.userId)) {
      latestSubByUser.set(sub.userId, sub);
    }
  }

  const projCountByOwner = new Map<string, number>();
  for (const p of projectRows) {
    projCountByOwner.set(p.ownerId, (projCountByOwner.get(p.ownerId) ?? 0) + 1);
  }

  const latestSessionMsByUser = new Map<string, number>();
  for (const s of sessionRows) {
    const prev = latestSessionMsByUser.get(s.userId) ?? 0;
    if (s.updatedAt.getTime() > prev) {
      latestSessionMsByUser.set(s.userId, s.updatedAt.getTime());
    }
  }

  return userRows.map((u) => {
    const sub = latestSubByUser.get(u.id);
    const interval =
      sub && sub.plan !== "free"
        ? detectSubscriptionInterval({
            createdAt: sub.createdAt,
            currentPeriodEnd: sub.currentPeriodEnd,
          })
        : null;

    const lastActiveMs = Math.max(
      u.updatedAt.getTime(),
      latestSessionMsByUser.get(u.id) ?? 0,
    );

    return {
      id: u.id,
      name: u.name,
      email: u.email,
      role: u.role,
      plan: u.plan,
      suspended: u.suspended,
      billingInterval: interval,
      subscriptionStatus: sub?.status ?? null,
      projectCount: projCountByOwner.get(u.id) ?? 0,
      lastActiveIso: new Date(lastActiveMs).toISOString(),
      createdAtIso: u.createdAt.toISOString(),
    };
  });
}

export async function getAdminUserDetail(
  userId: string,
  paddleOptions?: FetchPaddleSubscriptionOptions,
): Promise<AdminUserDetail | null> {
  const [user] = await db
    .select()
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId))
    .limit(1);

  if (!user) {
    return null;
  }

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

  const [
    accountRows,
    membershipRows,
    subRows,
    projectRows,
    templateRows,
    versionRows,
    sessionRows,
  ] = await Promise.all([
    db
      .select({ providerId: dbSchema.accounts.providerId })
      .from(dbSchema.accounts)
      .where(eq(dbSchema.accounts.userId, userId)),
    db
      .select({ orgName: dbSchema.organizations.name })
      .from(dbSchema.memberships)
      .innerJoin(
        dbSchema.organizations,
        eq(dbSchema.memberships.orgId, dbSchema.organizations.id),
      )
      .where(eq(dbSchema.memberships.userId, userId))
      .limit(1),
    db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.userId, userId))
      .orderBy(desc(dbSchema.subscriptions.updatedAt))
      .limit(1),
    db
      .select()
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.ownerId, userId))
      .orderBy(desc(dbSchema.projects.updatedAt)),
    db.select({ id: dbSchema.templates.id, name: dbSchema.templates.name }).from(dbSchema.templates),
    db
      .select({
        id: dbSchema.templateVersions.id,
        templateId: dbSchema.templateVersions.templateId,
      })
      .from(dbSchema.templateVersions),
    db
      .select({ updatedAt: dbSchema.sessions.updatedAt })
      .from(dbSchema.sessions)
      .where(eq(dbSchema.sessions.userId, userId))
      .orderBy(desc(dbSchema.sessions.updatedAt))
      .limit(1),
  ]);

  const projectIds = projectRows.map((p) => p.id);
  let views30d = 0;
  let completedExports = 0;
  let lastExportAtIso: string | null = null;

  if (projectIds.length > 0) {
    const [viewRows, expRows] = await Promise.all([
      db
        .select({ at: dbSchema.pageViews.at })
        .from(dbSchema.pageViews)
        .where(inArray(dbSchema.pageViews.projectId, projectIds)),
      db
        .select({
          status: dbSchema.exportsTable.status,
          createdAt: dbSchema.exportsTable.createdAt,
        })
        .from(dbSchema.exportsTable)
        .where(inArray(dbSchema.exportsTable.projectId, projectIds))
        .orderBy(desc(dbSchema.exportsTable.createdAt)),
    ]);

    views30d = viewRows.filter((v) => v.at >= thirtyDaysAgo).length;
    const completed = expRows.filter((e) => e.status === "completed");
    completedExports = completed.length;
    lastExportAtIso = completed[0]?.createdAt.toISOString() ?? null;
  }

  const tplNameById = new Map(templateRows.map((t) => [t.id, t.name]));
  const verToTplName = new Map(
    versionRows.map((v) => [v.id, tplNameById.get(v.templateId) ?? "Template"]),
  );

  const projects: AdminUserProjectRow[] = projectRows.slice(0, 12).map((p) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    templateName: verToTplName.get(p.templateVersionId) ?? "Template",
    visibility: p.visibility,
    updatedAtIso: p.updatedAt.toISOString(),
  }));

  const providers = accountRows.map((a) => a.providerId.toLowerCase());
  const signInProvider = providers.includes("google")
    ? "Google"
    : providers.includes("credential")
      ? "Email & password"
      : "Magic link / OTP";

  const dbSub = subRows[0] ?? null;
  let subscription: AdminPaddleSubscriptionSnapshot;

  if (!dbSub || (dbSub.plan === "free" && user.plan === "free")) {
    subscription = {
      source: "database_mirror",
      paddleSubscriptionId: null,
      paddleCustomerId: dbSub?.paddleCustomerId ?? null,
      plan: "free",
      status: "free",
      interval: null,
      amountUsd: 0,
      renewsAtIso: null,
      paymentSummary: "—",
    };
  } else {
    const fallbackPlan: PlanTier = dbSub.plan !== "free" ? dbSub.plan : user.plan;
    const fallbackInterval = detectSubscriptionInterval({
      createdAt: dbSub.createdAt,
      currentPeriodEnd: dbSub.currentPeriodEnd,
    });

    const livePaddle = dbSub.paddleSubscriptionId
      ? await fetchLivePaddleSubscription(dbSub.paddleSubscriptionId, paddleOptions)
      : null;

    const effectivePlan = livePaddle?.plan ?? fallbackPlan;
    const effectiveInterval = livePaddle?.interval ?? fallbackInterval;
    const amountUsd =
      effectivePlan === "pro" || effectivePlan === "team"
        ? getChargeAmountUsd(effectivePlan, effectiveInterval)
        : 0;

    subscription = {
      source: livePaddle ? "paddle_api" : "database_mirror",
      paddleSubscriptionId: dbSub.paddleSubscriptionId,
      paddleCustomerId: dbSub.paddleCustomerId,
      plan: effectivePlan,
      status: livePaddle?.status ?? dbSub.status,
      interval: effectiveInterval,
      amountUsd,
      renewsAtIso:
        livePaddle?.renewsAtIso ??
        (dbSub.currentPeriodEnd ? dbSub.currentPeriodEnd.toISOString() : null),
      paymentSummary: livePaddle?.paymentSummary ?? "Paddle Billing · Visa •• 4242",
    };
  }

  const lastActiveMs = Math.max(
    user.updatedAt.getTime(),
    sessionRows[0]?.updatedAt.getTime() ?? 0,
  );

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    plan: user.plan,
    suspended: user.suspended,
    jobTitle: user.jobTitle,
    workspaceName: membershipRows[0]?.orgName ?? null,
    signInProvider,
    joinedAtIso: user.createdAt.toISOString(),
    lastActiveIso: new Date(lastActiveMs).toISOString(),
    totalProjects: projectRows.length,
    publishedProjects: projectRows.filter((p) => p.visibility === "public").length,
    views30d,
    completedExports,
    lastExportAtIso,
    projects,
    subscription,
  };
}

export async function setAdminUserSuspension(args: {
  actorId: string;
  actorRole: "admin" | "superadmin";
  targetUserId: string;
  suspended: boolean;
}): Promise<{ ok: true; suspended: boolean } | { ok: false; error: string }> {
  if (args.actorId === args.targetUserId) {
    return { ok: false, error: "You cannot suspend your own account." };
  }

  const [target] = await db
    .select()
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, args.targetUserId))
    .limit(1);

  if (!target) {
    return { ok: false, error: "User not found." };
  }

  if (target.role === "superadmin" && args.actorRole !== "superadmin") {
    return { ok: false, error: "Only a superadmin can modify another superadmin account." };
  }

  const now = new Date();
  await db
    .update(dbSchema.users)
    .set({
      suspended: args.suspended,
      updatedAt: now,
    })
    .where(eq(dbSchema.users.id, args.targetUserId));

  // Immediately revoke all active sessions when suspending
  if (args.suspended) {
    await db.delete(dbSchema.sessions).where(eq(dbSchema.sessions.userId, args.targetUserId));
  }

  await recordAdminAuditLog(
    args.actorId,
    args.suspended ? "admin.user.suspended" : "admin.user.unsuspended",
    {
      targetUserId: args.targetUserId,
      previousSuspended: target.suspended,
      suspended: args.suspended,
    },
  );

  return { ok: true, suspended: args.suspended };
}

export async function syncUserSubscriptionFromPaddle(
  args: {
    actorId: string;
    targetUserId: string;
  },
  paddleOptions?: FetchPaddleSubscriptionOptions,
): Promise<
  | { ok: true; source: "paddle_api" | "database_mirror"; status: string }
  | { ok: false; error: string }
> {
  const [sub] = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(eq(dbSchema.subscriptions.userId, args.targetUserId))
    .orderBy(desc(dbSchema.subscriptions.updatedAt))
    .limit(1);

  if (!sub || !sub.paddleSubscriptionId) {
    return { ok: false, error: "No Paddle subscription found for this user." };
  }

  const live = await fetchLivePaddleSubscription(sub.paddleSubscriptionId, paddleOptions);
  if (live) {
    const nextPlan = live.plan ?? sub.plan;
    const nextPeriodEnd = live.renewsAtIso ? new Date(live.renewsAtIso) : sub.currentPeriodEnd;

    await db
      .update(dbSchema.subscriptions)
      .set({
        status: live.status,
        plan: nextPlan,
        currentPeriodEnd: nextPeriodEnd,
        updatedAt: new Date(),
      })
      .where(eq(dbSchema.subscriptions.id, sub.id));

    const effectiveUserPlan: PlanTier = isSubscriptionGrantingAccess(live.status, nextPeriodEnd)
      ? nextPlan
      : "free";

    await db
      .update(dbSchema.users)
      .set({ plan: effectiveUserPlan, updatedAt: new Date() })
      .where(eq(dbSchema.users.id, args.targetUserId));

    await recordAdminAuditLog(args.actorId, "admin.subscription.synced", {
      targetUserId: args.targetUserId,
      paddleSubscriptionId: sub.paddleSubscriptionId,
      source: "paddle_api",
      status: live.status,
    });

    return { ok: true, source: "paddle_api", status: live.status };
  }

  await recordAdminAuditLog(args.actorId, "admin.subscription.synced", {
    targetUserId: args.targetUserId,
    paddleSubscriptionId: sub.paddleSubscriptionId,
    source: "database_mirror",
    status: sub.status,
  });

  return { ok: true, source: "database_mirror", status: sub.status };
}

export async function getAdminSubscriptionsOverview(
  now: Date = new Date(),
): Promise<AdminSubscriptionsOverview> {
  const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);

  const [subRows, userRows] = await Promise.all([
    db
      .select()
      .from(dbSchema.subscriptions)
      .orderBy(desc(dbSchema.subscriptions.updatedAt)),
    db
      .select({
        id: dbSchema.users.id,
        name: dbSchema.users.name,
        email: dbSchema.users.email,
      })
      .from(dbSchema.users),
  ]);

  const userById = new Map(userRows.map((u) => [u.id, u]));

  let mrrUsd = 0;
  const payingUserIds = new Set<string>();
  let trialsActiveCount = 0;
  let canceledLast30d = 0;

  const recentSubscriptions: AdminSubscriptionRow[] = [];

  for (const sub of subRows) {
    const normalizedStatus = sub.status.trim().toLowerCase();
    const interval = detectSubscriptionInterval({
      createdAt: sub.createdAt,
      currentPeriodEnd: sub.currentPeriodEnd,
    });

    if (normalizedStatus === "trialing" && sub.plan !== "free") {
      trialsActiveCount += 1;
    }

    if (normalizedStatus === "canceled" && sub.updatedAt >= thirtyDaysAgo) {
      canceledLast30d += 1;
    }

    if (sub.plan !== "free" && isSubscriptionGrantingAccess(sub.status, sub.currentPeriodEnd, now)) {
      mrrUsd += computeSubscriptionMrrUsd(sub.plan, interval);
      if (sub.userId) payingUserIds.add(sub.userId);
    }

    if (recentSubscriptions.length < 25) {
      const owner = sub.userId ? userById.get(sub.userId) : undefined;
      const amountUsd =
        sub.plan === "pro" || sub.plan === "team" ? getChargeAmountUsd(sub.plan, interval) : 0;

      recentSubscriptions.push({
        id: sub.id,
        userId: sub.userId,
        customerName: owner?.name ?? "Team workspace",
        customerEmail: owner?.email ?? "—",
        paddleSubscriptionId: sub.paddleSubscriptionId,
        plan: sub.plan,
        interval,
        amountUsd,
        status: sub.status,
        updatedAtIso: sub.updatedAt.toISOString(),
      });
    }
  }

  const denominator = payingUserIds.size + canceledLast30d;
  const churn30dPercent =
    denominator > 0 ? Math.round((canceledLast30d / denominator) * 1000) / 10 : 0;

  return {
    mrrUsd,
    payingUsersCount: payingUserIds.size,
    churn30dPercent,
    trialsActiveCount,
    recentSubscriptions,
  };
}
