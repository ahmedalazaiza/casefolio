"use client";

import { AlertTriangle, Check, Info, Loader2, X } from "lucide-react";
import { useTheme } from "next-themes";
import type { CSSProperties, ReactNode } from "react";
import { Toaster as Sonner, toast, type ToasterProps } from "sonner";
import { cn } from "@/lib/utils";

type ToastTone = "success" | "error" | "warning" | "info" | "loading";

const TONE_STYLES: Record<ToastTone, string> = {
  success: "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]",
  error: "bg-destructive-soft text-destructive",
  warning: "bg-warning-soft text-warning",
  info: "bg-[var(--cf-royal-soft)] text-[var(--cf-royal-text)]",
  loading: "bg-[var(--cf-bg-surface)] text-[var(--cf-text-secondary)]",
};

/** Flat, square status glyph that matches the Casefolio dashboard language. */
function ToastGlyph({ tone, children }: { tone: ToastTone; children: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={cn(
        "inline-flex size-6 shrink-0 items-center justify-center rounded-md [&_svg]:size-3.5",
        TONE_STYLES[tone],
      )}
    >
      {children}
    </span>
  );
}

const TOAST_ICONS: ToasterProps["icons"] = {
  success: (
    <ToastGlyph tone="success">
      <Check strokeWidth={3} />
    </ToastGlyph>
  ),
  error: (
    <ToastGlyph tone="error">
      <X strokeWidth={3} />
    </ToastGlyph>
  ),
  warning: (
    <ToastGlyph tone="warning">
      <AlertTriangle />
    </ToastGlyph>
  ),
  info: (
    <ToastGlyph tone="info">
      <Info />
    </ToastGlyph>
  ),
  loading: (
    <ToastGlyph tone="loading">
      <Loader2 className="animate-spin" />
    </ToastGlyph>
  ),
};

const TOAST_STYLE = {
  "--normal-bg": "var(--cf-bg-elevated)",
  "--normal-border": "var(--cf-border-subtle)",
  "--normal-text": "var(--cf-text-primary)",
  "--border-radius": "0.625rem",
  "--width": "372px",
} as CSSProperties;

function Toaster(props: ToasterProps) {
  const { resolvedTheme } = useTheme();
  const theme: ToasterProps["theme"] =
    resolvedTheme === "dark" || resolvedTheme === "light" ? resolvedTheme : "system";

  return (
    <Sonner
      theme={theme}
      position="bottom-right"
      gap={8}
      visibleToasts={4}
      className="cf-toaster"
      icons={TOAST_ICONS}
      style={TOAST_STYLE}
      toastOptions={{
        classNames: {
          toast: "cf-toast",
          title: "cf-toast-title",
          description: "cf-toast-description",
          actionButton: "cf-toast-action",
          cancelButton: "cf-toast-cancel",
        },
      }}
      {...props}
    />
  );
}

export { Toaster, toast };
