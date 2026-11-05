import type { Metadata } from "next";
import { AdminModerationPanel } from "@/components/admin/admin-moderation-panel";
import { listAdminModerationQueue } from "@/lib/admin/moderation";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Moderation — Admin · Casefolio",
};

export default async function AdminModerationPage() {
  await requireAdmin("/admin/moderation");
  const overview = await listAdminModerationQueue();

  return <AdminModerationPanel initialOverview={overview} />;
}
