import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { ProfileSettingsPanel } from "@/components/account/profile-settings-panel";
import { computeUserInitials, requireSession } from "@/lib/auth/session";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";

export const metadata: Metadata = {
  title: "Account Settings — Casefolio",
};

interface AccountPageProps {
  searchParams: Promise<{ cancelDeletion?: string }>;
}

export default async function AccountPage({ searchParams }: AccountPageProps) {
  const { cancelDeletion } = await searchParams;
  if (cancelDeletion === "1") {
    redirect("/account/security");
  }

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
