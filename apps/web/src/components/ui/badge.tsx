import type { PlanTier } from "@casefolio/db";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 type-caption whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-[var(--cf-bg-surface)] text-[var(--cf-text-secondary)] border border-[var(--cf-lp-card-border)]",
        draft: "bg-warning-soft text-foreground",
        published: "bg-[var(--cf-lp-green-pill-bg)] text-[var(--cf-lp-green-pill-fg)] font-semibold",
        accent: "bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)] border border-[var(--cf-lp-ink)]/15 font-semibold",
        pro: "bg-[var(--cf-lp-dark)] text-[var(--cf-lp-lime)] font-semibold",
        teams: "border border-border-strong bg-[var(--cf-lp-card)] text-foreground font-semibold",
        danger: "bg-destructive-soft text-foreground",
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
      published: "bg-[var(--cf-lp-green-pill-fg)]",
      accent: "bg-[var(--cf-lp-on-lime)]",
      pro: "bg-[var(--cf-lp-lime)]",
      teams: "bg-foreground",
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

function TeamsBadge({ className, ...props }: Omit<BadgeProps, "tone" | "children">) {
  return (
    <Badge tone="teams" className={className} {...props}>
      TEAMS
    </Badge>
  );
}

function PlanTierBadge({
  plan,
  className,
  ...props
}: Omit<BadgeProps, "tone" | "children"> & { plan: PlanTier }) {
  if (plan === "team" || plan === "plus") {
    return <TeamsBadge className={className} {...props} />;
  }
  if (plan === "pro") {
    return <ProBadge className={className} {...props} />;
  }
  return null;
}

export { Badge, badgeVariants, PlanTierBadge, ProBadge, TeamsBadge, type BadgeProps };
