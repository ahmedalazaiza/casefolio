import type { Metadata } from "next";
import { AdminSubscriptionsPanel } from "@/components/admin/admin-subscriptions-panel";
import { getAdminSubscriptionsOverview } from "@/lib/admin/users";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Subscriptions & Plans · Admin · Casefolio",
};

export default async function AdminSubscriptionsPage() {
  await requireAdmin("/admin/subscriptions");
  const overview = await getAdminSubscriptionsOverview();

  return <AdminSubscriptionsPanel overview={overview} />;
}
