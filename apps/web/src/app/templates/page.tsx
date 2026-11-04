import type { Metadata } from "next";
import { TemplateLibraryClient } from "./template-library-client";
import { AppShell } from "@/components/layout/app-shell";
import { MarketingShell } from "@/components/layout/marketing-shell";
import { computeUserInitials, getServerSession } from "@/lib/auth/session";
import { listPublishedLibraryTemplates, listTemplateCategories } from "@/lib/template/service";

export const metadata: Metadata = {
  title: "Template Library · Casefolio",
  description: "Explore curated Mobile app and Website case-study templates built for designers.",
};

export default async function TemplatesLibraryPage() {
  const [session, publishedTemplates, categories] = await Promise.all([
    getServerSession(),
    listPublishedLibraryTemplates(),
    listTemplateCategories(),
  ]);

  const categoryOptions = categories.map((cat) => ({
    id: cat.id,
    name: cat.name,
    slug: cat.slug,
  }));

  if (session) {
    const initials = computeUserInitials(session.user.name, session.user.email);
    return (
      <AppShell
        userInitials={initials}
        userName={session.user.name}
        userEmail={session.user.email}
        userImage={session.user.image}
        showProBadge={session.user.plan !== "free"}
      >
        <TemplateLibraryClient
          templates={publishedTemplates}
          categories={categoryOptions}
          userPlan={session.user.plan}
          isAuthenticated
        />
      </AppShell>
    );
  }

  return (
    <MarketingShell>
      <div className="px-4 py-10 sm:px-6 lg:px-8 lg:py-14">
        <TemplateLibraryClient
          templates={publishedTemplates}
          categories={categoryOptions}
          userPlan="free"
          isAuthenticated={false}
        />
      </div>
    </MarketingShell>
  );
}
