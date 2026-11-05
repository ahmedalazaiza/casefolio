import { and, count, desc, eq, gt, ne } from "@casefolio/db";
import type { Metadata } from "next";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import {
  SecuritySettingsPanel,
  type ActiveSessionView,
} from "@/components/account/security-settings-panel";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";

export const metadata: Metadata = {
  title: "Security — Casefolio",
};

function describeUserAgent(ua: string | null | undefined): string {
  if (!ua) return "Web browser";
  const browser = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Firefox/")
      ? "Firefox"
      : ua.includes("Chrome/")
        ? "Chrome"
        : ua.includes("Safari/")
          ? "Safari"
          : "Browser";

  const os = ua.includes("iPhone")
    ? "iPhone"
    : ua.includes("iPad")
      ? "iPad"
      : ua.includes("Mac OS X")
        ? "macOS"
        : ua.includes("Windows")
          ? "Windows"
          : ua.includes("Android")
            ? "Android"
            : ua.includes("Linux")
              ? "Linux"
              : "Desktop";

  return `${browser} · ${os}`;
}

export default async function AccountSecurityPage() {
  const { user, session } = await requireSession("/account/security");
  const now = new Date();

  const [accountRows, activeSessionRows, [projectsTotal], [publishedTotal]] =
    await Promise.all([
      db
        .select()
        .from(dbSchema.accounts)
        .where(eq(dbSchema.accounts.userId, user.id)),
      db
        .select()
        .from(dbSchema.sessions)
        .where(
          and(
            eq(dbSchema.sessions.userId, user.id),
            gt(dbSchema.sessions.expiresAt, now),
          ),
        )
        .orderBy(desc(dbSchema.sessions.updatedAt)),
      db
        .select({ total: count() })
        .from(dbSchema.projects)
        .where(eq(dbSchema.projects.ownerId, user.id)),
      db
        .select({ total: count() })
        .from(dbSchema.projects)
        .where(
          and(
            eq(dbSchema.projects.ownerId, user.id),
            ne(dbSchema.projects.visibility, "private"),
          ),
        ),
    ]);

  const credentialAccount = accountRows.find(
    (acc) => acc.providerId === "credential" || Boolean(acc.password),
  );
  const googleConnected = accountRows.some((acc) => acc.providerId === "google");

  const passwordUpdatedLabel = credentialAccount?.updatedAt
    ? credentialAccount.updatedAt.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  const sessionViews: ActiveSessionView[] = activeSessionRows.map((row) => {
    const isCurrent = row.id === session.id;
    const ipPart = row.ipAddress ? `${row.ipAddress} · ` : "";
    const timePart = isCurrent
      ? "active now"
      : `signed in ${row.createdAt.toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
        })}`;

    return {
      id: row.id,
      deviceLabel: describeUserAgent(row.userAgent),
      subLabel: `${ipPart}${timePart}`,
      isCurrent,
    };
  });

  return (
    <AccountSettingsShell activeTab="security">
      <SecuritySettingsPanel
        email={user.email}
        emailVerified={Boolean(user.emailVerified)}
        hasPasswordAccount={Boolean(credentialAccount)}
        passwordUpdatedLabel={passwordUpdatedLabel}
        googleConnected={googleConnected}
        projectsCount={Number(projectsTotal?.total ?? 0)}
        publishedCount={Number(publishedTotal?.total ?? 0)}
        sessions={sessionViews}
      />
    </AccountSettingsShell>
  );
}
