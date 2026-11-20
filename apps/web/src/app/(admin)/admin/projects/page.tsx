import { AdminProjectsPanel } from "@/components/admin/admin-projects-panel";
import { listAdminProjectsOverview } from "@/lib/admin/projects";
import { requireAdmin } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export default async function AdminProjectsPage() {
  await requireAdmin("/admin/projects");
  const initialOverview = await listAdminProjectsOverview();

  return <AdminProjectsPanel initialOverview={initialOverview} />;
}
