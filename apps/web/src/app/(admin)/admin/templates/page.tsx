import type { Metadata } from "next";
import { AdminTemplatesList } from "./admin-templates-list";
import { requireAdmin } from "@/lib/auth/guards";
import {
  archiveTemplateAction,
  deleteTemplateAction,
  unarchiveTemplateAction,
} from "@/lib/template/admin-actions";
import { listAdminTemplates, listTemplateCategories } from "@/lib/template/service";

export const metadata: Metadata = {
  title: "Templates · Admin · Casefolio",
};

export default async function AdminTemplatesPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    type?: string;
    category?: string;
    tier?: string;
    q?: string;
  }>;
}) {
  await requireAdmin("/admin/templates");
  const [templates, categories, params] = await Promise.all([
    listAdminTemplates(),
    listTemplateCategories(),
    searchParams,
  ]);

  return (
    <AdminTemplatesList
      templates={templates}
      categories={categories.map((c) => ({ id: c.id, name: c.name, slug: c.slug }))}
      initialFilters={{
        searchQuery: params.q ?? "",
        status:
          params.status === "published" || params.status === "draft" || params.status === "archived"
            ? params.status
            : "all",
        type:
          params.type === "mobile" || params.type === "web" || params.type === "both"
            ? params.type
            : "all",
        categorySlug: params.category ?? "all",
        tier: params.tier === "free" || params.tier === "pro" ? params.tier : "all",
      }}
      archiveAction={archiveTemplateAction}
      unarchiveAction={unarchiveTemplateAction}
      deleteAction={deleteTemplateAction}
    />
  );
}
