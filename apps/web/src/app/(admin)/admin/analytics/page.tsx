import type { Metadata } from "next";
import { AdminAnalyticsPanel } from "@/components/admin/admin-analytics-panel";
import { getCachedAdminPlatformAnalytics } from "@/lib/admin/overview";
import { adminAnalyticsRangeSchema } from "@/lib/admin/overview-types";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Admin Analytics — Casefolio",
};

export default async function AdminAnalyticsPage({
  searchParams,
}: {
  searchParams: Promise<{ range?: string }>;
}) {
  await requireAdmin("/admin/analytics");
  const params = await searchParams;
  const range = adminAnalyticsRangeSchema.parse(params.range);
  const analytics = await getCachedAdminPlatformAnalytics(range);

  return <AdminAnalyticsPanel analytics={analytics} />;
}
