import type { ReactNode } from "react";
import { AdminShell } from "@/components/layout/admin-shell";
import { requireAdmin } from "@/lib/auth/guards";
import { computeUserInitials } from "@/lib/auth/session";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const { user } = await requireAdmin("/admin");
  const initials = computeUserInitials(user.name, user.email);

  return (
    <AdminShell
      userInitials={initials}
      userName={user.name}
      userEmail={user.email}
      userImage={user.image}
    >
      {children}
    </AdminShell>
  );
}
