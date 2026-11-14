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
          "flex flex-col gap-3.5 rounded-[1.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4",
          className,
        )}
        {...props}
      >
        <div className="bg-sunken h-48 w-full animate-pulse rounded-2xl" />
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
        "group flex min-w-0 flex-col gap-3.5 rounded-[1.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 text-card-foreground transition-all duration-200 hover:-translate-y-1 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]",
        className,
      )}
      {...props}
    >
      <div className="overflow-hidden rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)]">
        <div
          aria-hidden="true"
          className="flex items-center justify-between border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-2"
        >
          <span className="inline-flex items-center gap-1.5 font-mono text-[0.6875rem] font-semibold tracking-wider text-[var(--cf-text-primary)] uppercase">
            <span className="size-1.5 rounded-full bg-[var(--cf-royal)]" />
            <span>Preview</span>
          </span>
          <span className="text-tertiary font-mono text-[0.6875rem]">
            casefolio.app/p/story
          </span>
        </div>

        <div className="bg-sunken relative h-44 w-full overflow-hidden">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={title}
              className="size-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <>
              <span
                aria-hidden="true"
                className="font-display absolute top-4 left-4 text-2xl font-bold text-[var(--cf-text-primary)] select-none"
              >
                01
              </span>
              <div
                aria-hidden="true"
                className="absolute right-32 bottom-0 h-28 w-24 rounded-t-xl bg-[var(--cf-royal)] transition-transform duration-200 group-hover:-translate-y-1"
              />
              <div
                aria-hidden="true"
                className="absolute right-5 bottom-0 flex h-32 w-26 flex-col gap-2 rounded-t-xl border border-b-0 border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-2.5 transition-transform duration-200 group-hover:-translate-y-1.5"
              >
                <span className="h-2 w-10 rounded-full bg-[var(--cf-bg-accent)]" />
                <span className="bg-sunken h-1.5 w-full rounded-full" />
                <span className="bg-sunken h-1.5 w-3/4 rounded-full" />
              </div>
            </>
          )}
        </div>
      </div>

      <div className="flex min-w-0 flex-col gap-1 px-1 pb-0.5">
        <div className="flex min-w-0 items-center justify-between gap-2">
          <h3 className="v3-heading-s min-w-0 truncate text-[var(--cf-text-primary)] transition-colors group-hover:text-[var(--cf-royal-text)]">
            {title}
          </h3>
          <Badge tone={statusTone}>{statusLabel}</Badge>
        </div>
        <p className="text-muted-foreground type-body-s truncate">{subtitle}</p>
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
        "group relative flex flex-col justify-between gap-6 rounded-[1.5rem] border p-6 transition-all duration-200",
        state === "default" &&
          "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)] hover:-translate-y-1 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]",
        isSelected &&
          "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)] -translate-y-0.5 hover:shadow-[var(--cf-shadow-hover)]",
        isComingSoon &&
          "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-muted-foreground cursor-not-allowed border-dashed",
        className,
      )}
      {...props}
    >
      <div className="flex items-start justify-between gap-4">
        <span
          aria-hidden="true"
          className={cn(
            "inline-flex size-12 items-center justify-center rounded-xl transition-colors",
            state === "default" &&
              "border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]",
            isSelected &&
              "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]",
            isComingSoon && "bg-[var(--cf-bg-elevated)] text-muted-foreground",
          )}
        >
          {icon ?? <Smartphone className="size-5" />}
        </span>

        {isSelected ? (
          <span
            aria-label="Selected"
            className="inline-flex size-6 items-center justify-center rounded-full bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
          >
            <Check className="size-3.5 stroke-[2.5]" />
          </span>
        ) : isComingSoon ? (
          <Badge tone="neutral">Soon</Badge>
        ) : (
          <span
            aria-hidden="true"
            className="border-border-strong inline-flex size-6 rounded-full border transition-colors group-hover:border-[var(--cf-royal)]"
          />
        )}
      </div>

      <div className="flex flex-col gap-2">
        <h3
          className={cn(
            "v3-heading-s",
            isSelected
              ? "text-[var(--cf-text-on-royal)]"
              : isComingSoon
                ? "text-muted-foreground"
                : "text-[var(--cf-text-primary)]",
          )}
        >
          {title}
        </h3>
        <p
          className={cn(
            "v3-body-s",
            isSelected
              ? "text-[var(--cf-text-on-royal-muted)]"
              : "text-muted-foreground",
          )}
        >
          {description}
        </p>
      </div>

      <div
        className={cn(
          "flex items-center justify-between border-t pt-4",
          isSelected ? "border-[var(--cf-border-on-royal)]" : "border-[var(--cf-border-subtle)]",
        )}
      >
        <span
          className={cn(
            "v3-label inline-flex items-center gap-1.5 uppercase",
            isSelected
              ? "text-[var(--cf-bg-accent)]"
              : isComingSoon
                ? "text-muted-foreground"
                : "text-[var(--cf-royal-text)]",
          )}
        >
          <span
            aria-hidden="true"
            className={cn(
              "size-1.5 rounded-full",
              isSelected
                ? "bg-[var(--cf-bg-accent)]"
                : isComingSoon
                  ? "bg-muted-foreground"
                  : "bg-[var(--cf-royal)]",
            )}
          />
          <span>{resolvedFooter}</span>
        </span>
      </div>
    </div>
  );
}

export interface PlanSpecItem {
  label: string;
  value: string;
}

