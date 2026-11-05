export type HelpCalloutTone = "info" | "tip" | "warning";

export type HelpMdxBlock =
  | { type: "heading"; level: 2 | 3; text: string }
  | { type: "paragraph"; text: string }
  | { type: "list"; ordered: boolean; items: string[] }
  | { type: "callout"; tone: HelpCalloutTone; text: string };

export interface HelpArticleSummary {
  slug: string;
  title: string;
  summary: string;
  category: string;
  order: number;
  updatedAt: string;
  keywords: string[];
  searchableText: string;
}

export interface HelpArticle extends HelpArticleSummary {
  blocks: HelpMdxBlock[];
}

export function searchHelpArticles<T extends HelpArticleSummary>(
  articles: readonly T[],
  rawQuery: string,
): T[] {
  const normalized = rawQuery.trim().toLowerCase();
  if (!normalized) {
    return [...articles];
  }

  const tokens = normalized.split(/\s+/).filter(Boolean);

  return articles
    .map((article) => {
      const titleLower = article.title.toLowerCase();
      const summaryLower = article.summary.toLowerCase();
      const keywordsJoined = article.keywords.join(" ").toLowerCase();
      const bodyLower = article.searchableText.toLowerCase();

      let score = 0;
      for (const token of tokens) {
        if (titleLower.includes(token)) {
          score += 10;
        } else if (keywordsJoined.includes(token)) {
          score += 6;
        } else if (summaryLower.includes(token)) {
          score += 4;
        } else if (bodyLower.includes(token)) {
          score += 2;
        } else {
          return { article, score: 0 };
        }
      }

      return { article, score };
    })
    .filter((entry) => entry.score > 0)
    .sort((a, b) => b.score - a.score || a.article.order - b.article.order)
    .map((entry) => entry.article);
}

