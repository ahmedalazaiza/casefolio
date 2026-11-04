import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { requireSession } from "@/lib/auth/session";

function computeInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && (parts[0]?.length ?? 0) >= 2) {
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase() || "CF";
}

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession("/dashboard");
  const initials = computeInitials(user.name, user.email);

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
