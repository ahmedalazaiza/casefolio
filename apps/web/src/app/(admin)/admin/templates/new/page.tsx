import type { Metadata } from "next";
import { UploadTemplateWizard } from "./upload-template-wizard";
import { requireAdmin } from "@/lib/auth/guards";
import { createTemplateDraftAction } from "@/lib/template/admin-actions";
import { listTemplateCategories } from "@/lib/template/service";

export const metadata: Metadata = {
  title: "Upload Template · Admin · Casefolio",
};

export default async function AdminUploadTemplatePage() {
  await requireAdmin("/admin/templates/new");
  const categories = await listTemplateCategories();

  return (
    <UploadTemplateWizard
      saveDraftAction={createTemplateDraftAction}
      categories={categories.map((cat) => ({
        id: cat.id,
        name: cat.name,
        slug: cat.slug,
      }))}
    />
  );
}
