import type { Metadata } from "next";
import { AdminSettingsPanel } from "@/components/admin/admin-settings-panel";
import { getAdminSettingsOverview } from "@/lib/admin/settings";
import { ADMIN_SETTINGS_TABS, type AdminSettingsTab } from "@/lib/admin/settings-types";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Settings & roles — Admin · Casefolio",
};

export default async function AdminSettingsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const { user } = await requireAdmin("/admin/settings");
  const { tab } = await searchParams;
  const overview = await getAdminSettingsOverview();

  const initialTab: AdminSettingsTab =
    tab && (ADMIN_SETTINGS_TABS as readonly string[]).includes(tab)
      ? (tab as AdminSettingsTab)
      : "team";

  return (
    <AdminSettingsPanel
      initialOverview={overview}
      initialTab={initialTab}
      currentAdminId={user.id}
      currentAdminRole={user.role === "superadmin" ? "superadmin" : "admin"}
    />
  );
}
