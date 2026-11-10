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
  viewport?: "desktop" | "mobile";
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
    viewport:
      raw.viewport === "desktop" || raw.viewport === "mobile" ? raw.viewport : undefined,
  };
}

function viewClass(isMobile: boolean, mobileClasses: string, desktopLgClasses: string): string {
  return isMobile ? mobileClasses : cn(mobileClasses, desktopLgClasses);
}

function tokenColorVar(token: string | undefined, fallbackVar: string): string {
  const safeToken = token && token.trim().length > 0 ? token.trim() : "background";
  return `var(--tpl-color-${safeToken}, var(${fallbackVar}))`;
}

function buildSectionSurfaceStyle(backgroundToken?: string): CSSProperties {
  const isPrimaryFill = backgroundToken === "primary";
  const isAccentFill = backgroundToken === "accent";
  return {
    backgroundColor: tokenColorVar(backgroundToken, "--background"),
    color: isPrimaryFill
      ? "var(--tpl-color-onPrimary, var(--primary-foreground))"
      : isAccentFill
        ? "var(--tpl-color-background, var(--primary-foreground))"
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

function SectionEyebrow({
  text,
  accent = "accent",
  colorOverride,
  isMobile = false,
}: {
  text?: string;
  accent?: string;
  colorOverride?: string;
  isMobile?: boolean;
}) {
  if (!text) return null;
  return (
    <span
      style={{ color: colorOverride ?? tokenColorVar(accent, "--primary") }}
      className={viewClass(
        isMobile,
        "font-medium uppercase leading-[1.4] text-[0.75rem] tracking-[1.44px]",
        "lg:text-[0.875rem] lg:tracking-[1.68px]",
      )}
    >
      {text}
    </span>
  );
}

function QuoteMarkGlyph({ className, style }: { className?: string; style?: CSSProperties }) {
  return (
    <svg
      viewBox="0 0 48 36"
      fill="none"
      aria-hidden="true"
      style={style}
      className={className}
    >
      <path
        d="M14.4 0C6.24 5.52 1.2 13.44 1.2 22.8C1.2 30.48 6.24 35.52 12.72 35.52C18.72 35.52 23.04 25.44 23.04 25.44C23.04 19.68 18.72 15.84 13.44 15.84C12.24 15.84 10.8 16.08 10.32 16.32C11.28 11.28 15.12 6.72 20.4 3.6L14.4 0ZM38.16 0C30 5.52 24.96 13.44 24.96 22.8C24.96 30.48 30 35.52 36.48 35.52C42.48 35.52 46.8 31.2 46.8 25.44C46.8 19.68 42.48 15.84 37.2 15.84C36 15.84 34.56 16.08 34.08 16.32C35.04 11.28 38.88 6.72 44.16 3.6L38.16 0Z"
        fill="currentColor"
      />
    </svg>
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
  accent = "accent",
  puck,
}: HeroSectionProps) {
  if (hidden) return null;

  const { projectType = "mobile", slots, viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";
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
      className={viewClass(
        isMobile,
        "overflow-hidden px-[24px] pt-[24px] pb-[64px]",
        "lg:px-[120px] lg:pt-[104px] lg:pb-[120px]",
      )}
    >
      <div
        className={cn(
          "mx-auto max-w-[1200px]",
          isCentered
            ? viewClass(
                isMobile,
                "flex flex-col items-center gap-[40px] text-center",
                "lg:gap-[56px]",
              )
            : viewClass(
                isMobile,
                "flex flex-col items-start gap-[40px]",
                "lg:flex-row lg:items-center lg:gap-[80px]",
              ),
        )}
      >
        <div
          className={cn(
            viewClass(
              isMobile,
              "flex w-full flex-col items-start gap-[16px]",
              "lg:min-w-0 lg:flex-1 lg:gap-[24px]",
            ),
            isCentered && "max-w-[920px] items-center text-center",
            !isCentered && effectiveLayout === "split-left" && !isMobile && "lg:order-2",
          )}
        >
          {(logo || eyebrow) && (
            <div
              className={cn(
                viewClass(
                  isMobile,
                  "flex flex-row items-center gap-[12px] pb-[8px]",
                  "lg:flex-col lg:items-start lg:gap-[24px] lg:pb-0",
                ),
                isCentered && "items-center justify-center lg:items-center",
              )}
            >
              {logo && (
                <div
                  className={viewClass(
                    isMobile,
                    "size-[44px] shrink-0",
                    "lg:size-[72px]",
                  )}
                >
                  <ImageSlotFrame
                    image={logo}
                    slotDefinition={logoSlot}
                    fallbackRatio="1:1"
                    compact
                    className={viewClass(
                      isMobile,
                      "size-full rounded-[12px]",
                      "lg:rounded-[18px]",
                    )}
                    innerClassName="size-full"
                    placeholderIconClassName={viewClass(
                      isMobile,
                      "size-[16px]",
                      "lg:size-[22px]",
                    )}
                  />
                </div>
              )}
              <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
            </div>
          )}

          <h1
            style={HEADING_FONT_STYLE}
            className={viewClass(
              isMobile,
              "font-semibold text-[2.5rem] leading-[1.06] tracking-[-0.02em]",
              "lg:text-[4rem] lg:leading-[1.04]",
            )}
          >
            {title}
          </h1>

          {subtitle && (
            <p
              style={MUTED_TEXT_STYLE}
              className={cn(
                viewClass(
                  isMobile,
                  "font-normal text-[1.125rem] leading-[1.55]",
                  "lg:text-[1.3125rem] lg:leading-[1.55]",
                ),
                isCentered && "max-w-[740px]",
              )}
            >
              {subtitle}
            </p>
          )}

          {tags && tags.length > 0 && (
            <ul
              aria-label="Project highlights"
              className={cn(
                viewClass(
                  isMobile,
                  "flex flex-wrap items-start gap-[8px] pt-[4px]",
                  "lg:pt-[8px]",
                ),
                isCentered && "justify-center",
              )}
            >
              {tags.map((tag, idx) => (
                <li
                  key={`${id}-tag-${idx}`}
                  style={{
                    borderColor: "var(--tpl-color-line, var(--border))",
                    color: "var(--tpl-color-text, var(--foreground))",
                  }}
                  className={viewClass(
                    isMobile,
                    "rounded-full border border-solid px-[12px] py-[6px] font-medium text-[0.8125rem] leading-[1.2]",
                    "lg:px-[16px] lg:py-[8px] lg:text-[0.875rem]",
                  )}
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
              isCentered
                ? "w-full"
                : isWebVariant
                  ? viewClass(isMobile, "w-full", "lg:w-[52%] lg:shrink-0")
                  : viewClass(isMobile, "w-full shrink-0", "lg:w-auto lg:shrink-0"),
              !isCentered && effectiveLayout === "split-left" && !isMobile && "lg:order-1",
            )}
          >
            {isWebVariant ? (
              <ImageSlotFrame
                image={mockup}
                slotDefinition={mockupSlot}
                fallbackRatio="16:10"
                projectType={projectType}
                preferDeviceChrome
                presentation={mockupStyle}
                glow={glow}
                accentToken={accent}
              />
            ) : (
              <div
                data-slot="hero-mockup-stage"
                style={{
                  backgroundColor: "var(--tpl-color-surface, var(--surface))",
                  borderColor: "var(--tpl-color-line, var(--border))",
                }}
                className={viewClass(
                  isMobile,
                  "flex w-full items-center justify-center rounded-[28px] border border-solid px-[24px] py-[32px]",
                  "lg:w-auto lg:rounded-[40px] lg:p-[56px]",
                )}
              >
                <ImageSlotFrame
                  image={mockup}
                  slotDefinition={mockupSlot}
                  fallbackRatio="9:19.5"
                  projectType={projectType}
                  preferDeviceChrome
                  presentation={mockupStyle}
                  glow={glow}
                  accentToken={accent}
                  className={viewClass(
                    isMobile,
                    "w-[236px] max-w-none rounded-[35px] p-[8px]",
                    "lg:w-[340px] lg:rounded-[46px] lg:p-[10px]",
                  )}
                  innerClassName={viewClass(
                    isMobile,
                    "rounded-[27px]",
                    "lg:rounded-[36px]",
                  )}
                  placeholderIconClassName={viewClass(
                    isMobile,
                    "size-[36px]",
                    "lg:size-[48px]",
                  )}
                />
              </div>
            )}
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
  accent = "accent",
  puck,
}: OverviewSectionProps) {
  if (hidden) return null;

  const { projectType, slots, viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";
  const bannerSlot = getSlotDefinition(slots, banner, "overview.banner");

  return (
    <section
      id={id}
      data-section-type="Overview"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[24px] py-[64px]",
        "lg:p-[120px]",
      )}
    >
      <div
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1200px] flex-col gap-[32px]",
          "lg:gap-[72px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "flex w-full flex-col items-start gap-[32px]",
            "lg:flex-row lg:items-start lg:gap-[80px]",
          )}
        >
          <div
            className={viewClass(
              isMobile,
              "flex w-full flex-col items-start gap-[12px]",
              "lg:w-[420px] lg:shrink-0 lg:gap-[16px]",
            )}
          >
            <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
            <div className="flex flex-col gap-1.5">
              <h2
                style={HEADING_FONT_STYLE}
                className={viewClass(
                  isMobile,
                  "font-semibold text-[1.75rem] leading-[1.12]",
                  "lg:text-[2.5rem] lg:leading-[1.1]",
                )}
              >
                {heading}
              </h2>
              {highlight && (
                <p
                  style={{
                    ...HEADING_FONT_STYLE,
                    color: tokenColorVar(accent, "--primary"),
                  }}
                  className={viewClass(
                    isMobile,
                    "font-semibold text-[1.75rem] leading-[1.12]",
                    "lg:text-[2.5rem] lg:leading-[1.1]",
                  )}
                >
                  {highlight}
                </p>
              )}
            </div>
          </div>

          <div
            className={viewClass(
              isMobile,
              "flex w-full flex-col items-start gap-[28px]",
              "lg:min-w-0 lg:flex-1 lg:gap-[40px]",
            )}
          >
            <RichTextView
              value={summary}
              idPrefix={id}
              style={{ color: "var(--tpl-color-text, var(--foreground))" }}
              className={viewClass(
                isMobile,
                "font-normal text-[1.125rem] leading-[1.6]",
                "lg:text-[1.25rem] lg:leading-[1.6]",
              )}
            />

            {meta.length > 0 && (
              <dl
                className={viewClass(
                  isMobile,
                  "grid w-full grid-cols-2 gap-x-[20px] gap-y-[24px]",
                  "lg:grid-cols-4 lg:gap-[24px]",
                )}
              >
                {meta.map((item, idx) => (
                  <div
                    key={`${id}-meta-${idx}`}
                    className={viewClass(
                      isMobile,
                      "flex min-w-0 flex-col items-start gap-[8px]",
                      "lg:gap-[10px]",
                    )}
                  >
                    <div
                      aria-hidden="true"
                      style={{ backgroundColor: "var(--tpl-color-line, var(--border))" }}
                      className="h-px w-full shrink-0"
                    />
                    <dt
                      style={MUTED_TEXT_STYLE}
                      className={viewClass(
                        isMobile,
                        "font-medium uppercase text-[0.75rem] leading-[1.3] tracking-[0.96px]",
                        "lg:text-[0.8125rem] lg:tracking-[1.04px]",
                      )}
                    >
                      {item.label}
                    </dt>
                    <dd
                      className={viewClass(
                        isMobile,
                        "font-medium text-[1rem] leading-[1.35]",
                        "lg:text-[1.0625rem] lg:leading-[1.4]",
                      )}
                    >
                      {item.value}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        {banner && (
          <ImageSlotFrame
            image={banner}
            slotDefinition={bannerSlot}
            fallbackRatio="16:9"
            projectType={projectType}
            className={viewClass(
              isMobile,
              "rounded-[16px]",
              "lg:rounded-[24px]",
            )}
            placeholderIconClassName={viewClass(
              isMobile,
              "size-[28px]",
              "lg:size-[56px]",
            )}
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
  puck?: PuckContext;
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
  puck,
}: ProblemSectionProps) {
  if (hidden) return null;

  const { viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";

  const desktopGridClass =
    columns === 2
      ? "lg:grid-cols-2"
      : columns === 4
        ? "lg:grid-cols-4"
        : "lg:grid-cols-3";

  return (
    <section
      id={id}
      data-section-type="Problem"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[24px] py-[64px]",
        "lg:p-[120px]",
      )}
    >
      <div
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1200px] flex-col gap-[32px]",
          "lg:gap-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "flex w-full flex-col items-start gap-[12px]",
            "lg:gap-[16px]",
          )}
        >
          {eyebrow ? (
            <>
              <SectionEyebrow text={eyebrow} accent="primary" isMobile={isMobile} />
              <h2
                style={HEADING_FONT_STYLE}
                className={viewClass(
                  isMobile,
                  "max-w-[880px] font-semibold text-[1.875rem] leading-[1.12]",
                  "lg:text-[3rem] lg:leading-[1.1]",
                )}
              >
                {heading}
              </h2>
              <p
                style={MUTED_TEXT_STYLE}
                className={viewClass(
                  isMobile,
                  "max-w-[820px] font-normal text-[1.125rem] leading-[1.55]",
                  "lg:text-[1.375rem] lg:leading-[1.55]",
                )}
              >
                {statement}
              </p>
            </>
          ) : (
            <>
              <SectionEyebrow text={heading} accent="primary" isMobile={isMobile} />
              <h2
                style={HEADING_FONT_STYLE}
                className={viewClass(
                  isMobile,
                  "max-w-[880px] font-semibold text-[1.875rem] leading-[1.12]",
                  "lg:text-[3rem] lg:leading-[1.1]",
                )}
              >
                {statement}
              </h2>
            </>
          )}
        </div>

        <div
          className={viewClass(
            isMobile,
            "grid w-full grid-cols-1 gap-[12px]",
            cn("lg:gap-[24px]", desktopGridClass),
          )}
        >
          {painPoints.map((point, idx) => (
            <article
              key={`${id}-pain-${idx}`}
              style={{
                backgroundColor: tokenColorVar("surface", "--surface"),
                borderColor: "var(--tpl-color-line, var(--border))",
              }}
              className={viewClass(
                isMobile,
                "flex flex-col items-start gap-[12px] rounded-[16px] border border-solid p-[24px]",
                "lg:gap-[16px] lg:rounded-[20px] lg:p-[36px]",
              )}
            >
              <div
                aria-hidden="true"
                style={{ backgroundColor: tokenColorVar("primary", "--primary") }}
                className={viewClass(
                  isMobile,
                  "h-[4px] w-[32px] shrink-0 rounded-[2px]",
                  "lg:w-[40px]",
                )}
              />
              <h3
                style={HEADING_FONT_STYLE}
                className={viewClass(
                  isMobile,
                  "font-semibold text-[1.25rem] leading-[1.2]",
                  "lg:text-[1.5rem] lg:leading-[1.2]",
                )}
              >
                {point.title}
              </h3>
              <p
                style={MUTED_TEXT_STYLE}
                className={viewClass(
                  isMobile,
                  "font-normal text-[1rem] leading-[1.55]",
                  "lg:text-[1.0625rem] lg:leading-[1.55]",
                )}
              >
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
  accent = "accent",
  steps = [],
  background,
  puck,
}: ProcessSectionProps) {
  if (hidden) return null;

  const { projectType, slots, viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";
  const hasStepImages = steps.some((step) => Boolean(step.image));

  return (
    <section
      id={id}
      data-section-type="Process"
      data-process-layout={layout}
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[24px] py-[64px]",
        "lg:p-[120px]",
      )}
    >
      <div
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1200px] flex-col gap-[32px]",
          "lg:gap-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "flex w-full flex-col items-start gap-[12px]",
            "lg:gap-[16px]",
          )}
        >
          <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
          <h2
            style={HEADING_FONT_STYLE}
            className={viewClass(
              isMobile,
              "max-w-[880px] font-semibold text-[1.875rem] leading-[1.12]",
              "lg:text-[3rem] lg:leading-[1.1]",
            )}
          >
            {heading}
          </h2>
          {subtitle && (
            <p
              style={MUTED_TEXT_STYLE}
              className={viewClass(
                isMobile,
                "max-w-[760px] font-normal text-[1.0625rem] leading-[1.55]",
                "lg:text-[1.25rem] lg:leading-[1.55]",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        {layout === "timeline" || !hasStepImages ? (
          <ol
            className={viewClass(
              isMobile,
              "flex w-full flex-col gap-[28px]",
              "lg:gap-[40px]",
            )}
          >
            {steps.map((step, idx) => (
              <li
                key={`${id}-step-${idx}`}
                className={viewClass(
                  isMobile,
                  "flex w-full flex-col items-start gap-[20px]",
                  "lg:gap-[32px]",
                )}
              >
                <div
                  aria-hidden="true"
                  style={{ backgroundColor: "var(--tpl-color-line, var(--border))" }}
                  className="h-px w-full shrink-0"
                />
                <div
                  className={viewClass(
                    isMobile,
                    "flex w-full flex-col items-start gap-[8px]",
                    "lg:flex-row lg:items-start lg:gap-[48px]",
                  )}
                >
                  <span
                    style={{
                      ...HEADING_FONT_STYLE,
                      color: tokenColorVar(accent, "--primary"),
                    }}
                    className={viewClass(
                      isMobile,
                      "font-semibold text-[2rem] leading-none",
                      "lg:w-[140px] lg:shrink-0 lg:text-[3rem]",
                    )}
                  >
                    {step.number}
                  </span>
                  <h3
                    style={HEADING_FONT_STYLE}
                    className={viewClass(
                      isMobile,
                      "font-semibold text-[1.25rem] leading-[1.2]",
                      "lg:w-[320px] lg:shrink-0 lg:text-[1.75rem]",
                    )}
                  >
                    {step.title}
                  </h3>
                  <p
                    style={MUTED_TEXT_STYLE}
                    className={viewClass(
                      isMobile,
                      "font-normal text-[1rem] leading-[1.55]",
                      "lg:flex-1 lg:text-[1.125rem]",
                    )}
                  >
                    {step.body}
                  </p>
                </div>
              </li>
            ))}
          </ol>
        ) : (
          <div
            className={viewClass(
              isMobile,
              "grid grid-cols-1 gap-6",
              layout === "grid-3" ? "lg:grid-cols-3" : "lg:grid-cols-2",
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
                    borderColor: "var(--tpl-color-line, var(--border))",
                  }}
                  className="flex flex-col justify-between gap-5 rounded-[20px] border border-solid p-6"
                >
                  <div className="flex flex-col gap-2">
                    <span
                      style={{
                        ...HEADING_FONT_STYLE,
                        color: tokenColorVar(accent, "--primary"),
                      }}
                      className="font-semibold text-[1.5rem] leading-none"
                    >
                      {step.number}
                    </span>
                    <h3 style={HEADING_FONT_STYLE} className="font-semibold text-[1.375rem] leading-[1.2]">
                      {step.title}
                    </h3>
                    <p style={MUTED_TEXT_STYLE} className="text-[1rem] leading-[1.55]">
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

  const { projectType = "mobile", slots, viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";
  const isMobileGallery =
    projectType === "mobile" &&
    deviceFrame !== "browser" &&
    deviceFrame !== "macbook" &&
    deviceFrame !== "tablet" &&
    deviceFrame !== "none";

  const desktopGridClass =
    columns === 2
      ? "lg:grid-cols-2"
      : columns === 4
        ? "lg:grid-cols-4"
        : columns === 5
          ? "lg:grid-cols-5"
          : "lg:grid-cols-3";

  const isStaggered = showcaseLayout === "staggered";

  return (
    <section
      id={id}
      data-section-type="ScreensGallery"
      data-variant={projectType}
      data-showcase-layout={showcaseLayout}
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[24px] py-[64px]",
        "lg:p-[120px]",
      )}
    >
      <div
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1200px] flex-col gap-[32px]",
          "lg:gap-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "flex w-full flex-col items-start gap-[12px]",
            "lg:gap-[16px]",
          )}
        >
          <SectionEyebrow text={eyebrow} accent="accent" isMobile={isMobile} />
          <h2
            style={HEADING_FONT_STYLE}
            className={viewClass(
              isMobile,
              "max-w-[880px] font-semibold text-[1.875rem] leading-[1.12]",
              "lg:text-[3rem] lg:leading-[1.1]",
            )}
          >
            {heading}
          </h2>
          {subtitle && (
            <p
              style={MUTED_TEXT_STYLE}
              className={viewClass(
                isMobile,
                "max-w-[760px] font-normal text-[1.0625rem] leading-[1.55]",
                "lg:text-[1.25rem] lg:leading-[1.55]",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={cn(
            isMobileGallery
              ? viewClass(
                  isMobile,
                  "flex w-full flex-row items-start gap-[16px] overflow-x-auto",
                  cn(
                    "lg:grid lg:gap-x-[32px] lg:gap-y-[56px] lg:overflow-visible",
                    desktopGridClass,
                  ),
                )
              : viewClass(
                  isMobile,
                  "grid w-full grid-cols-1 gap-[24px]",
                  cn("lg:gap-x-[32px] lg:gap-y-[48px]", desktopGridClass),
                ),
            isStaggered && !isMobile && "lg:pb-8",
          )}
        >
          {screens.map((item, idx) => {
            const screenSlot = getSlotDefinition(slots, item.image, "gallery.screen");
            return (
              <figure
                key={`${id}-screen-${idx}`}
                className={cn(
                  isMobileGallery
                    ? viewClass(
                        isMobile,
                        "flex w-[200px] shrink-0 flex-col items-center gap-[12px]",
                        "lg:w-full lg:shrink lg:gap-[16px]",
                      )
                    : viewClass(
                        isMobile,
                        "flex w-full flex-col items-center gap-[12px]",
                        "lg:gap-[16px]",
                      ),
                  isStaggered && idx % 2 === 1 && !isMobile && "lg:translate-y-8",
                )}
              >
                <ImageSlotFrame
                  image={item.image}
                  slotDefinition={screenSlot}
                  overrideDevice={deviceFrame}
                  fallbackRatio={projectType === "web" ? "16:10" : "9:19.5"}
                  projectType={projectType}
                  preferDeviceChrome
                  className={
                    isMobileGallery
                      ? viewClass(
                          isMobile,
                          "w-[200px] max-w-none rounded-[30px] p-[8px]",
                          "lg:w-full lg:max-w-[276px] lg:rounded-[46px] lg:p-[10px]",
                        )
                      : undefined
                  }
                  innerClassName={
                    isMobileGallery
                      ? viewClass(
                          isMobile,
                          "rounded-[22px]",
                          "lg:rounded-[36px]",
                        )
                      : undefined
                  }
                  placeholderIconClassName={
                    isMobileGallery
                      ? viewClass(
                          isMobile,
                          "size-[28px]",
                          "lg:size-[38px]",
                        )
                      : undefined
                  }
                />
                {item.caption && (
                  <figcaption
                    style={MUTED_TEXT_STYLE}
                    className={viewClass(
                      isMobile,
                      "text-center font-medium text-[0.875rem] leading-[1.4]",
                      "lg:text-[0.9375rem]",
                    )}
                  >
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
  puck?: PuckContext;
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
  puck,
}: ResultsSectionProps) {
  if (hidden) return null;

  const { viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";
  const isPrimaryBg = background === "primary";

  const desktopGridClass =
    columns === 2
      ? "lg:grid-cols-2"
      : columns === 4
        ? "lg:grid-cols-4"
        : "lg:grid-cols-3";

  const primaryTextColor = isPrimaryBg
    ? "var(--tpl-color-onPrimary, var(--primary-foreground))"
    : "var(--tpl-color-text, var(--foreground))";
  const secondaryTextColor = isPrimaryBg
    ? "rgba(255, 255, 255, 0.82)"
    : "var(--tpl-color-textMuted, var(--muted-foreground))";

  return (
    <section
      id={id}
      data-section-type="Results"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[24px] py-[64px]",
        "lg:p-[120px]",
      )}
    >
      <div
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1200px] flex-col gap-[32px]",
          "lg:gap-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "flex w-full flex-col items-start gap-[12px]",
            "lg:gap-[16px]",
          )}
        >
          <SectionEyebrow
            text={eyebrow}
            accent={accent || "primary"}
            colorOverride={isPrimaryBg ? primaryTextColor : undefined}
            isMobile={isMobile}
          />
          <h2
            style={{ ...HEADING_FONT_STYLE, color: primaryTextColor }}
            className={viewClass(
              isMobile,
              "max-w-[880px] font-semibold text-[1.875rem] leading-[1.12]",
              "lg:text-[3rem] lg:leading-[1.1]",
            )}
          >
            {heading}
          </h2>
          {subtitle && (
            <p
              style={{ color: secondaryTextColor }}
              className={viewClass(
                isMobile,
                "max-w-[760px] font-normal text-[1.0625rem] leading-[1.55]",
                "lg:text-[1.25rem] lg:leading-[1.55]",
              )}
            >
              {subtitle}
            </p>
          )}
        </div>

        <div
          className={viewClass(
            isMobile,
            "grid w-full grid-cols-1 gap-[12px]",
            cn("lg:gap-[24px]", desktopGridClass),
          )}
        >
          {metrics.map((metric, idx) => (
            <div
              key={`${id}-metric-${idx}`}
              style={
                isPrimaryBg
                  ? { backgroundColor: "rgba(255, 255, 255, 0.12)" }
                  : {
                      backgroundColor: tokenColorVar("surface", "--surface"),
                      borderColor: "var(--tpl-color-line, var(--border))",
                    }
              }
              className={cn(
                viewClass(
                  isMobile,
                  "flex flex-col items-start gap-[8px] rounded-[16px] p-[20px]",
                  "lg:gap-[12px] lg:rounded-[20px] lg:p-[32px]",
                ),
                !isPrimaryBg && "border border-solid",
              )}
            >
              <span
                style={{
                  ...HEADING_FONT_STYLE,
                  color: isPrimaryBg
                    ? primaryTextColor
                    : accent
                      ? tokenColorVar(accent, "--primary")
                      : primaryTextColor,
                }}
                className={viewClass(
                  isMobile,
                  "font-semibold text-[2.5rem] leading-none",
                  "lg:text-[4rem]",
                )}
              >
                {metric.value}
              </span>
              <span
                style={{ color: secondaryTextColor }}
                className={viewClass(
                  isMobile,
                  "font-medium text-[0.875rem] leading-[1.35]",
                  "lg:text-[1.0625rem] lg:leading-[1.4]",
                )}
              >
                {metric.label}
              </span>
            </div>
          ))}
        </div>

        {takeaways && takeaways.length > 0 && (
          <div
            className={viewClass(
              isMobile,
              "grid w-full grid-cols-1 gap-[24px]",
              "lg:grid-cols-2 lg:gap-[24px]",
            )}
          >
            {takeaways.map((item, idx) => (
              <div
                key={`${id}-takeaway-${idx}`}
                className={viewClass(
                  isMobile,
                  "flex flex-col items-start gap-[6px]",
                  "lg:gap-[8px]",
                )}
              >
                <span
                  style={{ ...HEADING_FONT_STYLE, color: primaryTextColor }}
                  className={viewClass(
                    isMobile,
                    "font-semibold text-[1.125rem] leading-[1.2]",
                    "lg:text-[1.375rem]",
                  )}
                >
                  {item.title}
                </span>
                <p
                  style={{ color: secondaryTextColor }}
                  className={viewClass(
                    isMobile,
                    "font-normal text-[1rem] leading-[1.55]",
                    "lg:text-[1.0625rem]",
                  )}
                >
                  {item.body}
                </p>
              </div>
            ))}
          </div>
        )}

        {closing && (
          <p
            style={{ color: primaryTextColor }}
            className={viewClass(
              isMobile,
              "max-w-[820px] font-normal text-[1.125rem] leading-[1.55]",
              "lg:text-[1.25rem]",
            )}
          >
            {closing}
          </p>
        )}
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

  const { slots, viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";
  const avatarSlot = getSlotDefinition(slots, avatar, "quote.avatar");
  const normalizedQuote = quote.replace(/^[“"]+|[”"]+$/g, "").trim();

  return (
    <section
      id={id}
      data-section-type="Quote"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[24px] py-[64px]",
        "lg:p-[120px]",
      )}
    >
      <blockquote
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1200px] flex-col items-center gap-[24px] text-center",
          "lg:gap-[36px]",
        )}
      >
        <QuoteMarkGlyph
          style={{ color: tokenColorVar("primary", "--primary") }}
          className={viewClass(
            isMobile,
            "h-[24px] w-[32px] shrink-0",
            "lg:h-[36px] lg:w-[48px]",
          )}
        />
        <p
          style={HEADING_FONT_STYLE}
          className={viewClass(
            isMobile,
            "max-w-[980px] font-semibold text-[1.5rem] leading-[1.3]",
            "lg:text-[2.5rem] lg:leading-[1.25]",
          )}
        >
          “{normalizedQuote}”
        </p>
        <footer
          className={viewClass(
            isMobile,
            "flex items-center justify-center gap-[12px]",
            "lg:gap-[16px]",
          )}
        >
          {avatar && (
            <div
              className={viewClass(
                isMobile,
                "size-[48px] shrink-0",
                "lg:size-[64px]",
              )}
            >
              <ImageSlotFrame
                image={avatar}
                slotDefinition={avatarSlot}
                fallbackRatio="1:1"
                compact
                className="size-full rounded-full"
                innerClassName="size-full rounded-full"
                placeholderIconClassName={viewClass(
                  isMobile,
                  "size-[16px]",
                  "lg:size-[22px]",
                )}
              />
            </div>
          )}
          <div className="flex flex-col items-start gap-[2px] text-left">
            <cite
              className={viewClass(
                isMobile,
                "font-bold not-italic text-[1rem] leading-[1.3]",
                "lg:text-[1.125rem]",
              )}
            >
              {author}
            </cite>
            {role && (
              <span
                style={MUTED_TEXT_STYLE}
                className={viewClass(
                  isMobile,
                  "font-normal text-[0.8125rem] leading-[1.4]",
                  "lg:text-[0.9375rem]",
                )}
              >
                {role}
              </span>
            )}
          </div>
        </footer>
      </blockquote>
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
  puck?: PuckContext;
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
  puck,
}: CtaSectionProps) {
  if (hidden) return null;

  const { viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";

  return (
    <section
      id={id}
      data-section-type="CTA"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[24px] pt-[64px] pb-[72px]",
        "lg:px-[120px] lg:pt-[96px] lg:pb-[120px]",
      )}
    >
      <div
        style={{
          backgroundColor: tokenColorVar("surface", "--surface"),
          borderColor: "var(--tpl-color-line, var(--border))",
        }}
        className={viewClass(
          isMobile,
          "mx-auto flex w-full max-w-[1200px] flex-col items-center gap-[16px] rounded-[24px] border border-solid px-[24px] py-[48px] text-center",
          "lg:gap-[24px] lg:rounded-[32px] lg:px-[64px] lg:py-[88px]",
        )}
      >
        <h2
          style={HEADING_FONT_STYLE}
          className={viewClass(
            isMobile,
            "max-w-[780px] font-semibold text-[2rem] leading-[1.1]",
            "lg:text-[3.5rem] lg:leading-[1.08]",
          )}
        >
          {heading}
        </h2>
        {subheading && (
          <p
            style={MUTED_TEXT_STYLE}
            className={viewClass(
              isMobile,
              "max-w-[620px] font-normal text-[1rem] leading-[1.55]",
              "lg:text-[1.25rem] lg:leading-[1.55]",
            )}
          >
            {subheading}
          </p>
        )}

        <div
          className={viewClass(
            isMobile,
            "flex w-full flex-col items-stretch gap-[10px] pt-[12px]",
            "lg:w-auto lg:flex-row lg:items-center lg:justify-center lg:gap-[12px] lg:pt-[16px]",
          )}
        >
          <a
            href={primaryHref}
            style={{
              backgroundColor: tokenColorVar(accent, "--primary"),
              color: "var(--tpl-color-onPrimary, var(--primary-foreground))",
            }}
            className={viewClass(
              isMobile,
              "inline-flex w-full items-center justify-center rounded-full px-[24px] py-[15px] font-bold text-[0.9375rem] leading-none transition-opacity hover:opacity-90",
              "lg:w-auto lg:px-[28px] lg:py-[16px] lg:text-[1rem]",
            )}
          >
            {primaryLabel}
          </a>
          {secondaryLabel && secondaryHref && (
            <a
              href={secondaryHref}
              style={{
                borderColor: "var(--tpl-color-line, var(--border))",
                color: "var(--tpl-color-text, var(--foreground))",
              }}
              className={viewClass(
                isMobile,
                "inline-flex w-full items-center justify-center rounded-full border border-solid px-[24px] py-[15px] font-medium text-[0.9375rem] leading-none transition-colors",
                "lg:w-auto lg:px-[28px] lg:py-[16px] lg:text-[1rem]",
              )}
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

  const { projectType, slots, theme, viewport } = readRenderMetadata(puck);
  const isMobile = viewport === "mobile";
  const customSlot = getSlotDefinition(slots, image, "custom.image");

  if (layout === "split-right" || layout === "split-left") {
    const isLeft = layout === "split-left";
    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout={layout}
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "overflow-hidden px-[24px] py-[64px]",
          "lg:p-[120px]",
        )}
      >
        <div
          style={{
            backgroundColor: tokenColorVar("surface", "--surface"),
            borderColor: "var(--tpl-color-line, var(--border))",
          }}
          className={viewClass(
            isMobile,
            "mx-auto grid max-w-[1200px] items-center gap-8 rounded-[24px] border border-solid p-6",
            "lg:grid-cols-12 lg:gap-12 lg:rounded-[32px] lg:p-12",
          )}
        >
          <div
            className={cn(
              "flex flex-col gap-5",
              !isMobile && (isLeft ? "lg:order-2 lg:col-span-7" : "lg:col-span-7"),
            )}
          >
            <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-semibold text-[1.75rem] leading-[1.12]",
                "lg:text-[2.5rem] lg:leading-[1.1]",
              )}
            >
              {heading}
            </h2>
            <RichTextView
              value={body}
              idPrefix={`${id}-custom`}
              style={MUTED_TEXT_STYLE}
              className="text-[1.125rem] leading-[1.6]"
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
                    <span className="text-[1rem] leading-[1.55]">{bullet.text}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {image && (
            <div
              className={cn(
                "w-full",
                !isMobile && (isLeft ? "lg:order-1 lg:col-span-5" : "lg:col-span-5"),
              )}
            >
              <ImageSlotFrame
                image={image}
                slotDefinition={customSlot}
                fallbackRatio={projectType === "web" ? "16:10" : "9:19.5"}
                projectType={projectType}
                preferDeviceChrome
                presentation={mockupStyle}
                glow={false}
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
        className={viewClass(
          isMobile,
          "px-[24px] py-[64px]",
          "lg:p-[120px]",
        )}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-3">
            <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-semibold text-[1.875rem] leading-[1.12]",
                "lg:text-[3rem] lg:leading-[1.1]",
              )}
            >
              {heading}
            </h2>
            <RichTextView
              value={body}
              idPrefix={`${id}-custom`}
              style={MUTED_TEXT_STYLE}
              className="text-[1.125rem] leading-[1.6]"
            />
          </div>

          {cards && cards.length > 0 && (
            <div
              className={viewClass(
                isMobile,
                "grid grid-cols-1 gap-4",
                "lg:grid-cols-4 lg:gap-6",
              )}
            >
              {cards.map((card, idx) => (
                <article
                  key={`${id}-comp-${idx}`}
                  style={{
                    backgroundColor: tokenColorVar("surface", "--surface"),
                    borderColor: card.highlighted
                      ? tokenColorVar(accent, "--primary")
                      : "var(--tpl-color-line, var(--border))",
                  }}
                  className={cn(
                    "flex flex-col justify-between gap-4 rounded-[20px] border p-6",
                    card.highlighted ? "border-2" : "border-solid",
                  )}
                >
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                      <h3 style={HEADING_FONT_STYLE} className="font-semibold text-[1.25rem]">
                        {card.title}
                      </h3>
                      {card.highlighted && (
                        <span
                          style={{
                            backgroundColor: tokenColorVar(accent, "--primary"),
                            color: "var(--tpl-color-onPrimary, var(--primary-foreground))",
                          }}
                          className="rounded-full px-2.5 py-0.5 font-semibold text-[0.6875rem] uppercase"
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
                        className="font-semibold text-[0.8125rem]"
                      >
                        {card.subtitle}
                      </span>
                    )}
                    <div
                      aria-hidden="true"
                      style={{
                        backgroundColor: card.highlighted
                          ? tokenColorVar(accent, "--primary")
                          : "var(--tpl-color-line, var(--border))",
                      }}
                      className="h-px w-full"
                    />
                    <p style={MUTED_TEXT_STYLE} className="whitespace-pre-line text-[0.9375rem] leading-[1.55]">
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
        className={viewClass(
          isMobile,
          "px-[24px] py-[64px]",
          "lg:p-[120px]",
        )}
      >
        <div className="mx-auto flex max-w-[1200px] flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-3">
            <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-semibold text-[1.875rem] leading-[1.12]",
                "lg:text-[3rem] lg:leading-[1.1]",
              )}
            >
              {heading}
            </h2>
          </div>

          <div
            style={{
              backgroundColor: tokenColorVar("surface", "--surface"),
              borderColor: "var(--tpl-color-line, var(--border))",
            }}
            className={viewClass(
              isMobile,
              "grid gap-6 rounded-[20px] border border-solid p-6",
              "lg:grid-cols-12 lg:p-8",
            )}
          >
            <div
              style={{
                backgroundColor: tokenColorVar("background", "--background"),
                borderColor: "var(--tpl-color-line, var(--border))",
              }}
              className={cn(
                "flex flex-col justify-between gap-4 rounded-[16px] border border-solid p-6",
                !isMobile && "lg:col-span-4",
              )}
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
                      color: "var(--tpl-color-onPrimary, var(--primary-foreground))",
                    }}
                    className="inline-flex size-12 items-center justify-center rounded-xl font-bold text-[1.125rem]"
                  >
                    UX
                  </span>
                )}
                <RichTextView
                  value={body}
                  idPrefix={`${id}-persona`}
                  className="text-[1rem] leading-[1.55]"
                />
              </div>
            </div>

            {cards && cards.length > 0 && (
              <div
                className={viewClass(
                  isMobile,
                  "grid grid-cols-1 gap-4",
                  "lg:col-span-8 lg:grid-cols-3",
                )}
              >
                {cards.map((card, idx) => (
                  <div
                    key={`${id}-persona-card-${idx}`}
                    style={{
                      backgroundColor: tokenColorVar("background", "--background"),
                      borderColor: "var(--tpl-color-line, var(--border))",
                    }}
                    className="flex flex-col gap-2.5 rounded-[16px] border border-solid p-5"
                  >
                    <span
                      style={{ color: tokenColorVar(accent, "--primary") }}
                      className="font-semibold text-[0.75rem] uppercase tracking-wider"
                    >
                      {card.title}
                    </span>
                    {card.subtitle && (
                      <span className="font-semibold text-[0.9375rem]">{card.subtitle}</span>
                    )}
                    <p style={MUTED_TEXT_STYLE} className="whitespace-pre-line text-[0.875rem] leading-[1.55]">
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
        className={viewClass(
          isMobile,
          "px-[24px] py-[64px]",
          "lg:p-[120px]",
        )}
      >
        <div className="mx-auto flex min-w-0 max-w-[1200px] flex-col gap-10">
          <div className="flex max-w-3xl flex-col gap-3">
            <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-semibold text-[1.875rem] leading-[1.12]",
                "lg:text-[3rem] lg:leading-[1.1]",
              )}
            >
              {heading}
            </h2>
            <RichTextView
              value={body}
              idPrefix={`${id}-ds`}
              style={MUTED_TEXT_STYLE}
              className="text-[1.125rem] leading-[1.6]"
            />
          </div>

          <div
            className={viewClass(
              isMobile,
              "grid min-w-0 grid-cols-1 gap-6",
              "lg:grid-cols-12",
            )}
          >
            <div
              style={{
                backgroundColor: tokenColorVar("surface", "--surface"),
                borderColor: "var(--tpl-color-line, var(--border))",
              }}
              className={cn(
                "flex min-w-0 flex-col justify-between gap-6 rounded-[20px] border border-solid p-6",
                !isMobile && "lg:col-span-5 lg:p-8",
              )}
            >
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <span
                  style={{
                    ...HEADING_FONT_STYLE,
                    color: tokenColorVar(accent, "--primary"),
                  }}
                  className="font-semibold text-[3.5rem] leading-none"
                >
                  Aa
                </span>
                <span style={MUTED_TEXT_STYLE} className="font-mono text-[0.75rem] uppercase">
                  {headingWeights}
                </span>
              </div>

              <div className="flex min-w-0 flex-col gap-2">
                <span style={HEADING_FONT_STYLE} className="break-words font-semibold text-[1.5rem]">
                  {headingFamily}
                </span>
                <span style={MUTED_TEXT_STYLE} className="break-words text-[0.875rem]">
                  Body: {bodyFamily} · Aa Bb Cc Dd Ee Ff Gg 0123456789
                </span>
              </div>
            </div>

            <div
              style={{
                backgroundColor: tokenColorVar("surface", "--surface"),
                borderColor: "var(--tpl-color-line, var(--border))",
              }}
              className={cn(
                "flex min-w-0 flex-col justify-between gap-4 rounded-[20px] border border-solid p-6",
                !isMobile && "lg:col-span-7 lg:p-8",
              )}
            >
              <span style={MUTED_TEXT_STYLE} className="font-medium text-[0.75rem] uppercase tracking-wider">
                Type hierarchy
              </span>
              <div className="flex min-w-0 flex-col gap-3">
                <div
                  style={{ borderColor: "var(--tpl-color-line, var(--border))" }}
                  className="flex min-w-0 flex-col gap-1 border-b pb-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span style={HEADING_FONT_STYLE} className="min-w-0 break-words font-semibold text-[1.5rem]">
                    Display Headline
                  </span>
                  <span style={MUTED_TEXT_STYLE} className="shrink-0 font-mono text-[0.75rem]">
                    Heading · Bold
                  </span>
                </div>
                <div
                  style={{ borderColor: "var(--tpl-color-line, var(--border))" }}
                  className="flex min-w-0 flex-col gap-1 border-b pb-2.5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4"
                >
                  <span style={HEADING_FONT_STYLE} className="min-w-0 break-words font-semibold text-[1.125rem]">
                    Section Title &amp; Card Header
                  </span>
                  <span style={MUTED_TEXT_STYLE} className="shrink-0 font-mono text-[0.75rem]">
                    Subhead · Semibold
                  </span>
                </div>
                <div className="flex min-w-0 flex-col gap-1 sm:flex-row sm:items-baseline sm:justify-between sm:gap-4">
                  <span className="min-w-0 break-words text-[0.9375rem]">
                    Body copy designed for high-contrast dark &amp; light legibility.
                  </span>
                  <span style={MUTED_TEXT_STYLE} className="shrink-0 font-mono text-[0.75rem]">
                    Body · Regular
                  </span>
                </div>
              </div>
            </div>
          </div>

          {swatches && swatches.length > 0 && (
            <div
              className={viewClass(
                isMobile,
                "grid grid-cols-2 gap-4",
                "lg:grid-cols-5",
              )}
            >
              {swatches.map((swatch, idx) => {
                const liveHex = theme?.colors[swatch.token]?.toUpperCase();
                return (
                  <div
                    key={`${id}-swatch-${idx}`}
                    style={{
                      backgroundColor: tokenColorVar("surface", "--surface"),
                      borderColor: "var(--tpl-color-line, var(--border))",
                    }}
                    className="overflow-hidden rounded-[16px] border border-solid"
                  >
                    <div
                      style={{
                        backgroundColor: tokenColorVar(swatch.token, "--primary"),
                        borderColor: "var(--tpl-color-line, var(--border))",
                      }}
                      className="h-20 w-full border-b"
                    />
                    <div className="flex flex-col gap-0.5 p-3.5">
                      <span className="truncate font-semibold text-[0.875rem]">{swatch.label}</span>
                      <span style={MUTED_TEXT_STYLE} className="font-mono text-[0.75rem] uppercase">
                        {liveHex ?? swatch.token}
                      </span>
                      {swatch.role && (
                        <span style={MUTED_TEXT_STYLE} className="truncate text-[0.75rem]">
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
      className={viewClass(
        isMobile,
        "px-[24px] py-[64px]",
        "lg:p-[120px]",
      )}
    >
      <div
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1200px] flex-col gap-[32px]",
          "lg:gap-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "flex flex-col gap-[12px]",
            "lg:gap-[16px]",
          )}
        >
          <SectionEyebrow text={eyebrow} accent={accent} isMobile={isMobile} />
          <h2
            style={HEADING_FONT_STYLE}
            className={viewClass(
              isMobile,
              "max-w-[880px] font-semibold text-[1.875rem] leading-[1.12]",
              "lg:text-[3rem] lg:leading-[1.1]",
            )}
          >
            {heading}
          </h2>
          <RichTextView
            value={body}
            idPrefix={`${id}-custom`}
            style={MUTED_TEXT_STYLE}
            className={viewClass(
              isMobile,
              "max-w-[760px] font-normal text-[1.0625rem] leading-[1.55]",
              "lg:text-[1.25rem] lg:leading-[1.55]",
            )}
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
