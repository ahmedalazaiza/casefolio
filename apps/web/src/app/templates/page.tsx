import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { TemplateLibraryClient } from "./template-library-client";
import { AppShell } from "@/components/layout/app-shell";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { buildWorkspaceShellProps } from "@/components/layout/workspace-shell-props";
import { getServerSession } from "@/lib/auth/session";
import { listPublishedLibraryTemplates, listTemplateCategories } from "@/lib/template/service";

const getCachedTemplateCatalog = unstable_cache(
  async () => {
    const [publishedTemplates, categories] = await Promise.all([
      listPublishedLibraryTemplates(),
      listTemplateCategories(),
    ]);
    return { publishedTemplates, categories };
  },
  ["public-template-catalog"],
  { revalidate: 300, tags: ["templates"] },
);

export const metadata: Metadata = {
  title: "UI/UX Case Study Templates — Casefolio",
  description:
    "Browse curated mobile app and web product case study templates with structured storytelling sections and aspect-ratio-locked device mockups.",
};

export default async function TemplatesLibraryPage() {
  const [session, { publishedTemplates, categories }] = await Promise.all([
    getServerSession(),
    getCachedTemplateCatalog(),
  ]);

  const categoryOptions = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
  }));

  if (session) {
    const { shellProps, activePlan } = await buildWorkspaceShellProps(
      session.user,
      session.session.activeOrganizationId ?? null,
    );
    return (
      <AppShell {...shellProps}>
        <TemplateLibraryClient
          templates={publishedTemplates}
          categories={categoryOptions}
          userPlan={activePlan}
          isAuthenticated
        />
      </AppShell>
    );
  }

  return (
    <MarketingShell activeNavHref="/templates">
      <TemplateLibraryClient
        templates={publishedTemplates}
        categories={categoryOptions}
        userPlan="free"
        isAuthenticated={false}
      />
    </MarketingShell>
  );
}
