import type { Metadata } from "next";
import { AdminCategoriesPanel } from "@/components/admin/admin-categories-panel";
import { getAdminCategoriesOverview } from "@/lib/admin/categories";
import { requireAdmin } from "@/lib/auth/guards";

export const metadata: Metadata = {
  title: "Categories & Types · Admin · Casefolio",
};

export default async function AdminCategoriesPage() {
  await requireAdmin("/admin/categories");
  const overview = await getAdminCategoriesOverview();

  return <AdminCategoriesPanel initialOverview={overview} />;
}
