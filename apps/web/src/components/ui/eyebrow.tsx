import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps extends ComponentProps<"span"> {
  icon?: ReactNode;
  step?: string;
  tone?: "default" | "accent" | "obsidian";
}

/** Editorial mono kicker label shared across marketing and product headers. */
export function Eyebrow({
  icon,
  step,
  tone = "default",
  className,
  children,
  ...props
}: EyebrowProps) {
  return (
    <span
      data-slot="eyebrow"
      className={cn(
        "inline-flex items-center gap-2 rounded-[0.3125rem] border px-3 py-1 font-mono text-[0.6875rem] font-medium tracking-[0.11em] uppercase [&_svg]:size-3.5",
        tone === "default" &&
          "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-secondary)]",
        tone === "accent" &&
          "border-[var(--cf-lp-ink)]/15 bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]",
        tone === "obsidian" &&
          "border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] text-[var(--cf-text-inverse)]",
        className,
      )}
      {...props}
    >
      {step ? (
        <span
          aria-hidden="true"
          className={cn(
            "rounded-[0.1875rem] px-1.5 py-0.5 font-mono text-[0.625rem] leading-none font-medium",
            tone === "obsidian"
              ? "bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]"
              : "bg-[var(--cf-lp-dark)] text-[var(--cf-lp-lime)]",
          )}
        >
          {step}
        </span>
      ) : icon ? (
        icon
      ) : (
        <span
          aria-hidden="true"
          className={cn(
            "size-1.5 shrink-0 rounded-full",
            tone === "obsidian"
              ? "bg-[var(--cf-lp-lime)]"
              : "bg-[var(--cf-lp-ink)]",
          )}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
