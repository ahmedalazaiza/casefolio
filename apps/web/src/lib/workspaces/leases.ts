import { randomBytes } from "node:crypto";
import { and, eq, inArray, sql } from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import type { EditorLeaseState } from "@/lib/projects/types";
import { authorizeProjectAccess } from "@/lib/workspaces/acl";

export const EDIT_LEASE_TTL_SECONDS = 120;
export const EDIT_LEASE_HEARTBEAT_SECONDS = 30;

function generateLeaseToken(): string {
  return `lease_${randomBytes(18).toString("hex")}`;
}

export async function inspectProjectEditLease(
  projectId: string,
  viewerUserId: string,
  now: Date = new Date(),
): Promise<EditorLeaseState | null> {
  const [lease] = await db
    .select()
    .from(dbSchema.editLeases)
    .where(eq(dbSchema.editLeases.projectId, projectId))
    .limit(1);

  if (!lease || lease.expiresAt.getTime() <= now.getTime()) {
    return null;
  }

  const isHeldByCurrentUser = lease.holderUserId === viewerUserId;
  return {
    isHolder: isHeldByCurrentUser,
    isHeldByCurrentUser,
    readOnly: !isHeldByCurrentUser,
    holderUserId: lease.holderUserId,
    holderName: lease.holderName,
    leaseToken: isHeldByCurrentUser ? lease.leaseToken : null,
    expiresAtIso: lease.expiresAt.toISOString(),
    reason: isHeldByCurrentUser ? "active_writer" : "held_by_teammate",
  };
}

export type AcquireEditLeaseResult =
  | {
      ok: true;
      lease: EditorLeaseState;
    }
  | {
      ok: false;
      status: 404 | 403 | 409;
      code: "NOT_FOUND" | "FORBIDDEN" | "LEASE_HELD";
      error: string;
      lease?: EditorLeaseState;
    };

/**
 * Acquires or refreshes the 120-second single-writer server lease for asynchronous
 * team collaboration (`Spec §13 line 394`).
 */
export async function acquireOrRefreshEditLease(args: {
  projectId: string;
  actorUserId: string;
  leaseToken?: string;
  now?: Date;
}): Promise<AcquireEditLeaseResult> {
  const now = args.now ?? new Date();
  const auth = await authorizeProjectAccess(args.projectId, args.actorUserId, "edit", now);
  if (!auth.ok) {
    return {
      ok: false,
      status: auth.status,
      code: auth.status === 404 ? "NOT_FOUND" : "FORBIDDEN",
      error: auth.error,
    };
  }

  const [actorRow] = await db
    .select({ name: dbSchema.users.name })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, args.actorUserId))
    .limit(1);

  const holderName = actorRow?.name ?? "Teammate";
  const expiresAt = new Date(now.getTime() + EDIT_LEASE_TTL_SECONDS * 1000);

  return db.transaction(async (tx) => {
    const existingRows = await tx.execute<{
      project_id: string;
      holder_user_id: string;
      holder_name: string | null;
      lease_token: string;
      expires_at: Date | string;
    }>(sql`
      SELECT project_id, holder_user_id, holder_name, lease_token, expires_at
      FROM edit_leases
      WHERE project_id = ${args.projectId}
      FOR UPDATE
    `);

    const existing = existingRows.rows[0];
    if (existing) {
      const existingExpires =
        existing.expires_at instanceof Date
          ? existing.expires_at
          : new Date(existing.expires_at);

      if (
        existingExpires.getTime() > now.getTime() &&
        existing.holder_user_id !== args.actorUserId
      ) {
        return {
          ok: false,
          status: 409 as const,
          code: "LEASE_HELD" as const,
          error: `${existing.holder_name || "Another teammate"} is currently editing this case study. It is temporarily read-only until their 120-second session lease expires or is released.`,
          lease: {
            isHolder: false,
            isHeldByCurrentUser: false,
            readOnly: true,
            holderUserId: existing.holder_user_id,
            holderName: existing.holder_name,
            leaseToken: null,
            expiresAtIso: existingExpires.toISOString(),
            reason: "held_by_teammate",
          },
        };
      }

      const nextToken =
        existing.holder_user_id === args.actorUserId &&
        (!args.leaseToken || args.leaseToken === existing.lease_token)
          ? existing.lease_token
          : generateLeaseToken();

      await tx
        .update(dbSchema.editLeases)
        .set({
          workspaceId: auth.workspace.id,
          holderUserId: args.actorUserId,
          holderName,
          leaseToken: nextToken,
          heartbeatAt: now,
          expiresAt,
        })
        .where(eq(dbSchema.editLeases.projectId, args.projectId));

      return {
        ok: true,
        lease: {
          isHolder: true,
          isHeldByCurrentUser: true,
          readOnly: false,
          holderUserId: args.actorUserId,
          holderName,
          leaseToken: nextToken,
          expiresAtIso: expiresAt.toISOString(),
          reason: "active_writer",
        },
      };
    }

    const token = generateLeaseToken();
    await tx.insert(dbSchema.editLeases).values({
      projectId: args.projectId,
      workspaceId: auth.workspace.id,
      holderUserId: args.actorUserId,
      holderName,
      leaseToken: token,
      acquiredAt: now,
      heartbeatAt: now,
      expiresAt,
    });

    return {
      ok: true,
      lease: {
        isHolder: true,
        isHeldByCurrentUser: true,
        readOnly: false,
        holderUserId: args.actorUserId,
        holderName,
        leaseToken: token,
        expiresAtIso: expiresAt.toISOString(),
        reason: "active_writer",
      },
    };
  });
}

export async function releaseEditLease(args: {
  projectId: string;
  actorUserId: string;
  leaseToken?: string;
}): Promise<{ released: boolean }> {
  const [existing] = await db
    .select()
    .from(dbSchema.editLeases)
    .where(eq(dbSchema.editLeases.projectId, args.projectId))
    .limit(1);

  if (!existing || existing.holderUserId !== args.actorUserId) {
    return { released: false };
  }

  if (args.leaseToken && existing.leaseToken !== args.leaseToken) {
    return { released: false };
  }

  await db
    .delete(dbSchema.editLeases)
    .where(
      and(
        eq(dbSchema.editLeases.projectId, args.projectId),
        eq(dbSchema.editLeases.holderUserId, args.actorUserId),
      ),
    );

  return { released: true };
}

/**
 * Revokes all edit leases held by `userId` in `workspaceId` (or across a list of `projectIds`),
 * used on member departure or `Shared -> Private` transitions (`Spec §10.4 & §11.1`).
 */
export async function revokeUserWorkspaceLeases(args: {
  workspaceId: string;
  userId?: string;
  excludeUserId?: string;
  projectIds?: string[];
}): Promise<void> {
  if (args.projectIds && args.projectIds.length > 0) {
    const rows = await db
      .select()
      .from(dbSchema.editLeases)
      .where(inArray(dbSchema.editLeases.projectId, args.projectIds));

    for (const row of rows) {
      if (args.excludeUserId && row.holderUserId === args.excludeUserId) {
        continue;
      }
      if (args.userId && row.holderUserId !== args.userId) {
        continue;
      }
      await db
        .delete(dbSchema.editLeases)
        .where(eq(dbSchema.editLeases.projectId, row.projectId));
    }
    return;
  }

  if (args.userId) {
    await db
      .delete(dbSchema.editLeases)
      .where(
        and(
          eq(dbSchema.editLeases.workspaceId, args.workspaceId),
          eq(dbSchema.editLeases.holderUserId, args.userId),
        ),
      );
  }
}
