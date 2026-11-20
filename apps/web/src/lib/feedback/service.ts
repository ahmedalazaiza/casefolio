import { and, count, desc, eq, gt, isNotNull, type ProductFeedbackTrigger } from "@casefolio/db";
import { escapeCsvCell } from "@/lib/admin/users-types";
import { db, dbSchema } from "@/lib/db";
import {
  FEEDBACK_SNOOZE_DAYS,
  type AdminFeedbackOverview,
  type FeedbackEligibilityState,
} from "@/lib/feedback/types";

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export async function getFeedbackEligibilityForUser(
  userId: string,
  now: Date = new Date(),
): Promise<FeedbackEligibilityState> {
  const [submittedRow, activeSnoozeRow, userRow] = await Promise.all([
    db
      .select({ id: dbSchema.productFeedback.id })
      .from(dbSchema.productFeedback)
      .where(
        and(
          eq(dbSchema.productFeedback.userId, userId),
          eq(dbSchema.productFeedback.status, "submitted"),
        ),
      )
      .limit(1),
    db
      .select({ snoozeUntil: dbSchema.productFeedback.snoozeUntil })
      .from(dbSchema.productFeedback)
      .where(
        and(
          eq(dbSchema.productFeedback.userId, userId),
          eq(dbSchema.productFeedback.status, "snoozed"),
          gt(dbSchema.productFeedback.snoozeUntil, now),
        ),
      )
      .orderBy(desc(dbSchema.productFeedback.createdAt))
      .limit(1),
    db
      .select({ createdAt: dbSchema.users.createdAt, role: dbSchema.users.role })
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, userId))
      .limit(1),
  ]);

  if (submittedRow.length > 0) {
    return {
      eligible: false,
      alreadySubmitted: true,
      snoozedUntilIso: null,
      triggerMoment: null,
    };
  }

  const snooze = activeSnoozeRow[0]?.snoozeUntil ?? null;
  if (snooze && snooze.getTime() > now.getTime()) {
    return {
      eligible: false,
      alreadySubmitted: false,
      snoozedUntilIso: snooze.toISOString(),
      triggerMoment: null,
    };
  }

  // Admins don't need automatic feedback popups unless manually opened
  if (!userRow[0] || userRow[0].role !== "user") {
    return {
      eligible: false,
      alreadySubmitted: false,
      snoozedUntilIso: null,
      triggerMoment: null,
    };
  }

  const [publishedAgg, exportAgg, projectAgg] = await Promise.all([
    db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(
        and(
          eq(dbSchema.projects.ownerId, userId),
          isNotNull(dbSchema.projects.publishedAt),
        ),
      ),
    db
      .select({ total: count() })
      .from(dbSchema.exportsTable)
      .where(
        and(
          eq(dbSchema.exportsTable.requestedByUserId, userId),
          eq(dbSchema.exportsTable.status, "completed"),
        ),
      ),
    db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.ownerId, userId)),
  ]);

  if ((publishedAgg[0]?.total ?? 0) >= 1) {
    return {
      eligible: true,
      alreadySubmitted: false,
      snoozedUntilIso: null,
      triggerMoment: "first_publish",
    };
  }

  if ((exportAgg[0]?.total ?? 0) >= 1) {
    return {
      eligible: true,
      alreadySubmitted: false,
      snoozedUntilIso: null,
      triggerMoment: "first_export",
    };
  }

  const accountAgeMs = now.getTime() - userRow[0].createdAt.getTime();
  if ((projectAgg[0]?.total ?? 0) >= 1 && accountAgeMs >= ONE_DAY_MS) {
    return {
      eligible: true,
      alreadySubmitted: false,
      snoozedUntilIso: null,
      triggerMoment: "milestone_usage",
    };
  }

  return {
    eligible: false,
    alreadySubmitted: false,
    snoozedUntilIso: null,
    triggerMoment: null,
  };
}

export async function submitUserFeedback(args: {
  userId: string;
  rating: number;
  triggerMoment: ProductFeedbackTrigger;
  primaryUseCase?: string | null;
  topFeatureRequest?: string | null;
  sentimentTags?: string[];
  comment?: string | null;
  now?: Date;
}): Promise<{ id: string }> {
  const now = args.now ?? new Date();
  const [userRow] = await db
    .select({ plan: dbSchema.users.plan })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, args.userId))
    .limit(1);

  // Clean up any stale snooze records for cleanliness, keeping submission record durable
  await db
    .delete(dbSchema.productFeedback)
    .where(
      and(
        eq(dbSchema.productFeedback.userId, args.userId),
        eq(dbSchema.productFeedback.status, "snoozed"),
      ),
    );

  const [inserted] = await db
    .insert(dbSchema.productFeedback)
    .values({
      userId: args.userId,
      status: "submitted",
      rating: Math.max(1, Math.min(5, Math.round(args.rating))),
      triggerMoment: args.triggerMoment,
      primaryUseCase: args.primaryUseCase?.trim() || null,
      topFeatureRequest: args.topFeatureRequest?.trim() || null,
      sentimentTags: args.sentimentTags ?? [],
      comment: args.comment?.trim() || null,
      planTier: userRow?.plan === "plus" ? "team" : (userRow?.plan ?? "free"),
      createdAt: now,
      updatedAt: now,
    })
    .returning({ id: dbSchema.productFeedback.id });

  return { id: inserted!.id };
}

