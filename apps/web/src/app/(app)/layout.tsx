import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { computeUserInitials, requireSession } from "@/lib/auth/session";

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession("/dashboard");

  if (user.role === "user" && !user.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const initials = computeUserInitials(user.name, user.email);

  return (
    <AppShell
      userInitials={initials}
      userName={user.name}
      userEmail={user.email}
      userImage={user.image}
      showProBadge={user.plan !== "free"}
    >
      {children}
    </AppShell>
  );
}
