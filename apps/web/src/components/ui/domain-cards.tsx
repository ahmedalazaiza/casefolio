import { Check, Smartphone, X } from "lucide-react";
import Link from "next/link";
import type { ComponentProps, ReactNode } from "react";
import { Badge, type BadgeProps } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export interface ProjectCardProps extends ComponentProps<"article"> {
  title?: string;
  subtitle?: string;
  statusLabel?: string;
  statusTone?: BadgeProps["tone"];
  thumbnailUrl?: string | null;
  skeleton?: boolean;
}

export function ProjectCard({
  title = "Mosaed — Debt app",
  subtitle = "Mobile app · Edited 2h ago",
  statusLabel = "Draft",
  statusTone = "draft",
  thumbnailUrl,
  skeleton = false,
  className,
  ...props
}: ProjectCardProps) {
  if (skeleton) {
    return (
      <article
        data-slot="project-card"
        data-state="skeleton"
        aria-busy="true"
        className={cn(
          "border-border bg-card flex flex-col gap-3 rounded-xl border p-3",
          className,
        )}
        {...props}
      >
        <div className="bg-sunken h-48 w-full animate-pulse rounded-lg" />
        <div className="flex flex-col gap-2 px-1 py-1">
          <div className="bg-sunken h-4 w-3/5 animate-pulse rounded-xs" />
          <div className="bg-sunken h-3.5 w-2/5 animate-pulse rounded-xs" />
        </div>
      </article>
    );
  }

  return (
    <article
      data-slot="project-card"
      data-state="default"
      className={cn(
        "border-border bg-card text-card-foreground shadow-card hover:border-border-strong group flex min-w-0 flex-col gap-3 rounded-xl border p-3 transition-colors",
        className,
      )}
      {...props}
    >
      <div className="bg-sunken relative h-48 w-full overflow-hidden rounded-lg">
        {thumbnailUrl ? (
          <img
            src={thumbnailUrl}
            alt={title}
            className="size-full object-cover"
          />
        ) : (
          <>
            <span
              aria-hidden="true"
              className="text-foreground type-heading-l absolute top-5 left-5 select-none"
            >
              Aa
            </span>
            <div
              aria-hidden="true"
              className="bg-foreground/85 absolute right-36 bottom-0 h-32 w-24 rounded-t-lg transition-transform duration-200 group-hover:-translate-y-0.5"
            />
            <div
              aria-hidden="true"
              className="bg-elevated shadow-card border-border/60 absolute right-6 bottom-0 h-36 w-26 rounded-t-lg border border-b-0 transition-transform duration-200 group-hover:-translate-y-1"
            />
          </>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1 px-1.5 pb-1">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="text-foreground type-heading-s min-w-0 truncate">{title}</h3>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
        <p className="text-tertiary type-body-s truncate">{subtitle}</p>
      </div>
    </article>
  );
}

export type TemplateTypeCardState = "default" | "selected" | "coming-soon";

export interface TemplateTypeCardProps extends ComponentProps<"div"> {
  title: string;
  description: string;
  templateCount?: number;
  footerLabel?: string;
  state?: TemplateTypeCardState;
  icon?: ReactNode;
}

export function TemplateTypeCard({
  title,
  description,
  templateCount = 2,
  footerLabel,
  state = "default",
  icon,
  className,
  ...props
}: TemplateTypeCardProps) {
  const isSelected = state === "selected";
  const isComingSoon = state === "coming-soon";
  const resolvedFooter =
    footerLabel ?? `${templateCount} ${templateCount === 1 ? "template" : "templates"}`;

  return (
    <div
      data-slot="template-type-card"
      data-state={state}
      aria-disabled={isComingSoon ? true : undefined}
      className={cn(
        "flex flex-col justify-between gap-6 rounded-xl border p-6 transition-colors",
        state === "default" &&
          "border-border bg-card text-card-foreground hover:border-border-strong",
        isSelected && "border-primary bg-card text-card-foreground shadow-card border-2",
        isComingSoon && "border-border bg-sunken text-muted-foreground cursor-not-allowed",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-md",
            state === "default" && "bg-accent text-accent-foreground",
            isSelected && "bg-primary text-primary-foreground",
            isComingSoon && "bg-elevated text-muted-foreground",
          )}
        >
          {icon ?? <Smartphone className="size-5" />}
        </span>

        {isSelected ? (
          <span
            aria-label="Selected"
            className="bg-primary text-primary-foreground inline-flex size-6 items-center justify-center rounded-full"
          >
            <Check className="size-3.5" />
          </span>
        ) : isComingSoon ? (
          <Badge tone="neutral">Soon</Badge>
        ) : (
          <span
            aria-hidden="true"
            className="border-border-strong inline-flex size-6 rounded-full border"
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3
          className={cn(
            "type-heading-m",
            isComingSoon ? "text-muted-foreground" : "text-foreground",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "type-body-s",
            isComingSoon ? "text-muted-foreground" : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </div>

      <div className="border-border border-t pt-4">
        <span className="text-muted-foreground type-overline">{resolvedFooter}</span>
      </div>
    </div>
  );
}

export interface PlanCardProps extends ComponentProps<"section"> {
  name: string;
  price: string;
  period?: string;
  badgeLabel?: string;
  scopeLabel?: string;
  billingNote?: string;
  priceExtra?: ReactNode;
  description: string;
  ctaLabel?: string;
  ctaHref?: string;
  featuresHeading?: string;
  features: readonly string[];
  excludedFeatures?: readonly string[];
  icon?: ReactNode;
  highlighted?: boolean;
  onSelectPlan?: () => void;
}

export function PlanCard({
  name,
  price,
  period = "/mo",
  badgeLabel,
  scopeLabel,
  billingNote,
  priceExtra,
  description,
  ctaLabel = "Choose plan",
  ctaHref,
  featuresHeading,
  features,
  excludedFeatures,
  icon,
  highlighted = false,
  onSelectPlan,
  className,
  ...props
}: PlanCardProps) {
  const resolvedBadge = badgeLabel ?? (highlighted ? "Popular" : "Monthly");

  return (
    <section
      data-slot="plan-card"
      data-highlighted={highlighted ? "true" : "false"}
      className={cn(
        "bg-elevated text-card-foreground relative flex h-full min-w-0 flex-col justify-between gap-6 rounded-2xl border p-6 transition-colors duration-200 sm:p-7",
        highlighted
          ? "border-primary shadow-card ring-primary/20 ring-1"
          : "border-border hover:border-border-strong",
        className,
      )}
      {...props}
    >
      <div className="flex flex-col gap-5">
        {/* Top identity + price header */}
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              {icon && (
                <span
                  aria-hidden="true"
                  className={cn(
                    "inline-flex size-9 shrink-0 items-center justify-center rounded-lg border [&_svg]:size-4",
                    highlighted
                      ? "border-primary/30 bg-accent text-accent-foreground"
                      : "border-border bg-surface text-foreground",
                  )}
                >
                  {icon}
                </span>
              )}
              <h3 className="type-heading-m text-foreground truncate">{name}</h3>
            </div>
            <Badge tone={highlighted ? "accent" : "neutral"} withDot={highlighted}>
              {resolvedBadge}
            </Badge>
          </div>

          {scopeLabel && (
            <p className="text-muted-foreground type-caption">{scopeLabel}</p>
          )}

          <div className="flex flex-col gap-1 pt-1">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span className="font-display text-foreground text-3xl leading-none font-medium tracking-tight sm:text-4xl">
                {price}
              </span>
              {period && (
                <span className="text-muted-foreground type-body-s">
                  {period}
                </span>
              )}
            </div>
            {billingNote && (
              <p className="text-muted-foreground type-caption">{billingNote}</p>
            )}
            {priceExtra}
          </div>
        </div>

        <p className="text-muted-foreground type-body-s">{description}</p>

        {ctaHref && !onSelectPlan ? (
          <Button
            variant={highlighted ? "accent" : "default"}
            size="lg"
            className="w-full"
            asChild
          >
            <Link href={ctaHref}>{ctaLabel}</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant={highlighted ? "accent" : "default"}
            size="lg"
            className="w-full"
            onClick={onSelectPlan}
          >
            {ctaLabel}
          </Button>
        )}

        <div className="border-border flex flex-col gap-3 border-t pt-5">
          {featuresHeading && (
            <p className="text-muted-foreground type-overline">
              {featuresHeading}
            </p>
          )}

          <ul className="flex flex-col gap-2.5">
            {features.map((feature) => (
              <li key={feature} className="flex items-start gap-2.5">
                <span
                  aria-hidden="true"
                  className={cn(
                    "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                    highlighted
                      ? "bg-accent text-accent-foreground"
                      : "bg-success-soft text-success",
                  )}
                >
                  <Check className="size-3" />
                </span>
                <span className="text-foreground type-body-s">{feature}</span>
              </li>
            ))}
          </ul>

          {excludedFeatures && excludedFeatures.length > 0 && (
            <div className="border-border mt-2 flex flex-col gap-2 border-t pt-4">
              <p className="text-muted-foreground type-overline">
                Not included
              </p>
              <ul className="flex flex-col gap-2">
                {excludedFeatures.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className="bg-sunken text-muted-foreground mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
                    >
                      <X className="size-3" />
                    </span>
                    <span className="text-muted-foreground type-body-s">
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
