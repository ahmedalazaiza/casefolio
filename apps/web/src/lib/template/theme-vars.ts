import type { CSSProperties } from "react";
import type { RichTextValue, TemplateTheme } from "@/lib/template/schema";

export function buildTemplateThemeStyle(theme?: TemplateTheme): CSSProperties {
  if (!theme) {
    return {};
  }

  const vars: Record<string, string> = {};
  for (const [token, hex] of Object.entries(theme.colors)) {
    vars[`--tpl-color-${token}`] = hex;
  }

  if (theme.fonts.heading?.family) {
    vars["--tpl-font-heading"] = theme.fonts.heading.family;
  }
  if (theme.fonts.body?.family) {
    vars["--tpl-font-body"] = theme.fonts.body.family;
  }

  return vars as CSSProperties;
}

export function extractRichTextParagraphs(value: RichTextValue | undefined | null): string[] {
  if (!value) {
    return [];
  }
  if (typeof value === "string") {
    return value
      .split(/\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean);
  }

  const paragraphs: string[] = [];

  function walkNodes(nodes: unknown[] | undefined): string {
    if (!Array.isArray(nodes)) return "";
    return nodes
      .map((node) => {
        if (typeof node !== "object" || node === null) return "";
        const rec = node as Record<string, unknown>;
        if (typeof rec.text === "string") {
          return rec.text;
        }
        if (Array.isArray(rec.content)) {
          return walkNodes(rec.content);
        }
        return "";
      })
      .join("");
  }

  if (Array.isArray(value.content)) {
    for (const block of value.content) {
      if (typeof block === "object" && block !== null) {
        const text = walkNodes([block]).trim();
        if (text) {
          paragraphs.push(text);
        }
      }
    }
  }

  return paragraphs;
}
