import { and, eq, inArray, isNull } from "drizzle-orm";
import type { Database } from "./client";
import {
  assets,
  exportsTable,
  invitations,
  memberships,
  organizations,
  projects,
  publishedSnapshots,
  spaces,
  subscriptions,
  users,
  workspaces,
} from "./schema";

export interface BackfillResult {
  personalWorkspacesEnsured: number;
  teamWorkspacesEnsured: number;
  spacesEnsured: number;
  projectsLinked: number;
  publishedSnapshotsEnsured: number;
  subscriptionsLinked: number;
  rolesNormalized: number;
}

function isForeignKeyRaceError(err: unknown): boolean {
  if (!err || typeof err !== "object") return false;
  const record = err as { code?: unknown; cause?: unknown };
  if (record.code === "23503") return true;
  if (record.cause && typeof record.cause === "object") {
    return (record.cause as { code?: unknown }).code === "23503";
  }
  return false;
}

/**
 * Deterministic, idempotent backfill for Casefolio's business tenancy & privacy model:
 * - Creates 1 personal workspace + 1 default private space per user.
 * - Creates 1 team workspace + 1 default shared space + 1 private space per member for each organization.
 * - Keeps all legacy personal projects (`orgId IS NULL`) strictly inside the owner's personal private space
 *   (NEVER exposing personal content to any team).
 * - Snapshots already-published projects (`public`/`unlisted`) into `published_snapshots` so live `/p/[slug]`
 *   URLs continue working without serving raw private draft rows.
 * - Normalizes legacy `editor` -> `admin` and `viewer` -> `member` roles.
 */
