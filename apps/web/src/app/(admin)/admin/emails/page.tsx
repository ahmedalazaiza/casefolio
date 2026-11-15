import type { Metadata } from "next";
import { AdminEmailsPanel } from "@/components/admin/admin-emails-panel";
import type {
  AdminEmailDepartmentSummary,
  AdminEmailPreviewPayload,
  AdminEmailTemplateSummary,
} from "@/lib/admin/emails-types";
import { requireAdmin } from "@/lib/auth/guards";
import {
  EMAIL_TEMPLATE_CATALOG,
  isLiveResendKey,
  listAllDepartmentSenders,
  renderCatalogTemplatePreview,
  resolveDepartmentSender,
  resolveEmailDomain,
} from "@/lib/email";

export const metadata: Metadata = {
  title: "Email studio — Admin · Casefolio",
};

export default async function AdminEmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ template?: string }>;
}) {
  const { user } = await requireAdmin("/admin/emails");
  const { template } = await searchParams;

  const departments: AdminEmailDepartmentSummary[] = listAllDepartmentSenders().map((d) => ({
    department: d.department,
    displayName: d.displayName,
    address: d.address,
    formattedFrom: d.formattedFrom,
    defaultReplyTo: d.defaultReplyTo,
    badgeLabel: d.badgeLabel,
    categoryLabel: d.categoryLabel,
    description: d.description,
  }));

  const templates: AdminEmailTemplateSummary[] = EMAIL_TEMPLATE_CATALOG.map((entry) => {
    const sender = resolveDepartmentSender(entry.department);
    return {
      key: entry.key,
      title: entry.title,
      audience: entry.audience,
      audienceLabel: entry.audienceLabel,
      department: entry.department,
      senderAddress: sender.address,
      formattedFrom: sender.formattedFrom,
      defaultReplyTo: sender.defaultReplyTo,
      triggerSummary: entry.triggerSummary,
    };
  });

  const initialKey =
    template && EMAIL_TEMPLATE_CATALOG.some((t) => t.key === template)
      ? template
      : EMAIL_TEMPLATE_CATALOG[0]!.key;

  const rendered =
    (await renderCatalogTemplatePreview(initialKey)) ??
    (await renderCatalogTemplatePreview(EMAIL_TEMPLATE_CATALOG[0]!.key))!;

  const initialPreview: AdminEmailPreviewPayload = {
    key: rendered.entry.key,
    title: rendered.entry.title,
    department: rendered.department,
    from: rendered.from,
    senderAddress: rendered.senderAddress,
    replyTo: rendered.replyTo,
    subject: rendered.subject,
    triggerSummary: rendered.entry.triggerSummary,
    html: rendered.html,
    text: rendered.text,
  };

  return (
    <AdminEmailsPanel
      departments={departments}
      templates={templates}
      initialPreview={initialPreview}
      adminEmail={user.email}
      isSuperadmin={user.role === "superadmin"}
      liveResendConfigured={isLiveResendKey()}
      emailDomain={resolveEmailDomain()}
    />
  );
}

