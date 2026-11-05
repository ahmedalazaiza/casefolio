import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { computeUserInitials, getServerSession } from "@/lib/auth/session";
import { can } from "@/lib/entitlements";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";

export async function HelpShell({ children }: { children: ReactNode }) {
  const session = await getServerSession();

  if (session) {
    const effectivePlan = await resolveEffectivePlanForUser(session.user.id);
    const initials = computeUserInitials(session.user.name, session.user.email);

    return (
      <AppShell
        userInitials={initials}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
        showProBadge={can(effectivePlan, "pro_templates")}
      >
        <div className="mx-auto max-w-5xl">{children}</div>
      </AppShell>
    );
  }

  return (
    <MarketingShell>
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        {children}
      </div>
    </MarketingShell>
  );
}

