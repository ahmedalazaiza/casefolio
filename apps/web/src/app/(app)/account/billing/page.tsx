import type { Metadata } from "next";
import { AccountSettingsShell } from "@/components/account/account-settings-shell";
import { BillingSettingsPanel } from "@/components/account/billing-settings-panel";
import { requireSession } from "@/lib/auth/session";
import { getUserBillingOverview } from "@/lib/billing/service";

export const metadata: Metadata = {
  title: "Billing & Plan — Casefolio",
};

export default async function AccountBillingPage({
  searchParams,
}: {
  searchParams: Promise<{ portal?: string }>;
}) {
  const { user, session } = await requireSession("/account/billing");
  const [{ portal }, overview] = await Promise.all([
    searchParams,
    getUserBillingOverview(user.id, new Date(), session.activeOrganizationId ?? null),
  ]);

  return (
    <AccountSettingsShell activeTab="billing">
      <BillingSettingsPanel
        overview={overview}
        accountName={user.name}
        accountEmail={user.email}
        initialPortalAction={portal}
      />
    </AccountSettingsShell>
  );
}
