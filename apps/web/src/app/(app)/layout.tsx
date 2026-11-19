import { eq } from "@casefolio/db";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { buildWorkspaceShellProps } from "@/components/layout/workspace-shell-props";
import { requireSession } from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user, session } = await requireSession("/dashboard");

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
  );

  return <AppShell {...shellProps}>{children}</AppShell>;
}
