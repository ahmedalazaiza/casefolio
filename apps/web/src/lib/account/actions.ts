"use server";

import { and, eq, ne } from "@casefolio/db";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getServerSession } from "@/lib/auth/session";
import { cancelUserSubscription } from "@/lib/billing/service";
import { db, dbSchema } from "@/lib/db";

const updateProfileSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, "Full name must be at least 2 characters.")
    .max(80, "Full name must be 80 characters or fewer."),
  jobTitle: z
    .string()
    .trim()
    .max(100, "Role or title must be 100 characters or fewer.")
    .optional(),
  designFocus: z.enum(["mobile", "web", "both"]).nullable().optional(),
  imageUrl: z
    .string()
    .trim()
    .max(500, "Avatar URL is too long.")
    .refine(
      (val) => val.length === 0 || /^https?:\/\//i.test(val) || val.startsWith("/"),
      "Avatar URL must start with https:// or http://.",
    )
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

export async function revokeUserSessionAction(
  sessionId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Authentication required." };
  }

  if (sessionId === ctx.session.id) {
    return { ok: false, error: "Use Sign out from the menu to end your current session." };
  }

  await db
    .delete(dbSchema.sessions)
    .where(
      and(eq(dbSchema.sessions.id, sessionId), eq(dbSchema.sessions.userId, ctx.user.id)),
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
      and(
        eq(dbSchema.sessions.userId, ctx.user.id),
        ne(dbSchema.sessions.id, ctx.session.id),
      ),
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

  if (confirmEmail.trim().toLowerCase() !== ctx.user.email.toLowerCase()) {
    return {
      ok: false,
      error: "Email confirmation does not match your account email.",
    };
  }

  await cancelUserSubscription(
    { id: ctx.user.id, email: ctx.user.email, name: ctx.user.name },
    { reason: "other", feedback: "Account deleted by user", immediate: true },
  ).catch(() => null);

  await db.delete(dbSchema.users).where(eq(dbSchema.users.id, ctx.user.id));

  return { ok: true };
}
