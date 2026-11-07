import type { ComponentProps, ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface EyebrowProps extends ComponentProps<"span"> {
  icon?: ReactNode;
}

/** Soft pill label that sits above every marketing section heading. */
export function Eyebrow({ icon, className, children, ...props }: EyebrowProps) {
  return (
    <span
      data-slot="eyebrow"
      className={cn(
        "border-border/70 bg-elevated/80 text-foreground type-caption inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 shadow-xs backdrop-blur-sm [&_svg]:size-3.5",
        className,
      )}
      {...props}
    >
      {icon}
      <span>{children}</span>
    </span>
  );
}
