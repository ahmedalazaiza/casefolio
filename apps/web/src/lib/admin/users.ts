import { and, count, desc, eq, gte, inArray, max, ne, or, type PlanTier } from "@casefolio/db";
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
import { sendAdminAccountSuspensionEmail } from "@/lib/email";
import { revalidatePublicProject } from "@/lib/projects/public-cache";
import { recordAdminAuditLog } from "@/lib/template/service";

export interface FetchPaddleSubscriptionOptions {
  apiKey?: string;
  fetchImpl?: typeof fetch;
}

function normalizeAdminPlan(plan: PlanTier): PlanTier {
  return plan === "plus" ? "team" : plan;
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

export async function listAdminUsers(options?: {
  limit?: number;
  offset?: number;
}): Promise<AdminUserListItem[]> {
  const safeLimit = Math.max(1, Math.min(2000, Math.trunc(options?.limit ?? 1000)));
  const safeOffset = Math.max(0, Math.trunc(options?.offset ?? 0));

  const userRows = await db
    .select()
    .from(dbSchema.users)
    .orderBy(desc(dbSchema.users.createdAt))
    .limit(safeLimit)
    .offset(safeOffset);

  if (userRows.length === 0) {
    return [];
  }

  const userIds = userRows.map((u) => u.id);

  const [subRows, projectCounts, sessionRows] = await Promise.all([
    db
      .select()
      .from(dbSchema.subscriptions)
      .where(inArray(dbSchema.subscriptions.userId, userIds))
      .orderBy(desc(dbSchema.subscriptions.updatedAt)),
    db
      .select({
        ownerId: dbSchema.projects.ownerId,
        total: count(),
      })
      .from(dbSchema.projects)
      .where(inArray(dbSchema.projects.ownerId, userIds))
      .groupBy(dbSchema.projects.ownerId),
    db
      .select({
        userId: dbSchema.sessions.userId,
        lastUpdatedAt: max(dbSchema.sessions.updatedAt),
      })
      .from(dbSchema.sessions)
      .where(inArray(dbSchema.sessions.userId, userIds))
      .groupBy(dbSchema.sessions.userId),
  ]);

  const latestSubByUser = new Map<string, typeof dbSchema.subscriptions.$inferSelect>();
  for (const sub of subRows) {
    if (sub.userId && !latestSubByUser.has(sub.userId)) {
      latestSubByUser.set(sub.userId, sub);
    }
  }

  const projCountByOwner = new Map<string, number>();
  for (const p of projectCounts) {
    projCountByOwner.set(p.ownerId, p.total);
  }

  const latestSessionMsByUser = new Map<string, number>();
  for (const s of sessionRows) {
    if (s.lastUpdatedAt) {
      latestSessionMsByUser.set(s.userId, new Date(s.lastUpdatedAt).getTime());
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
      plan: normalizeAdminPlan(u.plan),
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

  const [accountRows, membershipRows, subRows, projectRows, sessionRows] = await Promise.all([
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
      .select({
        id: dbSchema.projects.id,
        name: dbSchema.projects.name,
        slug: dbSchema.projects.slug,
        templateVersionId: dbSchema.projects.templateVersionId,
        visibility: dbSchema.projects.visibility,
        updatedAt: dbSchema.projects.updatedAt,
      })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.ownerId, userId))
      .orderBy(desc(dbSchema.projects.updatedAt)),
    db
      .select({ updatedAt: dbSchema.sessions.updatedAt })
      .from(dbSchema.sessions)
      .where(eq(dbSchema.sessions.userId, userId))
      .orderBy(desc(dbSchema.sessions.updatedAt))
      .limit(1),
  ]);

  const projectIds = projectRows.map((p) => p.id);
  const topProjectsSlice = projectRows.slice(0, 12);
  const versionIds = Array.from(new Set(topProjectsSlice.map((p) => p.templateVersionId)));

  let views30d = 0;
  let completedExports = 0;
  let lastExportAtIso: string | null = null;
  const verToTplName = new Map<string, string>();

  if (projectIds.length > 0) {
    const [viewAggRows, expAggRows, versionTplRows] = await Promise.all([
      db
        .select({ total: count() })
        .from(dbSchema.pageViews)
        .where(
          and(
            inArray(dbSchema.pageViews.projectId, projectIds),
            gte(dbSchema.pageViews.at, thirtyDaysAgo),
          ),
        ),
      db
        .select({
          total: count(),
          latestAt: max(dbSchema.exportsTable.createdAt),
        })
        .from(dbSchema.exportsTable)
        .where(
          and(
            inArray(dbSchema.exportsTable.projectId, projectIds),
            eq(dbSchema.exportsTable.status, "completed"),
          ),
        ),
      versionIds.length > 0
        ? db
            .select({
              versionId: dbSchema.templateVersions.id,
              templateName: dbSchema.templates.name,
            })
            .from(dbSchema.templateVersions)
            .innerJoin(
              dbSchema.templates,
              eq(dbSchema.templateVersions.templateId, dbSchema.templates.id),
            )
            .where(inArray(dbSchema.templateVersions.id, versionIds))
        : Promise.resolve([]),
    ]);

    views30d = viewAggRows[0]?.total ?? 0;
    completedExports = expAggRows[0]?.total ?? 0;
    lastExportAtIso = expAggRows[0]?.latestAt
      ? new Date(expAggRows[0].latestAt).toISOString()
      : null;
    for (const row of versionTplRows) {
      verToTplName.set(row.versionId, row.templateName);
    }
  }

  const projects: AdminUserProjectRow[] = topProjectsSlice.map((p) => ({
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
    const fallbackPlan: PlanTier = normalizeAdminPlan(
      dbSub.plan !== "free" ? dbSub.plan : user.plan,
    );
    const fallbackInterval = detectSubscriptionInterval({
      createdAt: dbSub.createdAt,
      currentPeriodEnd: dbSub.currentPeriodEnd,
    });

    const livePaddle = dbSub.paddleSubscriptionId
      ? await fetchLivePaddleSubscription(dbSub.paddleSubscriptionId, paddleOptions)
      : null;

    const effectivePlan = normalizeAdminPlan(livePaddle?.plan ?? fallbackPlan);
    const effectiveInterval = livePaddle?.interval ?? fallbackInterval;
    const amountUsd =
      effectivePlan === "pro" || effectivePlan === "team"
        ? getChargeAmountUsd(effectivePlan, effectiveInterval, dbSub.currentPaidCapacity ?? 1)
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
      paymentSummary: livePaddle?.paymentSummary ?? "Paddle Billing · Card on file",
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
    plan: normalizeAdminPlan(user.plan),
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

  // N5: Prevent lateral admin-to-admin suspension; only superadmin can suspend/reactivate admin or superadmin
  if ((target.role === "admin" || target.role === "superadmin") && args.actorRole !== "superadmin") {
    return {
      ok: false,
      error: "Only a superadmin can suspend or reactivate an administrator account.",
    };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(dbSchema.users)
      .set({
        suspended: args.suspended,
        updatedAt: now,
      })
      .where(eq(dbSchema.users.id, args.targetUserId));

    // Immediately revoke all active sessions when suspending
    if (args.suspended) {
      await tx.delete(dbSchema.sessions).where(eq(dbSchema.sessions.userId, args.targetUserId));
    }
  });

  // Purge ISR cache for any published projects owned by the suspended/unsuspended user
  const ownedPublishedProjects = await db
    .select({ slug: dbSchema.projects.slug })
    .from(dbSchema.projects)
    .where(
      and(
        eq(dbSchema.projects.ownerId, args.targetUserId),
        inArray(dbSchema.projects.visibility, ["public", "unlisted"]),
      ),
    );
  for (const proj of ownedPublishedProjects) {
    revalidatePublicProject(proj.slug);
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

  await sendAdminAccountSuspensionEmail({
    to: target.email,
    name: target.name,
    suspended: args.suspended,
  }).catch(() => undefined);

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
    const nextPlan = normalizeAdminPlan(live.plan ?? sub.plan);
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

  const subRows = await db
    .select()
    .from(dbSchema.subscriptions)
    .where(
      or(
        ne(dbSchema.subscriptions.plan, "free"),
        eq(dbSchema.subscriptions.status, "canceled"),
      ),
    )
    .orderBy(desc(dbSchema.subscriptions.updatedAt));

  const recentSlice = subRows.slice(0, 25);
  const recentUserIds = Array.from(
    new Set(recentSlice.map((s) => s.userId).filter((id): id is string => Boolean(id))),
  );

  const userRows =
    recentUserIds.length > 0
      ? await db
          .select({
            id: dbSchema.users.id,
            name: dbSchema.users.name,
            email: dbSchema.users.email,
          })
          .from(dbSchema.users)
          .where(inArray(dbSchema.users.id, recentUserIds))
      : [];

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

    const normalizedPlan = normalizeAdminPlan(sub.plan);
    const subSeats = sub.currentPaidCapacity ?? 1;
    if (
      normalizedPlan !== "free" &&
      isSubscriptionGrantingAccess(sub.status, sub.currentPeriodEnd, now, sub.pastDueSince)
    ) {
      mrrUsd += computeSubscriptionMrrUsd(normalizedPlan, interval, subSeats);
      if (sub.userId) payingUserIds.add(sub.userId);
    }

    if (recentSubscriptions.length < 25) {
      const owner = sub.userId ? userById.get(sub.userId) : undefined;
      const amountUsd =
        normalizedPlan === "pro" || normalizedPlan === "team"
          ? getChargeAmountUsd(normalizedPlan, interval, subSeats)
          : 0;

      recentSubscriptions.push({
        id: sub.id,
        userId: sub.userId,
        customerName: owner?.name ?? "Team workspace",
        customerEmail: owner?.email ?? "—",
        paddleSubscriptionId: sub.paddleSubscriptionId,
        plan: normalizedPlan,
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