export interface PlanCardProps extends ComponentProps<"section"> {
  name: string;
  price: string;
  period?: string;
  badgeLabel?: string;
  scopeLabel?: string;
  billingNote?: string;
  priceExtra?: ReactNode;
  specs?: readonly PlanSpecItem[];
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
  specs,
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
        "relative flex h-full min-w-0 flex-col justify-between gap-6 rounded-[1.75rem] border p-6 transition-all duration-300 sm:p-8",
        highlighted
          ? "v3-pattern-dots-dark border-[var(--cf-royal)] hover:-translate-y-1 hover:shadow-[var(--cf-shadow-hover)]"
          : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)] hover:-translate-y-1 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]",
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
                    "inline-flex size-10 shrink-0 items-center justify-center rounded-xl [&_svg]:size-4.5",
                    highlighted
                      ? "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
                      : "border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-[var(--cf-text-primary)]",
                  )}
                >
                  {icon}
                </span>
              )}
              <h3
                className={cn(
                  "v3-heading-m truncate",
                  highlighted ? "text-[var(--cf-text-inverse)]" : "text-[var(--cf-text-primary)]",
                )}
              >
                {name}
              </h3>
            </div>
            {highlighted ? (
              <span className="v3-label inline-flex items-center gap-1.5 rounded-full bg-[var(--cf-bg-accent)] px-3 py-1 text-[var(--cf-text-on-accent)] uppercase">
                <span
                  aria-hidden="true"
                  className="size-1.5 rounded-full bg-[var(--cf-text-on-accent)]"
                />
                <span>{resolvedBadge}</span>
              </span>
            ) : (
              <span className="v3-label inline-flex items-center rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-3 py-1 text-[var(--cf-text-primary)] uppercase">
                {resolvedBadge}
              </span>
            )}
          </div>

          {scopeLabel && (
            <p
              className={cn(
                "type-caption",
                highlighted
                  ? "text-[var(--cf-text-inverse-muted)]"
                  : "text-muted-foreground",
              )}
            >
              {scopeLabel}
            </p>
          )}

          <div className="flex flex-col gap-1 pt-1">
            <div className="flex flex-wrap items-baseline gap-1.5">
              <span
                className={cn(
                  "font-display text-4xl leading-none font-bold tracking-tight sm:text-5xl",
                  highlighted ? "text-[var(--cf-text-inverse)]" : "text-[var(--cf-text-primary)]",
                )}
              >
                {price}
              </span>
              {period && (
                <span
                  className={cn(
                    "v3-body-s",
                    highlighted
                      ? "text-[var(--cf-text-inverse-muted)]"
                      : "text-muted-foreground",
                  )}
                >
                  {period}
                </span>
              )}
            </div>
            {billingNote && (
              <p
                className={cn(
                  "type-caption",
                  highlighted
                    ? "text-[var(--cf-text-inverse-muted)]"
                    : "text-muted-foreground",
                )}
              >
                {billingNote}
              </p>
            )}
            {priceExtra}
          </div>
        </div>

        <p
          className={cn(
            "v3-body-s",
            highlighted
              ? "text-[var(--cf-text-inverse-muted)]"
              : "text-muted-foreground",
          )}
        >
          {description}
        </p>

        {ctaHref && !onSelectPlan ? (
          <Button
            variant={highlighted ? "lime" : "default"}
            size="lg"
            className="w-full"
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
            variant={highlighted ? "lime" : "default"}
            size="lg"
            className="w-full"
            onClick={onSelectPlan}
          >
            <span>{ctaLabel}</span>
            <ArrowRight className="size-4" />
          </Button>
        )}

        {specs && specs.length > 0 && (
          <dl className="grid grid-cols-2 gap-2.5">
            {specs.map((spec) => (
              <div
                key={spec.label}
                className={cn(
                  "rounded-xl border px-3.5 py-2.5",
                  highlighted
                    ? "border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)]"
                    : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)]",
                )}
              >
                <dt
                  className={cn(
                    "type-caption",
                    highlighted
                      ? "text-[var(--cf-text-inverse-muted)]"
                      : "text-muted-foreground",
                  )}
                >
                  {spec.label}
                </dt>
                <dd
                  className={cn(
                    "type-body-s-strong mt-0.5 tabular-nums",
                    highlighted
                      ? "text-[var(--cf-text-inverse)]"
                      : "text-[var(--cf-text-primary)]",
                  )}
                >
                  {spec.value}
                </dd>
              </div>
            ))}
          </dl>
        )}

        <div
          className={cn(
            "flex flex-col gap-3 border-t pt-5",
            highlighted
              ? "border-[var(--cf-border-on-royal)]"
              : "border-[var(--cf-border-subtle)]",
          )}
        >
          {featuresHeading && (
            <p
              className={cn(
                "type-overline",
                highlighted
                  ? "text-[var(--cf-bg-accent)]"
                  : "text-[var(--cf-royal-text)]",
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
                      ? "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
                      : "bg-[var(--cf-royal-soft)] text-[var(--cf-royal-text)]",
                  )}
                >
                  <Check className="size-3 stroke-[2.5]" />
                </span>
                <span
                  className={cn(
                    "v3-body-s",
                    highlighted
                      ? "text-[var(--cf-text-inverse)]"
                      : "text-[var(--cf-text-primary)]",
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
                "mt-2 flex flex-col gap-2 border-t pt-4",
                highlighted
                  ? "border-[var(--cf-border-on-royal)]"
                  : "border-[var(--cf-border-subtle)]",
              )}
            >
              <p
                className={cn(
                  "type-overline",
                  highlighted
                    ? "text-[var(--cf-text-inverse-muted)]"
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
      </div>
    </section>
  );
}
