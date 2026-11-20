import { AdminFeedbackPanel } from "@/components/admin/admin-feedback-panel";
import { requireAdmin } from "@/lib/auth/guards";
import { getAdminFeedbackOverview } from "@/lib/feedback/service";

export const dynamic = "force-dynamic";

export default async function AdminFeedbackPage() {
  await requireAdmin("/admin/feedback");
  const overview = await getAdminFeedbackOverview();

  return <AdminFeedbackPanel overview={overview} />;
}
