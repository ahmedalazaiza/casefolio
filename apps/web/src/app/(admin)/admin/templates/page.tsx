import type { Metadata } from "next";
import { AdminTemplatesList } from "./admin-templates-list";
import { requireAdmin } from "@/lib/auth/guards";
import { listAdminTemplates } from "@/lib/template/service";

export const metadata: Metadata = {
  title: "Templates · Admin · Casefolio",
};

export default async function AdminTemplatesPage() {
  await requireAdmin("/admin/templates");
  const templates = await listAdminTemplates();

  return <AdminTemplatesList templates={templates} />;
}
