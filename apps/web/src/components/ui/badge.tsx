import type { PlanTier } from "@casefolio/db";
import { cva, type VariantProps } from "class-variance-authority";
import type { ComponentProps } from "react";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 type-caption whitespace-nowrap shrink-0 transition-colors",
  {
    variants: {
      tone: {
        neutral: "bg-sunken text-muted-foreground",
        draft: "bg-warning-soft text-foreground",
        published: "bg-success-soft text-foreground",
        accent: "bg-accent text-accent-foreground font-semibold",
        pro: "bg-brand-lime text-brand-on-lime font-semibold",
        teams: "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)] font-semibold",
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
      published: "bg-success",
      accent: "bg-accent-foreground",
      pro: "bg-brand-on-lime",
      teams: "bg-[var(--cf-bg-accent)]",
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
