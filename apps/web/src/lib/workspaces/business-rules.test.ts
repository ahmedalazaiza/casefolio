// @vitest-environment node
import { randomUUID } from "node:crypto";
import { backfillBusinessTenancy, eq, gt, inArray, seedDatabase } from "@casefolio/db";
import {
  isAllowedExportWorkerRequestUrl,
  processExportJob,
} from "@casefolio/worker";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { env } from "@/env";
import { getProjectAnalyticsForActor } from "@/lib/analytics/page-views";
import {
  completeSandboxCheckoutForUser,
  confirmTeamSeatIncrease,
  previewTeamSeatIncrease,
  scheduleTeamSeatDecrease,
} from "@/lib/billing/service";
import { resolveServerPaddlePriceId } from "@/lib/billing/server-config";
import { signPaddleWebhookPayload } from "@/lib/billing/signature";
import { handleSignedPaddleWebhookRequest } from "@/lib/billing/webhooks";
import { db, dbSchema } from "@/lib/db";
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
import {
  acceptTeamInvitation,
  createGatedTeamInvitation,
  normalizeInviteEmail,
  removeTeamMemberWithRecovery,
  revokeTeamInvitation,
} from "@/lib/entitlements/team-invitations";
import {
  authorizeAndReadExportFile,
  enqueueProjectExportForUser,
  getExportJobForUser,
  shutdownExportQueueForTests,
} from "@/lib/exports/service";
import {
  getPublishedProjectBySlug,
  publishProjectForUser,
} from "@/lib/projects/publish";
import {
  createProjectFromTemplate,
  getProjectEditorAccess,
  saveProjectEditorState,
} from "@/lib/projects/service";
import { resetUploadRateLimitsForTests } from "@/lib/storage/rate-limit";
import { deleteStoredObject, writeStoredObject } from "@/lib/storage/r2";
import { authorizeAndReadAsset } from "@/lib/storage/service";
import {
  authorizeProjectAccess,
  authorizeSpaceAccess,
} from "@/lib/workspaces/acl";
import {
  acquireOrRefreshEditLease,
  releaseEditLease,
} from "@/lib/workspaces/leases";
import {
  copyProjectAcrossWorkspaces,
  createSpaceForUser,
  exportProjectPortabilityJson,
  listRecoverySpacesForUser,
  listVisibleSpacesForWorkspace,
  transitionSpaceVisibility,
} from "@/lib/workspaces/service";

