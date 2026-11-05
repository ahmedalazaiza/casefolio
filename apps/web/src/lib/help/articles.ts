import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type {
  HelpArticle,
  HelpArticleSummary,
  HelpCalloutTone,
  HelpMdxBlock,
} from "./search";

function resolveHelpContentDir(): string {
  const candidates = [
    join(process.cwd(), "src/content/help"),
    join(process.cwd(), "apps/web/src/content/help"),
  ];
  for (const dir of candidates) {
    if (existsSync(dir)) {
      return dir;
    }
  }
  return candidates[0] ?? join(process.cwd(), "src/content/help");
}

function parseFrontmatter(raw: string): {
  meta: Record<string, string>;
  body: string;
} {
  const normalized = raw.replace(/\r\n/g, "\n");
  if (!normalized.startsWith("---\n")) {
    return { meta: {}, body: normalized };
  }

  const endIdx = normalized.indexOf("\n---\n", 4);
  if (endIdx === -1) {
    return { meta: {}, body: normalized };
  }

  const headerLines = normalized.slice(4, endIdx).split("\n");
  const meta: Record<string, string> = {};
  for (const line of headerLines) {
    const colonIdx = line.indexOf(":");
    if (colonIdx <= 0) continue;
    const key = line.slice(0, colonIdx).trim();
    const val = line.slice(colonIdx + 1).trim();
    meta[key] = val;
  }

  const body = normalized.slice(endIdx + 5).trim();
  return { meta, body };
}

export function parseMdxBlocks(body: string): HelpMdxBlock[] {
  const lines = body.replace(/\r\n/g, "\n").split("\n");
  const blocks: HelpMdxBlock[] = [];
  let idx = 0;

  while (idx < lines.length) {
    const rawLine = lines[idx] ?? "";
    const trimmed = rawLine.trim();

    if (!trimmed) {
      idx += 1;
      continue;
    }

    // Custom MDX <Callout tone="...">...</Callout>
    const calloutMatch = /^<Callout(?:\s+tone="(info|tip|warning)")?\s*>$/.exec(
      trimmed,
    );
    if (calloutMatch) {
      const tone = (calloutMatch[1] as HelpCalloutTone | undefined) ?? "info";
      const contentLines: string[] = [];
      idx += 1;
      while (idx < lines.length && !(lines[idx] ?? "").trim().startsWith("</Callout>")) {
        const inner = (lines[idx] ?? "").trim();
        if (inner) contentLines.push(inner);
        idx += 1;
      }
      idx += 1; // skip </Callout>
      blocks.push({
        type: "callout",
        tone,
        text: contentLines.join(" "),
      });
      continue;
    }

    // Headings ## / ###
    if (trimmed.startsWith("### ")) {
      blocks.push({
        type: "heading",
        level: 3,
        text: trimmed.slice(4).trim(),
      });
      idx += 1;
      continue;
    }
    if (trimmed.startsWith("## ")) {
      blocks.push({
        type: "heading",
        level: 2,
        text: trimmed.slice(3).trim(),
      });
      idx += 1;
      continue;
    }

    // Unordered list
    if (trimmed.startsWith("- ")) {
      const items: string[] = [];
      while (idx < lines.length && (lines[idx] ?? "").trim().startsWith("- ")) {
        items.push((lines[idx] ?? "").trim().slice(2).trim());
        idx += 1;
      }
      blocks.push({ type: "list", ordered: false, items });
      continue;
    }

    // Ordered list
    if (/^\d+\.\s+/.test(trimmed)) {
      const items: string[] = [];
      while (idx < lines.length && /^\d+\.\s+/.test((lines[idx] ?? "").trim())) {
        items.push((lines[idx] ?? "").trim().replace(/^\d+\.\s+/, "").trim());
        idx += 1;
      }
      blocks.push({ type: "list", ordered: true, items });
      continue;
    }

    // Paragraph
    const paragraphLines: string[] = [];
    while (idx < lines.length) {
      const nextTrimmed = (lines[idx] ?? "").trim();
      if (
        !nextTrimmed ||
        nextTrimmed.startsWith("## ") ||
        nextTrimmed.startsWith("### ") ||
        nextTrimmed.startsWith("- ") ||
        /^\d+\.\s+/.test(nextTrimmed) ||
        nextTrimmed.startsWith("<Callout")
      ) {
        break;
      }
      paragraphLines.push(nextTrimmed);
      idx += 1;
    }
    if (paragraphLines.length > 0) {
      blocks.push({
        type: "paragraph",
        text: paragraphLines.join(" "),
      });
    }
  }

  return blocks;
}

export function parseMdxDocument(slug: string, rawContent: string): HelpArticle {
  const { meta, body } = parseFrontmatter(rawContent);
  const blocks = parseMdxBlocks(body);
  const keywords = (meta.keywords ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const plainBody = blocks
    .map((block) => {
      if (block.type === "list") {
        return block.items.join(" ");
      }
      return block.text;
    })
    .join(" ");

  return {
    slug,
    title: meta.title ?? slug,
    summary: meta.summary ?? "",
    category: meta.category ?? "General",
    order: Number(meta.order ?? 99),
    updatedAt: meta.updatedAt ?? "2026-04-15",
    keywords,
    searchableText: plainBody,
    blocks,
  };
}

export function listHelpArticles(): HelpArticleSummary[] {
  const dir = resolveHelpContentDir();
  if (!existsSync(dir)) {
    return [];
  }

  const files = readdirSync(dir).filter((file) => file.endsWith(".mdx"));
  const articles = files.map((file) => {
    const slug = file.replace(/\.mdx$/, "");
    const raw = readFileSync(join(dir, file), "utf-8");
    const parsed = parseMdxDocument(slug, raw);
    const { blocks: _blocks, ...summary } = parsed;
    return summary;
  });

  return articles.sort((a, b) => a.order - b.order);
}

export function getHelpArticleBySlug(slug: string): HelpArticle | null {
  const safeSlug = slug.replace(/[^a-z0-9-]/gi, "");
  if (!safeSlug || safeSlug !== slug) {
    return null;
  }

  const dir = resolveHelpContentDir();
  const fullPath = join(dir, `${safeSlug}.mdx`);
  if (!existsSync(fullPath)) {
    return null;
  }

  const raw = readFileSync(fullPath, "utf-8");
  return parseMdxDocument(safeSlug, raw);
}

