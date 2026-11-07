import { eq } from "@casefolio/db";
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { nextCookies } from "better-auth/next-js";
import { emailOTP, magicLink, organization } from "better-auth/plugins";
import { env } from "@/env";
import { getPlatformSettings } from "@/lib/admin/settings";
import { checkPlatformAuthGate } from "@/lib/admin/settings-types";
import { trackServerProductEvent } from "@/lib/analytics/posthog";
import {
  sendMagicLinkEmail,
  sendPasswordResetEmail,
  sendTeamInvitationEmail,
  sendVerificationOtpEmail,
} from "@/lib/auth/email";
import { organizationAccessControl, organizationRoles } from "@/lib/auth/permissions";
import { db, dbSchema } from "@/lib/db";
import { sanitizeErrorForLogging } from "@/lib/security/redact";

export const auth = betterAuth({
  appName: "Casefolio",
  baseURL: env.BETTER_AUTH_URL,
  secret: env.BETTER_AUTH_SECRET,
  trustedOrigins: Array.from(
    new Set(
      [
        env.BETTER_AUTH_URL,
        env.NEXT_PUBLIC_APP_URL,
        process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "",
        process.env.VERCEL_BRANCH_URL ? `https://${process.env.VERCEL_BRANCH_URL}` : "",
        ...(process.env.NODE_ENV !== "production"
          ? ["http://127.0.0.1:3000", "http://localhost:3000"]
          : []),
      ].filter(Boolean),
    ),
  ),
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema: {
      ...dbSchema,
      members: dbSchema.memberships,
    },
  }),
  advanced: {
    database: {
      generateId: "uuid",
    },
  },
  hooks: {
    before: createAuthMiddleware(async (ctx) => {
      if (ctx.path === "/sign-up/email") {
        const platform = await getPlatformSettings();
        const gate = checkPlatformAuthGate({ path: ctx.path, platform });
        if (!gate.allowed) {
          throw new APIError("FORBIDDEN", { message: gate.message });
        }
      }

      const signInPaths = new Set([
        "/sign-in/email",
        "/sign-in/magic-link",
        "/sign-in/email-otp",
        "/email-otp/send-verification-otp",
      ]);

      if (signInPaths.has(ctx.path)) {
        const platform = await getPlatformSettings();
        const body = (ctx.body ?? {}) as { email?: unknown };
        const rawEmail = typeof body.email === "string" ? body.email.trim().toLowerCase() : null;
        if (rawEmail) {
          const [targetUser] = await db
            .select({
              suspended: dbSchema.users.suspended,
              role: dbSchema.users.role,
            })
            .from(dbSchema.users)
            .where(eq(dbSchema.users.email, rawEmail))
            .limit(1);

          if (targetUser?.suspended) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been suspended. Please contact support.",
            });
          }

          const gate = checkPlatformAuthGate({
            path: ctx.path,
            platform,
            targetUserRole: targetUser?.role ?? null,
          });
          if (!gate.allowed) {
            throw new APIError("FORBIDDEN", { message: gate.message });
          }
        }
      }
    }),
  },
  databaseHooks: {
    session: {
      create: {
        async before(session) {
          const [targetUser] = await db
            .select({ suspended: dbSchema.users.suspended })
            .from(dbSchema.users)
            .where(eq(dbSchema.users.id, session.userId))
            .limit(1);

          if (targetUser?.suspended) {
            throw new APIError("FORBIDDEN", {
              message: "Your account has been suspended. Please contact support.",
            });
          }
          return { data: session };
        },
      },
    },
    user: {
      create: {
        async after(user) {
          await trackServerProductEvent({
            event: "signup",
            distinctId: user.id,
            properties: {
              plan: "free",
              source: "auth",
            },
          });
        },
      },
    },
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "user",
        input: false,
      },
      plan: {
        type: "string",
        required: false,
        defaultValue: "free",
        input: false,
      },
      suspended: {
        type: "boolean",
        required: false,
        defaultValue: false,
        input: false,
      },
      jobTitle: {
        type: "string",
        required: false,
        input: true,
      },
      designFocus: {
        type: "string",
        required: false,
        input: true,
      },
      onboardingCompletedAt: {
        type: "date",
        required: false,
        input: false,
      },
    },
  },
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 8,
    maxPasswordLength: 128,
    autoSignIn: true,
    async sendResetPassword({ user, url }) {
      await sendPasswordResetEmail({ email: user.email, url });
    },
  },
  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
    },
  },
  rateLimit: {
    enabled: process.env.NODE_ENV === "production",
    window: 60,
    max: 30,
  },
  plugins: [
    magicLink({
      expiresIn: 300,
      async sendMagicLink({ email, url }) {
        await sendMagicLinkEmail({ email, url });
      },
    }),
    emailOTP({
      otpLength: 6,
      expiresIn: 600,
      sendVerificationOnSignUp: true,
      async sendVerificationOTP({ email, otp, type }) {
        try {
          await sendVerificationOtpEmail({ email, otp, type });
        } catch (err) {
          const safe = sanitizeErrorForLogging(err);
          console.warn("[auth] verification OTP email warning:", safe.message);
          if (type !== "email-verification") {
            throw err;
          }
        }
      },
    }),
    organization({
      ac: organizationAccessControl,
      roles: organizationRoles,
      creatorRole: "owner",
      schema: {
        member: {
          fields: {
            organizationId: "orgId",
          },
        },
      },
      async sendInvitationEmail(data) {
        await sendTeamInvitationEmail({
          email: data.email,
          organizationName: data.organization.name,
          inviterName: data.inviter.user.name,
          acceptUrl: `${env.NEXT_PUBLIC_APP_URL}/account/team?invitationId=${encodeURIComponent(data.id)}`,
          role: data.role,
        });
      },
    }),
    nextCookies(),
  ],
});

export type AuthSession = typeof auth.$Infer.Session;
export type AuthUser = AuthSession["user"];
