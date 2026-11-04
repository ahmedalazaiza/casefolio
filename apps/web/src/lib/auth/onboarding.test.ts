// @vitest-environment node
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import {
  markOnboardingSkippedForUser,
  saveOnboardingProfileForUser,
} from "@/lib/auth/onboarding-actions";
import { completeOnboardingSchema } from "@/lib/auth/schemas";
import { auth } from "@/lib/auth/server";
import { db, dbSchema } from "@/lib/db";

describe("Onboarding validation & profile persistence (C-203)", () => {
  it("validates onboarding inputs with Zod", () => {
    expect(
      completeOnboardingSchema.safeParse({
        name: "Ahmed Al-Azaiza",
        jobTitle: "Product designer",
        designFocus: "both",
        image: null,
      }).success,
    ).toBe(true);

    expect(
      completeOnboardingSchema.safeParse({
        name: "A",
        jobTitle: "Product designer",
        designFocus: "mobile",
      }).success,
    ).toBe(false);

    expect(
      completeOnboardingSchema.safeParse({
        name: "Ahmed Al-Azaiza",
        jobTitle: "Product designer",
        designFocus: "mobile",
        image: "javascript:alert(1)",
      }).success,
    ).toBe(false);
  });

  it("saves onboarding profile fields (`name`, `jobTitle`, `designFocus`, `image`, `onboardingCompletedAt`) to Postgres", async () => {
    const email = `c203-profile-${Date.now()}@casefolio.test`;
    const skipEmail = `c203-skip-${Date.now()}@casefolio.test`;

    try {
      const signUpRes = await auth.api.signUpEmail({
        body: {
          name: "Initial Name",
          email,
          password: "CasefolioPassword2026!",
        },
      });

      const userId = signUpRes.user.id;
      const [beforeRow] = await db
        .select()
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, userId));
      expect(beforeRow?.onboardingCompletedAt).toBeNull();

      const sampleDataUrl =
        "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";

      const saveRes = await saveOnboardingProfileForUser(userId, {
        name: "Lina Al-Harbi",
        jobTitle: "Senior UI/UX Designer",
        designFocus: "both",
        image: sampleDataUrl,
      });
      expect(saveRes.ok).toBe(true);

      const [afterRow] = await db
        .select()
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, userId));

      expect(afterRow?.name).toBe("Lina Al-Harbi");
      expect(afterRow?.jobTitle).toBe("Senior UI/UX Designer");
      expect(afterRow?.designFocus).toBe("both");
      expect(afterRow?.image).toBe(sampleDataUrl);
      expect(afterRow?.onboardingCompletedAt).toBeInstanceOf(Date);

      // Verify skip onboarding stamps `onboardingCompletedAt` so user only sees onboarding once
      const skipSignUp = await auth.api.signUpEmail({
        body: {
          name: "Skip User",
          email: skipEmail,
          password: "CasefolioPassword2026!",
        },
      });
      const skipRes = await markOnboardingSkippedForUser(skipSignUp.user.id);
      expect(skipRes.ok).toBe(true);

      const [skippedRow] = await db
        .select()
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, skipSignUp.user.id));
      expect(skippedRow?.onboardingCompletedAt).toBeInstanceOf(Date);
    } finally {
      await db.delete(dbSchema.users).where(eq(dbSchema.users.email, email));
      await db.delete(dbSchema.users).where(eq(dbSchema.users.email, skipEmail));
    }
  });
});