export async function backfillBusinessTenancy(db: Database): Promise<BackfillResult> {
  let personalWorkspacesEnsured = 0;
  let teamWorkspacesEnsured = 0;
  let spacesEnsured = 0;
  let projectsLinked = 0;
  let publishedSnapshotsEnsured = 0;
  let subscriptionsLinked = 0;

  // 1. Normalize legacy membership & invitation roles (`editor` -> `admin`, `viewer` -> `member`)
  const updatedEditorMemberships = await db
    .update(memberships)
    .set({ role: "admin" })
    .where(eq(memberships.role, "editor"))
    .returning({ id: memberships.id });
  const updatedViewerMemberships = await db
    .update(memberships)
    .set({ role: "member" })
    .where(eq(memberships.role, "viewer"))
    .returning({ id: memberships.id });

  const updatedEditorInvites = await db
    .update(invitations)
    .set({ role: "admin" })
    .where(eq(invitations.role, "editor"))
    .returning({ id: invitations.id });
  const updatedViewerInvites = await db
    .update(invitations)
    .set({ role: "member" })
    .where(eq(invitations.role, "viewer"))
    .returning({ id: invitations.id });

  const rolesNormalized =
    updatedEditorMemberships.length +
    updatedViewerMemberships.length +
    updatedEditorInvites.length +
    updatedViewerInvites.length;

  // 2. Ensure personal workspaces & default private spaces for all users
  const allUsers = await db
    .select({ id: users.id, name: users.name })
    .from(users);

  const personalWorkspaceByUser = new Map<string, string>();
  const defaultPersonalSpaceByUser = new Map<string, string>();

  for (const u of allUsers) {
    try {
      const slug = `personal-${u.id}`;
      const workspaceName = `${u.name?.trim() || "Personal"} · Personal`;

      await db
        .insert(workspaces)
        .values({
          kind: "personal",
          personalOwnerId: u.id,
          organizationId: null,
          name: workspaceName,
          slug,
        })
        .onConflictDoNothing();

      const [ws] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.personalOwnerId, u.id))
        .limit(1);

      if (!ws) continue;
      personalWorkspaceByUser.set(u.id, ws.id);
      personalWorkspacesEnsured += 1;

      await db
        .insert(spaces)
        .values({
          workspaceId: ws.id,
          name: "Personal Space",
          slug: "personal",
          visibility: "private",
          isDefault: true,
          controllerUserId: u.id,
        })
        .onConflictDoNothing({ target: [spaces.workspaceId, spaces.slug] });

      const [sp] = await db
        .select({ id: spaces.id })
        .from(spaces)
        .where(and(eq(spaces.workspaceId, ws.id), eq(spaces.slug, "personal")))
        .limit(1);

      if (sp) {
        defaultPersonalSpaceByUser.set(u.id, sp.id);
        spacesEnsured += 1;
      }
    } catch (err) {
      if (isForeignKeyRaceError(err)) continue;
      throw err;
    }
  }

  // 3. Ensure team workspaces, default shared space, and per-member private spaces for all organizations
  const allOrgs = await db.select().from(organizations);
  const teamWorkspaceByOrg = new Map<string, string>();
  const defaultSharedSpaceByOrg = new Map<string, string>();

  for (const org of allOrgs) {
    try {
      const wsSlug = `team-${org.id}`;
      await db
        .insert(workspaces)
        .values({
          kind: "team",
          personalOwnerId: null,
          organizationId: org.id,
          name: org.name,
          slug: wsSlug,
        })
        .onConflictDoNothing();

      const [ws] = await db
        .select({ id: workspaces.id })
        .from(workspaces)
        .where(eq(workspaces.organizationId, org.id))
        .limit(1);

      if (!ws) continue;
      teamWorkspaceByOrg.set(org.id, ws.id);
      teamWorkspacesEnsured += 1;

      const orgMembers = await db
        .select({ userId: memberships.userId, role: memberships.role })
        .from(memberships)
        .where(eq(memberships.orgId, org.id));

      const ownerMember =
        orgMembers.find((m) => m.role === "owner") ?? orgMembers[0];

      if (ownerMember) {
        await db
          .insert(spaces)
          .values({
            workspaceId: ws.id,
            name: `${org.name} Shared`,
            slug: "shared-studio",
            visibility: "shared",
            isDefault: true,
            controllerUserId: ownerMember.userId,
          })
          .onConflictDoNothing({ target: [spaces.workspaceId, spaces.slug] });

        const [sharedSpace] = await db
          .select({ id: spaces.id })
          .from(spaces)
          .where(and(eq(spaces.workspaceId, ws.id), eq(spaces.slug, "shared-studio")))
          .limit(1);

        if (sharedSpace) {
          defaultSharedSpaceByOrg.set(org.id, sharedSpace.id);
          spacesEnsured += 1;
        }
      }

      for (const member of orgMembers) {
        const memberPrivateSlug = `private-${member.userId}`;
        await db
          .insert(spaces)
          .values({
            workspaceId: ws.id,
            name: "My Private Space",
            slug: memberPrivateSlug,
            visibility: "private",
            isDefault: true,
            controllerUserId: member.userId,
          })
          .onConflictDoNothing({ target: [spaces.workspaceId, spaces.slug] });
        spacesEnsured += 1;
      }
    } catch (err) {
      if (isForeignKeyRaceError(err)) continue;
      throw err;
    }
  }

  // 4. Link unlinked projects (`workspaceId IS NULL` or `spaceId IS NULL`) without EVER moving personal projects to teams
  const unlinkedProjects = await db
    .select()
    .from(projects)
    .where(isNull(projects.spaceId));

  for (const proj of unlinkedProjects) {
    try {
      let targetWsId: string | undefined;
      let targetSpaceId: string | undefined;

      if (proj.orgId) {
        targetWsId = teamWorkspaceByOrg.get(proj.orgId);
        targetSpaceId = defaultSharedSpaceByOrg.get(proj.orgId);
      } else {
        targetWsId = personalWorkspaceByUser.get(proj.ownerId);
        targetSpaceId = defaultPersonalSpaceByUser.get(proj.ownerId);
      }

      if (!targetWsId || !targetSpaceId) continue;

      await db
        .update(projects)
        .set({
          workspaceId: targetWsId,
          spaceId: targetSpaceId,
          createdByUserId: proj.createdByUserId ?? proj.ownerId,
        })
        .where(eq(projects.id, proj.id));
      projectsLinked += 1;
    } catch (err) {
      if (isForeignKeyRaceError(err)) continue;
      throw err;
    }
  }

  // 5. Backfill workspaceId on assets & exports from their project
  const allProjectsWithWs = await db
    .select({
      id: projects.id,
      workspaceId: projects.workspaceId,
      spaceId: projects.spaceId,
      revision: projects.revision,
      puckData: projects.puckData,
      theme: projects.theme,
      visibility: projects.visibility,
      slug: projects.slug,
      publishedAt: projects.publishedAt,
      brandingRemoved: projects.brandingRemoved,
      ownerId: projects.ownerId,
    })
    .from(projects);

  for (const p of allProjectsWithWs) {
    try {
      if (p.workspaceId) {
        await db
          .update(assets)
          .set({ workspaceId: p.workspaceId })
          .where(and(eq(assets.projectId, p.id), isNull(assets.workspaceId)));

        await db
          .update(exportsTable)
          .set({ workspaceId: p.workspaceId })
          .where(and(eq(exportsTable.projectId, p.id), isNull(exportsTable.workspaceId)));
      }

      // 6. Ensure published_snapshots row for already-published projects so `/p/[slug]` keeps working
      if (
        (p.visibility === "public" || p.visibility === "unlisted") &&
        p.publishedAt !== null &&
        p.slug !== null
      ) {
        const projectAssets = await db
          .select({ id: assets.id })
          .from(assets)
          .where(eq(assets.projectId, p.id));

        const inserted = await db
          .insert(publishedSnapshots)
          .values({
            projectId: p.id,
            workspaceId: p.workspaceId,
            spaceId: p.spaceId,
            revision: p.revision,
            puckData: p.puckData,
            theme: p.theme,
            publishedAssetIds: projectAssets.map((a) => a.id),
            brandingRemoved: p.brandingRemoved,
            publishedByUserId: p.ownerId,
            publishedAt: p.publishedAt,
            updatedAt: p.publishedAt,
          })
          .onConflictDoNothing({ target: publishedSnapshots.projectId })
          .returning({ projectId: publishedSnapshots.projectId });

        if (inserted.length > 0) {
          publishedSnapshotsEnsured += 1;
        }
      }
    } catch (err) {
      if (isForeignKeyRaceError(err)) continue;
      throw err;
    }
  }

  // 7. Link unlinked subscriptions to their exact workspace (no personal/team cross-pollution)
  const unlinkedSubs = await db
    .select()
    .from(subscriptions)
    .where(isNull(subscriptions.workspaceId));

  for (const sub of unlinkedSubs) {
    if (sub.orgId) {
      const wsId = teamWorkspaceByOrg.get(sub.orgId);
      const [orgRow] = await db
        .select({ seats: organizations.seats })
        .from(organizations)
        .where(eq(organizations.id, sub.orgId))
        .limit(1);
      if (wsId) {
        const capacity =
          sub.plan === "plus"
            ? 20
            : Math.max(2, Math.min(10, orgRow?.seats ?? 2));
        await db
          .update(subscriptions)
          .set({
            workspaceId: wsId,
            currentPaidCapacity: capacity,
            maxSeats: capacity,
            maxCaseStudies: -1,
            customDomainEnabled: sub.plan === "plus",
            watermarkEnabled: false,
            ...(sub.plan === "team" || sub.plan === "plus" ? { userId: null } : {}),
          })
          .where(eq(subscriptions.id, sub.id));
        subscriptionsLinked += 1;
      }
    } else if (sub.userId) {
      const wsId = personalWorkspaceByUser.get(sub.userId);
      if (wsId) {
        const isPaid = sub.plan !== "free";
        await db
          .update(subscriptions)
          .set({
            workspaceId: wsId,
            currentPaidCapacity: 1,
            maxSeats: 1,
            maxCaseStudies: isPaid ? -1 : 1,
            customDomainEnabled: false,
            watermarkEnabled: !isPaid,
          })
          .where(eq(subscriptions.id, sub.id));
        subscriptionsLinked += 1;
      }
    }
  }

  // Ensure users whose subscription was purely a Team/Plus org subscription aren't left with `users.plan = 'team' | 'plus'`
  const teamPlanUsers = await db
    .select({ id: users.id })
    .from(users)
    .where(inArray(users.plan, ["team", "plus"]));

  for (const u of teamPlanUsers) {
    const [personalSub] = await db
      .select({ plan: subscriptions.plan, status: subscriptions.status })
      .from(subscriptions)
      .where(and(eq(subscriptions.userId, u.id), isNull(subscriptions.orgId)))
      .limit(1);

    const personalPlan =
      personalSub && personalSub.plan === "pro" && personalSub.status === "active"
        ? "pro"
        : "free";

    await db
      .update(users)
      .set({ plan: personalPlan })
      .where(eq(users.id, u.id));
  }

  return {
    personalWorkspacesEnsured,
    teamWorkspacesEnsured,
    spacesEnsured,
    projectsLinked,
    publishedSnapshotsEnsured,
    subscriptionsLinked,
    rolesNormalized,
  };
}
