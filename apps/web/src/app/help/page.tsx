import type { Metadata } from "next";
import { HelpCenterClient } from "@/components/help/help-center-client";
import { HelpShell } from "@/components/help/help-shell";
import { getSiteCmsContent } from "@/lib/cms/service";
import { listHelpArticles } from "@/lib/help/articles";

export const metadata: Metadata = {
  title: "Help Center & Guides — Casefolio",
  description:
    "Guides and answers for creating UI/UX case studies, customizing templates, publishing custom links, exporting full case studies to Layerat alongside PNG and A4 PDF files, and managing billing.",
  alternates: {
    canonical: "/help",
  },
};

export default async function HelpCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const [params, cms] = await Promise.all([
    searchParams,
    getSiteCmsContent(),
  ]);
  const resolvedParams = params ?? {};
  const articles = listHelpArticles();

  return (
    <HelpShell>
      <HelpCenterClient
        articles={articles}
        initialQuery={typeof resolvedParams.q === "string" ? resolvedParams.q : ""}
        cmsIntro={{
          eyebrow: cms.legalAndHelp.helpEyebrow,
          title: cms.legalAndHelp.helpTitle,
          subtitle: cms.legalAndHelp.helpSubtitle,
          noticeBanner: cms.legalAndHelp.helpNoticeBanner,
        }}
      />
    </HelpShell>
  );
}

