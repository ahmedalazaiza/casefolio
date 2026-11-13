"use client";

import { ArrowRight, LifeBuoy, Search, Send, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { searchHelpArticles, type HelpArticleSummary } from "@/lib/help/search";

export interface HelpCenterClientProps {
  articles: readonly HelpArticleSummary[];
  initialQuery?: string;
}

export function HelpCenterClient({ articles, initialQuery = "" }: HelpCenterClientProps) {
  const [query, setQuery] = useState(initialQuery);
  const filtered = searchHelpArticles(articles, query);
  const hasQuery = query.trim().length > 0;

  return (
    <div className="flex flex-col gap-8">
      {/* Brand-wash hero shared with every marketing page */}
      <section className="bg-wash-panel text-foreground flex flex-col items-center gap-8 rounded-[2rem] px-6 py-16 text-center sm:py-20">
        <div className="flex flex-col items-center gap-6">
          <Eyebrow icon={<LifeBuoy />}>Help center</Eyebrow>
          <h1 className="type-section text-balance">How can we help?</h1>
        </div>

        <div className="relative w-full max-w-xl text-left">
          <Search
            aria-hidden="true"
            className="text-muted-foreground pointer-events-none absolute top-1/2 left-5 size-4 -translate-y-1/2"
          />
          <input
            type="search"
            aria-label="Search help articles"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search articles — e.g. “export PDF”"
            className="border-border/60 bg-elevated text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/40 shadow-float type-body-m h-14 w-full rounded-full border pr-12 pl-12 outline-none focus-visible:ring-2"
          />
          {hasQuery && (
            <button
              type="button"
              aria-label="Clear search query"
              onClick={() => setQuery("")}
              className="text-muted-foreground hover:text-foreground absolute top-1/2 right-4 inline-flex size-6 -translate-y-1/2 items-center justify-center rounded-full"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </section>

      {hasQuery && (
        <p className="text-muted-foreground type-body-s">
          {filtered.length} {filtered.length === 1 ? "article matches" : "articles match"} “
          {query.trim()}”
        </p>
      )}

      {/* Articles + Still stuck? grid matching Figma 2:9985 + 2:9998 */}
      {filtered.length === 0 ? (
        <div className="border-border bg-card flex flex-col items-center justify-center gap-3 rounded-xl border p-10 text-center">
          <p className="text-foreground type-heading-s">No articles match “{query.trim()}”</p>
          <p className="text-muted-foreground type-body-s max-w-md">
            Try a broader keyword like “PDF”, “slug”, “branding”, or “Paddle”,
            or send a message directly to our support team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <Button type="button" variant="secondary" size="sm" onClick={() => setQuery("")}>
              Clear search
            </Button>
            <Button size="sm" asChild>
              <Link href="/help/contact">Contact support</Link>
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article) => (
            <Link
              key={article.slug}
              href={`/help/${article.slug}`}
              className="border-border bg-card hover:border-border-strong focus-visible:ring-ring/40 group flex flex-col justify-between gap-5 rounded-xl border p-6 transition-colors outline-none focus-visible:ring-2"
            >
              <div className="flex flex-col gap-2">
                <h2 className="text-foreground type-heading-s">{article.title}</h2>
                <p className="text-muted-foreground type-body-s">{article.summary}</p>
              </div>

              <span className="text-accent-foreground type-body-s-strong inline-flex items-center gap-1.5">
                <span>Read</span>
                <ArrowRight
                  aria-hidden="true"
                  className="size-3.5 transition-transform group-hover:translate-x-0.5"
                />
              </span>
            </Link>
          ))}

          {/* Still stuck? card matching Figma 2:10007 */}
          <aside
            id="contact"
            className="border-border bg-sunken flex flex-col justify-between gap-4 rounded-xl border p-6"
          >
            <div className="flex flex-col gap-3">
              <span
                aria-hidden="true"
                className="bg-elevated text-foreground border-border inline-flex size-10 items-center justify-center rounded-lg border"
              >
                <Send className="size-4" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h2 className="text-foreground type-heading-s">Still stuck?</h2>
                <p className="text-muted-foreground type-body-s">
                  Our support team typically replies by email within 1 business day.
                </p>
              </div>
            </div>

            <div>
              <Button size="sm" asChild>
                <Link href="/help/contact">Contact support</Link>
              </Button>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
