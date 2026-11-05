// @vitest-environment node
import { describe, expect, it } from "vitest";
import { getHelpArticleBySlug, listHelpArticles } from "./articles";
import { supportTicketInputSchema } from "./contact";
import { searchHelpArticles } from "./search";

describe("Help Center MDX loader & search (C-1003)", () => {
  it("loads all 5 ordered MDX articles from disk with frontmatter and parsed blocks", () => {
    const articles = listHelpArticles();
    expect(articles.map((a) => a.slug)).toEqual([
      "getting-started",
      "templates-and-editor",
      "publishing-and-links",
      "exports",
      "billing-and-plans",
    ]);

    const exportsArticle = getHelpArticleBySlug("exports");
    expect(exportsArticle).not.toBeNull();
    expect(exportsArticle?.title).toBe("Exports");
    expect(
      exportsArticle?.blocks.some((block) => block.type === "callout"),
    ).toBe(true);
    expect(getHelpArticleBySlug("../invalid")).toBeNull();
  });

  it("searches articles across title, keywords, summary, and MDX body", () => {
    const articles = listHelpArticles();

    const pdfMatches = searchHelpArticles(articles, "export PDF");
    expect(pdfMatches[0]?.slug).toBe("exports");

    const paddleMatches = searchHelpArticles(articles, "Paddle VAT");
    expect(paddleMatches[0]?.slug).toBe("billing-and-plans");

    const emptyMatches = searchHelpArticles(articles, "nonexistent-quantum-xyz");
    expect(emptyMatches).toHaveLength(0);
  });

  it("validates contact support payloads via Zod", () => {
    const valid = supportTicketInputSchema.safeParse({
      email: "ahmed@example.com",
      topic: "Exports",
      relatedProject: "Mosaed — Debt app",
      subject: "PDF export stuck on processing",
      message: "My A4 PDF export has been processing for 20 minutes.",
      includeDiagnostics: true,
    });
    expect(valid.success).toBe(true);

    const invalid = supportTicketInputSchema.safeParse({
      email: "bad-email",
      subject: "Hi",
      message: "short",
    });
    expect(invalid.success).toBe(false);
  });
});

