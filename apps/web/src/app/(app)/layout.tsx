import { eq } from "@casefolio/db";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { buildWorkspaceShellProps } from "@/components/layout/workspace-shell-props";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import { getActiveSpaceCookie } from "@/lib/workspaces/active-space";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const [{ user, session }, activeSpaceCookie] = await Promise.all([
    requireSession("/dashboard"),
    getActiveSpaceCookie(),
  ]);

  if (user.role === "user" && !user.onboardingCompletedAt) {
    const completedAt = new Date();
    await db
      .update(dbSchema.users)
      .set({
        onboardingCompletedAt: completedAt,
        updatedAt: completedAt,
      })
      .where(eq(dbSchema.users.id, user.id));
  }

  const { shellProps } = await buildWorkspaceShellProps(
    user,
    session.activeOrganizationId ?? null,
    new Date(),
    activeSpaceCookie,
  );

  return <AppShell {...shellProps}>{children}</AppShell>;
}
