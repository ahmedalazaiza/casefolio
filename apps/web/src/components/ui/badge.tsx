import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 type-caption whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-muted-foreground",
        draft: "bg-warning-soft text-warning",
        published: "bg-success-soft text-success",
        accent: "bg-accent text-accent-foreground",
        pro: "bg-secondary text-foreground",
        danger: "bg-destructive-soft text-destructive",
      },
    },
    defaultVariants: {
      tone: "neutral",
    },
  },
);

const dotVariants = cva("size-1.5 rounded-full shrink-0", {
  variants: {
    tone: {
      neutral: "bg-muted-foreground",
      draft: "bg-warning",
      published: "bg-success",
      accent: "bg-accent-foreground",
      pro: "bg-foreground",
      danger: "bg-destructive",
    },
  },
  defaultVariants: {
    tone: "neutral",
  },
});

type BadgeProps = ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & {
    withDot?: boolean;
  };

function Badge({ className, tone = "neutral", withDot = true, children, ...props }: BadgeProps) {
  return (
    <span data-slot="badge" className={cn(badgeVariants({ tone }), className)} {...props}>
      {withDot && <span aria-hidden="true" className={dotVariants({ tone })} />}
      {children}
    </span>
  );
}

function ProBadge({ className, ...props }: Omit<BadgeProps, "tone" | "children">) {
  return (
    <Badge tone="pro" className={className} {...props}>
      Pro
    </Badge>
  );
}

export { Badge, badgeVariants, ProBadge, type BadgeProps };

