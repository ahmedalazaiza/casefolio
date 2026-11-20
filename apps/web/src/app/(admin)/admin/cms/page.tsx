import { AdminCmsPanel } from "@/components/admin/admin-cms-panel";
import { requireAdmin } from "@/lib/auth/guards";
import { getUncachedSiteCmsContent } from "@/lib/cms/service";

export const dynamic = "force-dynamic";

export default async function AdminCmsPage() {
  await requireAdmin("/admin/cms");
  const initialContent = await getUncachedSiteCmsContent();

  return <AdminCmsPanel initialContent={initialContent} />;
}
