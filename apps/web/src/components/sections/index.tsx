import type { PuckContext } from "@puckeditor/core";
import type { CSSProperties } from "react";
import { ImageSlotFrame } from "@/components/sections/image-slot-frame";
import { RichTextView } from "@/components/sections/rich-text-view";
import type {
  ImageSlotValue,
  RichTextValue,
  TemplateProjectType,
  TemplateSlotDefinition,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export interface CasefolioRenderMetadata {
  projectType?: TemplateProjectType;
  slots?: Record<string, TemplateSlotDefinition>;
}

function readRenderMetadata(puck?: PuckContext): CasefolioRenderMetadata {
  if (!puck?.metadata || typeof puck.metadata !== "object") {
    return {};
  }
  const raw = puck.metadata as Record<string, unknown>;
  return {
    projectType:
      raw.projectType === "mobile" || raw.projectType === "web" || raw.projectType === "both"
        ? raw.projectType
        : undefined,
    slots:
      raw.slots && typeof raw.slots === "object"
        ? (raw.slots as Record<string, TemplateSlotDefinition>)
        : undefined,
  };
}

function tokenColorVar(token: string | undefined, fallbackVar: string): string {
  const safeToken = token && token.trim().length > 0 ? token.trim() : "background";
  return `var(--tpl-color-${safeToken}, var(${fallbackVar}))`;
}

function buildSectionSurfaceStyle(backgroundToken?: string): CSSProperties {
  const isAccentFill = backgroundToken === "primary" || backgroundToken === "accent";
  return {
    backgroundColor: tokenColorVar(backgroundToken, "--background"),
    color: isAccentFill
      ? "var(--tpl-color-text, var(--primary-foreground))"
      : "var(--tpl-color-text, var(--foreground))",
    fontFamily: "var(--tpl-font-body, var(--font-sans))",
  };
}

const HEADING_FONT_STYLE: CSSProperties = {
  fontFamily: "var(--tpl-font-heading, var(--font-display))",
};

const MUTED_TEXT_STYLE: CSSProperties = {
  color: "var(--tpl-color-textMuted, var(--muted-foreground))",
};

function getSlotDefinition(
  slots: Record<string, TemplateSlotDefinition> | undefined,
  image: ImageSlotValue | undefined,
  fallbackKey: string,
): TemplateSlotDefinition | undefined {
  if (!slots) return undefined;
  const key = image?.slot || fallbackKey;
  return slots[key];
}

export interface HeroSectionProps {
  id: string;
  hidden?: boolean;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  logo?: ImageSlotValue;
  mockup?: ImageSlotValue;
  background: string;
  accent?: string;
  puck?: PuckContext;
}

export function HeroSection({
  id,
  hidden,
  eyebrow,
  title,
  subtitle,
  logo,
  mockup,
  background,
  accent = "primary",
  puck,
}: HeroSectionProps) {
  if (hidden) return null;

  const { projectType = "mobile", slots } = readRenderMetadata(puck);
  const logoSlot = getSlotDefinition(slots, logo, "hero.logo");
  const mockupSlot = getSlotDefinition(slots, mockup, "hero.mockup");
  const isWebVariant = projectType === "web" || mockupSlot?.device === "browser";
  const resolvedVariant = isWebVariant ? "web" : projectType;

  return (
    <section
      id={id}
      data-section-type="Hero"
      data-variant={resolvedVariant}
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16 lg:py-20"
    >
      <div
        className={cn(
          "mx-auto max-w-6xl",
          isWebVariant
            ? "flex flex-col items-center gap-10 text-center"
            : "grid items-center gap-10 lg:grid-cols-12",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-5",
            isWebVariant ? "max-w-3xl items-center" : "lg:col-span-7",
          )}
        >
          <div className="flex flex-wrap items-center gap-3">
            {logo && (
              <div className="w-12 shrink-0">
                <ImageSlotFrame
                  image={logo}
                  slotDefinition={logoSlot}
                  fallbackRatio="1:1"
                  compact
                  className="rounded-lg"
                />
              </div>
            )}
            {eyebrow && (
              <span
                style={{
                  backgroundColor: tokenColorVar("surface", "--surface"),
                  color: tokenColorVar(accent, "--primary"),
                }}
                className="border-border/30 type-overline inline-flex items-center rounded-full border px-3.5 py-1"
              >
                {eyebrow}
              </span>
            )}
          </div>

          <h1 style={HEADING_FONT_STYLE} className="type-display-l">
            {title}
          </h1>

          {subtitle && (
            <p style={MUTED_TEXT_STYLE} className="type-body-l max-w-2xl">
              {subtitle}
            </p>
          )}
        </div>

        {mockup && (
          <div className={cn("w-full", isWebVariant ? "max-w-5xl" : "lg:col-span-5")}>
            <ImageSlotFrame
              image={mockup}
              slotDefinition={mockupSlot}
              fallbackRatio={isWebVariant ? "16:10" : "9:19.5"}
              projectType={projectType}
              preferDeviceChrome
            />
          </div>
        )}
      </div>
    </section>
  );
}

export interface OverviewSectionProps {
  id: string;
  hidden?: boolean;
  heading: string;
  summary: RichTextValue;
  meta?: Array<{ label: string; value: string }>;
  banner?: ImageSlotValue;
  background: string;
  puck?: PuckContext;
}

export function OverviewSection({
  id,
  hidden,
  heading,
  summary,
  meta = [],
  banner,
  background,
  puck,
}: OverviewSectionProps) {
  if (hidden) return null;

  const { projectType, slots } = readRenderMetadata(puck);
  const bannerSlot = getSlotDefinition(slots, banner, "overview.banner");

  return (
    <section
      id={id}
      data-section-type="Overview"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="grid gap-8 lg:grid-cols-12">
          <div className="flex flex-col gap-4 lg:col-span-7">
            <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
              {heading}
            </h2>
            <RichTextView
              value={summary}
              idPrefix={id}
              style={MUTED_TEXT_STYLE}
              className="type-body-l"
            />
          </div>

          {meta.length > 0 && (
            <dl className="grid grid-cols-2 gap-4 self-start lg:col-span-5">
              {meta.map((item, idx) => (
                <div
                  key={`${id}-meta-${idx}`}
                  style={{ backgroundColor: tokenColorVar("background", "--surface") }}
                  className="border-border/25 flex flex-col gap-1 rounded-lg border p-4"
                >
                  <dt style={MUTED_TEXT_STYLE} className="type-overline">
                    {item.label}
                  </dt>
                  <dd className="type-body-m-strong">{item.value}</dd>
                </div>
              ))}
            </dl>
          )}
        </div>

        {banner && (
          <ImageSlotFrame
            image={banner}
            slotDefinition={bannerSlot}
            fallbackRatio="16:9"
            projectType={projectType}
          />
        )}
      </div>
    </section>
  );
}

export interface ProblemSectionProps {
  id: string;
  hidden?: boolean;
  heading: string;
  statement: string;
  painPoints: Array<{ title: string; body: string }>;
  background: string;
}

export function ProblemSection({
  id,
  hidden,
  heading,
  statement,
  painPoints = [],
  background,
}: ProblemSectionProps) {
  if (hidden) return null;

  return (
    <section
      id={id}
      data-section-type="Problem"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex max-w-3xl flex-col gap-3">
          <span style={MUTED_TEXT_STYLE} className="type-overline">
            {heading}
          </span>
          <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
            {statement}
          </h2>
        </div>

        <div className="grid gap-5 md:grid-cols-3">
          {painPoints.map((point, idx) => (
            <article
              key={`${id}-pain-${idx}`}
              style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
              className="border-border/25 flex flex-col gap-2.5 rounded-xl border p-6"
            >
              <span
                style={{ color: tokenColorVar("primary", "--primary") }}
                className="type-overline font-mono"
              >
                0{idx + 1}
              </span>
              <h3 style={HEADING_FONT_STYLE} className="type-heading-s">
                {point.title}
              </h3>
              <p style={MUTED_TEXT_STYLE} className="type-body-s">
                {point.body}
              </p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export interface ProcessSectionProps {
  id: string;
  hidden?: boolean;
  heading: string;
  steps: Array<{
    number: string;
    title: string;
    body: string;
    image?: ImageSlotValue;
  }>;
  background: string;
  puck?: PuckContext;
}

export function ProcessSection({
  id,
  hidden,
  heading,
  steps = [],
  background,
  puck,
}: ProcessSectionProps) {
  if (hidden) return null;

  const { projectType, slots } = readRenderMetadata(puck);

  return (
    <section
      id={id}
      data-section-type="Process"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
          {heading}
        </h2>

        <div className="grid gap-6 md:grid-cols-2">
          {steps.map((step, idx) => {
            const stepSlot = getSlotDefinition(slots, step.image, "process.step.image");
            return (
              <article
                key={`${id}-step-${idx}`}
                style={{ backgroundColor: tokenColorVar("background", "--background") }}
                className="border-border/25 flex flex-col justify-between gap-5 rounded-xl border p-6"
              >
                <div className="flex flex-col gap-2">
                  <span
                    style={{ color: tokenColorVar("primary", "--primary") }}
                    className="type-overline font-mono"
                  >
                    {step.number}
                  </span>
                  <h3 style={HEADING_FONT_STYLE} className="type-heading-m">
                    {step.title}
                  </h3>
                  <p style={MUTED_TEXT_STYLE} className="type-body-m">
                    {step.body}
                  </p>
                </div>

                {step.image && (
                  <ImageSlotFrame
                    image={step.image}
                    slotDefinition={stepSlot}
                    fallbackRatio="4:3"
                    projectType={projectType}
                  />
                )}
              </article>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export interface ScreensGallerySectionProps {
  id: string;
  hidden?: boolean;
  heading: string;
  columns?: 2 | 3 | 4;
  screens: Array<{
    caption: string;
    image: ImageSlotValue;
  }>;
  background: string;
  puck?: PuckContext;
}

export function ScreensGallerySection({
  id,
  hidden,
  heading,
  columns = 3,
  screens = [],
  background,
  puck,
}: ScreensGallerySectionProps) {
  if (hidden) return null;

  const { projectType = "mobile", slots } = readRenderMetadata(puck);
  const gridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      id={id}
      data-section-type="ScreensGallery"
      data-variant={projectType}
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
          {heading}
        </h2>

        <div className={cn("grid gap-8", gridClass)}>
          {screens.map((item, idx) => {
            const screenSlot = getSlotDefinition(slots, item.image, "gallery.screen");
            return (
              <figure key={`${id}-screen-${idx}`} className="flex flex-col items-center gap-3">
                <ImageSlotFrame
                  image={item.image}
                  slotDefinition={screenSlot}
                  fallbackRatio={projectType === "web" ? "16:10" : "9:19.5"}
                  projectType={projectType}
                  preferDeviceChrome
                />
                {item.caption && (
                  <figcaption style={MUTED_TEXT_STYLE} className="type-caption text-center">
                    {item.caption}
                  </figcaption>
                )}
              </figure>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export interface ResultsSectionProps {
  id: string;
  hidden?: boolean;
  heading: string;
  metrics: Array<{ value: string; label: string }>;
  closing?: string;
  background: string;
}

export function ResultsSection({
  id,
  hidden,
  heading,
  metrics = [],
  closing,
  background,
}: ResultsSectionProps) {
  if (hidden) return null;

  const isPrimaryBg = background === "primary" || background === "accent";

  return (
    <section
      id={id}
      data-section-type="Results"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
          {heading}
        </h2>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {metrics.map((metric, idx) => (
            <div
              key={`${id}-metric-${idx}`}
              style={{
                backgroundColor: isPrimaryBg
                  ? tokenColorVar("surface", "--surface")
                  : tokenColorVar("surface", "--surface"),
              }}
              className="border-border/25 flex flex-col gap-2 rounded-xl border p-6"
            >
              <span style={HEADING_FONT_STYLE} className="type-display-l">
                {metric.value}
              </span>
              <span style={MUTED_TEXT_STYLE} className="type-body-m">
                {metric.label}
              </span>
            </div>
          ))}
        </div>

        {closing && <p className="type-body-l max-w-3xl opacity-90">{closing}</p>}
      </div>
    </section>
  );
}

export interface QuoteSectionProps {
  id: string;
  hidden?: boolean;
  quote: string;
  author: string;
  role?: string;
  avatar?: ImageSlotValue;
  background: string;
  puck?: PuckContext;
}

export function QuoteSection({
  id,
  hidden,
  quote,
  author,
  role,
  avatar,
  background,
  puck,
}: QuoteSectionProps) {
  if (hidden) return null;

  const { slots } = readRenderMetadata(puck);
  const avatarSlot = getSlotDefinition(slots, avatar, "quote.avatar");

  return (
    <section
      id={id}
      data-section-type="Quote"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto max-w-4xl">
        <blockquote
          style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
          className="border-border/25 flex flex-col gap-6 rounded-2xl border p-8 sm:p-10"
        >
          <p style={HEADING_FONT_STYLE} className="type-heading-l">
            “{quote}”
          </p>
          <footer className="flex items-center gap-4">
            {avatar && (
              <div className="w-12 shrink-0">
                <ImageSlotFrame
                  image={avatar}
                  slotDefinition={avatarSlot}
                  fallbackRatio="1:1"
                  compact
                  className="rounded-full"
                />
              </div>
            )}
            <div className="flex flex-col">
              <cite className="type-body-m-strong not-italic">{author}</cite>
              {role && (
                <span style={MUTED_TEXT_STYLE} className="type-caption">
                  {role}
                </span>
              )}
            </div>
          </footer>
        </blockquote>
      </div>
    </section>
  );
}

export interface CtaSectionProps {
  id: string;
  hidden?: boolean;
  heading: string;
  subheading?: string;
  primaryLabel: string;
  primaryHref: string;
  secondaryLabel?: string;
  secondaryHref?: string;
  background: string;
  accent?: string;
}

export function CtaSection({
  id,
  hidden,
  heading,
  subheading,
  primaryLabel,
  primaryHref,
  secondaryLabel,
  secondaryHref,
  background,
  accent = "primary",
}: CtaSectionProps) {
  if (hidden) return null;

  return (
    <section
      id={id}
      data-section-type="CTA"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div
        style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
        className="border-border/25 mx-auto flex max-w-5xl flex-col items-start justify-between gap-6 rounded-2xl border p-8 sm:flex-row sm:items-center sm:p-12"
      >
        <div className="flex max-w-xl flex-col gap-2">
          <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
            {heading}
          </h2>
          {subheading && (
            <p style={MUTED_TEXT_STYLE} className="type-body-m">
              {subheading}
            </p>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <a
            href={primaryHref}
            style={{
              backgroundColor: tokenColorVar(accent, "--primary"),
              color: "var(--tpl-color-text, var(--primary-foreground))",
            }}
            className="type-body-s-strong inline-flex h-11 items-center justify-center rounded-full px-6 transition-opacity hover:opacity-90"
          >
            {primaryLabel}
          </a>
          {secondaryLabel && secondaryHref && (
            <a
              href={secondaryHref}
              className="border-border/40 type-body-s-strong inline-flex h-11 items-center justify-center rounded-full border px-6 transition-colors"
            >
              {secondaryLabel}
            </a>
          )}
        </div>
      </div>
    </section>
  );
}

export interface CustomSectionProps {
  id: string;
  hidden?: boolean;
  heading: string;
  body: RichTextValue;
  image?: ImageSlotValue;
  background: string;
  puck?: PuckContext;
}

export function CustomSection({
  id,
  hidden,
  heading,
  body,
  image,
  background,
  puck,
}: CustomSectionProps) {
  if (hidden) return null;

  const { projectType, slots } = readRenderMetadata(puck);
  const customSlot = getSlotDefinition(slots, image, "custom.image");

  return (
    <section
      id={id}
      data-section-type="Custom"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
            {heading}
          </h2>
          <RichTextView
            value={body}
            idPrefix={`${id}-custom`}
            style={MUTED_TEXT_STYLE}
            className="type-body-l"
          />
        </div>

        {image && (
          <ImageSlotFrame
            image={image}
            slotDefinition={customSlot}
            fallbackRatio="16:9"
            projectType={projectType}
          />
        )}
      </div>
    </section>
  );
}
