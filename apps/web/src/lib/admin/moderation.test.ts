// @vitest-environment node
import { desc, eq, inArray } from "@casefolio/db";
import { afterAll, describe, expect, it } from "vitest";
import {
  listAdminModerationQueue,
  resolveModerationForProject,
  submitPublicProjectReport,
} from "@/lib/admin/moderation";
import { db, dbSchema } from "@/lib/db";
import { getPublishedProjectBySlug } from "@/lib/projects/publish";

const createdProjectIds: string[] = [];
const createdUserIds: string[] = [];

afterAll(async () => {
  if (createdProjectIds.length > 0) {
    await db
      .delete(dbSchema.reports)
      .where(inArray(dbSchema.reports.projectId, createdProjectIds));
    await db
      .delete(dbSchema.projects)
      .where(inArray(dbSchema.projects.id, createdProjectIds));
  }
  if (createdUserIds.length > 0) {
    await db
      .delete(dbSchema.notifications)
      .where(inArray(dbSchema.notifications.userId, createdUserIds));
    await db
      .delete(dbSchema.auditLogs)
      .where(inArray(dbSchema.auditLogs.actorId, createdUserIds));
    await db.delete(dbSchema.users).where(inArray(dbSchema.users.id, createdUserIds));
  }
});

describe("Admin moderation service (C-905)", () => {
  it("accepts public reports, queues flagged case studies, unpublishes on takedown (making /p/[slug] 404), and writes audit log entries", async () => {
    const suffix = `${Date.now()}-${Math.floor(Math.random() * 10_000)}`;
    const slug = `c905-flagged-${suffix}`;

    const [adminUser] = await db
      .insert(dbSchema.users)
      .values({
        email: `c905-admin-${suffix}@casefolio.test`,
        name: "C905 Moderator",
        role: "admin",
        emailVerified: true,
      })
      .returning();

    const [authorUser] = await db
      .insert(dbSchema.users)
      .values({
        email: `c905-author-${suffix}@casefolio.test`,
        name: "C905 Author",
        role: "user",
        emailVerified: true,
      })
      .returning();

    if (!adminUser || !authorUser) {
      throw new Error("Failed to seed C-905 test users");
    }
    createdUserIds.push(adminUser.id, authorUser.id);

    const [orbitTpl] = await db
      .select({ id: dbSchema.templates.id })
      .from(dbSchema.templates)
      .where(eq(dbSchema.templates.slug, "orbit"))
      .limit(1);
    const [tplVer] = orbitTpl
      ? await db
          .select()
          .from(dbSchema.templateVersions)
          .where(eq(dbSchema.templateVersions.templateId, orbitTpl.id))
          .limit(1)
      : await db.select().from(dbSchema.templateVersions).limit(1);
    if (!tplVer) {
      throw new Error("Expected at least one seeded template_version");
    }

    const docData = tplVer.data as { puckData?: Record<string, unknown>; theme?: Record<string, unknown> };

    const [project] = await db
      .insert(dbSchema.projects)
      .values({
        ownerId: authorUser.id,
        templateVersionId: tplVer.id,
        name: "Crypto Pump Landing",
        type: "web",
        puckData: docData.puckData ?? { content: [], root: {} },
        theme: docData.theme ?? {},
        slug,
        visibility: "public",
        publishedAt: new Date(),
      })
      .returning();

    if (!project) {
      throw new Error("Failed to insert test project");
    }
    createdProjectIds.push(project.id);

    // Confirm public page initially resolves (200)
    const beforeTakedown = await getPublishedProjectBySlug(slug);
    expect(beforeTakedown).not.toBeNull();
    expect(beforeTakedown?.project.id).toBe(project.id);

    // Submit 2 public reports
    const r1 = await submitPublicProjectReport({
      input: {
        projectId: project.id,
        category: "Spam or scam",
        details: "Promotes a token scheme and links to an external wallet.",
      },
    });
    const r2 = await submitPublicProjectReport({
      input: {
        projectId: project.id,
        category: "Phishing or malware",
      },
    });
    expect(r1.ok).toBe(true);
    expect(r2.ok).toBe(true);

    const queue = await listAdminModerationQueue();
    const flaggedItem = queue.items.find(
      (i) => i.projectId === project.id && i.queueBucket === "open",
    );
    expect(flaggedItem).toBeDefined();
    expect(flaggedItem?.reportCount).toBe(2);

    // Execute takedown
    const takedownRes = await resolveModerationForProject({
      actorId: adminUser.id,
      projectId: project.id,
      decision: "takedown",
    });
    expect(takedownRes).toEqual({ ok: true, slug, decision: "takedown" });

    // Confirm public page now resolves to null -> HTTP 404
    const afterTakedown = await getPublishedProjectBySlug(slug);
    expect(afterTakedown).toBeNull();

    // Confirm owner keeps draft in DB
    const [draftRow] = await db
      .select()
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.id, project.id))
      .limit(1);
    expect(draftRow?.visibility).toBe("private");
    expect(draftRow?.publishedAt).toBeNull();

    // Confirm owner notification created
    const ownerNotifs = await db
      .select()
      .from(dbSchema.notifications)
      .where(eq(dbSchema.notifications.userId, authorUser.id));
    expect(ownerNotifs.some((n) => n.kind === "moderation_takedown")).toBe(true);

    // Also test dismissing a separate report on a second project
    const [secondProject] = await db
      .insert(dbSchema.projects)
      .values({
        ownerId: authorUser.id,
        templateVersionId: tplVer.id,
        name: "Benign Portfolio Study",
        type: "mobile",
        puckData: docData.puckData ?? { content: [], root: {} },
        theme: docData.theme ?? {},
        slug: `c905-benign-${suffix}`,
        visibility: "public",
        publishedAt: new Date(),
      })
      .returning();
    if (!secondProject) throw new Error("Failed to insert second project");
    createdProjectIds.push(secondProject.id);

    await submitPublicProjectReport({
      input: {
        projectId: secondProject.id,
        category: "Other policy violation",
      },
    });

    const dismissRes = await resolveModerationForProject({
      actorId: adminUser.id,
      projectId: secondProject.id,
      decision: "dismiss",
    });
    expect(dismissRes.ok).toBe(true);

    // Confirm audit_logs contains both takedown and dismissed entries
    const logs = await db
      .select()
      .from(dbSchema.auditLogs)
      .where(eq(dbSchema.auditLogs.actorId, adminUser.id))
      .orderBy(desc(dbSchema.auditLogs.at));
    const actions = logs.map((l) => l.action);
    expect(actions).toContain("admin.moderation.takedown");
    expect(actions).toContain("admin.moderation.dismissed");
  });
});
