import {
  and,
  count,
  desc,
  eq,
  ilike,
  inArray,
  isNull,
} from "@casefolio/db";
import { renderAndDeliverEmail } from "@/lib/auth/email";
import { db, dbSchema } from "@/lib/db";
import {
  formatExportFormatShortLabel,
  isKnownNotificationKind,
  matchesNotificationFilter,
  type NotificationFilterKey,
  type NotificationItem,
  type NotificationKind,
} from "@/lib/notifications/types";
import { resolvePublicAppBaseUrl } from "@/lib/projects/publish";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface SentNotificationEmailAudit {
  kind: NotificationKind;
  subject: string;
  deliveredViaResend: boolean;
  htmlLength: number;
  timestamp: string;
}

const globalEmailAuditStore = globalThis as unknown as {
  __casefolioNotificationEmailAudits?: SentNotificationEmailAudit[];
};

function recordNotificationEmailAudit(entry: SentNotificationEmailAudit): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (!globalEmailAuditStore.__casefolioNotificationEmailAudits) {
    globalEmailAuditStore.__casefolioNotificationEmailAudits = [];
  }
  const list = globalEmailAuditStore.__casefolioNotificationEmailAudits;
  list.push(entry);
  if (list.length > 100) {
    list.splice(0, list.length - 100);
  }
}

export function getNotificationEmailAuditsForDev(): SentNotificationEmailAudit[] {
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  return [...(globalEmailAuditStore.__casefolioNotificationEmailAudits ?? [])];
}

export function clearNotificationEmailAuditsForDev(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  globalEmailAuditStore.__casefolioNotificationEmailAudits = [];
}

function serializeNotificationRow(
  row: typeof dbSchema.notifications.$inferSelect,
): NotificationItem {
  const payload = row.payload ?? {};
  const kind: NotificationKind = isKnownNotificationKind(row.kind)
    ? row.kind
    : "export_ready";
  const title =
    typeof payload.title === "string" && payload.title.trim().length > 0
      ? payload.title.trim()
      : "Notification";
  const message =
    typeof payload.message === "string" && payload.message.trim().length > 0
      ? payload.message.trim()
      : "";
  const href =
    typeof payload.href === "string" && payload.href.trim().length > 0
      ? payload.href.trim()
      : null;

  return {
    id: row.id,
    userId: row.userId,
    kind,
    title,
    message,
    href,
    isRead: row.readAt !== null,
    readAtIso: row.readAt ? row.readAt.toISOString() : null,
    createdAtIso: row.createdAt.toISOString(),
    meta: payload,
  };
}

export interface CreateUserNotificationInput {
  userId: string;
  recipientEmail?: string | null;
  kind: NotificationKind;
  title: string;
  message: string;
  href?: string | null;
  meta?: Record<string, unknown>;
  sendEmail?: boolean;
  emailSubject?: string;
  emailCtaLabel?: string;
  appUrl?: string;
  deliverEmailFn?: typeof renderAndDeliverEmail;
}

export async function createUserNotification(
  input: CreateUserNotificationInput,
): Promise<{
  notification: NotificationItem;
  emailSent: boolean;
  emailPrepared: boolean;
}> {
  const payload: Record<string, unknown> = {
    ...(input.meta ?? {}),
    title: input.title,
    message: input.message,
    href: input.href ?? null,
  };

  const [inserted] = await db
    .insert(dbSchema.notifications)
    .values({
      userId: input.userId,
      kind: input.kind,
      payload,
    })
    .returning();

  if (!inserted) {
    throw new Error("Failed to insert notification record.");
  }

  let emailSent = false;
  let emailPrepared = false;

  if (input.sendEmail) {
    let targetEmail = input.recipientEmail?.trim() || null;
    if (!targetEmail) {
      const [userRow] = await db
        .select({ email: dbSchema.users.email })
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, input.userId))
        .limit(1);
      targetEmail = userRow?.email ?? null;
    }

    if (targetEmail) {
      const baseUrl = (input.appUrl ?? resolvePublicAppBaseUrl()).replace(/\/+$/, "");
      const ctaUrl = input.href
        ? input.href.startsWith("http")
          ? input.href
          : `${baseUrl}${input.href.startsWith("/") ? "" : "/"}${input.href}`
        : `${baseUrl}/notifications`;

      const subject = input.emailSubject ?? `${input.title} — Casefolio`;
      const deliverFn = input.deliverEmailFn ?? renderAndDeliverEmail;

      try {
        const result = await deliverFn({
          to: targetEmail,
          subject,
          template: {
            previewText: input.message,
            heading: input.title,
            body: input.message,
            ctaLabel: input.emailCtaLabel ?? "Open in Casefolio",
            ctaUrl,
            footerNote:
              "You received this notification because of activity in your Casefolio workspace.",
          },
        });
        emailPrepared = result.html.length > 0;
        emailSent = result.delivered;

        recordNotificationEmailAudit({
          kind: input.kind,
          subject,
          deliveredViaResend: result.delivered,
          htmlLength: result.html.length,
          timestamp: new Date().toISOString(),
        });
      } catch {
        // Resend network errors should not roll back the saved in-app notification
      }
    }
  }

  return {
    notification: serializeNotificationRow(inserted),
    emailSent,
    emailPrepared,
  };
}

