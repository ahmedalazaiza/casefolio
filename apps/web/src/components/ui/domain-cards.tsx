import { ArrowRight, Check, Smartphone, X } from "lucide-react";
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
          "flex flex-col overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)]",
          className,
        )}
        {...props}
      >
        <div className="bg-sunken h-44 w-full animate-pulse" />
        <div className="flex flex-col gap-2 p-4">
          <div className="bg-sunken h-3 w-16 animate-pulse rounded-xs" />
          <div className="bg-sunken h-4 w-3/5 animate-pulse rounded-xs" />
          <div className="bg-sunken h-3 w-2/5 animate-pulse rounded-xs" />
        </div>
      </article>
    );
  }

  return (
    <article
      data-slot="project-card"
      data-state="default"
      className={cn(
        "group flex min-w-0 flex-col overflow-hidden rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] text-card-foreground transition-colors duration-200 hover:border-[var(--cf-lp-ink)]",
        className,
      )}
      {...props}
    >
      <div className="relative h-44 w-full overflow-hidden border-b border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-lime)] p-4 text-[var(--cf-lp-on-lime)]">
        {thumbnailUrl ? (
          <img
            loading="lazy"
            decoding="async"
            src={thumbnailUrl}
            alt={title}
            className="absolute inset-0 size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="flex h-full items-center justify-between gap-3">
            <div className="flex flex-col justify-between self-stretch">
              <span className="font-mono text-[0.5625rem] font-medium tracking-[0.1em] text-[var(--cf-lp-on-lime)] uppercase opacity-75">
                CASEFOLIO / STORY
              </span>
              <p className="font-editorial max-w-[10rem] text-[1.375rem] leading-[1.02] tracking-[-0.03em] text-[var(--cf-lp-on-lime)]">
                Move freely. Live fully.
              </p>
            </div>
            <div
              aria-hidden="true"
              className="flex h-36 w-24 shrink-0 rotate-3 flex-col justify-between rounded-[0.625rem] border border-[var(--cf-lp-ink)] bg-[var(--cf-lp-card)] p-2.5 transition-transform duration-200 group-hover:-translate-y-1"
            >
              <span className="font-mono text-[0.5rem] tracking-[0.08em] text-[var(--cf-lp-subtle)] uppercase">
                MOBILE
              </span>
              <span className="h-2 w-10 rounded-full bg-[var(--cf-lp-dark)]" />
              <span className="h-1.5 w-full rounded-full bg-[var(--cf-bg-surface)]" />
              <span className="h-5 w-full rounded-[0.25rem] bg-[var(--cf-lp-dark)]" />
            </div>
          </div>
        )}
      </div>

      <div className="flex min-w-0 flex-col gap-1.5 p-4">
        <span className="font-mono text-[0.625rem] tracking-[0.11em] text-[var(--cf-lp-kicker-muted)] uppercase">
          CASE STUDY
        </span>
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="v3-dashboard-card-title min-w-0 truncate text-[var(--cf-lp-ink)] transition-colors group-hover:underline">
            {title}
          </h3>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
        <p className="truncate text-[0.75rem] text-[var(--cf-lp-subtle)]">{subtitle}</p>
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
        "group relative flex flex-col justify-between gap-4 rounded-[0.5625rem] border p-5 transition-colors duration-200",
        state === "default" &&
          "border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] text-[var(--cf-text-primary)] hover:border-[var(--cf-lp-ink)]",
        isSelected &&
          "border-[var(--cf-lp-ink)] bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]",
        isComingSoon &&
          "border-[var(--cf-lp-card-border)] bg-[var(--cf-bg-surface)] text-muted-foreground cursor-not-allowed border-dashed",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-10 items-center justify-center rounded-xl transition-colors",
            state === "default" &&
              "border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]",
            isSelected &&
              "bg-[var(--cf-lp-action)] text-[var(--cf-lp-on-action)]",
            isComingSoon && "bg-[var(--cf-bg-elevated)] text-muted-foreground",
          )}
        >
          {icon ?? <Smartphone className="size-5" />}
        </span>

        {isSelected ? (
          <span
            aria-label="Selected"
            className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--cf-lp-action)] text-[var(--cf-lp-on-action)]"
          >
            <Check className="size-3.5 stroke-[2.5]" />
          </span>
        ) : isComingSoon ? (
          <Badge tone="neutral">Soon</Badge>
        ) : (
          <span
            aria-hidden="true"
            className="border-border-strong inline-flex size-6 rounded-full border transition-colors group-hover:border-[var(--cf-lp-ink)]"
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3
          className={cn(
            "v3-heading-s",
            isComingSoon ? "text-muted-foreground" : "text-[var(--cf-text-primary)]",
          )}
        >
          {title}
        </h3>
        <p className="v3-body-s text-muted-foreground">{description}</p>
      </div>

      <div className="flex items-center justify-between border-t border-[var(--cf-border-subtle)] pt-4">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 text-xs font-medium",
            isComingSoon ? "text-muted-foreground" : "text-[var(--cf-text-secondary)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              isSelected
                ? "bg-[var(--cf-lp-ink)]"
                : isComingSoon
                  ? "bg-muted-foreground"
                  : "bg-[var(--cf-text-tertiary)]",
            )}
          />
          <span>{resolvedFooter}</span>
        </span>
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
  ctaDisabled?: boolean;
  alignCtaRow?: boolean;
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
  ctaDisabled = false,
  alignCtaRow = false,
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

  const nonHighlightedBtnClasses =
    "border border-[var(--cf-lp-plan-btn-border)] bg-[var(--cf-lp-plan-btn-bg)] text-[var(--cf-lp-plan-btn-fg)] hover:border-[var(--cf-lp-ink)] hover:bg-[var(--cf-lp-plan-btn-hover-bg)]";

  return (
    <section
      data-slot="plan-card"
      data-highlighted={highlighted ? "true" : "false"}
      className={cn(
        "relative flex h-full min-w-0 flex-col rounded-[0.625rem] border p-6 transition-colors duration-200 lg:p-7",
        alignCtaRow ? "lg:row-span-4 lg:grid lg:grid-rows-subgrid" : "justify-between",
        highlighted
          ? "border-[var(--cf-lp-plan-pro-border)] bg-[var(--cf-lp-plan-pro-bg)] text-[var(--cf-lp-dark-ink)] shadow-[0_18px_40px_-14px_rgba(32,33,29,0.45)]"
          : "border-[var(--cf-lp-plan-card-border)] bg-[var(--cf-lp-plan-card-bg)] text-[var(--cf-text-primary)] shadow-[0_1px_2px_rgba(32,33,29,0.06)] hover:border-[var(--cf-lp-ink)]",
        className,
      )}
      {...props}
    >
      {/* Row 1: Identity, Scope & Headline Price */}
      <div className="flex flex-col gap-3">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <div className="flex min-w-0 items-center gap-2.5">
            {icon && (
              <span
                aria-hidden="true"
                className={cn(
                  "inline-flex size-9 shrink-0 items-center justify-center rounded-xl border [&_svg]:size-4",
                  highlighted
                    ? "border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] text-[var(--cf-lp-lime)]"
                    : "border-[var(--cf-lp-border)] bg-[var(--cf-lp-surface)] text-[var(--cf-lp-ink)]",
                )}
              >
                {icon}
              </span>
            )}
            <h3
              className={cn(
                "v3-heading-m truncate",
                highlighted ? "text-[var(--cf-lp-dark-ink)]" : "text-[var(--cf-lp-ink)]",
              )}
            >
              {name}
            </h3>
          </div>
          {highlighted ? (
            <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[var(--cf-lp-lime)] px-3 py-1 text-xs font-semibold text-[var(--cf-lp-on-lime)]">
              <span>{resolvedBadge}</span>
            </span>
          ) : (
            <span className="inline-flex shrink-0 items-center rounded-full border border-[var(--cf-lp-border)] bg-[var(--cf-lp-surface)] px-3 py-1 text-xs font-medium text-[var(--cf-lp-muted)]">
              {resolvedBadge}
            </span>
          )}
        </div>

        {scopeLabel && (
          <p
            className={cn(
              "type-caption",
              highlighted ? "text-[var(--cf-lp-dark-muted)]" : "text-[var(--cf-lp-muted)]",
            )}
          >
            {scopeLabel}
          </p>
        )}

        <div className="flex flex-col gap-1.5 pt-1">
          <div className="flex flex-wrap items-baseline gap-1.5">
            <span
              data-testid="plan-card-price"
              className={cn(
                "font-editorial text-4xl leading-none font-normal tracking-tight tabular-nums sm:text-5xl",
                highlighted ? "text-[var(--cf-lp-dark-ink)]" : "text-[var(--cf-lp-ink)]",
              )}
            >
              {price}
            </span>
            {period && (
              <span
                data-testid="plan-card-period"
                className={cn(
                  "v3-body-s",
                  highlighted ? "text-[var(--cf-lp-dark-muted)]" : "text-[var(--cf-lp-muted)]",
                )}
              >
                {period}
              </span>
            )}
          </div>
          {billingNote && (
            <p
              className={cn(
                "type-caption leading-snug",
                highlighted ? "text-[var(--cf-lp-dark-muted)]" : "text-[var(--cf-lp-muted)]",
              )}
            >
              {billingNote}
            </p>
          )}
        </div>
      </div>

      {/* Row 2: Description & Optional Inline Control (e.g. Teams Seat Stepper) */}
      <div className="flex flex-col justify-between gap-4 pt-4 pb-5">
        <p
          className={cn(
            "v3-body-s leading-relaxed",
            highlighted ? "text-[var(--cf-lp-dark-list)]" : "text-[var(--cf-lp-muted)]",
          )}
        >
          {description}
        </p>
        {priceExtra}
      </div>

      {/* Row 3: Aligned Primary CTA Button & Section Divider */}
      <div
        className={cn(
          "border-b pb-6",
          highlighted ? "border-[var(--cf-lp-dark-rule)]" : "border-[var(--cf-lp-border)]",
        )}
      >
        {ctaHref && !onSelectPlan && !ctaDisabled ? (
          <Button
            variant={highlighted ? "lime" : "secondary"}
            size="lg"
            className={cn("w-full", !highlighted && nonHighlightedBtnClasses)}
            asChild
          >
            <Link href={ctaHref}>
              <span>{ctaLabel}</span>
              <ArrowRight className="size-4" />
            </Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant={highlighted ? "lime" : "secondary"}
            size="lg"
            className={cn("w-full", !highlighted && nonHighlightedBtnClasses)}
            disabled={ctaDisabled}
            onClick={onSelectPlan}
          >
            <span>{ctaLabel}</span>
            {!ctaDisabled && <ArrowRight className="size-4" />}
          </Button>
        )}
      </div>

      {/* Row 4: Features List & Optional Excluded Section */}
      <div className="flex flex-1 flex-col gap-3.5 pt-5">
        {featuresHeading && (
          <p
            className={cn(
              "type-overline font-semibold",
              highlighted
                ? "text-[var(--cf-lp-lime)]"
                : "text-[var(--cf-lp-ink)]",
            )}
          >
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
                    ? "bg-[var(--cf-lp-lime)] text-[var(--cf-lp-on-lime)]"
                    : "border border-[var(--cf-lp-green-pill-bg)] bg-[var(--cf-lp-green-pill-bg)] text-[var(--cf-lp-green-pill-fg)]",
                )}
              >
                <Check className="size-3 stroke-[2.5]" />
              </span>
              <span
                className={cn(
                  "v3-body-s leading-snug",
                  highlighted
                    ? "text-[var(--cf-lp-dark-ink)]"
                    : "text-[var(--cf-lp-ink)]",
                )}
              >
                {feature}
              </span>
            </li>
          ))}
        </ul>

        {excludedFeatures && excludedFeatures.length > 0 && (
          <div
            className={cn(
              "mt-auto flex flex-col gap-2 border-t pt-4",
              highlighted
                ? "border-[var(--cf-lp-dark-rule)]"
                : "border-[var(--cf-lp-border)]",
            )}
          >
            <p
              className={cn(
                "type-overline",
                highlighted
                  ? "text-[var(--cf-lp-dark-muted)]"
                  : "text-muted-foreground",
              )}
              >
                Not included
              </p>
              <ul className="flex flex-col gap-2">
                {excludedFeatures.map((item) => (
                  <li key={item} className="flex items-start gap-2.5">
                    <span
                      aria-hidden="true"
                      className={cn(
                        "mt-0.5 inline-flex size-5 shrink-0 items-center justify-center rounded-full",
                        highlighted
                          ? "border border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] text-[var(--cf-text-inverse-muted)]"
                          : "bg-sunken text-muted-foreground",
                      )}
                    >
                      <X className="size-3" />
                    </span>
                    <span
                      className={cn(
                        "type-body-s",
                        highlighted
                          ? "text-[var(--cf-text-inverse-muted)]"
                          : "text-muted-foreground",
                      )}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
      </div>
    </section>
  );
}
