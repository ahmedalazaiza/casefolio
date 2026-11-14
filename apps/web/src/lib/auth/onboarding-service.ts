import { eq } from "@casefolio/db";
import { completeOnboardingSchema } from "@/lib/auth/schemas";
import { db, dbSchema } from "@/lib/db";
import { sendWelcomeNewUserEmail } from "@/lib/email";

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

  const [existing] = await db
    .select({
      email: dbSchema.users.email,
      onboardingCompletedAt: dbSchema.users.onboardingCompletedAt,
    })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId))
    .limit(1);

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

  if (existing && existing.onboardingCompletedAt === null) {
    await sendWelcomeNewUserEmail({
      to: existing.email,
      name: parsed.data.name,
      jobTitle: parsed.data.jobTitle,
      designFocus: parsed.data.designFocus,
    }).catch(() => undefined);
  }

  return { ok: true };
}

export async function markOnboardingSkippedForUser(
  userId: string,
): Promise<OnboardingActionResult> {
  const [existing] = await db
    .select({
      email: dbSchema.users.email,
      name: dbSchema.users.name,
      jobTitle: dbSchema.users.jobTitle,
      designFocus: dbSchema.users.designFocus,
      onboardingCompletedAt: dbSchema.users.onboardingCompletedAt,
    })
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, userId))
    .limit(1);

  await db
    .update(dbSchema.users)
    .set({
      onboardingCompletedAt: new Date(),
      updatedAt: new Date(),
    })
    .where(eq(dbSchema.users.id, userId));

  if (existing && existing.onboardingCompletedAt === null) {
    await sendWelcomeNewUserEmail({
      to: existing.email,
      name: existing.name,
      jobTitle: existing.jobTitle,
      designFocus: existing.designFocus,
    }).catch(() => undefined);
  }

  return { ok: true };
}