describe("Casefolio Business Model, Workspaces, Privacy & Billing Spec Suite (§15)", () => {
  const createdUserIds: string[] = [];
  const createdOrgIds: string[] = [];
  const createdR2Keys: string[] = [];
  let starterTemplateId = "";
  let starterTemplateVersionId = "";

  async function createVerifiedUser(label: string, emailOverride?: string) {
    const suffix = randomUUID().slice(0, 8);
    const email =
      emailOverride ?? `spec15-${label}-${suffix}@casefolio.test`.toLowerCase();
    const [row] = await db
      .insert(dbSchema.users)
      .values({
        email,
        name: `Spec15 ${label}`,
        emailVerified: true,
        plan: "free",
      })
      .returning();
    createdUserIds.push(row!.id);
    return row!;
  }

  async function createPaidTeamFixture(seats: number) {
    const owner = await createVerifiedUser("team-owner");
    const suffix = randomUUID().slice(0, 8);
    const [org] = await db
      .insert(dbSchema.organizations)
      .values({
        name: `Spec15 Studio ${suffix}`,
        slug: `spec15-studio-${suffix}`,
        seats: 1,
      })
      .returning();
    createdOrgIds.push(org!.id);

    await db.insert(dbSchema.memberships).values({
      userId: owner.id,
      orgId: org!.id,
      role: "owner",
    });

    const checkout = await completeSandboxCheckoutForUser(
      { id: owner.id, email: owner.email, name: owner.name },
      {
        plan: "team",
        interval: "monthly",
        orgId: org!.id,
        seats,
      },
    );
    expect(checkout.ok).toBe(true);

    const ensured = await ensureTeamWorkspaceForOrganization(org!.id, owner.id);
    return {
      owner,
      org: org!,
      workspaceId: ensured.workspaceId,
      defaultSharedSpaceId: ensured.defaultSharedSpaceId!,
      ownerPrivateSpaceId: ensured.memberPrivateSpaceId!,
    };
  }

  async function admitMemberToTeam(
    orgId: string,
    ownerId: string,
    role: "admin" | "member",
    label: string,
  ) {
    const user = await createVerifiedUser(label);
    const inv = await createGatedTeamInvitation({
      actorUserId: ownerId,
      rawInput: {
        organizationId: orgId,
        email: user.email,
        role,
      },
    });
    expect(inv.ok).toBe(true);
    if (!inv.ok) throw new Error(inv.error);

    const accepted = await acceptTeamInvitation({
      actorUserId: user.id,
      invitationId: inv.invitationId,
      token: inv.invitationToken,
    });
    expect(accepted.ok).toBe(true);
    if (!accepted.ok) throw new Error(accepted.error);

    return {
      user,
      privateSpaceId: accepted.privateSpaceId!,
    };
  }

  beforeAll(async () => {
    await seedDatabase(db);
    const [orbit] = await db
      .select()
      .from(dbSchema.templates)
      .where(eq(dbSchema.templates.slug, "orbit"))
      .limit(1);
    expect(orbit?.currentVersionId).toBeTruthy();
    starterTemplateId = orbit!.id;
    starterTemplateVersionId = orbit!.currentVersionId!;
  });

  afterAll(async () => {
    await shutdownExportQueueForTests();
    for (const key of createdR2Keys) {
      await deleteStoredObject(key).catch(() => undefined);
    }
    await db
      .delete(dbSchema.webhookEvents)
      .where(gt(dbSchema.webhookEvents.processedAt, new Date(Date.now() + 60 * 60 * 1000)));
    if (createdOrgIds.length > 0) {
      await db
        .delete(dbSchema.organizations)
        .where(inArray(dbSchema.organizations.id, createdOrgIds));
    }
    if (createdUserIds.length > 0) {
      await db
        .delete(dbSchema.projects)
        .where(inArray(dbSchema.projects.ownerId, createdUserIds));
      await db
        .delete(dbSchema.users)
        .where(inArray(dbSchema.users.id, createdUserIds));
    }
  });

  it("1. enforces strict Team Private Space isolation: Owner & Admin receive 404 on another member's private space, project, asset, export, analytics, and portability endpoints", async () => {
    resetUploadRateLimitsForTests();
    const team = await createPaidTeamFixture(3);
    const admin = await admitMemberToTeam(team.org.id, team.owner.id, "admin", "admin-a");
    const member = await admitMemberToTeam(team.org.id, team.owner.id, "member", "member-b");

    // Member creates a case study inside their Private Space in the Team workspace
    const createdProj = await createProjectFromTemplate({
      userId: member.user.id,
      userPlan: "free",
      orgId: team.org.id,
      input: {
        type: "mobile",
        templateId: starterTemplateId,
        name: "Confidential Stealth Banking Concept",
        spaceId: member.privateSpaceId,
      },
    });
    expect(createdProj.ok).toBe(true);
    if (!createdProj.ok) return;

    // Attach a private asset & a completed export job to Member's private project
    const r2Key = `workspaces/${team.workspaceId}/projects/${createdProj.projectId}/slots/hero/private-${randomUUID()}.png`;
    createdR2Keys.push(r2Key);
    await writeStoredObject(
      r2Key,
      new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
      { contentType: "image/png" },
    );

    const [asset] = await db
      .insert(dbSchema.assets)
      .values({
        projectId: createdProj.projectId,
        workspaceId: team.workspaceId,
        r2Key,
        slot: "hero.mockup",
        width: 900,
        height: 1950,
        bytes: 1024,
        mimeType: "image/png",
      })
      .returning();

    const exportQueued = await enqueueProjectExportForUser(
      { projectId: createdProj.projectId, format: "pdf" },
      { id: member.user.id, role: "user" },
      { enqueueJobFn: async () => undefined },
    );
    expect(exportQueued.ok).toBe(true);
    if (!exportQueued.ok) return;

    // Member's private space is visible to Member, NEVER listed for Owner or Admin
    const ownerVisibleSpaces = await listVisibleSpacesForWorkspace(
      team.workspaceId,
      team.owner.id,
    );
    const adminVisibleSpaces = await listVisibleSpacesForWorkspace(
      team.workspaceId,
      admin.user.id,
    );
    expect(ownerVisibleSpaces.some((s) => s.id === member.privateSpaceId)).toBe(false);
    expect(adminVisibleSpaces.some((s) => s.id === member.privateSpaceId)).toBe(false);

    // Owner & Admin probing Member's private space, project, editor, asset, export, analytics, and portability ALL receive 404 / NOT_FOUND
    for (const actor of [team.owner, admin.user]) {
      const spaceProbe = await authorizeSpaceAccess(member.privateSpaceId, actor.id, "read");
      expect(spaceProbe).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });

      const projProbe = await authorizeProjectAccess(createdProj.projectId, actor.id, "read");
      expect(projProbe).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });

      const editorProbe = await getProjectEditorAccess(createdProj.projectId, {
        id: actor.id,
        role: "user",
      });
      expect(editorProbe.status).toBe("not_found");

      const assetProbe = await authorizeAndReadAsset(asset!.id, {
        id: actor.id,
        role: "user",
        plan: "team",
      });
      expect(assetProbe.status).toBe("not_found");

      const exportJobProbe = await getExportJobForUser(exportQueued.exportJob.id, {
        id: actor.id,
        role: "user",
      });
      expect(exportJobProbe.status).toBe("not_found");

      const exportDownloadProbe = await authorizeAndReadExportFile(
        exportQueued.exportJob.id,
        { id: actor.id, role: "user" },
      );
      expect(exportDownloadProbe.status).toBe("not_found");

      const analyticsProbe = await getProjectAnalyticsForActor({
        projectId: createdProj.projectId,
        actor: { id: actor.id, role: "user" },
      });
      expect(analyticsProbe.status).toBe("not_found");

      const portabilityProbe = await exportProjectPortabilityJson({
        actorUserId: actor.id,
        projectId: createdProj.projectId,
      });
      expect(portabilityProbe).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });
    }
  });

  it("2. returns 404 on cross-tenant probes and blocks SSRF / metadata / SVG data URLs in the export worker", async () => {
    const tenantA = await createPaidTeamFixture(2);
    const tenantB = await createPaidTeamFixture(2);

    const projA = await createProjectFromTemplate({
      userId: tenantA.owner.id,
      userPlan: "team",
      orgId: tenantA.org.id,
      input: {
        type: "mobile",
        templateId: starterTemplateId,
        name: "Tenant A Shared Study",
        spaceId: tenantA.defaultSharedSpaceId,
      },
    });
    expect(projA.ok).toBe(true);
    if (!projA.ok) return;

    const crossSpace = await authorizeSpaceAccess(
      tenantA.defaultSharedSpaceId,
      tenantB.owner.id,
      "read",
    );
    expect(crossSpace).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });

    const crossProject = await authorizeProjectAccess(
      projA.projectId,
      tenantB.owner.id,
      "read",
    );
    expect(crossProject).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });

    // Worker SSRF allowlist checks (`Spec §5.6 & §10.7`)
    const appOrigin = "https://casefolio-gamma.vercel.app";
    expect(
      isAllowedExportWorkerRequestUrl(
        `${appOrigin}/export/123?token=signed`,
        appOrigin,
      ),
    ).toBe(true);
    expect(
      isAllowedExportWorkerRequestUrl(
        "https://cdn.casefolio.app/templates/orbit/cover.png",
        appOrigin,
      ),
    ).toBe(true);
    expect(
      isAllowedExportWorkerRequestUrl(
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAAB",
        appOrigin,
      ),
    ).toBe(true);

    // Blocked SSRF & active-content vectors
    expect(
      isAllowedExportWorkerRequestUrl(
        "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
        appOrigin,
      ),
    ).toBe(false);
    expect(
      isAllowedExportWorkerRequestUrl("http://127.0.0.1:5433/", appOrigin),
    ).toBe(false);
    expect(
      isAllowedExportWorkerRequestUrl("http://localhost:3000/api/health", appOrigin),
    ).toBe(false);
    expect(
      isAllowedExportWorkerRequestUrl(
        "data:image/svg+xml;base64,PHN2ZyBvbmxvYWQ9ImFsZXJ0KDEpIj48L3N2Zz4=",
        appOrigin,
      ),
    ).toBe(false);
    expect(
      isAllowedExportWorkerRequestUrl("file:///etc/passwd", appOrigin),
    ).toBe(false);
    expect(
      isAllowedExportWorkerRequestUrl("https://evil.example.com/pixel.png", appOrigin),
    ).toBe(false);
  });

  it("3. serializes concurrent last-seat invitations under FOR UPDATE row lock so only one succeeds", async () => {
    const team = await createPaidTeamFixture(2); // Owner = 1 seat occupied, 1 seat remaining
    const candidateA = `race-a-${randomUUID().slice(0, 6)}@casefolio.test`;
    const candidateB = `race-b-${randomUUID().slice(0, 6)}@casefolio.test`;

    const [resA, resB] = await Promise.all([
      createGatedTeamInvitation({
        actorUserId: team.owner.id,
        rawInput: {
          organizationId: team.org.id,
          email: candidateA,
          role: "member",
        },
      }),
      createGatedTeamInvitation({
        actorUserId: team.owner.id,
        rawInput: {
          organizationId: team.org.id,
          email: candidateB,
          role: "member",
        },
      }),
    ]);

    const successes = [resA, resB].filter((r) => r.ok);
    const failures = [resA, resB].filter((r) => !r.ok);

    expect(successes).toHaveLength(1);
    expect(failures).toHaveLength(1);
    if (!failures[0]!.ok) {
      expect(failures[0]!.code).toBe("TEAM_SEAT_LIMIT_REACHED");
    }
  });

  it("4. enforces single-use invitation security: preserves '.' and '+' in email, and rejects unverified, wrong-email, revoked, expired, and replayed links", async () => {
    expect(normalizeInviteEmail("  Lina.Haddad+Cohort1@Casefolio.Test ")).toBe(
      "lina.haddad+cohort1@casefolio.test",
    );

    const team = await createPaidTeamFixture(4);
    const suffix = randomUUID().slice(0, 8);
    const exactEmail = `lina.haddad+team-${suffix}@casefolio.test`;
    const strippedEmail = `linahaddad-${suffix}@casefolio.test`;

    const [unverifiedInvitee] = await db
      .insert(dbSchema.users)
      .values({
        email: exactEmail,
        name: "Lina Haddad",
        emailVerified: false,
        plan: "free",
      })
      .returning();
    createdUserIds.push(unverifiedInvitee!.id);

    const wrongUser = await createVerifiedUser("wrong-email", strippedEmail);

    const invite = await createGatedTeamInvitation({
      actorUserId: team.owner.id,
      rawInput: {
        organizationId: team.org.id,
        email: `  ${exactEmail.toUpperCase()}  `,
        role: "member",
      },
    });
    expect(invite.ok).toBe(true);
    if (!invite.ok) return;

    // 4a. Unverified email rejected
    const unverifiedTry = await acceptTeamInvitation({
      actorUserId: unverifiedInvitee!.id,
      invitationId: invite.invitationId,
      token: invite.invitationToken,
    });
    expect(unverifiedTry).toMatchObject({ ok: false, code: "EMAIL_NOT_VERIFIED" });

    // Verify invitee email
    await db
      .update(dbSchema.users)
      .set({ emailVerified: true })
      .where(eq(dbSchema.users.id, unverifiedInvitee!.id));

    // 4b. Wrong email rejected
    const wrongEmailTry = await acceptTeamInvitation({
      actorUserId: wrongUser.id,
      invitationId: invite.invitationId,
      token: invite.invitationToken,
    });
    expect(wrongEmailTry).toMatchObject({ ok: false, code: "EMAIL_MISMATCH" });

    // 4c. Valid acceptance succeeds once, replay is rejected
    const accepted = await acceptTeamInvitation({
      actorUserId: unverifiedInvitee!.id,
      invitationId: invite.invitationId,
      token: invite.invitationToken,
    });
    expect(accepted.ok).toBe(true);

    const replayTry = await acceptTeamInvitation({
      actorUserId: unverifiedInvitee!.id,
      invitationId: invite.invitationId,
      token: invite.invitationToken,
    });
    expect(replayTry).toMatchObject({ ok: false, code: "INVITATION_ALREADY_ACCEPTED" });

    // 4d. Revoked invitation rejected
    const revocableUser = await createVerifiedUser("revocable");
    const revInvite = await createGatedTeamInvitation({
      actorUserId: team.owner.id,
      rawInput: {
        organizationId: team.org.id,
        email: revocableUser.email,
        role: "member",
      },
    });
    expect(revInvite.ok).toBe(true);
    if (!revInvite.ok) return;

    await revokeTeamInvitation({
      actorUserId: team.owner.id,
      invitationId: revInvite.invitationId,
    });

    const revokedTry = await acceptTeamInvitation({
      actorUserId: revocableUser.id,
      invitationId: revInvite.invitationId,
      token: revInvite.invitationToken,
    });
    expect(revokedTry).toMatchObject({ ok: false, code: "INVITATION_REVOKED" });

    // 4e. Expired 7-day invitation rejected
    const expiredUser = await createVerifiedUser("expired");
    const expInvite = await createGatedTeamInvitation({
      actorUserId: team.owner.id,
      rawInput: {
        organizationId: team.org.id,
        email: expiredUser.email,
        role: "member",
      },
    });
    expect(expInvite.ok).toBe(true);
    if (!expInvite.ok) return;

    const eightDaysLater = new Date(Date.now() + 8 * 24 * 60 * 60 * 1000);
    const expiredTry = await acceptTeamInvitation({
      actorUserId: expiredUser.id,
      invitationId: expInvite.invitationId,
      token: expInvite.invitationToken,
      now: eightDaysLater,
    });
    expect(expiredTry).toMatchObject({ ok: false, code: "INVITATION_EXPIRED" });
  });

  it("5. blocks mid-export worker delivery on member removal, freezes private space into >=90d Recovery Portal (404 to team), withdraws private public pages, and transfers orphaned shared space controller to Owner", async () => {
    resetUploadRateLimitsForTests();
    const team = await createPaidTeamFixture(3);
    const departing = await admitMemberToTeam(
      team.org.id,
      team.owner.id,
      "admin",
      "departing-admin",
    );

    // Departing member creates a Shared Space they control + publishes a shared project
    const sharedSpaceRes = await createSpaceForUser({
      actorUserId: departing.user.id,
      workspaceId: team.workspaceId,
      name: "Cohort Shared Showcase",
      visibility: "shared",
    });
    expect(sharedSpaceRes.ok).toBe(true);
    if (!sharedSpaceRes.ok) return;

    const sharedProj = await createProjectFromTemplate({
      userId: departing.user.id,
      userPlan: "team",
      orgId: team.org.id,
      input: {
        type: "mobile",
        templateId: starterTemplateId,
        name: "Shared Studio Flagship",
        spaceId: sharedSpaceRes.space.id,
      },
    });
    expect(sharedProj.ok).toBe(true);
    if (!sharedProj.ok) return;

    const sharedSlug = `shared-flagship-${randomUUID().slice(0, 8)}`;
    const pubShared = await publishProjectForUser(
      {
        projectId: sharedProj.projectId,
        slug: sharedSlug,
        visibility: "public",
      },
      { id: departing.user.id, role: "user" },
    );
    expect(pubShared.ok).toBe(true);

    // Departing member ALSO creates & publishes (with public exposure ack) a Private Space project
    const privateProj = await createProjectFromTemplate({
      userId: departing.user.id,
      userPlan: "team",
      orgId: team.org.id,
      input: {
        type: "mobile",
        templateId: starterTemplateId,
        name: "Departing Member Personal Draft",
        spaceId: departing.privateSpaceId,
      },
    });
    expect(privateProj.ok).toBe(true);
    if (!privateProj.ok) return;

    const privateSlug = `private-member-${randomUUID().slice(0, 8)}`;
    const pubPrivate = await publishProjectForUser(
      {
        projectId: privateProj.projectId,
        slug: privateSlug,
        visibility: "public",
        acknowledgePublicExposure: true,
      },
      { id: departing.user.id, role: "user" },
    );
    expect(pubPrivate.ok).toBe(true);

    // Departing member enqueues an export job, then Owner removes them BEFORE worker delivers
    const enqueuedJobs: Array<{
      exportId: string;
      projectId: string;
      format: "png_long" | "pdf" | "behance";
    }> = [];
    const queuedExport = await enqueueProjectExportForUser(
      { projectId: sharedProj.projectId, format: "pdf" },
      { id: departing.user.id, role: "user" },
      {
        enqueueJobFn: async (job) => {
          enqueuedJobs.push(job);
        },
      },
    );
    expect(queuedExport.ok).toBe(true);
    if (!queuedExport.ok) return;

    const departureTime = new Date();
    const removed = await removeTeamMemberWithRecovery({
      actorUserId: team.owner.id,
      organizationId: team.org.id,
      targetUserId: departing.user.id,
      now: departureTime,
    });
    expect(removed.ok).toBe(true);

    // Worker executes the queued job after removal -> ACL re-check denies delivery!
    const workerResult = await processExportJob(enqueuedJobs[0]!, {
      db,
      appUrl: "http://localhost:3000",
      signingSecret: "spec15-worker-secret-at-least-32-characters",
      renderFn: async () => ({
        bytes: new TextEncoder().encode("%PDF-1.7 should not be delivered"),
        contentType: "application/pdf",
        extension: "pdf",
        sliceCount: 1,
        computedHeadingFont: "Inter",
      }),
    });
    expect(workerResult.status).toBe("failed");

    const [expRow] = await db
      .select()
      .from(dbSchema.exportsTable)
      .where(eq(dbSchema.exportsTable.id, queuedExport.exportJob.id));
    expect(expRow?.r2Key).toBeNull();

    // Private public page was withdrawn; Shared public page remains live!
    expect(await getPublishedProjectBySlug(privateSlug)).toBeNull();
    expect(await getPublishedProjectBySlug(sharedSlug)).not.toBeNull();

    // Orphaned shared space controller transferred to Owner
    const [updatedSharedSpace] = await db
      .select()
      .from(dbSchema.spaces)
      .where(eq(dbSchema.spaces.id, sharedSpaceRes.space.id));
    expect(updatedSharedSpace?.controllerUserId).toBe(team.owner.id);

    // Departed member's private space is `frozen_member_departed` for >= 90 days and returns 404 to Owner
    const ownerProbeRecovery = await authorizeSpaceAccess(
      departing.privateSpaceId,
      team.owner.id,
      "read",
    );
    expect(ownerProbeRecovery).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });

    const recoveryBundles = await listRecoverySpacesForUser(departing.user.id);
    const matchingBundle = recoveryBundles.find(
      (b) => b.spaceId === departing.privateSpaceId,
    );
    expect(matchingBundle).toBeDefined();
    const recoveryDays =
      (new Date(matchingBundle!.recoveryUntilIso!).getTime() - departureTime.getTime()) /
      (1000 * 60 * 60 * 24);
    expect(recoveryDays).toBeGreaterThanOrEqual(89.9);

    // Departed member can export portability JSON & copy their recovery project into their Personal Workspace!
    const jsonExport = await exportProjectPortabilityJson({
      actorUserId: departing.user.id,
      projectId: privateProj.projectId,
    });
    expect(jsonExport.ok).toBe(true);

    const copiedOut = await copyProjectAcrossWorkspaces({
      actorUserId: departing.user.id,
      projectId: privateProj.projectId,
    });
    expect(copiedOut.ok).toBe(true);
    if (copiedOut.ok) {
      const personal = await ensurePersonalWorkspaceForUser(departing.user.id);
      expect(copiedOut.destinationWorkspaceId).toBe(personal.workspaceId);
    }
  });

  it("6. transitions Shared -> Private safely: unpublishes pages, deletes snapshots, revokes collaborator leases, bumps aclVersion, and denies teammates prior exports", async () => {
    resetUploadRateLimitsForTests();
    const team = await createPaidTeamFixture(3);
    const teammate = await admitMemberToTeam(
      team.org.id,
      team.owner.id,
      "member",
      "collab-member",
    );

    const customShared = await createSpaceForUser({
      actorUserId: team.owner.id,
      workspaceId: team.workspaceId,
      name: "Client Pitch Room",
      visibility: "shared",
    });
    expect(customShared.ok).toBe(true);
    if (!customShared.ok) return;

    const initialAclVersion = customShared.space.aclVersion;

    const proj = await createProjectFromTemplate({
      userId: team.owner.id,
      userPlan: "team",
      orgId: team.org.id,
      input: {
        type: "web",
        templateId: starterTemplateId,
        name: "Shared Pitch Deck",
        spaceId: customShared.space.id,
      },
    });
    expect(proj.ok).toBe(true);
    if (!proj.ok) return;

    const pitchSlug = `pitch-shared-${randomUUID().slice(0, 8)}`;
    const published = await publishProjectForUser(
      {
        projectId: proj.projectId,
        slug: pitchSlug,
        visibility: "public",
      },
      { id: team.owner.id, role: "user" },
    );
    expect(published.ok).toBe(true);

    // Teammate acquires edit lease and generates an export while space is shared
    const lease = await acquireOrRefreshEditLease({
      projectId: proj.projectId,
      actorUserId: teammate.user.id,
    });
    expect(lease.ok).toBe(true);

    const teammateExport = await enqueueProjectExportForUser(
      { projectId: proj.projectId, format: "pdf" },
      { id: teammate.user.id, role: "user" },
      { enqueueJobFn: async () => undefined },
    );
    expect(teammateExport.ok).toBe(true);
    if (!teammateExport.ok) return;

    // Non-controller teammate CANNOT convert Owner's shared space to private
    const nonControllerAttempt = await transitionSpaceVisibility({
      actorUserId: teammate.user.id,
      spaceId: customShared.space.id,
      targetVisibility: "private",
      confirmed: true,
    });
    expect(nonControllerAttempt).toMatchObject({ ok: false, status: 403 });

    // Without confirmation, transition is rejected
    const unconfirmedAttempt = await transitionSpaceVisibility({
      actorUserId: team.owner.id,
      spaceId: customShared.space.id,
      targetVisibility: "private",
      confirmed: false,
    });
    expect(unconfirmedAttempt).toMatchObject({
      ok: false,
      code: "CONFIRMATION_REQUIRED",
    });

    // Controller converts Shared -> Private with confirmation
    const converted = await transitionSpaceVisibility({
      actorUserId: team.owner.id,
      spaceId: customShared.space.id,
      targetVisibility: "private",
      confirmed: true,
    });
    expect(converted.ok).toBe(true);
    if (!converted.ok) return;
    expect(converted.unpublishedCount).toBe(1);
    expect(converted.space.aclVersion).toBeGreaterThan(initialAclVersion);

    // Public snapshot removed, teammate's edit lease revoked, and teammate denied (404) on project & prior export
    expect(await getPublishedProjectBySlug(pitchSlug)).toBeNull();

    const [remainingLease] = await db
      .select()
      .from(dbSchema.editLeases)
      .where(eq(dbSchema.editLeases.projectId, proj.projectId));
    expect(remainingLease).toBeUndefined();

    const teammateProjCheck = await authorizeProjectAccess(
      proj.projectId,
      teammate.user.id,
      "read",
    );
    expect(teammateProjCheck).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });

    const teammateExportDownload = await authorizeAndReadExportFile(
      teammateExport.exportJob.id,
      { id: teammate.user.id, role: "user" },
    );
    expect(teammateExportDownload.status).toBe("not_found");
  });

  it("7. grants zero seats on failed seat-increase payment and preserves original pastDueSince across repeated failure webhooks (7d grace -> >7d read-only)", async () => {
    const t0 = new Date("2026-11-07T10:00:00.000Z");
    const team = await createPaidTeamFixture(2);

    const preview = await previewTeamSeatIncrease({
      actorUserId: team.owner.id,
      organizationId: team.org.id,
      targetSeats: 5,
      now: t0,
    });
    expect(preview.ok).toBe(true);
    if (!preview.ok) return;

    // Simulate payment failure (`prevent_change`) -> capacity MUST stay at 2 seats!
    const failedConfirm = await confirmTeamSeatIncrease({
      actorUserId: team.owner.id,
      organizationId: team.org.id,
      operationId: preview.operationId,
      simulatePaymentFailure: true,
      now: t0,
    });
    expect(failedConfirm).toMatchObject({ ok: false, code: "PAYMENT_FAILED" });

    const [subAfterFirstFail] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, team.org.id));
    expect(subAfterFirstFail?.currentPaidCapacity).toBe(2);
    expect(subAfterFirstFail?.pastDueSince?.toISOString()).toBe(t0.toISOString());

    // Repeated failure webhook 3 days later MUST NOT reset `pastDueSince`
    const tPlus3d = new Date(t0.getTime() + 3 * 24 * 60 * 60 * 1000);
    const repeatFailBody = JSON.stringify({
      event_id: `evt_repeat_fail_${randomUUID().slice(0, 12)}`,
      event_type: "transaction.payment_failed",
      occurred_at: tPlus3d.toISOString(),
      data: {
        id: subAfterFirstFail!.paddleSubscriptionId,
        status: "past_due",
        current_billing_period: {
          ends_at: new Date(t0.getTime() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        },
        custom_data: {
          userId: team.owner.id,
          orgId: team.org.id,
          plan: "team",
          interval: "monthly",
          seats: 2,
        },
      },
    });
    const sig = signPaddleWebhookPayload(
      repeatFailBody,
      env.PADDLE_WEBHOOK_SECRET,
      Math.floor(tPlus3d.getTime() / 1000),
    );
    const repeatProcessed = await handleSignedPaddleWebhookRequest({
      rawBody: repeatFailBody,
      signatureHeader: sig,
      now: tPlus3d,
    });
    expect(repeatProcessed.ok).toBe(true);

    const [subAfterSecondFail] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, team.org.id));
    expect(subAfterSecondFail?.pastDueSince?.toISOString()).toBe(t0.toISOString());

    // At day 3 (<= 7d grace): workspace still has paid access and is NOT frozen
    const entDay3 = await resolveWorkspaceEntitlementState(team.workspaceId, tPlus3d);
    expect(entDay3?.plan).toBe("team");
    expect(entDay3?.isFrozen).toBe(false);

    // At day 8 (> 7d grace): workspace freezes to read-only!
    const tPlus8d = new Date(t0.getTime() + 8 * 24 * 60 * 60 * 1000);
    const entDay8 = await resolveWorkspaceEntitlementState(team.workspaceId, tPlus8d);
    expect(entDay8?.isFrozen).toBe(true);
  });

  it("8. schedules renewal seat decreases (do_not_bill) without reducing mid-period capacity, caps new admissions to renewalQuantity, blocks conflicting seat changes, and adopts renewalQuantity on verified renewal", async () => {
    const now = new Date("2026-11-07T12:00:00.000Z");
    const team = await createPaidTeamFixture(3);
    const m2 = await admitMemberToTeam(team.org.id, team.owner.id, "member", "seat-2");
    const m3 = await admitMemberToTeam(team.org.id, team.owner.id, "member", "seat-3");

    // Cannot decrease to 2 seats while all 3 seats are occupied
    const blockedDecrease = await scheduleTeamSeatDecrease({
      actorUserId: team.owner.id,
      organizationId: team.org.id,
      targetSeats: 2,
      now,
    });
    expect(blockedDecrease).toMatchObject({ ok: false, code: "SEATS_IN_USE" });

    // Remove 3rd member -> occupied = 2, paid = 3
    await removeTeamMemberWithRecovery({
      actorUserId: team.owner.id,
      organizationId: team.org.id,
      targetUserId: m3.user.id,
      now,
    });
    expect(m2.user.id).toBeTruthy();

    // Schedule renewal decrease from 3 -> 2 (`do_not_bill`)
    const scheduled = await scheduleTeamSeatDecrease({
      actorUserId: team.owner.id,
      organizationId: team.org.id,
      targetSeats: 2,
      now,
    });
    expect(scheduled.ok).toBe(true);
    if (!scheduled.ok) return;
    expect(scheduled.currentPaidSeats).toBe(3);
    expect(scheduled.renewalSeats).toBe(2);

    // Mid-period pooled quotas still reflect 3 paid seats (`activeProjectsLimit = 60`), while admissionCeiling = 2!
    const midPeriodEnt = await resolveWorkspaceEntitlementState(team.workspaceId, now);
    expect(midPeriodEnt?.paidSeats).toBe(3);
    expect(midPeriodEnt?.quotas.activeProjectsLimit).toBe(60);
    expect(midPeriodEnt?.admissionCeiling).toBe(2);

    // Inviting a 3rd member is blocked by `admissionCeiling = 2`
    const overTargetInvite = await createGatedTeamInvitation({
      actorUserId: team.owner.id,
      rawInput: {
        organizationId: team.org.id,
        email: `blocked-by-target-${randomUUID().slice(0, 6)}@casefolio.test`,
        role: "member",
      },
      now,
    });
    expect(overTargetInvite).toMatchObject({
      ok: false,
      code: "TEAM_SEAT_LIMIT_REACHED",
    });

    // Conflicting seat increase while renewal decrease is pending is blocked (`PENDING_DECREASE_CONFLICT`)
    const conflictingIncrease = await previewTeamSeatIncrease({
      actorUserId: team.owner.id,
      organizationId: team.org.id,
      targetSeats: 4,
      now,
    });
    expect(conflictingIncrease).toMatchObject({
      ok: false,
      code: "PENDING_DECREASE_CONFLICT",
    });

    // Verified renewal webhook adopts `renewalQuantity = 2` as the new `currentPaidCapacity`
    const [subBeforeRenewal] = await db
      .select()
      .from(dbSchema.subscriptions)
      .where(eq(dbSchema.subscriptions.orgId, team.org.id));

    const renewalDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
    const nextPeriodEnd = new Date(renewalDate.getTime() + 30 * 24 * 60 * 60 * 1000);
    const priceId = resolveServerPaddlePriceId("team", "monthly");
    const renewalBody = JSON.stringify({
      event_id: `evt_renewal_adopt_${randomUUID().slice(0, 12)}`,
      event_type: "transaction.completed",
      occurred_at: renewalDate.toISOString(),
      data: {
        subscription_id: subBeforeRenewal!.paddleSubscriptionId,
        customer_id: subBeforeRenewal!.paddleCustomerId,
        status: "completed",
        billing_period: {
          ends_at: nextPeriodEnd.toISOString(),
        },
        items: [
          {
            quantity: 2,
            price: {
              id: priceId,
              billing_cycle: { interval: "month", frequency: 1 },
            },
          },
        ],
        custom_data: {
          userId: team.owner.id,
          orgId: team.org.id,
          plan: "team",
          interval: "monthly",
          seats: 2,
        },
      },
    });
    const renewalSig = signPaddleWebhookPayload(
      renewalBody,
      env.PADDLE_WEBHOOK_SECRET,
      Math.floor(renewalDate.getTime() / 1000),
    );
    const renewalRes = await handleSignedPaddleWebhookRequest({
      rawBody: renewalBody,
      signatureHeader: renewalSig,
      now: renewalDate,
    });
    expect(renewalRes.ok).toBe(true);

    const postRenewalEnt = await resolveWorkspaceEntitlementState(
      team.workspaceId,
      renewalDate,
    );
    expect(postRenewalEnt?.paidSeats).toBe(2);
    expect(postRenewalEnt?.renewalQuantity).toBeNull();
    expect(postRenewalEnt?.quotas.activeProjectsLimit).toBe(40);
  });

  it("9. enforces expectedRevision CAS conflict detection and 120s single-writer edit leases on shared projects", async () => {
    const team = await createPaidTeamFixture(2);
    const collaborator = await admitMemberToTeam(
      team.org.id,
      team.owner.id,
      "member",
      "writer-b",
    );

    const proj = await createProjectFromTemplate({
      userId: team.owner.id,
      userPlan: "team",
      orgId: team.org.id,
      input: {
        type: "mobile",
        templateId: starterTemplateId,
        name: "Collaborative Study",
        spaceId: team.defaultSharedSpaceId,
      },
    });
    expect(proj.ok).toBe(true);
    if (!proj.ok) return;

    const initialAccess = await getProjectEditorAccess(proj.projectId, {
      id: team.owner.id,
      role: "user",
    });
    expect(initialAccess.status).toBe("ok");
    if (initialAccess.status !== "ok") return;

    // Owner acquires 120s edit lease
    const ownerLease = await acquireOrRefreshEditLease({
      projectId: proj.projectId,
      actorUserId: team.owner.id,
    });
    expect(ownerLease.ok).toBe(true);
    if (!ownerLease.ok) return;

    // Collaborator attempting to acquire lease or save while Owner holds active lease gets 409 LEASE_HELD
    const collabLeaseBlocked = await acquireOrRefreshEditLease({
      projectId: proj.projectId,
      actorUserId: collaborator.user.id,
    });
    expect(collabLeaseBlocked).toMatchObject({
      ok: false,
      status: 409,
      code: "LEASE_HELD",
    });

    const collabSaveBlocked = await saveProjectEditorState(
      {
        projectId: proj.projectId,
        expectedRevision: initialAccess.payload.project.revision ?? 1,
        puckData: initialAccess.payload.project.puckData,
        theme: initialAccess.payload.project.theme,
      },
      { id: collaborator.user.id, role: "user" },
    );
    expect(collabSaveBlocked).toMatchObject({ ok: false, code: "LEASE_HELD" });

    // Owner saves revision 2, then tries saving again with stale expectedRevision = 1 -> 409 CONFLICT
    const nextPuck = structuredClone(initialAccess.payload.project.puckData);
    nextPuck.root.props.title = "Collaborative Study v2";

    const savedRev2 = await saveProjectEditorState(
      {
        projectId: proj.projectId,
        expectedRevision: initialAccess.payload.project.revision ?? 1,
        leaseToken: ownerLease.lease.leaseToken ?? undefined,
        puckData: nextPuck,
        theme: initialAccess.payload.project.theme,
      },
      { id: team.owner.id, role: "user" },
    );
    expect(savedRev2).toMatchObject({ ok: true, revision: 2 });

    const staleRev1 = await saveProjectEditorState(
      {
        projectId: proj.projectId,
        expectedRevision: 1,
        leaseToken: ownerLease.lease.leaseToken ?? undefined,
        puckData: initialAccess.payload.project.puckData,
        theme: initialAccess.payload.project.theme,
      },
      { id: team.owner.id, role: "user" },
    );
    expect(staleRev1).toMatchObject({
      ok: false,
      code: "CONFLICT",
      serverRevision: 2,
    });

    // Owner releases lease -> Collaborator can now acquire lease and save revision 3
    const released = await releaseEditLease({
      projectId: proj.projectId,
      actorUserId: team.owner.id,
      leaseToken: ownerLease.lease.leaseToken ?? undefined,
    });
    expect(released.released).toBe(true);

    const collabLeaseAcquired = await acquireOrRefreshEditLease({
      projectId: proj.projectId,
      actorUserId: collaborator.user.id,
    });
    expect(collabLeaseAcquired.ok).toBe(true);
    if (!collabLeaseAcquired.ok) return;

    const rev3Puck = structuredClone(nextPuck);
    rev3Puck.root.props.title = "Collaborative Study v3 by Teammate";
    const savedRev3 = await saveProjectEditorState(
      {
        projectId: proj.projectId,
        expectedRevision: 2,
        leaseToken: collabLeaseAcquired.lease.leaseToken ?? undefined,
        puckData: rev3Puck,
        theme: initialAccess.payload.project.theme,
      },
      { id: collaborator.user.id, role: "user" },
    );
    expect(savedRev3).toMatchObject({ ok: true, revision: 3 });
  });

  it("10. runs backfillBusinessTenancy idempotently and never exposes personal projects (orgId === null) to any team workspace", async () => {
    const team = await createPaidTeamFixture(2);
    const member = await admitMemberToTeam(
      team.org.id,
      team.owner.id,
      "member",
      "legacy-member",
    );

    // Insert a legacy project row (`orgId = null`, `workspaceId = null`, `spaceId = null`) owned by a user who is ALSO in a Team
    const [legacyProject] = await db
      .insert(dbSchema.projects)
      .values({
        ownerId: member.user.id,
        orgId: null,
        workspaceId: null,
        spaceId: null,
        templateVersionId: starterTemplateVersionId,
        name: "Legacy Personal Portfolio Study",
        type: "mobile",
        puckData: {},
        theme: {},
        visibility: "private",
      })
      .returning();

    const firstRun = await backfillBusinessTenancy(db);
    expect(firstRun.projectsLinked).toBeGreaterThanOrEqual(1);

    // Verify legacy project bound ONLY to member's Personal Workspace private space — invisible (404) to Team Owner!
    const [backfilledProject] = await db
      .select()
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.id, legacyProject!.id));

    const personal = await ensurePersonalWorkspaceForUser(member.user.id);
    expect(backfilledProject?.workspaceId).toBe(personal.workspaceId);
    expect(backfilledProject?.spaceId).toBe(personal.defaultSpaceId);

    const teamOwnerProbe = await authorizeProjectAccess(
      legacyProject!.id,
      team.owner.id,
      "read",
    );
    expect(teamOwnerProbe).toMatchObject({ ok: false, status: 404, code: "NOT_FOUND" });

    // Second run is 100% idempotent (`0` projects re-linked, `0` duplicate workspaces or spaces created for our test fixtures)
    const scopedPersonalWsBefore = await db
      .select({ id: dbSchema.workspaces.id })
      .from(dbSchema.workspaces)
      .where(inArray(dbSchema.workspaces.personalOwnerId, [member.user.id, team.owner.id]));
    const scopedTeamWsBefore = await db
      .select({ id: dbSchema.workspaces.id })
      .from(dbSchema.workspaces)
      .where(eq(dbSchema.workspaces.organizationId, team.org.id));
    const scopedWsIds = [
      ...scopedPersonalWsBefore.map((w) => w.id),
      ...scopedTeamWsBefore.map((w) => w.id),
    ];
    const spBefore = (
      await db
        .select({ id: dbSchema.spaces.id })
        .from(dbSchema.spaces)
        .where(inArray(dbSchema.spaces.workspaceId, scopedWsIds))
    ).length;

    const [recheckProjectBefore] = await db
      .select({ spaceId: dbSchema.projects.spaceId })
      .from(dbSchema.projects)
      .where(eq(dbSchema.projects.id, legacyProject!.id));
    expect(recheckProjectBefore?.spaceId).toBe(personal.defaultSpaceId);

    const secondRun = await backfillBusinessTenancy(db);
    expect(secondRun.rolesNormalized).toBe(0);

    const scopedPersonalWsAfter = await db
      .select({ id: dbSchema.workspaces.id })
      .from(dbSchema.workspaces)
      .where(inArray(dbSchema.workspaces.personalOwnerId, [member.user.id, team.owner.id]));
    const scopedTeamWsAfter = await db
      .select({ id: dbSchema.workspaces.id })
      .from(dbSchema.workspaces)
      .where(eq(dbSchema.workspaces.organizationId, team.org.id));
    const spAfter = (
      await db
        .select({ id: dbSchema.spaces.id })
        .from(dbSchema.spaces)
        .where(inArray(dbSchema.spaces.workspaceId, scopedWsIds))
    ).length;

    expect(scopedPersonalWsAfter.length).toBe(scopedPersonalWsBefore.length);
    expect(scopedTeamWsAfter.length).toBe(scopedTeamWsBefore.length);
    expect(spAfter).toBe(spBefore);
  });
});
