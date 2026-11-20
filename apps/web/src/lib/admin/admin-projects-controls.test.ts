// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { afterEach, describe, expect, it } from "vitest";
import { getAdminPlatformAnalytics } from "@/lib/admin/overview";
import {
  listAdminProjectsOverview,
  performAdminProjectAction,
} from "@/lib/admin/projects";
import {
  permanentlyDeleteAdminUser,
  revokeAdminUserSessions,
  setAdminUserPlanOverride,
  verifyAdminUserEmail,
} from "@/lib/admin/users";
import { PRO_MAX_PROJECTS } from "@/lib/billing/plans";
import { db, dbSchema } from "@/lib/db";

const createdUserIds: string[] = [];

afterEach(async () => {
  for (const uid of createdUserIds.splice(0, createdUserIds.length)) {
    await db.delete(dbSchema.users).where(eq(dbSchema.users.id, uid)).catch(() => undefined);
  }
});

describe("Admin All-Projects Explorer, Full User Controls & Extended Telemetry", () => {
  it("lists platform projects with owner info and allows admin unpublish & deletion", async () => {
    const adminId = randomUUID();
    const userId = randomUUID();
    const wsId = randomUUID();
    const tplId = randomUUID();
    const verId = randomUUID();
    const projId = randomUUID();

    await db.insert(dbSchema.users).values([
      {
        id: adminId,
        name: "Super Admin",
        email: `sup-${adminId}@example.com`,
        emailVerified: true,
        role: "superadmin",
        plan: "free",
      },
      {
        id: userId,
        name: "Project Owner",
        email: `owner-${userId}@example.com`,
        emailVerified: false,
        role: "user",
        plan: "free",
      },
    ]);
    createdUserIds.push(adminId, userId);

    await db.insert(dbSchema.workspaces).values({
      id: wsId,
      kind: "personal",
      personalOwnerId: userId,
      name: "Owner Personal",
      slug: `ws-${wsId.slice(0, 8)}`,
      maxCaseStudies: 1,
    });

    await db.insert(dbSchema.templates).values({
      id: tplId,
      slug: `tpl-${tplId.slice(0, 8)}`,
      name: "Admin Proj Template",
      type: "web",
      tier: "free",
      status: "published",
      coverUrl: "/cdn/covers/sample.png",
    });

    await db.insert(dbSchema.templateVersions).values({
      id: verId,
      templateId: tplId,
      version: "1.0.0",
      data: { template: { slots: {} } },
    });

    await db.insert(dbSchema.projects).values({
      id: projId,
      ownerId: userId,
      workspaceId: wsId,
      templateVersionId: verId,
      name: "Fintech Checkout Case Study",
      slug: `fintech-${projId.slice(0, 8)}`,
      type: "web",
      puckData: {},
      theme: {},
      visibility: "public",
      publishedAt: new Date(),
    });

    // Explorer surfaces project with owner link data
    const explorer = await listAdminProjectsOverview({ ownerId: userId });
    expect(explorer.projects).toHaveLength(1);
    expect(explorer.projects[0]?.ownerName).toBe("Project Owner");
    expect(explorer.projects[0]?.ownerId).toBe(userId);

    // Admin unpublish transitions to private
    const unpub = await performAdminProjectAction({
      actorId: adminId,
      actorRole: "superadmin",
      projectId: projId,
      action: "unpublish",
    });
    expect(unpub.ok).toBe(true);

    const afterUnpub = await listAdminProjectsOverview({ ownerId: userId });
    expect(afterUnpub.projects[0]?.visibility).toBe("private");

    // Admin user controls: verify email, override plan -> pro, revoke sessions
    const verifyRes = await verifyAdminUserEmail({ actorId: adminId, targetUserId: userId });
    expect(verifyRes.ok).toBe(true);

    const planRes = await setAdminUserPlanOverride({
      actorId: adminId,
      actorRole: "superadmin",
      targetUserId: userId,
      plan: "pro",
    });
    expect(planRes.ok).toBe(true);

    const [updatedWs] = await db
      .select({ maxCaseStudies: dbSchema.workspaces.maxCaseStudies })
      .from(dbSchema.workspaces)
      .where(eq(dbSchema.workspaces.id, wsId));
    expect(updatedWs?.maxCaseStudies).toBe(PRO_MAX_PROJECTS);

    await db.insert(dbSchema.sessions).values({
      userId,
      token: `tok-${randomUUID()}`,
      expiresAt: new Date(Date.now() + 86_400_000),
    });
    await revokeAdminUserSessions({ actorId: adminId, targetUserId: userId });
    const remainingSessions = await db
      .select({ id: dbSchema.sessions.id })
      .from(dbSchema.sessions)
      .where(eq(dbSchema.sessions.userId, userId));
    expect(remainingSessions).toHaveLength(0);

    // Non-superadmin cannot permanently erase user
    const blockedDel = await permanentlyDeleteAdminUser({
      actorId: adminId,
      actorRole: "admin",
      targetUserId: userId,
    });
    expect(blockedDel.ok).toBe(false);

    // Superadmin can permanently delete user and cascade projects
    const delRes = await permanentlyDeleteAdminUser({
      actorId: adminId,
      actorRole: "superadmin",
      targetUserId: userId,
    });
    expect(delRes.ok).toBe(true);

    const afterPurgeProjects = await listAdminProjectsOverview({ ownerId: userId });
    expect(afterPurgeProjects.projects).toHaveLength(0);

    // Analytics telemetry includes subscribers, exports, visits, and feedback
    const analytics = await getAdminPlatformAnalytics("30d");
    expect(analytics.telemetry).toBeDefined();
    expect(analytics.telemetry?.viewsByBucket).toHaveLength(12);
    expect(analytics.telemetry?.subscribers.mrrUsd).toBeGreaterThanOrEqual(0);
  });
});
