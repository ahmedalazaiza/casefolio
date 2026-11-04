"use server";

import { eq } from "@casefolio/db";
import { revalidatePath } from "next/cache";
import { completeOnboardingSchema } from "@/lib/auth/schemas";
import { getServerSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";

export interface OnboardingActionResult {
  ok: boolean;
  error?: string;
}

export async function saveOnboardingProfileForUser(
  userId: string,
  rawInput: unknown,
): Promise<OnboardingActionResult> {
  const parsed = completeOnboardingSchema.safeParse(rawInput);
  if (!parsed.success) {
    return {
      ok: false,
      error: parsed.error.issues[0]?.message ?? "Invalid onboarding profile details.",
    };
  }

  const normalizedImage =
    parsed.data.image && parsed.data.image.length > 0 ? parsed.data.image : null;

  await db
    .update(dbSchema.users)
    .set({
      name: parsed.data.name,
      jobTitle: parsed.data.jobTitle,
      designFocus: parsed.data.designFocus,
      ...(normalizedImage !== null ? { image: normalizedImage } : {}),
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.users.id, userId));

  return { ok: true };
}

export async function markOnboardingSkippedForUser(userId: string): Promise<OnboardingActionResult> {
  await db
    .update(dbSchema.users)
    .set({
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.users.id, userId));

  return { ok: true };
}

export async function completeOnboardingAction(rawInput: {
  name: string;
  jobTitle: string;
  designFocus: "mobile" | "web" | "both";
  image?: string | null;
}): Promise<OnboardingActionResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Please sign in to complete onboarding." };
  }

  const result = await saveOnboardingProfileForUser(ctx.user.id, rawInput);
  if (result.ok) {
    revalidatePath("/dashboard");
    revalidatePath("/account");
    revalidatePath("/onboarding");
  }
  return result;
}

export async function skipOnboardingAction(): Promise<OnboardingActionResult> {
  const ctx = await getServerSession();
  if (!ctx) {
    return { ok: false, error: "Please sign in first." };
  }

  const result = await markOnboardingSkippedForUser(ctx.user.id);
  revalidatePath("/dashboard");
  revalidatePath("/onboarding");
  return result;
}