export async function getUnreadNotificationCount(userId: string): Promise<number> {
  if (!UUID_REGEX.test(userId)) {
    return 0;
  }

  const [row] = await db
    .select({ total: count() })
    .from(dbSchema.notifications)
    .where(
      and(
        eq(dbSchema.notifications.userId, userId),
        isNull(dbSchema.notifications.readAt),
      ),
    );

  return Number(row?.total ?? 0);
}

export async function listNotificationsForUser(
  userId: string,
  options?: {
    filter?: NotificationFilterKey;
    limit?: number;
  },
): Promise<{
  unreadCount: number;
  notifications: NotificationItem[];
}> {
  if (!UUID_REGEX.test(userId)) {
    return { unreadCount: 0, notifications: [] };
  }

  const limit = Math.min(100, Math.max(1, options?.limit ?? 50));
  const filter = options?.filter ?? "all";

  const [unreadCount, rows] = await Promise.all([
    getUnreadNotificationCount(userId),
    db
      .select()
      .from(dbSchema.notifications)
      .where(eq(dbSchema.notifications.userId, userId))
      .orderBy(desc(dbSchema.notifications.createdAt))
      .limit(100),
  ]);

  const mapped = rows.map(serializeNotificationRow);
  const filtered = mapped.filter((item) => matchesNotificationFilter(item, filter));

  return {
    unreadCount,
    notifications: filtered.slice(0, limit),
  };
}

export async function markNotificationReadForUser(
  userId: string,
  notificationId: string,
): Promise<boolean> {
  if (!UUID_REGEX.test(userId) || !UUID_REGEX.test(notificationId)) {
    return false;
  }

  const [updated] = await db
    .update(dbSchema.notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(dbSchema.notifications.id, notificationId),
        eq(dbSchema.notifications.userId, userId),
      ),
    )
    .returning({ id: dbSchema.notifications.id });

  return Boolean(updated);
}

export async function markAllNotificationsReadForUser(userId: string): Promise<number> {
  if (!UUID_REGEX.test(userId)) {
    return 0;
  }

  const updated = await db
    .update(dbSchema.notifications)
    .set({
      readAt: new Date(),
    })
    .where(
      and(
        eq(dbSchema.notifications.userId, userId),
        isNull(dbSchema.notifications.readAt),
      ),
    )
    .returning({ id: dbSchema.notifications.id });

  return updated.length;
}

// ============================================================================
// Domain Notification Triggers (C-803)
// ============================================================================

export async function notifyExportFinished(args: {
  exportId: string;
  projectId: string;
  format: "png_long" | "pdf" | "behance";
  status: "completed" | "failed";
  appUrl?: string;
  error?: string;
}): Promise<void> {
  if (!UUID_REGEX.test(args.projectId) || !UUID_REGEX.test(args.exportId)) {
    return;
  }

  const [projectRow] = await db
    .select({
      projectId: dbSchema.projects.id,
      projectName: dbSchema.projects.name,
      ownerId: dbSchema.projects.ownerId,
      ownerEmail: dbSchema.users.email,
    })
    .from(dbSchema.projects)
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .where(eq(dbSchema.projects.id, args.projectId))
    .limit(1);

  if (!projectRow) {
    return;
  }

  const kind: NotificationKind =
    args.status === "completed" ? "export_ready" : "export_failed";

  // Deduplicate by exportId + kind so retries never emit duplicate notifications
  const existingRows = await db
    .select({
      id: dbSchema.notifications.id,
      payload: dbSchema.notifications.payload,
    })
    .from(dbSchema.notifications)
    .where(
      and(
        eq(dbSchema.notifications.userId, projectRow.ownerId),
        eq(dbSchema.notifications.kind, kind),
      ),
    )
    .orderBy(desc(dbSchema.notifications.createdAt))
    .limit(20);

  const alreadyExists = existingRows.some(
    (row) => row.payload?.exportId === args.exportId,
  );
  if (alreadyExists) {
    return;
  }

  const formatLabel = formatExportFormatShortLabel(args.format);
  const exportsHref = `/projects/${projectRow.projectId}/exports`;

  if (args.status === "completed") {
    await createUserNotification({
      userId: projectRow.ownerId,
      recipientEmail: projectRow.ownerEmail,
      kind: "export_ready",
      title: "Export ready",
      message: `“${projectRow.projectName}” ${formatLabel} is ready to download.`,
      href: exportsHref,
      meta: {
        exportId: args.exportId,
        projectId: projectRow.projectId,
        format: args.format,
      },
      sendEmail: true,
      emailSubject: `Your ${formatLabel} export for “${projectRow.projectName}” is ready`,
      emailCtaLabel: "Download export",
      appUrl: args.appUrl,
    });
  } else {
    await createUserNotification({
      userId: projectRow.ownerId,
      recipientEmail: projectRow.ownerEmail,
      kind: "export_failed",
      title: "Export failed",
      message: `“${projectRow.projectName}” couldn’t render. Retry from Exports.`,
      href: exportsHref,
      meta: {
        exportId: args.exportId,
        projectId: projectRow.projectId,
        format: args.format,
      },
      sendEmail: true,
      emailSubject: `Export failed for “${projectRow.projectName}”`,
      emailCtaLabel: "View exports",
      appUrl: args.appUrl,
    });
  }
}

