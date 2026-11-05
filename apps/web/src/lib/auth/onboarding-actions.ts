"use server";

import { revalidatePath } from "next/cache";
import {
  markOnboardingSkippedForUser,
  saveOnboardingProfileForUser,
  type OnboardingActionResult,
} from "@/lib/auth/onboarding-service";
import { getServerSession } from "@/lib/auth/session";

export type { OnboardingActionResult };

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
