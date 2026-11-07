"use client";

import Bold from "@tiptap/extension-bold";
import Document from "@tiptap/extension-document";
import HardBreak from "@tiptap/extension-hard-break";
import Italic from "@tiptap/extension-italic";
import Link from "@tiptap/extension-link";
import { BulletList, ListItem, OrderedList } from "@tiptap/extension-list";
import Paragraph from "@tiptap/extension-paragraph";
import Text from "@tiptap/extension-text";
import { EditorContent, useEditor, type Editor } from "@tiptap/react";
import {
  Bold as BoldIcon,
  Check,
  Italic as ItalicIcon,
  Link2,
  List,
  ListOrdered,
  Unlink,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  isSafeRichTextHref,
  normalizeRichTextToDoc,
  sanitizeRichTextHtml,
  type TipTapDocJson,
} from "@/lib/template/rich-text";
import type { RichTextValue } from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export function createCasefolioTipTapExtensions() {
  return [
    Document,
    Paragraph,
    Text,
    HardBreak,
    Bold,
    Italic,
    BulletList,
    OrderedList,
    ListItem,
    Link.configure({
      openOnClick: false,
      autolink: true,
      linkOnPaste: true,
      defaultProtocol: "https",
      protocols: ["http", "https", "mailto"],
      isAllowedUri: (url) => isSafeRichTextHref(url),
    }),
  ];
}

export interface RichTextFieldProps {
  label: string;
  value: RichTextValue | undefined;
  onChange: (nextValue: TipTapDocJson) => void;
  readOnly?: boolean;
  onEditorReady?: (editor: Editor) => void;
}

interface ActiveToolbarState {
  bold: boolean;
  italic: boolean;
  bulletList: boolean;
  orderedList: boolean;
  link: boolean;
  linkHref: string;
}

const INITIAL_ACTIVE_STATE: ActiveToolbarState = {
  bold: false,
  italic: false,
  bulletList: false,
  orderedList: false,
  link: false,
  linkHref: "",
};

function readToolbarState(editor: Editor | null): ActiveToolbarState {
  if (!editor) return INITIAL_ACTIVE_STATE;
  const linkAttrs = editor.getAttributes("link") as { href?: unknown };
  return {
    bold: editor.isActive("bold"),
    italic: editor.isActive("italic"),
    bulletList: editor.isActive("bulletList"),
    orderedList: editor.isActive("orderedList"),
    link: editor.isActive("link"),
    linkHref: typeof linkAttrs.href === "string" ? linkAttrs.href : "",
  };
}

