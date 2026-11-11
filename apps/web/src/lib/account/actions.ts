"use server";

import { and, eq, inArray, isNull, ne, normalizeMembershipRole } from "@casefolio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSafeAvatarUrl } from "@/lib/auth/schemas";
import { getServerSession } from "@/lib/auth/session";
import { cancelUserSubscription } from "@/lib/billing/service";
import { db, dbSchema } from "@/lib/db";
import { executeMemberDepartureSideEffects } from "@/lib/entitlements/team-invitations";
import { deleteStoredObject } from "@/lib/storage/r2";

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(80, "Full name must be 80 characters or fewer."),
  jobTitle: z.string().trim().max(100, "Role or title must be 100 characters or fewer.").optional(),
  designFocus: z.enum(["mobile", "web", "both"]).nullable().optional(),
  imageUrl: z
    .string()
    .trim()
    .max(500_000, "Avatar URL is too long.")
    .refine(isSafeAvatarUrl, "Avatar must be a valid https:// URL, /path, or raster image upload.")
    .optional(),
});

export type UpdateAccountProfileInput = z.infer<typeof updateProfileSchema>;

export async function updateAccountProfileAction(
  rawInput: UpdateAccountProfileInput,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Please sign in to update your profile." };
  }

  const parsed = updateProfileSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please review your profile fields.",
    };
  }

  const valid = parsed.data;
  const normalizedImage =
    valid.imageUrl === undefined
      ? ctx.user.image
      : valid.imageUrl.trim().length > 0
        ? valid.imageUrl.trim()
        : null;

  await db
    .update(dbSchema.users)
    .set({
      name: valid.name,
      jobTitle: valid.jobTitle && valid.jobTitle.length > 0 ? valid.jobTitle : null,
      designFocus: valid.designFocus ?? null,
      image: normalizedImage,
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.users.id, ctx.user.id));

  revalidatePath("/account");
  revalidatePath("/dashboard");

  return { ok: true };
}

const revokeSessionSchema = z.object({
  sessionId: z.string().uuid("Invalid session identifier."),
});

const deleteAccountSchema = z.object({
  confirmEmail: z.string().trim().email("Please enter a valid email address."),
});

export async function revokeUserSessionAction(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Authentication required." };
  }

  const parsed = revokeSessionSchema.safeParse({ sessionId });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid session identifier.",
    };
  }

  if (parsed.data.sessionId === ctx.session.id) {
    return { ok: false, error: "Use Sign out from the menu to end your current session." };
  }

  await db
    .delete(dbSchema.sessions)
    .where(
      and(
        eq(dbSchema.sessions.id, parsed.data.sessionId),
        eq(dbSchema.sessions.userId, ctx.user.id),
      ),
    );

  revalidatePath("/account/security");
  return { ok: true };
}

export async function revokeOtherUserSessionsAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Authentication required." };
  }

  await db
    .delete(dbSchema.sessions)
    .where(
      and(eq(dbSchema.sessions.userId, ctx.user.id), ne(dbSchema.sessions.id, ctx.session.id)),
    );

  revalidatePath("/account/security");
  return { ok: true };
}

