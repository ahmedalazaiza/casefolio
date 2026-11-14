"use client";

import { ArrowRight, LifeBuoy, Search, Send, X } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
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
      {/* Architectural Royal Grid Help Hero + Studio Command Search */}
      <section className="v3-pattern-grid flex flex-col items-center gap-8 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-6 py-16 text-center text-[var(--cf-text-primary)] sm:py-20">
        <div className="flex flex-col items-center gap-4">
          <Eyebrow icon={<LifeBuoy className="size-3.5" />}>
            Help center
          </Eyebrow>
          <h1 className="v3-display-l text-balance text-[var(--cf-text-primary)]">
            How can we help?
          </h1>
          <p className="v3-body-m max-w-lg text-[var(--cf-text-secondary)]">
            Guides on templates, ratio-locked screen slots, custom domains, exports, and billing.
          </p>
        </div>

        <div className="relative w-full max-w-xl text-left">
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3 inline-flex size-9 -translate-y-1/2 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-bg-accent)]"
          >
            <Search className="size-4" />
          </span>
          <input
            type="search"
            aria-label="Search help articles"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search articles — e.g. “export PDF”"
            className="focus-visible:ring-ring/40 type-body-m h-14 w-full rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] pr-12 pl-14 text-[var(--cf-text-primary)] placeholder:text-[var(--cf-text-tertiary)] outline-none focus-visible:border-[var(--cf-royal)] focus-visible:ring-2"
          />
          {hasQuery && (
            <button
              type="button"
              aria-label="Clear search query"
              onClick={() => setQuery("")}
              className="absolute top-1/2 right-3.5 inline-flex size-7 -translate-y-1/2 items-center justify-center rounded-lg bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </section>

      {hasQuery && (
        <p className="v3-body-s text-[var(--cf-text-secondary)]">
          {filtered.length} {filtered.length === 1 ? "article matches" : "articles match"} “
          {query.trim()}”
        </p>
      )}

      {/* Articles + Electric Royal Blue Support Card */}
      {filtered.length === 0 ? (
        <div className="v3-pattern-dots-light flex flex-col items-center justify-center gap-3.5 rounded-[2rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-10 text-center">
          <p className="v3-heading-s text-[var(--cf-text-primary)]">
            No articles match “{query.trim()}”
          </p>
          <p className="v3-body-s max-w-md text-[var(--cf-text-secondary)]">
            Try a broader keyword like “PDF”, “slug”, “branding”, or “Paddle”, or send a message
            directly to our support team.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            <button
              type="button"
              onClick={() => setQuery("")}
              className="v3-btn-secondary py-2 text-xs font-semibold"
            >
              Clear search
            </button>
            <Link href="/help/contact" className="v3-btn-primary py-2 text-xs font-semibold">
              Contact support
            </Link>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filtered.map((article, idx) => (
            <Link
              key={article.slug}
              href={`/help/${article.slug}`}
              className="focus-visible:ring-ring/40 group flex flex-col justify-between gap-5 rounded-[1.75rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 transition-all duration-200 outline-none hover:-translate-y-1 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)] focus-visible:ring-2"
            >
              <div className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="inline-flex items-center rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2.5 py-1 font-mono text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-primary)] uppercase">
                    0{idx + 1} · Guide
                  </span>
                  {article.category &&
                    article.category.toLowerCase() !== article.title.toLowerCase() && (
                      <span className="type-caption text-[var(--cf-text-tertiary)]">
                        {article.category}
                      </span>
                    )}
                </div>
                <h2 className="v3-heading-s text-[var(--cf-text-primary)] transition-colors group-hover:text-[var(--cf-royal)]">
                  {article.title}
                </h2>
                <p className="v3-body-s text-[var(--cf-text-secondary)]">{article.summary}</p>
              </div>

              <div className="flex items-center justify-between border-t border-[var(--cf-border-subtle)] pt-3.5">
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--cf-royal-text)]">
                  <span>Read</span>
                  <ArrowRight
                    aria-hidden="true"
                    className="size-3.5 transition-transform group-hover:translate-x-1"
                  />
                </span>
              </div>
            </Link>
          ))}

          {/* Electric Royal Blue Still Stuck Card */}
          <aside
            id="contact"
            className="v3-pattern-dots-dark flex flex-col justify-between gap-5 rounded-[1.75rem] border border-[var(--cf-border-on-royal)] p-6 text-[var(--cf-text-on-royal)]"
          >
            <div className="flex flex-col gap-3.5">
              <span
                aria-hidden="true"
                className="inline-flex size-11 items-center justify-center rounded-2xl bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
              >
                <Send className="size-4" />
              </span>
              <div className="flex flex-col gap-1.5">
                <h2 className="v3-heading-s text-[var(--cf-text-on-royal)]">Still stuck?</h2>
                <p className="v3-body-s text-[var(--cf-text-on-royal-muted)]">
                  Our support team typically replies by email within 1 business day.
                </p>
              </div>
            </div>

            <div>
              <Link href="/help/contact" className="v3-btn-lime py-2.5 px-4 text-xs">
                <span>Contact support</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
