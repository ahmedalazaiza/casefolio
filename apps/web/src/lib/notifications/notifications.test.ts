// @vitest-environment node
import { randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq, inArray } from "@casefolio/db";
import { describe, expect, it, vi } from "vitest";
import { renderAndDeliverEmail } from "@/lib/auth/email";
import { db, dbSchema } from "@/lib/db";
import {
  clearNotificationEmailAuditsForDev,
  createUserNotification,
  getNotificationEmailAuditsForDev,
  getUnreadNotificationCount,
  listNotificationsForUser,
  markAllNotificationsReadForUser,
  markNotificationReadForUser,
  notifyExportFinished,
  notifyPaymentIssue,
  notifyProjectPublished,
  notifyTeamInviteIfExistingUser,
} from "@/lib/notifications/service";
import {
  formatRelativeNotificationTime,
  markNotificationsInputSchema,
  matchesNotificationFilter,
} from "@/lib/notifications/types";
import { createProjectFromTemplate } from "@/lib/projects/service";
import { publishTemplateVersion, saveTemplateDraftFromWizard } from "@/lib/template/service";

function readOrbitJson(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf-8");
    }
  }
  throw new Error("Missing reference/template.example.json");
}

describe("notifications service — in-app + Resend email triggers (C-803)", () => {
  it("validates notification schemas, filter matching, and relative time formatting", () => {
    const validOne = markNotificationsInputSchema.safeParse({
      action: "mark_one",
      notificationId: randomUUID(),
    });
    expect(validOne.success).toBe(true);

    const invalidOne = markNotificationsInputSchema.safeParse({
      action: "mark_one",
      notificationId: "not-a-uuid",
    });
    expect(invalidOne.success).toBe(false);

    expect(
      matchesNotificationFilter({ kind: "export_ready", isRead: false }, "exports"),
    ).toBe(true);
    expect(
      matchesNotificationFilter({ kind: "payment_failed", isRead: true }, "billing"),
    ).toBe(true);
    expect(
      matchesNotificationFilter({ kind: "payment_failed", isRead: true }, "unread"),
    ).toBe(false);

    const baseNow = new Date("2026-11-05T12:00:00.000Z");
    expect(
      formatRelativeNotificationTime("2026-11-05T11:58:00.000Z", baseNow),
    ).toBe("2 min ago");
    expect(
      formatRelativeNotificationTime("2026-11-05T09:00:00.000Z", baseNow),
    ).toBe("3 h ago");
    expect(
      formatRelativeNotificationTime("2026-11-04T10:00:00.000Z", baseNow),
    ).toBe("Yesterday");
  });

  it("creates in-app notifications, renders React Email payloads, enforces user isolation, and deduplicates export notifications", async () => {
    const stamp = Date.now();
    const rawOrbit = readOrbitJson();
    const createdUserIds: string[] = [];
    let createdTemplateId: string | null = null;

    clearNotificationEmailAuditsForDev();

    try {
      const [owner] = await db
        .insert(dbSchema.users)
        .values({
          email: `c803-owner-${stamp}@casefolio.test`,
          name: "Nadia Al-Mansoor",
          emailVerified: true,
          plan: "pro",
        })
        .returning({ id: dbSchema.users.id, email: dbSchema.users.email });

      const [teammate] = await db
        .insert(dbSchema.users)
        .values({
          email: `c803-teammate-${stamp}@casefolio.test`,
          name: "Tariq Darwish",
          emailVerified: true,
          plan: "free",
        })
        .returning({ id: dbSchema.users.id, email: dbSchema.users.email });

      createdUserIds.push(owner!.id, teammate!.id);

      const draft = await saveTemplateDraftFromWizard({
        actorId: owner!.id,
        rawJson: rawOrbit,
        metadata: {
          name: "Orbit Notifications Test",
          slug: `c803-orbit-${stamp}`,
          type: "mobile",
          category: "Fintech",
          tier: "free",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
        },
      });
      expect(draft.ok).toBe(true);
      if (!draft.ok) return;
      createdTemplateId = draft.templateId;

      await publishTemplateVersion({
        actorId: owner!.id,
        templateId: draft.templateId,
        versionId: draft.versionId,
      });

      const projectResult = await createProjectFromTemplate({
        userId: owner!.id,
        userPlan: "pro",
        input: {
          type: "mobile",
          templateId: draft.templateId,
          name: "Orbit Mobile Banking",
        },
      });
      expect(projectResult.ok).toBe(true);
      if (!projectResult.ok) return;

      // 1. Direct notification + React Email render verification via injected deliverEmailFn
      const deliveredPayloads: Array<{ to: string; subject: string; html: string }> = [];
      const mockDeliverFn: typeof renderAndDeliverEmail = vi.fn(async (opts) => {
        const rendered = await renderAndDeliverEmail(opts);
        deliveredPayloads.push({
          to: opts.to,
          subject: opts.subject,
          html: rendered.html,
        });
        return {
          delivered: true,
          html: rendered.html,
          text: rendered.text,
        };
      });

      const customResult = await createUserNotification({
        userId: owner!.id,
        kind: "payment_failed",
        title: "Payment failed",
        message: "Update your card to keep Pro benefits active.",
        href: "/account/billing",
        sendEmail: true,
        emailSubject: "Action needed: Casefolio payment failed",
        emailCtaLabel: "Update payment method",
        appUrl: "https://casefolio.app",
        deliverEmailFn: mockDeliverFn,
      });

      expect(customResult.emailPrepared).toBe(true);
      expect(customResult.emailSent).toBe(true);
      expect(deliveredPayloads).toHaveLength(1);
      expect(deliveredPayloads[0]?.to).toBe(owner!.email);
      expect(deliveredPayloads[0]?.html).toContain("Payment failed");
      expect(deliveredPayloads[0]?.html).toContain("https://casefolio.app/account/billing");

      // Zero PII in dev email audit trail
      const audits = getNotificationEmailAuditsForDev();
      expect(audits.length).toBeGreaterThanOrEqual(1);
      expect(JSON.stringify(audits)).not.toContain(owner!.email);

      // 2. Domain triggers: export ready (with deduplication), published, payment issue, team invite
      const exportId = randomUUID();
      await notifyExportFinished({
        exportId,
        projectId: projectResult.projectId,
        format: "pdf",
        status: "completed",
        appUrl: "http://localhost:3000",
      });

      // Second call for the same exportId must be deduplicated
      await notifyExportFinished({
        exportId,
        projectId: projectResult.projectId,
        format: "pdf",
        status: "completed",
        appUrl: "http://localhost:3000",
      });

      await notifyProjectPublished({
        userId: owner!.id,
        projectId: projectResult.projectId,
        projectName: "Orbit Mobile Banking",
        slug: `orbit-live-${stamp}`,
      });

      await notifyPaymentIssue({
        userId: owner!.id,
        plan: "pro",
        eventId: `evt_${stamp}`,
      });

      const invitedExisting = await notifyTeamInviteIfExistingUser({
        invitedEmail: teammate!.email,
        organizationName: "Nadia Studio",
        role: "member",
        invitationId: `inv_${stamp}`,
        sendEmail: false,
      });
      expect(invitedExisting).toBe(true);

      // Verify owner notifications list & filter queries
      const allOwner = await listNotificationsForUser(owner!.id, { filter: "all" });
      expect(allOwner.unreadCount).toBe(4);
      expect(allOwner.notifications).toHaveLength(4);

      const exportOnly = await listNotificationsForUser(owner!.id, { filter: "exports" });
      expect(exportOnly.notifications).toHaveLength(1);
      expect(exportOnly.notifications[0]?.title).toBe("Export ready");
      expect(exportOnly.notifications[0]?.message).toContain("PDF is ready to download");

      const billingOnly = await listNotificationsForUser(owner!.id, { filter: "billing" });
      expect(billingOnly.notifications).toHaveLength(2);

      // Verify teammate received team invite
      const teammateTeamList = await listNotificationsForUser(teammate!.id, {
        filter: "team",
      });
      expect(teammateTeamList.notifications).toHaveLength(1);
      expect(teammateTeamList.notifications[0]?.title).toBe("Team invitation");

      // Cross-user isolation: teammate cannot mark owner's notification as read
      const targetNotifId = exportOnly.notifications[0]!.id;
      const crossUserAttempt = await markNotificationReadForUser(
        teammate!.id,
        targetNotifId,
      );
      expect(crossUserAttempt).toBe(false);
      expect(await getUnreadNotificationCount(owner!.id)).toBe(4);

      // Owner marks one notification as read
      const markOneOk = await markNotificationReadForUser(owner!.id, targetNotifId);
      expect(markOneOk).toBe(true);
      expect(await getUnreadNotificationCount(owner!.id)).toBe(3);

      // Owner marks remaining notifications as read
      const markedCount = await markAllNotificationsReadForUser(owner!.id);
      expect(markedCount).toBe(3);
      expect(await getUnreadNotificationCount(owner!.id)).toBe(0);

      const unreadAfter = await listNotificationsForUser(owner!.id, {
        filter: "unread",
      });
      expect(unreadAfter.notifications).toHaveLength(0);
    } finally {
      if (createdUserIds.length > 0) {
        await db
          .delete(dbSchema.projects)
          .where(inArray(dbSchema.projects.ownerId, createdUserIds));
      }
      if (createdTemplateId) {
        await db
          .delete(dbSchema.templates)
          .where(eq(dbSchema.templates.id, createdTemplateId));
      }
      if (createdUserIds.length > 0) {
        await db
          .delete(dbSchema.users)
          .where(inArray(dbSchema.users.id, createdUserIds));
      }
    }
  });
});