export function RichTextField({
  label,
  value,
  onChange,
  readOnly = false,
  onEditorReady,
}: RichTextFieldProps) {
  const normalizedDoc = useMemo(() => normalizeRichTextToDoc(value), [value]);
  const normalizedSerialized = useMemo(() => JSON.stringify(normalizedDoc), [normalizedDoc]);
  const lastEmittedJsonRef = useRef<string>(normalizedSerialized);

  const [toolbarState, setToolbarState] = useState<ActiveToolbarState>(INITIAL_ACTIVE_STATE);
  const [linkBarOpen, setLinkBarOpen] = useState(false);
  const [linkDraft, setLinkDraft] = useState("");
  const [linkError, setLinkError] = useState<string | null>(null);

  const extensions = useMemo(() => createCasefolioTipTapExtensions(), []);

  const editor = useEditor({
    immediatelyRender: false,
    extensions,
    content: normalizedDoc,
    editable: !readOnly,
    editorProps: {
      attributes: {
        role: "textbox",
        "aria-multiline": "true",
        "aria-label": label,
        class:
          "min-h-28 px-3 py-2.5 outline-none type-body-s text-foreground [&_p]:mb-2 [&_p:last-child]:mb-0 [&_ul]:mb-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:mb-2 [&_ol]:list-decimal [&_ol]:pl-5 [&_a]:text-primary [&_a]:underline",
      },
      transformPastedHTML: (html) => sanitizeRichTextHtml(html),
    },
    onUpdate: ({ editor: activeEditor }) => {
      const json = activeEditor.getJSON() as TipTapDocJson;
      const serialized = JSON.stringify(json);
      lastEmittedJsonRef.current = serialized;
      setToolbarState(readToolbarState(activeEditor));
      onChange(json);
    },
    onSelectionUpdate: ({ editor: activeEditor }) => {
      setToolbarState(readToolbarState(activeEditor));
    },
    onTransaction: ({ editor: activeEditor }) => {
      setToolbarState(readToolbarState(activeEditor));
    },
  });

  useEffect(() => {
    if (editor && onEditorReady) {
      onEditorReady(editor);
    }
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!readOnly);
  }, [editor, readOnly]);

  useEffect(() => {
    if (!editor) return;
    if (normalizedSerialized !== lastEmittedJsonRef.current) {
      lastEmittedJsonRef.current = normalizedSerialized;
      editor.commands.setContent(normalizedDoc, { emitUpdate: false });
      setToolbarState(readToolbarState(editor));
    }
  }, [editor, normalizedDoc, normalizedSerialized]);

  const handleOpenLinkBar = () => {
    if (!editor || readOnly) return;
    setLinkError(null);
    setLinkDraft(toolbarState.linkHref || "https://");
    setLinkBarOpen((prev) => !prev);
  };

  const handleApplyLink = () => {
    if (!editor || readOnly) return;
    const trimmed = linkDraft.trim();
    if (!trimmed) {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      setLinkError(null);
      setLinkBarOpen(false);
      return;
    }

    if (!isSafeRichTextHref(trimmed)) {
      setLinkError("Enter a valid https://, http://, or mailto: link.");
      return;
    }

    editor
      .chain()
      .focus()
      .extendMarkRange("link")
      .setLink({ href: trimmed, rel: "noopener noreferrer" })
      .run();
    setLinkError(null);
    setLinkBarOpen(false);
  };

  const handleRemoveLink = () => {
    if (!editor || readOnly) return;
    editor.chain().focus().extendMarkRange("link").unsetLink().run();
    setLinkError(null);
    setLinkBarOpen(false);
  };

  return (
    <div data-testid="rich-text-field" className="flex flex-col gap-1.5">
      <span className="text-foreground type-caption font-medium">{label}</span>

      <div className="border-border/70 bg-elevated focus-within:ring-ring/25 focus-within:border-ring overflow-hidden rounded-xl border shadow-2xs transition-all focus-within:ring-3">
        {/* Constrained formatting toolbar: Bold, Italic, Lists, Link only */}
        <div
          role="toolbar"
          aria-label={`${label} formatting`}
          className="border-border/70 bg-surface/70 flex flex-wrap items-center gap-1 border-b px-2.5 py-1.5"
        >
          <button
            type="button"
            aria-label="Bold"
            aria-pressed={toolbarState.bold}
            disabled={readOnly || !editor}
            onClick={() => editor?.chain().focus().toggleBold().run()}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-45",
              toolbarState.bold
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground",
            )}
          >
            <BoldIcon className="size-3.5" />
          </button>

          <button
            type="button"
            aria-label="Italic"
            aria-pressed={toolbarState.italic}
            disabled={readOnly || !editor}
            onClick={() => editor?.chain().focus().toggleItalic().run()}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-45",
              toolbarState.italic
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground",
            )}
          >
            <ItalicIcon className="size-3.5" />
          </button>

          <span aria-hidden="true" className="bg-border mx-0.5 h-4 w-px" />

          <button
            type="button"
            aria-label="Bullet list"
            aria-pressed={toolbarState.bulletList}
            disabled={readOnly || !editor}
            onClick={() => editor?.chain().focus().toggleBulletList().run()}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-45",
              toolbarState.bulletList
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground",
            )}
          >
            <List className="size-3.5" />
          </button>

          <button
            type="button"
            aria-label="Ordered list"
            aria-pressed={toolbarState.orderedList}
            disabled={readOnly || !editor}
            onClick={() => editor?.chain().focus().toggleOrderedList().run()}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-45",
              toolbarState.orderedList
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground",
            )}
          >
            <ListOrdered className="size-3.5" />
          </button>

          <span aria-hidden="true" className="bg-border mx-0.5 h-4 w-px" />

          <button
            type="button"
            aria-label="Link"
            aria-pressed={toolbarState.link || linkBarOpen}
            disabled={readOnly || !editor}
            onClick={handleOpenLinkBar}
            className={cn(
              "inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-45",
              toolbarState.link || linkBarOpen
                ? "bg-accent text-accent-foreground"
                : "text-muted-foreground hover:bg-elevated hover:text-foreground",
            )}
          >
            <Link2 className="size-3.5" />
          </button>

          {toolbarState.link && (
            <button
              type="button"
              aria-label="Remove link"
              disabled={readOnly || !editor}
              onClick={handleRemoveLink}
              className="text-muted-foreground hover:bg-elevated hover:text-foreground inline-flex size-7 items-center justify-center rounded-md transition-colors disabled:opacity-45"
            >
              <Unlink className="size-3.5" />
            </button>
          )}
        </div>

        {/* Inline safe URL editor */}
        {linkBarOpen && (
          <div className="border-border bg-elevated flex flex-col gap-1.5 border-b p-2">
            <div className="flex items-center gap-1.5">
              <Input
                type="url"
                aria-label="Link URL"
                placeholder="https://example.com"
                value={linkDraft}
                onChange={(e) => {
                  setLinkDraft(e.target.value);
                  if (linkError) setLinkError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyLink();
                  } else if (e.key === "Escape") {
                    e.preventDefault();
                    setLinkBarOpen(false);
                  }
                }}
                className="h-8 text-xs"
              />
              <Button
                type="button"
                size="sm"
                aria-label="Apply link"
                onClick={handleApplyLink}
                className="h-8 px-2.5"
              >
                <Check className="size-3.5" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                aria-label="Cancel link"
                onClick={() => {
                  setLinkError(null);
                  setLinkBarOpen(false);
                }}
                className="h-8 px-2"
              >
                <X className="size-3.5" />
              </Button>
            </div>
            {linkError && <span className="text-destructive type-caption">{linkError}</span>}
          </div>
        )}

        {/* TipTap ProseMirror Surface */}
        {editor ? (
          <EditorContent editor={editor} />
        ) : (
          <div className="text-tertiary type-body-s min-h-28 px-3 py-2.5">Loading editor...</div>
        )}
      </div>
    </div>
  );
}
