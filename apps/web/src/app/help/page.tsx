import type { Metadata } from "next";
import { HelpCenterClient } from "@/components/help/help-center-client";
import { HelpShell } from "@/components/help/help-shell";
import { listHelpArticles } from "@/lib/help/articles";

export const metadata: Metadata = {
  title: "Help Center — Casefolio",
  description:
    "Browse guides on getting started, customising templates, publishing custom slugs, exporting PNG & PDF files, and managing billing.",
  alternates: {
    canonical: "/help",
  },
};

export default async function HelpCenterPage({
  searchParams,
}: {
  searchParams?: Promise<{ q?: string }>;
}) {
  const params = (await searchParams) ?? {};
  const articles = listHelpArticles();

  return (
    <HelpShell>
      <HelpCenterClient
        articles={articles}
        initialQuery={typeof params.q === "string" ? params.q : ""}
      />
    </HelpShell>
  );
}

