import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

function Textarea({ className, ...props }: ComponentProps<"textarea">) {
  return (
    <textarea
      data-slot="textarea"
      className={cn(
        "border-input bg-elevated text-foreground placeholder:text-tertiary selection:bg-primary selection:text-primary-foreground flex min-h-24 w-full min-w-0 rounded-lg border px-4 py-2.5 type-body-m transition-colors outline-none disabled:pointer-events-none disabled:cursor-not-allowed disabled:bg-surface disabled:text-tertiary disabled:opacity-70",
        "focus-visible:border-ring focus-visible:ring-ring/20 focus-visible:ring-2",
        "aria-invalid:border-destructive aria-invalid:ring-destructive/15",
        className,
      )}
      {...props}
    />
  );
}

export { Textarea };