export async function snoozeUserFeedback(args: {
  userId: string;
  triggerMoment: ProductFeedbackTrigger;
  now?: Date;
}): Promise<{ snoozedUntilIso: string }> {
  const now = args.now ?? new Date();
  const snoozeUntil = new Date(now.getTime() + FEEDBACK_SNOOZE_DAYS * ONE_DAY_MS);

  await db
    .delete(dbSchema.productFeedback)
    .where(
      and(
        eq(dbSchema.productFeedback.userId, args.userId),
        eq(dbSchema.productFeedback.status, "snoozed"),
      ),
    );

  await db.insert(dbSchema.productFeedback).values({
    userId: args.userId,
    status: "snoozed",
    rating: null,
    triggerMoment: args.triggerMoment,
    snoozeUntil,
    createdAt: now,
    updatedAt: now,
  });

  return { snoozedUntilIso: snoozeUntil.toISOString() };
}

export async function getAdminFeedbackOverview(): Promise<AdminFeedbackOverview> {
  const rows = await db
    .select({
      fb: dbSchema.productFeedback,
      userName: dbSchema.users.name,
      userEmail: dbSchema.users.email,
    })
    .from(dbSchema.productFeedback)
    .innerJoin(dbSchema.users, eq(dbSchema.productFeedback.userId, dbSchema.users.id))
    .where(
      and(
        eq(dbSchema.productFeedback.status, "submitted"),
        isNotNull(dbSchema.productFeedback.rating),
      ),
    )
    .orderBy(desc(dbSchema.productFeedback.createdAt))
    .limit(500);

  const countsByStar: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
  const featureTallies = new Map<string, number>();
  let sumRatings = 0;
  let promoters = 0;

  const entries = rows.map((row) => {
    const stars = Math.max(1, Math.min(5, row.fb.rating ?? 5)) as 1 | 2 | 3 | 4 | 5;
    countsByStar[stars] = (countsByStar[stars] ?? 0) + 1;
    sumRatings += stars;
    if (stars >= 4) promoters += 1;

    if (row.fb.topFeatureRequest) {
      featureTallies.set(
        row.fb.topFeatureRequest,
        (featureTallies.get(row.fb.topFeatureRequest) ?? 0) + 1,
      );
    }

    return {
      id: row.fb.id,
      userId: row.fb.userId,
      userName: row.userName,
      userEmail: row.userEmail,
      planTier: row.fb.planTier === "plus" ? "team" : row.fb.planTier,
      rating: stars,
      triggerMoment: row.fb.triggerMoment,
      primaryUseCase: row.fb.primaryUseCase,
      topFeatureRequest: row.fb.topFeatureRequest,
      sentimentTags: Array.isArray(row.fb.sentimentTags) ? row.fb.sentimentTags : [],
      comment: row.fb.comment,
      createdAtIso: row.fb.createdAt.toISOString(),
    };
  });

  const totalResponses = entries.length;
  const averageRating =
    totalResponses > 0 ? Math.round((sumRatings / totalResponses) * 100) / 100 : null;
  const promoterPercent =
    totalResponses > 0 ? Math.round((promoters / totalResponses) * 100) : 0;

  const distribution = ([5, 4, 3, 2, 1] as const).map((stars) => {
    const c = countsByStar[stars] ?? 0;
    return {
      stars,
      count: c,
      percent: totalResponses > 0 ? Math.round((c / totalResponses) * 100) : 0,
    };
  });

  const topFeatureRequests = Array.from(featureTallies.entries())
    .map(([feature, countVal]) => ({ feature, count: countVal }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 6);

  return {
    totalResponses,
    averageRating,
    promoterPercent,
    distribution,
    topFeatureRequests,
    entries,
  };
}

export function serializeAdminFeedbackCsv(overview: AdminFeedbackOverview): string {
  const lines: string[] = [
    [
      "Submitted At",
      "User Name",
      "User Email",
      "Plan",
      "Rating (Stars)",
      "Trigger",
      "Primary Use Case",
      "Requested Feature",
      "Tags",
      "Comment",
    ]
      .map(escapeCsvCell)
      .join(","),
  ];

  for (const e of overview.entries) {
    lines.push(
      [
        e.createdAtIso,
        e.userName,
        e.userEmail,
        e.planTier,
        e.rating,
        e.triggerMoment,
        e.primaryUseCase ?? "",
        e.topFeatureRequest ?? "",
        e.sentimentTags.join(" | "),
        e.comment ?? "",
      ]
        .map(escapeCsvCell)
        .join(","),
    );
  }

  return lines.join("\n");
}
