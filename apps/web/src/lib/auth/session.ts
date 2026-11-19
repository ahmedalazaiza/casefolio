import { eq } from "@casefolio/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { sanitizeCallbackUrl } from "@/lib/auth/safe-redirect";
import { auth } from "@/lib/auth/server";
import { db, dbSchema } from "@/lib/db";

export interface AuthenticatedContext {
  session: {
    id: string;
    token: string;
    expiresAt: Date;
    activeOrganizationId?: string | null;
  };
  user: typeof dbSchema.users.$inferSelect;
}

export const SESSION_INACTIVITY_TIMEOUT_MS = 5 * 24 * 60 * 60 * 1000;
export const SESSION_ACTIVITY_TOUCH_MS = 15 * 60 * 1000;

export async function getServerSession(): Promise<AuthenticatedContext | null> {
  const reqHeaders = await headers();
  const result = await auth.api.getSession({ headers: reqHeaders });
  if (!result?.session || !result?.user) {
    return null;
  }

  const [[sessionRow], [dbUser]] = await Promise.all([
    db
      .select()
      .from(dbSchema.sessions)
      .where(eq(dbSchema.sessions.id, result.session.id))
      .limit(1),
    db
      .select()
      .from(dbSchema.users)
      .where(eq(dbSchema.users.id, result.user.id))
      .limit(1),
  ]);

  const now = new Date();

  if (
    !sessionRow ||
    now.getTime() - sessionRow.updatedAt.getTime() > SESSION_INACTIVITY_TIMEOUT_MS ||
    sessionRow.expiresAt.getTime() <= now.getTime()
  ) {
    await db
      .delete(dbSchema.sessions)
      .where(eq(dbSchema.sessions.id, result.session.id));
    return null;
  }

  if (!dbUser || dbUser.suspended) {
    return null;
  }

  let effectiveExpiresAt = sessionRow.expiresAt;
  if (now.getTime() - sessionRow.updatedAt.getTime() > SESSION_ACTIVITY_TOUCH_MS) {
    effectiveExpiresAt = new Date(now.getTime() + SESSION_INACTIVITY_TIMEOUT_MS);
    await db
      .update(dbSchema.sessions)
      .set({
        updatedAt: now,
        expiresAt: effectiveExpiresAt,
      })
      .where(eq(dbSchema.sessions.id, result.session.id));
  }

  return {
    session: {
      id: result.session.id,
      token: result.session.token,
      expiresAt: effectiveExpiresAt,
      activeOrganizationId:
        sessionRow.activeOrganizationId ??
        ("activeOrganizationId" in result.session
          ? ((result.session as { activeOrganizationId?: string | null })
              .activeOrganizationId ?? null)
          : null),
    },
    user: dbUser,
  };
}

export function computeUserInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && (parts[0]?.length ?? 0) >= 2) {
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase() || "CF";
}

export async function requireSession(callbackPath = "/dashboard"): Promise<AuthenticatedContext> {
  const ctx = await getServerSession();
  if (!ctx) {
    const encoded = encodeURIComponent(sanitizeCallbackUrl(callbackPath));
    redirect(`/sign-in?callbackUrl=${encoded}`);
  }
  return ctx;
}
