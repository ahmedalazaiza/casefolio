import type { Metadata } from "next";
import { unstable_cache } from "next/cache";
import { TemplateLibraryClient } from "./template-library-client";
import { AppShell } from "@/components/layout/app-shell";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { computeUserInitials, getServerSession } from "@/lib/auth/session";
import { can } from "@/lib/entitlements";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";
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
    const effectivePlan = await resolveEffectivePlanForUser(session.user.id);
    const initials = computeUserInitials(session.user.name, session.user.email);
    return (
      <AppShell
        userInitials={initials}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
        showProBadge={can(effectivePlan, "pro_templates")}
      >
        <TemplateLibraryClient
          templates={publishedTemplates}
          categories={categoryOptions}
          userPlan={effectivePlan}
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
