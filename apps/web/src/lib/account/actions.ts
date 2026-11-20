"use server";

import { and, eq, ne } from "@casefolio/db";
import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { z } from "zod";
import { isSafeAvatarUrl } from "@/lib/auth/schemas";
import { getServerSession } from "@/lib/auth/session";
import { consumeStepUpToken } from "@/lib/auth/step-up";
import { db, dbSchema } from "@/lib/db";
import {
  sendAccountDeletionCanceledEmail,
  sendSessionsRevokedEmail,
} from "@/lib/email";
import { executeAccountPurge } from "@/lib/retention/account";

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
  stepUpToken: z.string().trim().min(20, "Identity confirmation is required."),
  dissolveOwnedTeams: z.boolean().optional(),
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

  await sendSessionsRevokedEmail({
    to: ctx.user.email,
    name: ctx.user.name,
  }).catch(() => undefined);

  revalidatePath("/account/security");
  return { ok: true };
}

/**
 * Permanently and immediately erases the authenticated user's account, personal projects,
 * published links, exports, sessions, and R2 media after server-verified step-up confirmation.
 * Cancels active Paddle billing first so users are never billed after deletion.
 */
export async function deleteUserAccountAction(rawInput: {
  confirmEmail: string;
  stepUpToken: string;
  dissolveOwnedTeams?: boolean;
}): Promise<{ ok: true; deletedImmediately: true } | { ok: false; code?: string; error: string }> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Authentication required." };
  }

  const parsed = deleteAccountSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Please confirm your identity and email.",
    };
  }

  if (parsed.data.confirmEmail.toLowerCase() !== ctx.user.email.toLowerCase()) {
    return {
      ok: false,
      error: "Email confirmation does not match your account email.",
    };
  }

  const stepUp = await consumeStepUpToken({
    userId: ctx.user.id,
    sessionId: ctx.session.id,
    purpose: "account_deletion",
    stepUpToken: parsed.data.stepUpToken,
  });
  if (!stepUp.ok) {
    return { ok: false, error: stepUp.error };
  }

  const purgeRes = await executeAccountPurge(ctx.user.id, {
    dissolveOwnedTeams: Boolean(parsed.data.dissolveOwnedTeams),
  });
  if (!purgeRes.ok) {
    return { ok: false, code: purgeRes.code, error: purgeRes.error };
  }

  try {
    const cookieStore = await cookies();
    for (const c of cookieStore.getAll()) {
      if (c.name.includes("better-auth")) {
        cookieStore.delete(c.name);
      }
    }
  } catch {
    // DB sessions are already purged; browser will prompt sign-in on next request
  }

  revalidatePath("/", "layout");
  revalidatePath("/dashboard");

  return {
    ok: true,
    deletedImmediately: true,
  };
}

export async function cancelScheduledAccountDeletionAction(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Authentication required." };
  }

  if (!ctx.user.deletionScheduledFor && !ctx.user.deletionRequestedAt) {
    return { ok: true };
  }

  const now = new Date();
  await db.transaction(async (tx) => {
    await tx
      .update(dbSchema.users)
      .set({
        deletionRequestedAt: null,
        deletionScheduledFor: null,
        updatedAt: now,
      })
      .where(eq(dbSchema.users.id, ctx.user.id));

    await tx.insert(dbSchema.auditLogs).values({
      actorId: ctx.user.id,
      action: "account.deletion_canceled",
      meta: {
        canceledAtIso: now.toISOString(),
      },
      at: now,
    });
  });

  await sendAccountDeletionCanceledEmail({
    to: ctx.user.email,
    name: ctx.user.name,
    canceledAtIso: now.toISOString(),
  }).catch(() => undefined);

  revalidatePath("/account");
  revalidatePath("/account/security");

  return { ok: true };
}
