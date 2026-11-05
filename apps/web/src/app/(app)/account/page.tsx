import type { Metadata } from "next";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { ProfileSettingsPanel } from "@/components/account/profile-settings-panel";
import { computeUserInitials, requireSession } from "@/lib/auth/session";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";

export const metadata: Metadata = {
  title: "Account Settings — Casefolio",
};

export default async function AccountPage() {
  const { user } = await requireSession("/account");
  const effectivePlan = await resolveEffectivePlanForUser(user.id);
  const initials = computeUserInitials(user.name, user.email);

  return (
    <AccountSettingsShell activeTab="profile">
      <ProfileSettingsPanel
        initialProfile={{
          name: user.name,
          email: user.email,
          emailVerified: user.emailVerified,
          image: user.image,
          initials,
          role: user.role,
          effectivePlan,
          jobTitle: user.jobTitle,
          designFocus: user.designFocus,
        }}
      />
    </AccountSettingsShell>
  );
}
