"use client";

import dynamic from "next/dynamic";
import type { ComponentProps } from "react";
import type { ConstrainedEditor } from "@/components/editor/constrained-editor";

const DynamicConstrainedEditor = dynamic(
  () =>
    import("@/components/editor/constrained-editor").then((mod) => ({
      default: mod.ConstrainedEditor,
    })),
  {
    ssr: false,
    loading: () => (
      <div
        role="status"
        aria-label="Loading case study editor"
        className="bg-background text-muted-foreground flex min-h-screen w-full items-center justify-center p-6"
      >
        <div className="border-border bg-card flex items-center gap-3 rounded-xl border px-5 py-3.5 text-sm font-medium">
          <span className="bg-primary size-2 animate-pulse rounded-full" aria-hidden="true" />
          <span>Loading Casefolio Studio…</span>
        </div>
      </div>
    ),
  },
);

export type EditorClientProps = ComponentProps<typeof ConstrainedEditor>;

export function EditorClient(props: EditorClientProps) {
  return <DynamicConstrainedEditor {...props} />;
}
