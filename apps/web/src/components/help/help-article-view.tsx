import { AlertTriangle, ArrowLeft, Info, Lightbulb } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
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
          className="text-muted-foreground hover:text-foreground type-body-s-strong inline-flex items-center gap-1.5"
        >
          <ArrowLeft className="size-4" />
          <span>Back to Help center</span>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-12">
        <article className="border-border bg-card flex flex-col gap-6 rounded-xl border p-6 sm:p-8 lg:col-span-8">
          <header className="border-border flex flex-col gap-3 border-b pb-6">
            <div className="flex flex-wrap items-center gap-2.5">
              <Badge tone="accent" withDot={false}>
                {article.category}
              </Badge>
              <span className="text-muted-foreground type-caption">
                Updated {article.updatedAt}
              </span>
            </div>
            <h1 className="text-foreground type-display-m">{article.title}</h1>
            <p className="text-muted-foreground type-body-l">
              {article.summary}
            </p>
          </header>

          <div className="flex flex-col gap-5">
            {article.blocks.map((block, idx) => {
              if (block.type === "heading") {
                return block.level === 2 ? (
                  <h2
                    key={idx}
                    className="text-foreground type-heading-m pt-2"
                  >
                    {block.text}
                  </h2>
                ) : (
                  <h3 key={idx} className="text-foreground type-heading-s pt-1">
                    {block.text}
                  </h3>
                );
              }

              if (block.type === "paragraph") {
                return (
                  <p key={idx} className="text-muted-foreground type-body-m">
                    {renderInlineFormatting(block.text)}
                  </p>
                );
              }

              if (block.type === "list") {
                const ListTag = block.ordered ? "ol" : "ul";
                return (
                  <ListTag
                    key={idx}
                    className={`text-muted-foreground type-body-m flex flex-col gap-2 pl-5 ${
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
          <div className="border-border bg-card flex flex-col gap-3 rounded-xl border p-5">
            <h2 className="text-foreground type-heading-s">More guides</h2>
            <ul className="flex flex-col gap-2">
              {relatedArticles.map((related) => (
                <li key={related.slug}>
                  <Link
                    href={`/help/${related.slug}`}
                    className="text-muted-foreground hover:text-foreground type-body-s block py-1 transition-colors"
                  >
                    {related.title} →
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="border-border bg-sunken flex flex-col gap-3 rounded-xl border p-5">
            <h2 className="text-foreground type-heading-s">Need a hand?</h2>
            <p className="text-muted-foreground type-body-s">
              Send us your project name and question — we’ll reply by email.
            </p>
            <div>
              <Button size="sm" asChild>
                <Link href="/help/contact">Contact support</Link>
              </Button>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}
