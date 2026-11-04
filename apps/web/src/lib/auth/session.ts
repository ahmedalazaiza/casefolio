import { eq } from "@casefolio/db";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
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

export async function getServerSession(): Promise<AuthenticatedContext | null> {
  const reqHeaders = await headers();
  const result = await auth.api.getSession({ headers: reqHeaders });
  if (!result?.session || !result?.user) {
    return null;
  }

  const [dbUser] = await db
    .select()
    .from(dbSchema.users)
    .where(eq(dbSchema.users.id, result.user.id))
    .limit(1);

  if (!dbUser || dbUser.suspended) {
    return null;
  }

  return {
    session: {
      id: result.session.id,
      token: result.session.token,
      expiresAt: result.session.expiresAt,
      activeOrganizationId:
        "activeOrganizationId" in result.session
          ? ((result.session as { activeOrganizationId?: string | null })
              .activeOrganizationId ?? null)
          : null,
    },
    user: dbUser,
  };
}

export async function requireSession(callbackPath = "/dashboard"): Promise<AuthenticatedContext> {
  const ctx = await getServerSession();
  if (!ctx) {
    const encoded = encodeURIComponent(callbackPath);
    redirect(`/sign-in?callbackUrl=${encoded}`);
  }
  return ctx;
}
