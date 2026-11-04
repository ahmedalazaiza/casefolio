import type { RichTextValue } from "@/lib/template/schema";

export interface TipTapMarkJson {
  type: "bold" | "italic" | "link" | (string & {});
  attrs?: Record<string, unknown>;
}

export interface TipTapNodeJson {
  type: string;
  attrs?: Record<string, unknown>;
  content?: TipTapNodeJson[];
  marks?: TipTapMarkJson[];
  text?: string;
}

export interface TipTapDocJson {
  type: "doc";
  content: Array<Record<string, unknown>>;
}

const SAFE_PROTOCOL_REGEX = /^(https?:\/\/|mailto:)/i;

function hasControlCharacters(value: string): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    if (code <= 31 || code === 127) {
      return true;
    }
  }
  return false;
}

/**
 * Validates that a link href uses an allowed safe protocol (`http:`, `https:`, or `mailto:`).
 * Rejects `javascript:`, `data:`, `vbscript:`, protocol-relative `//`, and malformed URLs.
 */
export function isSafeRichTextHref(rawHref: unknown): rawHref is string {
  if (typeof rawHref !== "string") return false;
  const trimmed = rawHref.trim();
  if (!trimmed || trimmed.length > 2048) return false;
  if (hasControlCharacters(trimmed)) return false;
  if (!SAFE_PROTOCOL_REGEX.test(trimmed)) return false;

  if (/^mailto:/i.test(trimmed)) {
    const recipient = trimmed.slice("mailto:".length).trim();
    return recipient.length > 0 && !recipient.startsWith("//");
  }

  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

/**
 * Converts a plain string or existing TipTap JSON value into a normalized TipTap `doc` JSON object.
 */
export function normalizeRichTextToDoc(value: RichTextValue | undefined | null): TipTapDocJson {
  if (value && typeof value === "object" && value.type === "doc") {
    return {
      type: "doc",
      content: Array.isArray(value.content) && value.content.length > 0
        ? structuredClone(value.content)
        : [{ type: "paragraph" }],
    };
  }

  if (typeof value === "string" && value.trim().length > 0) {
    const blocks = value
      .split(/\n{2,}/)
      .map((chunk) => chunk.trim())
      .filter(Boolean);

    if (blocks.length > 0) {
      return {
        type: "doc",
        content: blocks.map((paragraphText) => ({
          type: "paragraph",
          content: [{ type: "text", text: paragraphText }],
        })),
      };
    }
  }

  return {
    type: "doc",
    content: [{ type: "paragraph" }],
  };
}

const DROP_SUBTREE_TAGS = new Set([
  "SCRIPT",
  "STYLE",
  "IFRAME",
  "OBJECT",
  "EMBED",
  "SVG",
  "MATH",
  "FORM",
  "INPUT",
  "TEXTAREA",
  "SELECT",
  "BUTTON",
  "VIDEO",
  "AUDIO",
  "IMG",
  "PICTURE",
  "SOURCE",
  "CANVAS",
  "META",
  "LINK",
  "NOSCRIPT",
  "TEMPLATE",
  "HEAD",
]);

const CONVERT_TO_PARAGRAPH_TAGS = new Set([
  "P",
  "DIV",
  "H1",
  "H2",
  "H3",
  "H4",
  "H5",
  "H6",
  "BLOCKQUOTE",
  "PRE",
  "SECTION",
  "ARTICLE",
  "HEADER",
  "FOOTER",
  "ASIDE",
]);

function escapeHtmlText(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function escapeHtmlAttr(value: string): string {
  return escapeHtmlText(value).replaceAll('"', "&quot;");
}

function serializeCleanChildren(nodes: NodeListOf<ChildNode> | ChildNode[]): string {
  let out = "";
  for (const child of Array.from(nodes)) {
    out += serializeCleanNode(child);
  }
  return out;
}

function serializeCleanNode(node: ChildNode): string {
  if (node.nodeType === 3) {
    return escapeHtmlText(node.textContent ?? "");
  }
  if (node.nodeType !== 1) {
    return "";
  }

  const el = node as Element;
  const tag = el.tagName.toUpperCase();

  if (DROP_SUBTREE_TAGS.has(tag)) {
    return "";
  }

  if (tag === "BR") {
    return "<br>";
  }

  const inner = serializeCleanChildren(el.childNodes);

  if (tag === "STRONG" || tag === "B") {
    return inner ? `<strong>${inner}</strong>` : "";
  }

  if (tag === "EM" || tag === "I") {
    return inner ? `<em>${inner}</em>` : "";
  }

  if (tag === "A") {
    const rawHref = el.getAttribute("href");
    if (isSafeRichTextHref(rawHref)) {
      return `<a href="${escapeHtmlAttr(rawHref.trim())}" rel="noopener noreferrer">${inner}</a>`;
    }
    return inner;
  }

  if (tag === "UL" || tag === "OL") {
    const items = Array.from(el.children)
      .filter((child) => child.tagName.toUpperCase() === "LI")
      .map((child) => serializeCleanNode(child))
      .join("");
    if (!items) return "";
    return tag === "UL" ? `<ul>${items}</ul>` : `<ol>${items}</ol>`;
  }

  if (tag === "LI") {
    return `<li>${inner}</li>`;
  }

  if (CONVERT_TO_PARAGRAPH_TAGS.has(tag)) {
    const hasNestedBlock = Array.from(el.children).some((child) => {
      const childTag = child.tagName.toUpperCase();
      return (
        CONVERT_TO_PARAGRAPH_TAGS.has(childTag) || childTag === "UL" || childTag === "OL"
      );
    });
    if (hasNestedBlock) {
      return inner;
    }
    return inner.trim() ? `<p>${inner}</p>` : "";
  }

  // Any other inline/unknown wrapper (`<span>`, `<font>`, `<u>`, `<code>`, etc.): unwrap and keep sanitized inner content
  return inner;
}

/**
 * Sanitizes pasted HTML before TipTap parses it into ProseMirror JSON:
 * - Drops `<script>`, `<style>`, `<iframe>`, `<img>`, `<svg>`, forms, and media subtrees completely
 * - Strips all `style`, `class`, `on*`, and arbitrary attributes
 * - Allows only `<p>`, `<br>`, `<strong>`, `<em>`, `<ul>`, `<ol>`, `<li>`, and safe `<a href="https://...|http://...|mailto:...">`
 */
export function sanitizeRichTextHtml(rawHtml: string): string {
  if (!rawHtml || typeof rawHtml !== "string") {
    return "";
  }

  if (typeof DOMParser !== "undefined") {
    const doc = new DOMParser().parseFromString(rawHtml, "text/html");
    const cleaned = serializeCleanChildren(doc.body.childNodes).trim();
    if (!cleaned) {
      return "<p></p>";
    }
    return cleaned.startsWith("<p") || cleaned.startsWith("<ul") || cleaned.startsWith("<ol")
      ? cleaned
      : `<p>${cleaned}</p>`;
  }

  // Fallback when DOMParser is unavailable (SSR safety): strip all HTML tags and keep plain text paragraph
  const stripped = rawHtml
    .replace(/<(script|style|iframe|object|embed|svg)[\s\S]*?<\/\1>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  return stripped ? `<p>${escapeHtmlText(stripped)}</p>` : "<p></p>";
}
