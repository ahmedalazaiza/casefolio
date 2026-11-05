import { eq } from "@casefolio/db";
import { completeOnboardingSchema } from "@/lib/auth/schemas";
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

export async function markOnboardingSkippedForUser(
  userId: string,
): Promise<OnboardingActionResult> {
  await db
    .update(dbSchema.users)
    .set({
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.users.id, userId));

  return { ok: true };
}

