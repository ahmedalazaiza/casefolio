// @vitest-environment node
import { desc, eq, like } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import {
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendVerificationOtpEmail,
} from "@/lib/auth/email";
import {
  resetPasswordSchema,
  signInPasswordSchema,
  signUpSchema,
  verifyEmailOtpSchema,
} from "@/lib/auth/schemas";
import { auth } from "@/lib/auth/server";
import { db, dbSchema } from "@/lib/db";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe("Better Auth: email+password, Google, magic link, OTP & DB sessions (C-201)", () => {
  it("validates auth forms with Zod and rejects weak passwords or unchecked terms", () => {
    expect(
      signUpSchema.safeParse({
        name: "Ahmed Al-Azaiza",
        email: "ahmed@example.com",
        password: "short",
        acceptTerms: true,
      }).success,
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        name: "Ahmed Al-Azaiza",
        email: "ahmed@example.com",
        password: "StrongPassword123!",
        acceptTerms: false,
      }).success,
    ).toBe(false);

    expect(
      signUpSchema.safeParse({
        name: "Ahmed Al-Azaiza",
        email: "ahmed@example.com",
        password: "StrongPassword123!",
        acceptTerms: true,
      }).success,
    ).toBe(true);

    expect(
      signInPasswordSchema.safeParse({
        email: "ahmed@example.com",
        password: "StrongPassword123!",
        rememberMe: true,
      }).success,
    ).toBe(true);

    expect(
      verifyEmailOtpSchema.safeParse({
        email: "ahmed@example.com",
        otp: "481920",
      }).success,
    ).toBe(true);

    expect(
      resetPasswordSchema.safeParse({
        token: "tok_123",
        newPassword: "StrongPassword123!",
        confirmPassword: "MismatchPassword!",
      }).success,
    ).toBe(false);
  });

  it("renders React Email templates cleanly for OTP, magic link, and password reset", async () => {
    const otpMail = await sendVerificationOtpEmail({
      email: "designer@casefolio.app",
      otp: "629401",
      type: "email-verification",
    });
    expect(otpMail.html).toContain("629401");
    expect(otpMail.text).toContain("629401");

    const magicMail = await sendMagicLinkEmail({
      email: "designer@casefolio.app",
      url: "http://localhost:3000/api/auth/magic-link/verify?token=abc",
    });
    expect(magicMail.html).toContain("Sign in to Casefolio");

    const resetMail = await sendPasswordResetEmail({
      email: "designer@casefolio.app",
      url: "http://localhost:3000/reset?token=xyz",
    });
    expect(resetMail.html).toContain("Choose new password");
  });

  it("signs up, issues UUID records, verifies email OTP, signs in/out, and generates magic links in Postgres", async () => {
    const uniqueEmail = `c201-${Date.now()}@casefolio.test`;
    const password = "CasefolioPassword2026!";

    try {
      // 1. Sign up with email & password
      const signUpRes = await auth.api.signUpEmail({
        body: {
          name: "Noura Al-Mansoor",
          email: uniqueEmail,
          password,
        },
        returnHeaders: true,
      });

      expect(signUpRes.response.user.email).toBe(uniqueEmail);
      expect(signUpRes.response.user.id).toMatch(UUID_REGEX);

      // Verify user defaults in Postgres (`role = user`, `plan = free`, `emailVerified = false`)
      const [createdUser] = await db
        .select()
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, signUpRes.response.user.id));

      expect(createdUser).toBeDefined();
      expect(createdUser?.role).toBe("user");
      expect(createdUser?.plan).toBe("free");
      expect(createdUser?.emailVerified).toBe(false);

      // 2. Read the 6-digit OTP stored in `verifications` and verify email
      const [otpRow] = await db
        .select()
        .from(dbSchema.verifications)
        .where(like(dbSchema.verifications.identifier, `%${uniqueEmail}%`))
        .orderBy(desc(dbSchema.verifications.createdAt))
        .limit(1);

      expect(otpRow).toBeDefined();
      const otpCode = (otpRow?.value ?? "").split(":")[0] ?? "";
      expect(otpCode).toMatch(/^\d{6}$/);

      const verifyRes = await auth.api.verifyEmailOTP({
        body: {
          email: uniqueEmail,
          otp: otpCode,
        },
      });
      expect(verifyRes.status).toBe(true);

      const [verifiedUser] = await db
        .select()
        .from(dbSchema.users)
        .where(eq(dbSchema.users.id, signUpRes.response.user.id));
      expect(verifiedUser?.emailVerified).toBe(true);

      // 3. Sign in with email & password -> persists session in DB
      const signInRes = await auth.api.signInEmail({
        body: {
          email: uniqueEmail,
          password,
        },
        returnHeaders: true,
      });

      const setCookie = signInRes.headers.get("set-cookie");
      expect(setCookie).toBeTruthy();
      const cookieHeader = (setCookie ?? "")
        .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
        .map((part) => part.split(";")[0]?.trim())
        .filter(Boolean)
        .join("; ");

      const activeSession = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });
      expect(activeSession?.user.id).toBe(signUpRes.response.user.id);

      // 4. Request magic link -> persists verification token
      const magicRes = await auth.api.signInMagicLink({
        body: {
          email: uniqueEmail,
          callbackURL: "/dashboard",
        },
        headers: new Headers(),
      });
      expect(magicRes.status).toBe(true);

      // 5. Sign out -> revokes session in DB
      await auth.api.signOut({
        headers: new Headers({ cookie: cookieHeader }),
      });

      const afterSignOut = await auth.api.getSession({
        headers: new Headers({ cookie: cookieHeader }),
      });
      expect(afterSignOut).toBeNull();
    } finally {
      await db.delete(dbSchema.users).where(eq(dbSchema.users.email, uniqueEmail));
      await db
        .delete(dbSchema.verifications)
        .where(like(dbSchema.verifications.identifier, `%${uniqueEmail}%`));
    }
  });
});
