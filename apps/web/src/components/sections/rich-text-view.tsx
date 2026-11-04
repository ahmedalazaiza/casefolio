import type { CSSProperties, ReactNode } from "react";
import { isSafeRichTextHref, type TipTapMarkJson, type TipTapNodeJson } from "@/lib/template/rich-text";
import type { RichTextValue } from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export interface RichTextViewProps {
  value: RichTextValue | undefined | null;
  idPrefix: string;
  style?: CSSProperties;
  className?: string;
}

function applyMarks(content: ReactNode, marks: TipTapMarkJson[] | undefined, keyBase: string): ReactNode {
  if (!Array.isArray(marks) || marks.length === 0) {
    return content;
  }

  return marks.reduce<ReactNode>((acc, mark, idx) => {
    const markKey = `${keyBase}-m-${idx}`;
    if (mark.type === "bold") {
      return (
        <strong key={markKey} className="font-semibold">
          {acc}
        </strong>
      );
    }
    if (mark.type === "italic") {
      return (
        <em key={markKey} className="italic">
          {acc}
        </em>
      );
    }
    if (mark.type === "link") {
      const href = mark.attrs?.href;
      if (isSafeRichTextHref(href)) {
        return (
          <a
            key={markKey}
            href={href.trim()}
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: "var(--tpl-color-primary, var(--primary))" }}
            className="underline underline-offset-4 transition-opacity hover:opacity-80"
          >
            {acc}
          </a>
        );
      }
    }
    return acc;
  }, content);
}

function renderInlineNodes(nodes: TipTapNodeJson[] | undefined, keyPrefix: string): ReactNode[] {
  if (!Array.isArray(nodes)) return [];

  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-i-${idx}`;
    if (node.type === "hardBreak") {
      return <br key={key} />;
    }
    if (node.type === "text" && typeof node.text === "string") {
      return <span key={key}>{applyMarks(node.text, node.marks, key)}</span>;
    }
    if (Array.isArray(node.content)) {
      return <span key={key}>{renderInlineNodes(node.content, key)}</span>;
    }
    return null;
  });
}

function renderBlockNodes(
  nodes: TipTapNodeJson[],
  keyPrefix: string,
  style?: CSSProperties,
  className?: string,
): ReactNode[] {
  return nodes.map((node, idx) => {
    const key = `${keyPrefix}-b-${idx}`;

    if (node.type === "bulletList") {
      return (
        <ul
          key={key}
          style={style}
          className={cn("list-disc space-y-1.5 pl-6", className)}
        >
          {(node.content ?? []).map((item, itemIdx) => (
            <li key={`${key}-li-${itemIdx}`}>
              {renderListItemChildren(item.content, `${key}-li-${itemIdx}`)}
            </li>
          ))}
        </ul>
      );
    }

    if (node.type === "orderedList") {
      return (
        <ol
          key={key}
          style={style}
          className={cn("list-decimal space-y-1.5 pl-6", className)}
        >
          {(node.content ?? []).map((item, itemIdx) => (
            <li key={`${key}-li-${itemIdx}`}>
              {renderListItemChildren(item.content, `${key}-li-${itemIdx}`)}
            </li>
          ))}
        </ol>
      );
    }

    const inlineChildren = renderInlineNodes(node.content, key);
    if (inlineChildren.length === 0) {
      return null;
    }

    return (
      <p key={key} style={style} className={className}>
        {inlineChildren}
      </p>
    );
  });
}

function renderListItemChildren(nodes: TipTapNodeJson[] | undefined, keyPrefix: string): ReactNode {
  if (!Array.isArray(nodes) || nodes.length === 0) return null;

  return nodes.map((child, idx) => {
    const key = `${keyPrefix}-c-${idx}`;
    if (child.type === "paragraph") {
      return <span key={key}>{renderInlineNodes(child.content, key)}</span>;
    }
    if (child.type === "bulletList" || child.type === "orderedList") {
      return renderBlockNodes([child], key);
    }
    return <span key={key}>{renderInlineNodes(child.content, key)}</span>;
  });
}

export function RichTextView({ value, idPrefix, style, className }: RichTextViewProps) {
  if (!value) {
    return null;
  }

  if (typeof value === "string") {
    const paragraphs = value
      .split(/\n{2,}/)
      .map((line) => line.trim())
      .filter(Boolean);

    if (paragraphs.length === 0) return null;

    return (
      <div className="flex flex-col gap-3">
        {paragraphs.map((paragraph, idx) => (
          <p key={`${idPrefix}-p-${idx}`} style={style} className={className}>
            {paragraph}
          </p>
        ))}
      </div>
    );
  }

  const content = Array.isArray(value.content) ? (value.content as unknown as TipTapNodeJson[]) : [];
  if (content.length === 0) {
    return null;
  }

  const renderedBlocks = renderBlockNodes(content, idPrefix, style, className).filter(Boolean);
  if (renderedBlocks.length === 0) {
    return null;
  }

  return <div className="flex flex-col gap-3">{renderedBlocks}</div>;
}
