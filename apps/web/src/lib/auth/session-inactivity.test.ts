// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { describe, expect, it, vi } from "vitest";
import HomePage from "@/app/(marketing)/page";
import { auth } from "@/lib/auth/server";
import {
  getServerSession,
  SESSION_INACTIVITY_TIMEOUT_MS,
} from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";

let mockCookieEntries: Array<{ name: string; value: string }> = [];
let mockHeaderString = "";

vi.mock("next/headers", () => ({
  headers: vi.fn(async () => new Headers(mockHeaderString ? { cookie: mockHeaderString } : {})),
  cookies: vi.fn(async () => ({
    getAll: () => mockCookieEntries,
  })),
}));

function parseCookies(setCookieHeader: string | null): Array<{ name: string; value: string }> {
  return (setCookieHeader ?? "")
    .split(/,(?=\s*[A-Za-z0-9_.-]+=)/)
    .map((part) => part.split(";")[0]?.trim() ?? "")
    .filter(Boolean)
    .map((pair) => {
      const idx = pair.indexOf("=");
      return {
        name: pair.slice(0, idx),
        value: pair.slice(idx + 1),
      };
    });
}

describe("5-Day Inactivity Session Destruction & Logged-In `/` -> `/dashboard` Redirect", () => {
  it("slides active sessions on activity, redirects logged-in `/` visitors to `/dashboard`, and destroys sessions inactive > 5 days", async () => {
    const suffix = randomUUID().slice(0, 8);
    const email = `inactivity-${suffix}@casefolio.test`;
    const password = "CasefolioPassword2026!";

    const signUp = await auth.api.signUpEmail({
      body: {
        name: "Session Lifecycle User",
        email,
        password,
      },
      returnHeaders: true,
    });
    const userId = signUp.response.user.id;

    try {
      await db
        .update(dbSchema.users)
        .set({ emailVerified: true })
        .where(eq(dbSchema.users.id, userId));

      const signIn = await auth.api.signInEmail({
        body: { email, password },
        returnHeaders: true,
      });

      mockCookieEntries = parseCookies(signIn.headers.get("set-cookie"));
      mockHeaderString = mockCookieEntries.map((c) => `${c.name}=${c.value}`).join("; ");

      // 1. Active session resolves cleanly
      const activeCtx = await getServerSession();
      expect(activeCtx).not.toBeNull();
      const sessionId = activeCtx!.session.id;

      // 2. Logged-in user visiting `/` redirects immediately to `/dashboard`
      await expect(HomePage()).rejects.toThrow(/NEXT_REDIRECT;replace;\/dashboard;307|NEXT_REDIRECT/);

      // 3. Session older than 20m (but < 5d) slides `updatedAt` and refreshes `expiresAt` to ~5d ahead
      const twentyMinutesAgo = new Date(Date.now() - 25 * 60 * 1000);
      await db
        .update(dbSchema.sessions)
        .set({ updatedAt: twentyMinutesAgo })
        .where(eq(dbSchema.sessions.id, sessionId));

      const refreshedCtx = await getServerSession();
      expect(refreshedCtx).not.toBeNull();
      const [afterRefreshRow] = await db
        .select()
        .from(dbSchema.sessions)
        .where(eq(dbSchema.sessions.id, sessionId));
      expect(afterRefreshRow).toBeDefined();
      expect(afterRefreshRow!.updatedAt.getTime()).toBeGreaterThan(twentyMinutesAgo.getTime());

      // 4. Session inactive > 5 days is destroyed in PostgreSQL and returns null
      const fiveDaysAndOneMinuteAgo = new Date(
        Date.now() - SESSION_INACTIVITY_TIMEOUT_MS - 60 * 1000,
      );
      await db
        .update(dbSchema.sessions)
        .set({ updatedAt: fiveDaysAndOneMinuteAgo })
        .where(eq(dbSchema.sessions.id, sessionId));

      const expiredByInactivity = await getServerSession();
      expect(expiredByInactivity).toBeNull();

      const [deletedRow] = await db
        .select()
        .from(dbSchema.sessions)
        .where(eq(dbSchema.sessions.id, sessionId));
      expect(deletedRow).toBeUndefined();
    } finally {
      mockCookieEntries = [];
      mockHeaderString = "";
      await db.delete(dbSchema.users).where(eq(dbSchema.users.id, userId));
    }
  });
});
