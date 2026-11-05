import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HelpArticleView } from "@/components/help/help-article-view";
import { HelpShell } from "@/components/help/help-shell";
import { getHelpArticleBySlug, listHelpArticles } from "@/lib/help/articles";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const article = getHelpArticleBySlug(slug);
  if (!article) {
    return { title: "Article Not Found — Casefolio Help" };
  }
  return {
    title: `${article.title} — Casefolio Help`,
    description: article.summary,
    alternates: {
      canonical: `/help/${article.slug}`,
    },
  };
}

export default async function HelpArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const article = getHelpArticleBySlug(slug);
  if (!article) {
    notFound();
  }

  const relatedArticles = listHelpArticles().filter(
    (item) => item.slug !== article.slug,
  );

  return (
    <HelpShell>
      <HelpArticleView article={article} relatedArticles={relatedArticles} />
    </HelpShell>
  );
}
