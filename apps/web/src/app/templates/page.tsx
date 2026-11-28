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
  ["public-template-catalog-v2"],
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
    process.env.NODE_ENV === "production"
      ? getCachedTemplateCatalog()
      : Promise.all([listPublishedLibraryTemplates(), listTemplateCategories()]).then(
          ([tpls, cats]) => ({ publishedTemplates: tpls, categories: cats }),
        ),
  ]);

  const activeCategorySlugs = new Set(
    publishedTemplates
      .map((tpl) => tpl.categorySlug)
      .filter((slug): slug is string => Boolean(slug)),
  );

  const seenCategoryNames = new Set<string>();
  const categoryOptions = categories
    .filter((cat) => {
      if (!activeCategorySlugs.has(cat.slug)) return false;
      const key = cat.name.trim().toLowerCase();
      if (seenCategoryNames.has(key)) return false;
      seenCategoryNames.add(key);
      return true;
    })
    .map((cat) => ({
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
