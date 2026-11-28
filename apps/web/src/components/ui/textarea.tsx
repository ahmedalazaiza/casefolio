import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-[var(--cf-lp-input-border)] bg-[var(--cf-lp-input-bg)] text-foreground placeholder:text-tertiary selection:bg-primary selection:text-primary-foreground flex min-h-24 w-full min-w-0 rounded-[0.375rem] border px-3.5 py-2.5 text-[0.8125rem] transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-tertiary disabled:opacity-70",
        "focus-visible:border-[var(--cf-lp-ink)] focus-visible:ring-ring/20 focus-visible:ring-2",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

