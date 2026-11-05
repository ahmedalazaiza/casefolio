import type { Metadata } from "next";
import { AdminOverviewPanel } from "@/components/admin/admin-overview-panel";
import { getAdminOverviewMetrics } from "@/lib/admin/overview";
import { adminOverviewRangeSchema } from "@/lib/admin/overview-types";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Admin Overview — Casefolio",
};

export default async function AdminOverviewPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdmin("/admin");
  const params = await searchParams;
  const range = adminOverviewRangeSchema.parse(params.range);
  const metrics = await getAdminOverviewMetrics(range);

  return <AdminOverviewPanel metrics={metrics} />;
}
