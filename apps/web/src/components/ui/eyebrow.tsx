import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps extends ComponentProps<"span"> {
  icon?: ReactNode;
  step?: string;
  tone?: "default" | "accent" | "obsidian";
}

/** Signature Studio pill label shared across marketing and product headers. */
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
        "v3-label inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 uppercase [&_svg]:size-3.5",
        tone === "default" &&
          "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)]",
        tone === "accent" &&
          "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]",
        tone === "obsidian" &&
          "border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] text-[var(--cf-bg-accent)] [&_svg]:text-[var(--cf-bg-accent)]",
        className,
      )}
      {...props}
    >
      {step ? (
        <span
          aria-hidden="true"
          className="rounded-full bg-[var(--cf-bg-accent)] px-1.5 py-0.5 text-[0.625rem] leading-none font-bold text-[var(--cf-text-on-accent)]"
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
            tone === "obsidian" ? "bg-[var(--cf-bg-accent)]" : "bg-[var(--cf-royal)]",
          )}
        />
      )}
      <span>{children}</span>
    </span>
  );
}