export async function notifyPaymentIssue(args: {
  userId: string;
  plan?: string | null;
  eventId?: string;
  appUrl?: string;
}): Promise<void> {
  if (!UUID_REGEX.test(args.userId)) {
    return;
  }

  const tierTitle =
    args.plan === "plus" ? "Plus" : args.plan === "team" ? "Team" : "Pro";

  await createUserNotification({
    userId: args.userId,
    kind: "payment_failed",
    title: "Payment failed",
    message: `We couldn’t process your ${tierTitle} subscription renewal. Update your payment method to avoid interruption.`,
    href: "/account/billing",
    meta: {
      plan: args.plan ?? "pro",
      eventId: args.eventId ?? null,
    },
    sendEmail: true,
    emailSubject: "Action needed: Casefolio payment failed",
    emailCtaLabel: "Update payment method",
    appUrl: args.appUrl,
  });
}

export async function notifyTeamInviteIfExistingUser(args: {
  invitedEmail: string;
  organizationName: string;
  role: string;
  invitationId: string;
  sendEmail?: boolean;
  appUrl?: string;
}): Promise<boolean> {
  const cleanEmail = args.invitedEmail.trim();
  if (!cleanEmail) return false;

  const [existingUser] = await db
    .select({
      id: dbSchema.users.id,
      email: dbSchema.users.email,
    })
    .from(dbSchema.users)
    .where(ilike(dbSchema.users.email, cleanEmail))
    .limit(1);

  if (!existingUser) {
    return false;
  }

  const acceptHref = `/account/team?invitationId=${encodeURIComponent(args.invitationId)}`;

  await createUserNotification({
    userId: existingUser.id,
    recipientEmail: existingUser.email,
    kind: "team_invite",
    title: "Team invitation",
    message: `You were invited to collaborate in ${args.organizationName} as ${args.role}.`,
    href: acceptHref,
    meta: {
      invitationId: args.invitationId,
      organizationName: args.organizationName,
      role: args.role,
    },
    sendEmail: Boolean(args.sendEmail),
    emailSubject: `Join ${args.organizationName} on Casefolio`,
    emailCtaLabel: "Accept invitation",
    appUrl: args.appUrl,
  });

  return true;
}

export async function notifyTemplateVersionPublished(args: {
  templateId: string;
  templateName: string;
  version: string;
  appUrl?: string;
}): Promise<number> {
  if (!UUID_REGEX.test(args.templateId)) {
    return 0;
  }

  const versions = await db
    .select({ id: dbSchema.templateVersions.id })
    .from(dbSchema.templateVersions)
    .where(eq(dbSchema.templateVersions.templateId, args.templateId));

  if (versions.length === 0) {
    return 0;
  }

  const versionIds = versions.map((v) => v.id);
  const projectOwners = await db
    .select({
      ownerId: dbSchema.projects.ownerId,
      ownerEmail: dbSchema.users.email,
    })
    .from(dbSchema.projects)
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .where(inArray(dbSchema.projects.templateVersionId, versionIds));

  const uniqueOwners = new Map<string, string>();
  for (const row of projectOwners) {
    uniqueOwners.set(row.ownerId, row.ownerEmail);
  }

  let countSent = 0;
  for (const [ownerId, ownerEmail] of uniqueOwners.entries()) {
    await createUserNotification({
      userId: ownerId,
      recipientEmail: ownerEmail,
      kind: "template_update",
      title: "Template updated",
      message: `${args.templateName} v${args.version} is now available in the template library.`,
      href: "/templates",
      meta: {
        templateId: args.templateId,
        templateName: args.templateName,
        version: args.version,
      },
      sendEmail: true,
      emailSubject: `${args.templateName} v${args.version} is now available on Casefolio`,
      emailCtaLabel: "Browse templates",
      appUrl: args.appUrl,
    });
    countSent += 1;
  }

  return countSent;
}

export async function notifyProjectPublished(args: {
  userId: string;
  projectId: string;
  projectName: string;
  slug: string;
}): Promise<void> {
  if (!UUID_REGEX.test(args.userId) || !UUID_REGEX.test(args.projectId)) {
    return;
  }

  await createUserNotification({
    userId: args.userId,
    kind: "published",
    title: "Published",
    message: `${args.projectName} is live at /p/${args.slug}.`,
    href: `/p/${args.slug}`,
    meta: {
      projectId: args.projectId,
      slug: args.slug,
    },
    sendEmail: false,
  });
}
