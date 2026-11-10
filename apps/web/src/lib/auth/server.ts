import { and, eq, normalizeMembershipRole } from "@casefolio/db";
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
import {
  ensurePersonalWorkspaceForUser,
  ensureTeamWorkspaceForOrganization,
  resolveWorkspaceEntitlementState,
} from "@/lib/entitlements/server";
import {
  executeMemberDepartureSideEffects,
  getTeamSeatOccupancy,
  INVITATION_TTL_DAYS,
  normalizeInviteEmail,
} from "@/lib/entitlements/team-invitations";
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
          await ensurePersonalWorkspaceForUser(user.id).catch(() => undefined);
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
    // Shared across serverless instances (see `rate_limits`); in-memory counters are per-instance.
    storage: "database",
    // Keyed per client IP + path. The general ceiling must stay generous: offices, schools and
    // mobile carriers put many real users behind one IP, and session reads happen on every page.
    window: 60,
    max: 300,
    customRules: {
      // Read-only session probe — never throttle it (it would log users out of the UI).
      "/get-session": false,
      // Credential endpoints: tight enough to stop brute force / email bombing, loose enough that
      // a team signing in from one office does not lock itself out.
      "/sign-in/email": { window: 60, max: 30 },
      "/sign-up/email": { window: 60, max: 30 },
      "/sign-in/magic-link": { window: 60, max: 6 },
      "/email-otp/send-verification-otp": { window: 60, max: 6 },
      "/sign-in/email-otp": { window: 60, max: 12 },
      "/email-otp/verify-email": { window: 60, max: 12 },
      "/request-password-reset": { window: 300, max: 6 },
      "/reset-password": { window: 300, max: 10 },
    },
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
      invitationExpiresIn: INVITATION_TTL_DAYS * 24 * 60 * 60,
      cancelPendingInvitationsOnReInvite: true,
      requireEmailVerificationOnInvitation: true,
      schema: {
        member: {
          fields: {
            organizationId: "orgId",
          },
        },
      },
      organizationHooks: {
        async afterCreateOrganization({ organization: org, user }) {
          await ensureTeamWorkspaceForOrganization(org.id, user.id);
        },
        async beforeCreateInvitation({ invitation, inviter, organization: org }) {
          if (invitation.role === "owner") {
            throw new APIError("FORBIDDEN", {
              message: "Owner cannot be assigned via invitation. Use ownership transfer.",
            });
          }

          const canonicalTargetRole =
            invitation.role === "admin" || invitation.role === "editor" ? "admin" : "member";

          const [inviterMembership] = await db
            .select({ role: dbSchema.memberships.role })
            .from(dbSchema.memberships)
            .where(
              and(
                eq(dbSchema.memberships.orgId, org.id),
                eq(dbSchema.memberships.userId, inviter.id),
              ),
            )
            .limit(1);

          const inviterRole = normalizeMembershipRole(inviterMembership?.role);
          if (inviterRole === "member") {
            throw new APIError("FORBIDDEN", {
              message: "Members cannot invite teammates.",
            });
          }
          if (inviterRole === "admin" && canonicalTargetRole !== "member") {
            throw new APIError("FORBIDDEN", {
              message: "Admins can invite Members only.",
            });
          }

          const ensured = await ensureTeamWorkspaceForOrganization(org.id, inviter.id);
          const ent = await resolveWorkspaceEntitlementState(ensured.workspaceId);
          if (!ent || ent.plan !== "team" || ent.isFrozen || ent.lifecycle.isPastDueInGrace) {
            throw new APIError("FORBIDDEN", {
              message: "An active Casefolio Teams subscription is required to invite members.",
            });
          }

          const occupancy = await getTeamSeatOccupancy(org.id);
          if (occupancy.occupiedSeats >= occupancy.admissionCeiling) {
            throw new APIError("FORBIDDEN", {
              message: "All paid team seats are currently occupied or reserved.",
            });
          }

          return {
            data: {
              ...invitation,
              email: normalizeInviteEmail(invitation.email),
              role: canonicalTargetRole,
              expiresAt: new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000),
            },
          };
        },
        async afterCreateInvitation({ invitation, organization: org }) {
          const ensured = await ensureTeamWorkspaceForOrganization(org.id);
          await db
            .insert(dbSchema.seatReservations)
            .values({
              invitationId: invitation.id,
              workspaceId: ensured.workspaceId,
              organizationId: org.id,
              normalizedEmail: normalizeInviteEmail(invitation.email),
              role: normalizeMembershipRole(invitation.role),
              status: "active",
              expiresAt: invitation.expiresAt,
            })
            .onConflictDoNothing({ target: dbSchema.seatReservations.invitationId });
        },
        async beforeAcceptInvitation({ invitation, user, organization: org }) {
          if (!user.emailVerified) {
            throw new APIError("FORBIDDEN", {
              message: "Verify your email address before accepting a team invitation.",
            });
          }

          if (normalizeInviteEmail(user.email) !== normalizeInviteEmail(invitation.email)) {
            throw new APIError("FORBIDDEN", {
              message: "Sign in with the exact email address invited.",
            });
          }

          const [dbInv] = await db
            .select()
            .from(dbSchema.invitations)
            .where(eq(dbSchema.invitations.id, invitation.id))
            .limit(1);

          if (!dbInv || dbInv.revokedAt !== null || dbInv.status !== "pending") {
            throw new APIError("BAD_REQUEST", {
              message: "Invitation is no longer active.",
            });
          }

          if (dbInv.expiresAt.getTime() <= Date.now()) {
            throw new APIError("BAD_REQUEST", {
              message: "Invitation has expired.",
            });
          }

          const ensured = await ensureTeamWorkspaceForOrganization(org.id);
          const ent = await resolveWorkspaceEntitlementState(ensured.workspaceId);
          if (!ent || ent.plan !== "team" || ent.isFrozen) {
            throw new APIError("FORBIDDEN", {
              message: "Team workspace subscription is not active.",
            });
          }

          const activeMembers = await db
            .select({ id: dbSchema.memberships.id })
            .from(dbSchema.memberships)
            .where(eq(dbSchema.memberships.orgId, org.id));

          if (activeMembers.length >= ent.admissionCeiling) {
            throw new APIError("FORBIDDEN", {
              message: "Team workspace has no available seat capacity.",
            });
          }
        },
        async afterAcceptInvitation({ invitation, user, organization: org }) {
          const now = new Date();
          await db
            .update(dbSchema.invitations)
            .set({ acceptedAt: now })
            .where(eq(dbSchema.invitations.id, invitation.id));

          await db
            .update(dbSchema.seatReservations)
            .set({ status: "consumed", updatedAt: now })
            .where(eq(dbSchema.seatReservations.invitationId, invitation.id));

          await ensureTeamWorkspaceForOrganization(org.id, user.id);
        },
        async afterCancelInvitation({ invitation }) {
          const now = new Date();
          await db
            .update(dbSchema.invitations)
            .set({ revokedAt: now })
            .where(eq(dbSchema.invitations.id, invitation.id));

          await db
            .update(dbSchema.seatReservations)
            .set({ status: "revoked", updatedAt: now })
            .where(eq(dbSchema.seatReservations.invitationId, invitation.id));
        },
        async beforeRemoveMember({ member, user, organization: org }) {
          const targetRole = normalizeMembershipRole(member.role);
          if (targetRole === "owner") {
            throw new APIError("BAD_REQUEST", {
              message: "Transfer ownership before removing the workspace Owner.",
            });
          }

          if (member.userId !== user.id) {
            const [actorMembership] = await db
              .select({ role: dbSchema.memberships.role })
              .from(dbSchema.memberships)
              .where(
                and(
                  eq(dbSchema.memberships.orgId, org.id),
                  eq(dbSchema.memberships.userId, user.id),
                ),
              )
              .limit(1);

            const actorRole = normalizeMembershipRole(actorMembership?.role);
            if (actorRole === "admin" && targetRole !== "member") {
              throw new APIError("FORBIDDEN", {
                message: "Admins can remove Members only.",
              });
            }
          }
        },
        async afterRemoveMember({ member, user, organization: org }) {
          await executeMemberDepartureSideEffects({
            organizationId: org.id,
            departedUserId: member.userId,
            actorUserId: user.id,
          });
        },
        async beforeUpdateMemberRole({ member, newRole, user, organization: org }) {
          const [actorMembership] = await db
            .select({ role: dbSchema.memberships.role })
            .from(dbSchema.memberships)
            .where(
              and(
                eq(dbSchema.memberships.orgId, org.id),
                eq(dbSchema.memberships.userId, user.id),
              ),
            )
            .limit(1);

          if (normalizeMembershipRole(actorMembership?.role) !== "owner") {
            throw new APIError("FORBIDDEN", {
              message: "Only the workspace Owner can update member roles.",
            });
          }

          if (normalizeMembershipRole(member.role) === "owner" || newRole === "owner") {
            throw new APIError("BAD_REQUEST", {
              message: "Use Ownership Transfer to change the workspace Owner.",
            });
          }

          return {
            data: {
              role: newRole === "admin" || newRole === "editor" ? "admin" : "member",
            },
          };
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
