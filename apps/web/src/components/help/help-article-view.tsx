import { AlertTriangle, ArrowLeft, Info, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import type {
  HelpArticle,
  HelpArticleSummary,
  HelpCalloutTone,
} from "@/lib/help/search";

function renderInlineFormatting(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return tokens.map((part, idx) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={idx} className="text-foreground font-semibold">
          {part.slice(2, -2)}
        </strong>
      );
    }
    if (part.startsWith("`") && part.endsWith("`")) {
      return (
        <code
          key={idx}
          className="bg-sunken text-foreground border-border rounded-xs border px-1.5 py-0.5 font-mono type-caption"
        >
          {part.slice(1, -1)}
        </code>
      );
    }
    return part;
  });
}

function CalloutBox({
  tone,
  children,
}: {
  tone: HelpCalloutTone;
  children: ReactNode;
}) {
  const map = {
    info: {
      box: "border-border bg-accent/50 text-foreground",
      icon: <Info className="text-accent-foreground mt-0.5 size-4 shrink-0" />,
    },
    tip: {
      box: "border-border bg-success-soft text-foreground",
      icon: <Lightbulb className="text-success mt-0.5 size-4 shrink-0" />,
    },
    warning: {
      box: "border-border bg-warning-soft text-foreground",
      icon: <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />,
    },
  }[tone];

  return (
    <div className={`flex items-start gap-3 rounded-xl border p-4 ${map.box}`}>
      <span aria-hidden="true">{map.icon}</span>
      <p className="type-body-s">{children}</p>
    </div>
  );
}

export function HelpArticleView({
  article,
  relatedArticles,
}: {
  article: HelpArticle;
  relatedArticles: readonly HelpArticleSummary[];
}) {
  return (
    <div className="flex flex-col gap-8">
      <div>
        <Link
          href="/help"
          className="v3-btn-secondary w-fit py-2 px-3.5 text-xs font-semibold"
        >
          <ArrowLeft className="size-3.5" />
          <span>Back to Help center</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <article className="flex flex-col gap-6 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 shadow-[var(--cf-shadow-card)] sm:p-9 lg:col-span-8">
          <header className="flex flex-col gap-3 border-b border-[var(--cf-border-subtle)] pb-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone="accent" withDot={false}>
                {article.category}
              </Badge>
              <span className="type-caption text-[var(--cf-text-tertiary)]">
                Updated {article.updatedAt}
              </span>
            </div>
            <h1 className="v3-display-l text-[var(--cf-text-primary)]">{article.title}</h1>
            <p className="v3-body-l text-[var(--cf-text-secondary)]">
              {article.summary}
            </p>
          </header>

          <div className="flex flex-col gap-5">
            {article.blocks.map((block, idx) => {
              if (block.type === "heading") {
                return block.level === 2 ? (
                  <h2
                    key={idx}
                    className="v3-heading-m pt-2 text-[var(--cf-text-primary)]"
                  >
                    {block.text}
                  </h2>
                ) : (
                  <h3 key={idx} className="v3-heading-s pt-1 text-[var(--cf-text-primary)]">
                    {block.text}
                  </h3>
                );
              }

              if (block.type === "paragraph") {
                return (
                  <p key={idx} className="v3-body-m text-[var(--cf-text-secondary)]">
                    {renderInlineFormatting(block.text)}
                  </p>
                );
              }

              if (block.type === "list") {
                const ListTag = block.ordered ? "ol" : "ul";
                return (
                  <ListTag
                    key={idx}
                    className={`v3-body-m flex flex-col gap-2 pl-5 text-[var(--cf-text-secondary)] ${
                      block.ordered ? "list-decimal" : "list-disc"
                    }`}
                  >
                    {block.items.map((item, itemIdx) => (
                      <li key={itemIdx}>{renderInlineFormatting(item)}</li>
                    ))}
                  </ListTag>
                );
              }

              return (
                <CalloutBox key={idx} tone={block.tone}>
                  {renderInlineFormatting(block.text)}
                </CalloutBox>
              );
            })}
          </div>
        </article>

        <aside className="flex flex-col gap-5 lg:col-span-4">
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 shadow-[var(--cf-shadow-soft)]">
            <h2 className="v3-heading-s text-[var(--cf-text-primary)]">More guides</h2>
            <ul className="flex flex-col gap-2">
              {relatedArticles.map((related) => (
                <li key={related.slug}>
                  <Link
                    href={`/help/${related.slug}`}
                    className="v3-body-s block rounded-xl border border-transparent px-3 py-2 text-[var(--cf-text-secondary)] transition-colors hover:border-[var(--cf-border-subtle)] hover:bg-[var(--cf-bg-canvas)] hover:text-[var(--cf-royal-text)]"
                  >
                    {related.title} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="v3-pattern-dots-dark flex flex-col gap-3.5 rounded-xl border border-[var(--cf-border-on-royal)] p-6 text-[var(--cf-text-on-royal)] shadow-[var(--cf-shadow-soft)]">
            <h2 className="v3-heading-s text-[var(--cf-text-on-royal)]">Need a hand?</h2>
            <p className="v3-body-s text-[var(--cf-text-on-royal-muted)]">
              Send us your project name and question — we’ll reply by email.
            </p>
            <div>
              <Link href="/help/contact" className="v3-btn-lime py-2.5 px-4 text-xs">
                Contact support
              </Link>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