export async function deleteUserAccountAction(
  confirmEmail: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Authentication required." };
  }

  const parsed = deleteAccountSchema.safeParse({ confirmEmail });
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please enter your account email.",
    };
  }

  if (parsed.data.confirmEmail.toLowerCase() !== ctx.user.email.toLowerCase()) {
    return {
      ok: false,
      error: "Email confirmation does not match your account email.",
    };
  }

  // 1. Prevent sole Team Owners from orphaning live Team subscriptions or destroying shared workspaces
  const userMemberships = await db
    .select()
    .from(dbSchema.memberships)
    .where(eq(dbSchema.memberships.userId, ctx.user.id));

  for (const membership of userMemberships) {
    const role = normalizeMembershipRole(membership.role);
    if (role === "owner") {
      const orgMembers = await db
        .select({
          userId: dbSchema.memberships.userId,
          role: dbSchema.memberships.role,
        })
        .from(dbSchema.memberships)
        .where(eq(dbSchema.memberships.orgId, membership.orgId));

      const hasOtherOwner = orgMembers.some(
        (m) => m.userId !== ctx.user.id && normalizeMembershipRole(m.role) === "owner",
      );
      const hasOtherMembers = orgMembers.some((m) => m.userId !== ctx.user.id);

      const [liveTeamSub] = await db
        .select({ id: dbSchema.subscriptions.id, status: dbSchema.subscriptions.status })
        .from(dbSchema.subscriptions)
        .where(
          and(
            eq(dbSchema.subscriptions.orgId, membership.orgId),
            inArray(dbSchema.subscriptions.status, [
              "active",
              "trialing",
              "past_due",
              "paused",
              "cancel_at_period_end",
            ]),
          ),
        )
        .limit(1);

      if (!hasOtherOwner && (hasOtherMembers || Boolean(liveTeamSub))) {
        return {
          ok: false,
          error:
            "You are the sole Owner of an active Team workspace. Transfer workspace ownership or cancel and dissolve the Team workspace before deleting your account.",
        };
      }
    }
  }

  // 2. Run clean departure side effects & preserve shared team projects (`ownerId` -> org Owner)
  for (const membership of userMemberships) {
    const orgMembers = await db
      .select({
        userId: dbSchema.memberships.userId,
        role: dbSchema.memberships.role,
      })
      .from(dbSchema.memberships)
      .where(eq(dbSchema.memberships.orgId, membership.orgId));

    const survivingOwner = orgMembers.find(
      (m) => m.userId !== ctx.user.id && normalizeMembershipRole(m.role) === "owner",
    );

    if (survivingOwner) {
      await executeMemberDepartureSideEffects({
        organizationId: membership.orgId,
        departedUserId: ctx.user.id,
        actorUserId: ctx.user.id,
      }).catch(() => undefined);

      // Reassign `ownerId` on team projects so ON DELETE CASCADE on `users` never wipes shared team work
      await db
        .update(dbSchema.projects)
        .set({ ownerId: survivingOwner.userId })
        .where(
          and(
            eq(dbSchema.projects.orgId, membership.orgId),
            eq(dbSchema.projects.ownerId, ctx.user.id),
          ),
        );
    }
  }

  // 3. Cancel personal subscription immediately
  await cancelUserSubscription(
    { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name },
    { reason: "other", feedback: "Account deleted by user", immediate: true },
  ).catch(() => null);

  // 4. Purge stored R2/local asset & export objects belonging to personal projects before cascading DB rows
  const personalProjects = await db
    .select({ id: dbSchema.projects.id })
    .from(dbSchema.projects)
    .where(and(eq(dbSchema.projects.ownerId, ctx.user.id), isNull(dbSchema.projects.orgId)));

  if (personalProjects.length > 0) {
    const personalIds = personalProjects.map((p) => p.id);
    const [personalAssets, personalExports] = await Promise.all([
      db
        .select({ r2Key: dbSchema.assets.r2Key })
        .from(dbSchema.assets)
        .where(inArray(dbSchema.assets.projectId, personalIds)),
      db
        .select({ r2Key: dbSchema.exportsTable.r2Key })
        .from(dbSchema.exportsTable)
        .where(inArray(dbSchema.exportsTable.projectId, personalIds)),
    ]);

    const r2Keys = [
      ...personalAssets.map((a) => a.r2Key),
      ...personalExports.map((e) => e.r2Key).filter((k): k is string => Boolean(k)),
    ];
    await Promise.all(r2Keys.map((key) => deleteStoredObject(key).catch(() => undefined)));
  }

  await db.delete(dbSchema.users).where(eq(dbSchema.users.id, ctx.user.id));

  return { ok: true };
}
