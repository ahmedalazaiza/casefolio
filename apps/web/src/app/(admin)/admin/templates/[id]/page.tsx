import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TemplateDetailClient } from "./template-detail-client";
import { requireAdmin } from "@/lib/auth/guards";
import {
  archiveTemplateAction,
  createTemplateVersionAction,
  deleteTemplateAction,
  publishTemplateVersionAction,
  unarchiveTemplateAction,
  updateTemplateCoverAction,
} from "@/lib/template/admin-actions";
import { getAdminTemplateDetail } from "@/lib/template/service";

export const metadata: Metadata = {
  title: "Template Detail · Admin · Casefolio",
};

export default async function AdminTemplateDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  await requireAdmin(`/admin/templates/${id}`);

  const detail = await getAdminTemplateDetail(id);
  if (!detail) {
    notFound();
  }

  return (
    <TemplateDetailClient
      detail={detail}
      publishVersionAction={publishTemplateVersionAction}
      archiveAction={archiveTemplateAction}
      unarchiveAction={unarchiveTemplateAction}
      createVersionAction={createTemplateVersionAction}
      deleteAction={deleteTemplateAction}
      updateCoverAction={updateTemplateCoverAction}
    />
  );
}
