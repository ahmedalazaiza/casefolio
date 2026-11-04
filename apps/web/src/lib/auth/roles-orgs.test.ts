// @vitest-environment node
import { and, eq } from "@casefolio/db";
import { describe, expect, it, vi } from "vitest";
import { sendTeamInvitationEmail } from "@/lib/auth/email";
import {
  canEditInOrganization,
  hasAdminRole,
  isOrganizationOwner,
  isSuperAdminRole,
} from "@/lib/auth/guards";
import { createOrganizationSchema, inviteTeamMemberSchema } from "@/lib/auth/schemas";
import { auth } from "@/lib/auth/server";
import { db, dbSchema } from "@/lib/db";

function extractCookieHeader(setCookie: string | null): string {
  return (setCookie ?? "")
    .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
    .map((part) => part.split(";")[0]?.trim())
    .filter(Boolean)
    .join("; ");
}

describe("Roles, guards & Better Auth organizations/teams (C-202)", () => {
  it("evaluates platform roles (user, admin, superadmin) and org membership roles accurately", () => {
    expect(hasAdminRole("user")).toBe(false);
    expect(hasAdminRole(null)).toBe(false);
    expect(hasAdminRole("admin")).toBe(true);
    expect(hasAdminRole("superadmin")).toBe(true);

    expect(isSuperAdminRole("admin")).toBe(false);
    expect(isSuperAdminRole("superadmin")).toBe(true);

    expect(isOrganizationOwner("owner")).toBe(true);
    expect(isOrganizationOwner("editor")).toBe(false);
    expect(canEditInOrganization("owner")).toBe(true);
    expect(canEditInOrganization("editor")).toBe(true);
    expect(canEditInOrganization("viewer")).toBe(false);
  });

  it("validates organization creation and team invitation schemas", () => {
    expect(
      createOrganizationSchema.safeParse({
        name: "Orbit Studio",
        slug: "orbit-studio",
      }).success,
    ).toBe(true);

    expect(
      createOrganizationSchema.safeParse({
        name: "Orbit Studio",
        slug: "Invalid Slug!",
      }).success,
    ).toBe(false);

    expect(
      inviteTeamMemberSchema.safeParse({
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        email: "teammate@casefolio.app",
        role: "editor",
      }).success,
    ).toBe(true);

    expect(
      inviteTeamMemberSchema.safeParse({
        organizationId: "550e8400-e29b-41d4-a716-446655440000",
        email: "teammate@casefolio.app",
        role: "owner",
      }).success,
    ).toBe(false);
  });

  it("renders team invitation emails via React Email without leaking tokens to console", async () => {
    const consoleSpy = vi.spyOn(console, "log");
    const mail = await sendTeamInvitationEmail({
      email: "teammate@casefolio.app",
      organizationName: "Orbit Studio",
      inviterName: "Ahmed Al-Azaiza",
      acceptUrl: "http://localhost:3000/account/team?invitationId=inv-123",
      role: "editor",
    });

    expect(mail.html).toContain("Join Orbit Studio");
    expect(mail.html).toContain("Accept invitation");
    expect(consoleSpy).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it("creates an organization in Postgres (`organizations` + `memberships.org_id`), sends team invites, accepts invites, and enforces role permissions", async () => {
    const stamp = Date.now();
    const ownerEmail = `c202-owner-${stamp}@casefolio.test`;
    const editorEmail = `c202-editor-${stamp}@casefolio.test`;
    const viewerEmail = `c202-viewer-${stamp}@casefolio.test`;
    const orgSlug = `orbit-studio-${stamp}`;
    const password = "CasefolioPassword2026!";

    try {
      // 1. Sign up owner, editor, and viewer accounts
      const ownerSignUp = await auth.api.signUpEmail({
        body: { name: "Studio Owner", email: ownerEmail, password },
        returnHeaders: true,
      });
      const editorSignUp = await auth.api.signUpEmail({
        body: { name: "Studio Editor", email: editorEmail, password },
        returnHeaders: true,
      });
      const viewerSignUp = await auth.api.signUpEmail({
        body: { name: "Studio Viewer", email: viewerEmail, password },
        returnHeaders: true,
      });

      // Mark emails verified so invitation acceptance passes strict verification checks if enabled
      for (const uid of [
        ownerSignUp.response.user.id,
        editorSignUp.response.user.id,
        viewerSignUp.response.user.id,
      ]) {
        await db
          .update(dbSchema.users)
          .set({ emailVerified: true })
          .where(eq(dbSchema.users.id, uid));
      }

      const ownerHeaders = new Headers({
        cookie: extractCookieHeader(ownerSignUp.headers.get("set-cookie")),
      });
      const editorHeaders = new Headers({
        cookie: extractCookieHeader(editorSignUp.headers.get("set-cookie")),
      });
      const viewerHeaders = new Headers({
        cookie: extractCookieHeader(viewerSignUp.headers.get("set-cookie")),
      });

      // 2. Owner creates organization -> inserts into `organizations` and `memberships` (role = owner)
      const createdOrg = await auth.api.createOrganization({
        body: {
          name: "Orbit Design Team",
          slug: orgSlug,
        },
        headers: ownerHeaders,
      });

      expect(createdOrg).toBeDefined();
      const orgId = createdOrg!.id;

      const [dbOrg] = await db
        .select()
        .from(dbSchema.organizations)
        .where(eq(dbSchema.organizations.id, orgId));
      expect(dbOrg?.slug).toBe(orgSlug);
      expect(dbOrg?.seats).toBe(3);

      const [ownerMembership] = await db
        .select()
        .from(dbSchema.memberships)
        .where(
          and(
            eq(dbSchema.memberships.orgId, orgId),
            eq(dbSchema.memberships.userId, ownerSignUp.response.user.id),
          ),
        );
      expect(ownerMembership?.role).toBe("owner");

      // 3. Owner invites teammate as `editor` and another as `viewer`
      const editorInvite = await auth.api.createInvitation({
        body: {
          organizationId: orgId,
          email: editorEmail,
          role: "editor",
        },
        headers: ownerHeaders,
      });
      expect(editorInvite.role).toBe("editor");
      expect(editorInvite.status).toBe("pending");

      const viewerInvite = await auth.api.createInvitation({
        body: {
          organizationId: orgId,
          email: viewerEmail,
          role: "viewer",
        },
        headers: ownerHeaders,
      });
      expect(viewerInvite.role).toBe("viewer");

      // 4. Editor & Viewer accept their invitations -> added to `memberships`
      await auth.api.acceptInvitation({
        body: { invitationId: editorInvite.id },
        headers: editorHeaders,
      });
      await auth.api.acceptInvitation({
        body: { invitationId: viewerInvite.id },
        headers: viewerHeaders,
      });

      const [editorMembership] = await db
        .select()
        .from(dbSchema.memberships)
        .where(
          and(
            eq(dbSchema.memberships.orgId, orgId),
            eq(dbSchema.memberships.userId, editorSignUp.response.user.id),
          ),
        );
      expect(editorMembership?.role).toBe("editor");

      const [viewerMembership] = await db
        .select()
        .from(dbSchema.memberships)
        .where(
          and(
            eq(dbSchema.memberships.orgId, orgId),
            eq(dbSchema.memberships.userId, viewerSignUp.response.user.id),
          ),
        );
      expect(viewerMembership?.role).toBe("viewer");

      // 5. Viewer is forbidden from inviting new members
      await expect(
        auth.api.createInvitation({
          body: {
            organizationId: orgId,
            email: `blocked-${stamp}@casefolio.test`,
            role: "viewer",
          },
          headers: viewerHeaders,
        }),
      ).rejects.toThrow();
    } finally {
      await db.delete(dbSchema.organizations).where(eq(dbSchema.organizations.slug, orgSlug));
      for (const email of [ownerEmail, editorEmail, viewerEmail]) {
        await db.delete(dbSchema.users).where(eq(dbSchema.users.email, email));
      }
    }
  });
});

