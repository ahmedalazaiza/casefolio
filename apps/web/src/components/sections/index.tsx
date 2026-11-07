import type { PuckContext } from "@puckeditor/core";
import { Check } from "lucide-react";
import type { CSSProperties } from "react";
import { ImageSlotFrame } from "@/components/sections/image-slot-frame";
import { RichTextView } from "@/components/sections/rich-text-view";
import type {
  CustomSectionLayout,
  GalleryDeviceFrame,
  GalleryShowcaseLayout,
  HeroLayout,
  ImageSlotValue,
  MockupStyle,
  ProcessLayout,
  RichTextValue,
  TemplateProjectType,
  TemplateSlotDefinition,
  TemplateTheme,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export interface CasefolioRenderMetadata {
  projectType?: TemplateProjectType;
  slots?: Record<string, TemplateSlotDefinition>;
  theme?: TemplateTheme;
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
    theme:
      raw.theme && typeof raw.theme === "object" ? (raw.theme as TemplateTheme) : undefined,
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

function SectionEyebrow({ text, accent = "primary" }: { text?: string; accent?: string }) {
  if (!text) return null;
  return (
    <span
      style={{ color: tokenColorVar(accent, "--primary") }}
      className="type-overline inline-flex items-center gap-2 font-semibold tracking-wider uppercase"
    >
      <span
        aria-hidden="true"
        style={{ backgroundColor: tokenColorVar(accent, "--primary") }}
        className="size-1.5 shrink-0 rounded-full"
      />
      {text}
    </span>
  );
}

export interface HeroSectionProps {
  id: string;
  hidden?: boolean;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  tags?: Array<{ label: string }>;
  layout?: HeroLayout;
  mockupStyle?: MockupStyle;
  glow?: boolean;
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
  tags,
  layout,
  mockupStyle = "straight",
  glow = false,
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
  const effectiveDevice = mockup?.device ?? mockupSlot?.device;
  const isWebVariant =
    projectType === "web" ||
    effectiveDevice === "browser" ||
    effectiveDevice === "macbook" ||
    effectiveDevice === "tablet";
  const resolvedVariant = isWebVariant ? "web" : projectType;
  const effectiveLayout: HeroLayout = layout ?? (isWebVariant ? "centered" : "split-right");
  const isCentered = effectiveLayout === "centered";

  return (
    <section
      id={id}
      data-section-type="Hero"
      data-variant={resolvedVariant}
      data-hero-layout={effectiveLayout}
      style={buildSectionSurfaceStyle(background)}
      className="overflow-hidden px-6 py-14 sm:px-10 lg:px-16 lg:py-20"
    >
      <div
        className={cn(
          "mx-auto max-w-6xl",
          isCentered
            ? "flex flex-col items-center gap-10 text-center"
            : "grid items-center gap-10 lg:grid-cols-12",
        )}
      >
        <div
          className={cn(
            "flex flex-col gap-5",
            isCentered
              ? "max-w-3xl items-center"
              : effectiveLayout === "split-left"
                ? "lg:order-2 lg:col-span-7"
                : "lg:col-span-7",
          )}
        >
          <div className={cn("flex flex-wrap items-center gap-3", isCentered && "justify-center")}>
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
                  color: tokenColorVar("text", "--foreground"),
                }}
                className="border-border/30 type-overline inline-flex items-center gap-2 rounded-full border px-3.5 py-1"
              >
                <span
                  aria-hidden="true"
                  style={{ backgroundColor: tokenColorVar(accent, "--primary") }}
                  className="size-1.5 shrink-0 rounded-full"
                />
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

          {tags && tags.length > 0 && (
            <ul
              aria-label="Project highlights"
              className={cn("flex flex-wrap items-center gap-2 pt-1", isCentered && "justify-center")}
            >
              {tags.map((tag, idx) => (
                <li
                  key={`${id}-tag-${idx}`}
                  style={{
                    backgroundColor: tokenColorVar("surface", "--surface"),
                    color: tokenColorVar("textMuted", "--muted-foreground"),
                  }}
                  className="border-border/30 type-caption rounded-full border px-3 py-1 font-medium"
                >
                  {tag.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {mockup && (
          <div
            className={cn(
              "w-full",
              isCentered
                ? "max-w-5xl"
                : effectiveLayout === "split-left"
                  ? "lg:order-1 lg:col-span-5"
                  : "lg:col-span-5",
            )}
          >
            <ImageSlotFrame
              image={mockup}
              slotDefinition={mockupSlot}
              fallbackRatio={isWebVariant ? "16:10" : "9:19.5"}
              projectType={projectType}
              preferDeviceChrome
              presentation={mockupStyle}
              glow={glow}
              accentToken={accent}
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
  eyebrow?: string;
  heading: string;
  highlight?: string;
  summary: RichTextValue;
  meta?: Array<{ label: string; value: string }>;
  banner?: ImageSlotValue;
  background: string;
  accent?: string;
  puck?: PuckContext;
}

export function OverviewSection({
  id,
  hidden,
  eyebrow,
  heading,
  highlight,
  summary,
  meta = [],
  banner,
  background,
  accent = "primary",
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
            <SectionEyebrow text={eyebrow} accent={accent} />
            <div className="flex flex-col gap-1.5">
              <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
                {heading}
              </h2>
              {highlight && (
                <p
                  style={{
                    ...HEADING_FONT_STYLE,
                    color: tokenColorVar(accent, "--primary"),
                  }}
                  className="type-heading-l"
                >
                  {highlight}
                </p>
              )}
            </div>
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
                  style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
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
  eyebrow?: string;
  heading: string;
  statement: string;
  columns?: 2 | 3 | 4;
  painPoints: Array<{ title: string; body: string }>;
  background: string;
}

export function ProblemSection({
  id,
  hidden,
  eyebrow,
  heading,
  statement,
  columns = 3,
  painPoints = [],
  background,
}: ProblemSectionProps) {
  if (hidden) return null;

  const gridClass =
    columns === 2
      ? "md:grid-cols-2"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "md:grid-cols-3";

  return (
    <section
      id={id}
      data-section-type="Problem"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex max-w-3xl flex-col gap-3">
          {eyebrow ? (
            <>
              <SectionEyebrow text={eyebrow} />
              <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
                {heading}
              </h2>
              <p style={MUTED_TEXT_STYLE} className="type-body-l">
                {statement}
              </p>
            </>
          ) : (
            <>
              <span style={MUTED_TEXT_STYLE} className="type-overline">
                {heading}
              </span>
              <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
                {statement}
              </h2>
            </>
          )}
        </div>

        <div className={cn("grid gap-5", gridClass)}>
          {painPoints.map((point, idx) => (
            <article
              key={`${id}-pain-${idx}`}
              style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
              className="border-border/25 flex flex-col gap-2.5 rounded-xl border p-6"
            >
              <span
                style={{
                  color: `color-mix(in oklab, ${tokenColorVar("primary", "--primary")} 68%, ${tokenColorVar("text", "--foreground")})`,
                }}
                className="type-overline font-mono"
              >
                {String(idx + 1).padStart(2, "0")}
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
  eyebrow?: string;
  heading: string;
  subtitle?: string;
  layout?: ProcessLayout;
  accent?: string;
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
  eyebrow,
  heading,
  subtitle,
  layout = "cards",
  accent = "primary",
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
      data-process-layout={layout}
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex max-w-3xl flex-col gap-3">
          <SectionEyebrow text={eyebrow} accent={accent} />
          <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
            {heading}
          </h2>
          {subtitle && (
            <p style={MUTED_TEXT_STYLE} className="type-body-l">
              {subtitle}
            </p>
          )}
        </div>

        {layout === "timeline" ? (
          <ol className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {steps.map((step, idx) => {
              const isEndpoint = idx === 0 || idx === steps.length - 1;
              return (
                <li
                  key={`${id}-step-${idx}`}
                  style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
                  className="border-border/25 relative flex flex-col gap-3 rounded-xl border p-5"
                >
                  <div className="flex items-center gap-3">
                    <span
                      style={
                        isEndpoint
                          ? {
                              backgroundColor: tokenColorVar(accent, "--primary"),
                              color: "var(--tpl-color-text, var(--primary-foreground))",
                            }
                          : {
                              backgroundColor: tokenColorVar("background", "--background"),
                              color: tokenColorVar("text", "--foreground"),
                            }
                      }
                      className="border-border/40 type-caption inline-flex size-8 shrink-0 items-center justify-center rounded-full border font-mono font-semibold"
                    >
                      {step.number}
                    </span>
                    <span
                      aria-hidden="true"
                      className="bg-border/30 h-px flex-1"
                    />
                  </div>
                  <h3 style={HEADING_FONT_STYLE} className="type-heading-s">
                    {step.title}
                  </h3>
                  <p style={MUTED_TEXT_STYLE} className="type-body-s">
                    {step.body}
                  </p>
                </li>
              );
            })}
          </ol>
        ) : (
          <div
            className={cn(
              "grid gap-6",
              layout === "grid-3" ? "sm:grid-cols-2 lg:grid-cols-3" : "md:grid-cols-2",
            )}
          >
            {steps.map((step, idx) => {
              const stepSlot = getSlotDefinition(slots, step.image, "process.step.image");
              return (
                <article
                  key={`${id}-step-${idx}`}
                  style={{
                    backgroundColor:
                      background === "surface"
                        ? tokenColorVar("background", "--background")
                        : tokenColorVar("surface", "--surface"),
                  }}
                  className="border-border/25 flex flex-col justify-between gap-5 rounded-xl border p-6"
                >
                  <div className="flex flex-col gap-2">
                    <span
                      style={{
                        color: `color-mix(in oklab, ${tokenColorVar(accent, "--primary")} 68%, ${tokenColorVar("text", "--foreground")})`,
                      }}
                      className="type-overline font-mono"
                    >
                      {step.number}
                    </span>
                    <h3 style={HEADING_FONT_STYLE} className="type-heading-s">
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
        )}
      </div>
    </section>
  );
}

export interface ScreensGallerySectionProps {
  id: string;
  hidden?: boolean;
  eyebrow?: string;
  heading: string;
  subtitle?: string;
  columns?: 2 | 3 | 4 | 5;
  showcaseLayout?: GalleryShowcaseLayout;
  deviceFrame?: GalleryDeviceFrame;
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
  eyebrow,
  heading,
  subtitle,
  columns = 3,
  showcaseLayout = "grid",
  deviceFrame = "auto",
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
        : columns === 5
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5"
          : "sm:grid-cols-2 lg:grid-cols-3";

  const isStaggered = showcaseLayout === "staggered";

  return (
    <section
      id={id}
      data-section-type="ScreensGallery"
      data-variant={projectType}
      data-showcase-layout={showcaseLayout}
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex max-w-3xl flex-col gap-3">
          <SectionEyebrow text={eyebrow} />
          <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
            {heading}
          </h2>
          {subtitle && (
            <p style={MUTED_TEXT_STYLE} className="type-body-l">
              {subtitle}
            </p>
          )}
        </div>

        <div className={cn("grid gap-6 sm:gap-8", gridClass, isStaggered && "lg:pb-8")}>
          {screens.map((item, idx) => {
            const screenSlot = getSlotDefinition(slots, item.image, "gallery.screen");
            return (
              <figure
                key={`${id}-screen-${idx}`}
                className={cn(
                  "flex flex-col items-center gap-3",
                  isStaggered && idx % 2 === 1 && "lg:translate-y-8",
                )}
              >
                <ImageSlotFrame
                  image={item.image}
                  slotDefinition={screenSlot}
                  overrideDevice={deviceFrame}
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
  eyebrow?: string;
  heading: string;
  subtitle?: string;
  columns?: 2 | 3 | 4;
  accent?: string;
  metrics: Array<{ value: string; label: string }>;
  takeaways?: Array<{ title: string; body: string }>;
  closing?: string;
  background: string;
}

export function ResultsSection({
  id,
  hidden,
  eyebrow,
  heading,
  subtitle,
  columns = 3,
  accent,
  metrics = [],
  takeaways,
  closing,
  background,
}: ResultsSectionProps) {
  if (hidden) return null;

  const gridClass =
    columns === 2
      ? "sm:grid-cols-2"
      : columns === 4
        ? "sm:grid-cols-2 lg:grid-cols-4"
        : "sm:grid-cols-2 lg:grid-cols-3";

  return (
    <section
      id={id}
      data-section-type="Results"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-10">
        <div className="flex max-w-3xl flex-col gap-3">
          <SectionEyebrow text={eyebrow} accent={accent || "primary"} />
          <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
            {heading}
          </h2>
          {subtitle && (
            <p style={MUTED_TEXT_STYLE} className="type-body-l">
              {subtitle}
            </p>
          )}
        </div>

        <div className={cn("grid gap-6", gridClass)}>
          {metrics.map((metric, idx) => (
            <div
              key={`${id}-metric-${idx}`}
              style={{
                backgroundColor: tokenColorVar("surface", "--surface"),
              }}
              className="border-border/25 flex flex-col gap-2 rounded-xl border p-6"
            >
              <span
                style={{
                  ...HEADING_FONT_STYLE,
                  ...(accent ? { color: tokenColorVar(accent, "--primary") } : {}),
                }}
                className="type-display-l"
              >
                {metric.value}
              </span>
              <span style={MUTED_TEXT_STYLE} className="type-body-m">
                {metric.label}
              </span>
            </div>
          ))}
        </div>

        {takeaways && takeaways.length > 0 && (
          <div
            style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
            className="border-border/25 grid gap-6 rounded-2xl border p-6 sm:p-8 md:grid-cols-3"
          >
            {takeaways.map((item, idx) => (
              <div key={`${id}-takeaway-${idx}`} className="flex flex-col gap-2">
                <span
                  style={{ color: tokenColorVar(accent || "primary", "--primary") }}
                  className="type-overline font-semibold"
                >
                  {item.title}
                </span>
                <p style={MUTED_TEXT_STYLE} className="type-body-s">
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        )}

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
  eyebrow?: string;
  heading: string;
  body: RichTextValue;
  layout?: CustomSectionLayout;
  mockupStyle?: MockupStyle;
  accent?: string;
  bullets?: Array<{ text: string }>;
  cards?: Array<{
    title: string;
    subtitle?: string;
    body: string;
    highlighted?: boolean;
  }>;
  swatches?: Array<{
    label: string;
    token: string;
    role?: string;
  }>;
  image?: ImageSlotValue;
  background: string;
  puck?: PuckContext;
}

export function CustomSection({
  id,
  hidden,
  eyebrow,
  heading,
  body,
  layout = "stacked",
  mockupStyle = "straight",
  accent = "primary",
  bullets,
  cards,
  swatches,
  image,
  background,
  puck,
}: CustomSectionProps) {
  if (hidden) return null;

  const { projectType, slots, theme } = readRenderMetadata(puck);
  const customSlot = getSlotDefinition(slots, image, "custom.image");

  if (layout === "split-right" || layout === "split-left") {
    const isLeft = layout === "split-left";
    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout={layout}
        style={buildSectionSurfaceStyle(background)}
        className="overflow-hidden px-6 py-14 sm:px-10 lg:px-16"
      >
        <div
          style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
          className="border-border/25 mx-auto grid max-w-6xl items-center gap-10 rounded-3xl border p-8 sm:p-12 lg:grid-cols-12"
        >
          <div
            className={cn(
              "flex flex-col gap-5",
              isLeft ? "lg:order-2 lg:col-span-7" : "lg:col-span-7",
            )}
          >
            <SectionEyebrow text={eyebrow} accent={accent} />
            <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
              {heading}
            </h2>
            <RichTextView
              value={body}
              idPrefix={`${id}-custom`}
              style={MUTED_TEXT_STYLE}
              className="type-body-l"
            />
            {bullets && bullets.length > 0 && (
              <ul className="flex flex-col gap-2.5 pt-1">
                {bullets.map((bullet, idx) => (
                  <li key={`${id}-bullet-${idx}`} className="flex items-start gap-3">
                    <span
                      style={{ backgroundColor: tokenColorVar(accent, "--primary") }}
                      className="text-primary-foreground mt-1 inline-flex size-5 shrink-0 items-center justify-center rounded-full"
                    >
                      <Check className="size-3" />
                    </span>
                    <span className="type-body-m">{bullet.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {image && (
            <div
              className={cn(
                "w-full",
                isLeft ? "lg:order-1 lg:col-span-5" : "lg:col-span-5",
              )}
            >
              <ImageSlotFrame
                image={image}
                slotDefinition={customSlot}
                fallbackRatio={projectType === "web" ? "16:10" : "9:19.5"}
                projectType={projectType}
                preferDeviceChrome
                presentation={mockupStyle}
                glow
                accentToken={accent}
              />
            </div>
          )}
        </div>
      </section>
    );
  }

  if (layout === "comparison") {
    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="comparison"
        style={buildSectionSurfaceStyle(background)}
        className="px-6 py-14 sm:px-10 lg:px-16"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-3">
            <SectionEyebrow text={eyebrow} accent={accent} />
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

          {cards && cards.length > 0 && (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {cards.map((card, idx) => (
                <article
                  key={`${id}-comp-${idx}`}
                  style={{
                    backgroundColor: tokenColorVar("surface", "--surface"),
                    ...(card.highlighted
                      ? { borderColor: tokenColorVar(accent, "--primary") }
                      : {}),
                  }}
                  className={cn(
                    "flex flex-col justify-between gap-4 rounded-2xl border p-6",
                    card.highlighted ? "border-2 shadow-card" : "border-border/25",
                  )}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 style={HEADING_FONT_STYLE} className="type-heading-s">
                        {card.title}
                      </h3>
                      {card.highlighted && (
                        <span
                          style={{
                            backgroundColor: tokenColorVar(accent, "--primary"),
                            color: "var(--tpl-color-text, var(--primary-foreground))",
                          }}
                          className="type-overline rounded-full px-2.5 py-0.5 font-semibold"
                        >
                          Ours
                        </span>
                      )}
                    </div>
                    {card.subtitle && (
                      <span
                        style={{
                          color: card.highlighted
                            ? tokenColorVar(accent, "--primary")
                            : tokenColorVar("textMuted", "--muted-foreground"),
                        }}
                        className="type-caption font-semibold"
                      >
                        {card.subtitle}
                      </span>
                    )}
                    <div
                      aria-hidden="true"
                      style={{
                        backgroundColor: card.highlighted
                          ? tokenColorVar(accent, "--primary")
                          : "var(--border)",
                      }}
                      className="h-0.5 w-full rounded-full opacity-50"
                    />
                    <p style={MUTED_TEXT_STYLE} className="type-body-s whitespace-pre-line">
                      {card.body}
                    </p>
                  </div>
                </article>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (layout === "persona") {
    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="persona"
        style={buildSectionSurfaceStyle(background)}
        className="px-6 py-14 sm:px-10 lg:px-16"
      >
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-3">
            <SectionEyebrow text={eyebrow} accent={accent} />
            <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
              {heading}
            </h2>
          </div>

          <div
            style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
            className="border-border/25 grid gap-6 rounded-2xl border p-6 sm:p-8 lg:grid-cols-12"
          >
            <div
              style={{ backgroundColor: tokenColorVar("background", "--background") }}
              className="border-border/30 flex flex-col justify-between gap-4 rounded-xl border p-6 lg:col-span-4"
            >
              <div className="flex flex-col gap-3">
                {image ? (
                  <div className="w-16">
                    <ImageSlotFrame
                      image={image}
                      slotDefinition={customSlot}
                      fallbackRatio="1:1"
                      compact
                      className="rounded-full"
                    />
                  </div>
                ) : (
                  <span
                    style={{
                      backgroundColor: tokenColorVar(accent, "--primary"),
                      color: "var(--tpl-color-text, var(--primary-foreground))",
                    }}
                    className="type-heading-s inline-flex size-12 items-center justify-center rounded-xl font-bold"
                  >
                    UX
                  </span>
                )}
                <RichTextView
                  value={body}
                  idPrefix={`${id}-persona`}
                  className="type-body-m"
                />
              </div>
            </div>

            {cards && cards.length > 0 && (
              <div className="grid gap-4 sm:grid-cols-2 lg:col-span-8 lg:grid-cols-3">
                {cards.map((card, idx) => (
                  <div
                    key={`${id}-persona-card-${idx}`}
                    style={{ backgroundColor: tokenColorVar("background", "--background") }}
                    className="border-border/25 flex flex-col gap-2.5 rounded-xl border p-5"
                  >
                    <span
                      style={{ color: tokenColorVar(accent, "--primary") }}
                      className="type-overline font-semibold"
                    >
                      {card.title}
                    </span>
                    {card.subtitle && (
                      <span className="type-body-s-strong">{card.subtitle}</span>
                    )}
                    <p style={MUTED_TEXT_STYLE} className="type-body-s whitespace-pre-line">
                      {card.body}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "design-system") {
    const headingFamily = theme?.fonts.heading.family ?? "Display Sans";
    const bodyFamily = theme?.fonts.body.family ?? "Body Sans";
    const headingWeights = theme?.fonts.heading.weights?.join(" · ") ?? "600 · 700";

    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="design-system"
        style={buildSectionSurfaceStyle(background)}
        className="px-5 py-14 sm:px-10 lg:px-16"
      >
        <div className="mx-auto flex min-w-0 max-w-6xl flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-3">
            <SectionEyebrow text={eyebrow} accent={accent} />
            <h2 style={HEADING_FONT_STYLE} className="type-heading-l">
              {heading}
            </h2>
            <RichTextView
              value={body}
              idPrefix={`${id}-ds`}
              style={MUTED_TEXT_STYLE}
              className="type-body-l"
            />
          </div>

          <div className="grid min-w-0 grid-cols-1 gap-6 lg:grid-cols-12">
            <div
              style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
              className="border-border/25 flex min-w-0 flex-col justify-between gap-6 rounded-2xl border p-5 sm:p-8 lg:col-span-5"
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span
                  style={{
                    ...HEADING_FONT_STYLE,
                    color: tokenColorVar(accent, "--primary"),
                  }}
                  className="type-display-xl"
                >
                  Aa
                </span>
                <span style={MUTED_TEXT_STYLE} className="type-overline font-mono">
                  {headingWeights}
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <span style={HEADING_FONT_STYLE} className="type-heading-m break-words">
                  {headingFamily}
                </span>
                <span style={MUTED_TEXT_STYLE} className="type-body-s break-words">
                  Body: {bodyFamily} · Aa Bb Cc Dd Ee Ff Gg 0123456789
                </span>
              </div>
            </div>

            <div
              style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
              className="border-border/25 flex min-w-0 flex-col justify-between gap-4 rounded-2xl border p-5 sm:p-8 lg:col-span-7"
            >
              <span style={MUTED_TEXT_STYLE} className="type-overline">
                Type hierarchy
              </span>
              <div className="flex min-w-0 flex-col gap-3">
                <div className="border-border/20 flex min-w-0 flex-col gap-1 border-b pb-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span style={HEADING_FONT_STYLE} className="type-heading-m sm:type-heading-l min-w-0 break-words">
                    Display Headline
                  </span>
                  <span style={MUTED_TEXT_STYLE} className="type-caption shrink-0 font-mono">
                    Heading · Bold
                  </span>
                </div>
                <div className="border-border/20 flex min-w-0 flex-col gap-1 border-b pb-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span style={HEADING_FONT_STYLE} className="type-heading-s min-w-0 break-words">
                    Section Title &amp; Card Header
                  </span>
                  <span style={MUTED_TEXT_STYLE} className="type-caption shrink-0 font-mono">
                    Subhead · Semibold
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="type-body-m min-w-0 break-words">
                    Body copy designed for high-contrast dark &amp; light legibility.
                  </span>
                  <span style={MUTED_TEXT_STYLE} className="type-caption shrink-0 font-mono">
                    Body · Regular
                  </span>
                </div>
              </div>
            </div>
          </div>

          {swatches && swatches.length > 0 && (
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-5">
              {swatches.map((swatch, idx) => {
                const liveHex = theme?.colors[swatch.token]?.toUpperCase();
                return (
                  <div
                    key={`${id}-swatch-${idx}`}
                    style={{ backgroundColor: tokenColorVar("surface", "--surface") }}
                    className="border-border/25 overflow-hidden rounded-xl border"
                  >
                    <div
                      style={{ backgroundColor: tokenColorVar(swatch.token, "--primary") }}
                      className="border-border/20 h-20 w-full border-b"
                    />
                    <div className="flex flex-col gap-0.5 p-3.5">
                      <span className="type-body-s-strong truncate">{swatch.label}</span>
                      <span style={MUTED_TEXT_STYLE} className="type-caption font-mono uppercase">
                        {liveHex ?? swatch.token}
                      </span>
                      {swatch.role && (
                        <span style={MUTED_TEXT_STYLE} className="type-caption truncate">
                          {swatch.role}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </section>
    );
  }

  return (
    <section
      id={id}
      data-section-type="Custom"
      data-custom-layout="stacked"
      style={buildSectionSurfaceStyle(background)}
      className="px-6 py-14 sm:px-10 lg:px-16"
    >
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4">
          <SectionEyebrow text={eyebrow} accent={accent} />
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
