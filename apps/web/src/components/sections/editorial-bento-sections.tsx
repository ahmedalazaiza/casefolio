import {
  ArrowDown,
  ArrowDownToLine,
  CircleDot,
  Coins,
  CreditCard,
  Globe,
  Layers,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Wallet,
} from "lucide-react";
import type { CSSProperties } from "react";
import { ImageSlotFrame } from "@/components/sections/image-slot-frame";
import { RichTextView } from "@/components/sections/rich-text-view";
import { isSafeRichTextHref } from "@/lib/template/rich-text";
import type {
  CtaSocialPlatform,
  CustomMediaItem,
  CustomSectionLayout,
  GalleryDeviceFrame,
  ImageSlotValue,
  MockupStyle,
  RichTextValue,
  TemplateProjectType,
  TemplateSlotDefinition,
  TemplateTheme,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";

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

export function resolveEditorialToneStyle(
  tone: CustomMediaItem["tone"] | "peri-gradient" = "stone",
): CSSProperties {
  switch (tone) {
    case "peri":
      return {
        backgroundColor:
          "var(--tpl-color-panelPeri, color-mix(in oklab, var(--tpl-color-primary, var(--primary)) 14%, var(--tpl-color-background, var(--background))))",
        color: "var(--tpl-color-text, var(--foreground))",
      };
    case "peri-gradient":
      return {
        backgroundImage:
          "linear-gradient(156deg, var(--tpl-color-panelPeri, color-mix(in oklab, var(--tpl-color-primary, var(--primary)) 14%, var(--tpl-color-background, var(--background)))) 14%, var(--tpl-color-panelPeriDeep, color-mix(in oklab, var(--tpl-color-primary, var(--primary)) 24%, var(--tpl-color-background, var(--background)))) 86%)",
        color: "var(--tpl-color-text, var(--foreground))",
      };
    case "butter":
      return {
        backgroundColor:
          "var(--tpl-color-panelButter, color-mix(in oklab, var(--tpl-color-accent, var(--tpl-color-secondary, var(--accent))) 22%, var(--tpl-color-surface, var(--surface))))",
        color: "var(--tpl-color-text, var(--foreground))",
      };
    case "ink":
      return {
        backgroundImage:
          "linear-gradient(147deg, color-mix(in oklab, var(--tpl-color-ink, var(--tpl-color-text, var(--foreground))) 86%, var(--tpl-color-onPrimary, var(--primary-foreground))) 14%, var(--tpl-color-ink, var(--tpl-color-text, var(--foreground))) 86%)",
        color: "var(--tpl-color-onPrimary, var(--primary-foreground))",
      };
    case "surface":
      return {
        backgroundColor: "var(--tpl-color-surface, var(--surface))",
        borderColor: "var(--tpl-color-line, var(--border))",
        color: "var(--tpl-color-text, var(--foreground))",
      };
    case "clear":
      return {
        backgroundColor: "transparent",
        borderColor: "var(--tpl-color-line, var(--border))",
      };
    case "stone":
    default:
      return {
        backgroundColor:
          "var(--tpl-color-panelStone, var(--tpl-color-surfaceAlt, var(--tpl-color-surface, var(--sunken))))",
        color: "var(--tpl-color-text, var(--foreground))",
      };
  }
}

function EditorialFeatureIcon({
  iconKey,
  className = "size-6",
}: {
  iconKey?: string;
  className?: string;
}) {
  const clean = iconKey?.trim().toLowerCase() ?? "";
  switch (clean) {
    case "wallet":
      return <Wallet className={className} aria-hidden="true" />;
    case "send":
      return <Send className={className} aria-hidden="true" />;
    case "arrow-down-to-line":
    case "earn":
    case "receive":
      return <ArrowDownToLine className={className} aria-hidden="true" />;
    case "coins":
      return <Coins className={className} aria-hidden="true" />;
    case "refresh-cw":
    case "swap":
      return <RefreshCw className={className} aria-hidden="true" />;
    case "credit-card":
    case "card":
      return <CreditCard className={className} aria-hidden="true" />;
    case "circle-dot":
    case "calm":
      return <CircleDot className={className} aria-hidden="true" />;
    case "shield":
    case "shield-check":
      return <ShieldCheck className={className} aria-hidden="true" />;
    default:
      return <Sparkles className={className} aria-hidden="true" />;
  }
}

function SocialPlatformIcon({
  platform,
  className = "size-5",
}: {
  platform: CtaSocialPlatform;
  className?: string;
}) {
  switch (platform) {
    case "layerat":
      return <Layers className={className} aria-hidden="true" />;
    case "dribbble":
      return (
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className={className} aria-hidden="true">
          <circle cx="12" cy="12" r="9.5" />
          <path d="M8.56 2.75c4.37 6.03 6.02 9.42 8.03 17.72" />
          <path d="M19.13 5.09C15.22 9.14 10 10.44 2.25 10.94" />
          <path d="M21.75 12.84c-6.62-1.41-12.14 1-16.38 6.32" />
        </svg>
      );
    case "linkedin":
      return (
        <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden="true">
          <path d="M6.94 8.5H3.56V20h3.38V8.5ZM5.25 3.06a1.96 1.96 0 1 0 0 3.92 1.96 1.96 0 0 0 0-3.92ZM20.44 13.02c0-3.04-1.62-4.46-3.79-4.46-1.75 0-2.53.96-2.97 1.64V8.5h-3.38c.04.93 0 11.5 0 11.5h3.38v-6.42c0-.34.02-.68.13-.93.27-.68.89-1.39 1.93-1.39 1.36 0 1.91 1.04 1.91 2.56V20h3.38v-6.98h-.59Z" />
        </svg>
      );
    case "website":
    default:
      return <Globe className={className} aria-hidden="true" />;
  }
}

function renderTitleWithMutedPhrase(title: string, mutedPhrase?: string) {
  const phrase = mutedPhrase?.trim();
  if (!phrase) return title;
  const lowerTitle = title.toLowerCase();
  const lowerPhrase = phrase.toLowerCase();
  const matchIdx = lowerTitle.indexOf(lowerPhrase);
  if (matchIdx < 0) return title;

  const before = title.slice(0, matchIdx);
  const matched = title.slice(matchIdx, matchIdx + phrase.length);
  const after = title.slice(matchIdx + phrase.length);

  return (
    <>
      {before}
      <span style={MUTED_TEXT_STYLE}>{matched}</span>
      {after}
    </>
  );
}

const DARK_BEZEL_COLOR = "var(--tpl-color-ink, var(--tpl-color-text, var(--foreground)))";
const INVERSE_CHIP_TEXT = "var(--tpl-color-onPrimary, var(--primary-foreground))";

export interface EditorialHeroStageProps {
  id: string;
  studioName?: string;
  eyebrow?: string;
  title: string;
  titleMuted?: string;
  subtitle?: string;
  ctaLabel?: string;
  ctaHref?: string;
  tags?: Array<{ label: string }>;
  logo?: ImageSlotValue;
  mockup?: ImageSlotValue;
  background: string;
  accent?: string;
  projectType: TemplateProjectType;
  slots?: Record<string, TemplateSlotDefinition>;
  isMobile: boolean;
}

export function EditorialHeroStage({
  id,
  studioName,
  eyebrow,
  title,
  titleMuted,
  subtitle,
  ctaLabel,
  ctaHref,
  tags,
  logo,
  mockup,
  background,
  projectType,
  slots,
  isMobile,
}: EditorialHeroStageProps) {
  const logoSlot = getSlotDefinition(slots, logo, "hero.logo");
  const mockupSlot = getSlotDefinition(slots, mockup, "hero.mockup");
  const resolvedWordmark = studioName?.trim() || eyebrow?.trim();
  const resolvedCtaLabel = ctaLabel?.trim() || "More projects";
  const resolvedCtaHref =
    ctaHref && isSafeRichTextHref(ctaHref) ? ctaHref.trim() : "#Overview-1";

  return (
    <section
      id={id}
      data-section-type="Hero"
      data-variant={projectType}
      data-hero-layout="editorial-stage"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "overflow-hidden px-[20px] pt-[28px] pb-[48px]",
        "lg:px-[56px] lg:pt-[48px] lg:pb-[64px]",
      )}
    >
      <div className="mx-auto flex max-w-[1320px] flex-col gap-[32px] lg:gap-[48px]">
        {(logo || resolvedWordmark) && (
          <div className="flex items-center gap-3">
            {logo && (
              <div className="size-9 shrink-0 overflow-hidden rounded-xl">
                <ImageSlotFrame
                  image={logo}
                  slotDefinition={logoSlot}
                  fallbackRatio="1:1"
                  compact
                  className="size-full rounded-xl"
                  innerClassName="size-full"
                />
              </div>
            )}
            {resolvedWordmark && (
              <span
                style={HEADING_FONT_STYLE}
                className={viewClass(
                  isMobile,
                  "font-bold text-[1.1875rem] leading-[1.2] tracking-[-0.025em]",
                  "lg:text-[1.5rem]",
                )}
              >
                {resolvedWordmark}
              </span>
            )}
          </div>
        )}

        <div className="flex max-w-[980px] flex-col gap-4">
          <h1
            style={HEADING_FONT_STYLE}
            className={viewClass(
              isMobile,
              "font-medium text-[2.25rem] leading-[1.1] tracking-[-0.028em]",
              "lg:text-[4.25rem] lg:leading-[1.08]",
            )}
          >
            {renderTitleWithMutedPhrase(title, titleMuted)}
          </h1>

          {subtitle && (
            <p
              style={MUTED_TEXT_STYLE}
              className={viewClass(
                isMobile,
                "max-w-[720px] text-[1rem] leading-[1.55]",
                "lg:text-[1.1875rem]",
              )}
            >
              {subtitle}
            </p>
          )}

          {tags && tags.length > 0 && (
            <ul className="flex flex-wrap items-center gap-2 pt-1">
              {tags.map((tag, idx) => (
                <li
                  key={`${id}-tag-${idx}`}
                  style={{
                    borderColor: "var(--tpl-color-line, var(--border))",
                  }}
                  className="rounded-full border px-3.5 py-1.5 font-medium text-[0.8125rem]"
                >
                  {tag.label}
                </li>
              ))}
            </ul>
          )}
        </div>

        {mockup && (
          <div className="relative pb-7">
            <div
              data-slot="hero-editorial-stage"
              style={resolveEditorialToneStyle("peri-gradient")}
              className={viewClass(
                isMobile,
                "relative flex h-[360px] w-full items-start justify-center overflow-hidden rounded-[28px] pt-[36px]",
                "lg:h-[580px] lg:rounded-[36px] lg:pt-[72px]",
              )}
            >
              <div
                className={viewClass(
                  isMobile,
                  "-rotate-[18deg] translate-y-2 transition-transform duration-300",
                  "lg:-rotate-[28deg] lg:translate-y-4",
                )}
              >
                <ImageSlotFrame
                  image={mockup}
                  slotDefinition={mockupSlot}
                  fallbackRatio="9:19.5"
                  projectType={projectType}
                  preferDeviceChrome
                  bezelColor={DARK_BEZEL_COLOR}
                  showDynamicIsland
                  className={viewClass(
                    isMobile,
                    "w-[216px] max-w-none rounded-[36px] p-[8px] shadow-2xl",
                    "lg:w-[320px] lg:rounded-[48px] lg:p-[11px]",
                  )}
                  innerClassName={viewClass(
                    isMobile,
                    "rounded-[28px]",
                    "lg:rounded-[38px]",
                  )}
                />
              </div>
            </div>

            <a
              href={resolvedCtaHref}
              style={{
                backgroundColor: DARK_BEZEL_COLOR,
                color: INVERSE_CHIP_TEXT,
              }}
              className={viewClass(
                isMobile,
                "absolute bottom-0 left-1/2 z-10 inline-flex -translate-x-1/2 items-center gap-3 rounded-full py-1.5 pr-1.5 pl-5 font-medium text-[0.875rem] shadow-lg transition-transform hover:scale-[1.02]",
                "lg:gap-4 lg:py-2 lg:pr-2 lg:pl-7 lg:text-[0.9375rem]",
              )}
            >
              <span className="whitespace-nowrap">{resolvedCtaLabel}</span>
              <span
                style={{
                  backgroundColor: "var(--tpl-color-surface, var(--surface))",
                  color: DARK_BEZEL_COLOR,
                }}
                className="inline-flex size-9 items-center justify-center rounded-full"
              >
                <ArrowDown className="size-4" aria-hidden="true" />
              </span>
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

export function EditorialBandOffsetGallery({
  id,
  eyebrow,
  heading,
  subtitle,
  deviceFrame = "iphone",
  screens,
  background,
  projectType,
  slots,
  isMobile,
}: {
  id: string;
  eyebrow?: string;
  heading: string;
  subtitle?: string;
  deviceFrame?: GalleryDeviceFrame;
  screens: Array<{ caption: string; image: ImageSlotValue }>;
  background: string;
  projectType: TemplateProjectType;
  slots?: Record<string, TemplateSlotDefinition>;
  isMobile: boolean;
}) {
  const rowOne = screens.slice(0, 3);
  const rowTwo = screens.slice(3, 6);
  const extraRows = screens.slice(6);

  const renderPhoneFigure = (item: { caption: string; image: ImageSlotValue }, idx: number) => {
    const screenSlot = getSlotDefinition(slots, item.image, "gallery.screen");
    return (
      <figure
        key={`${id}-band-screen-${idx}`}
        className={viewClass(
          isMobile,
          "flex w-[204px] shrink-0 flex-col items-center gap-2.5",
          "lg:w-full lg:max-w-[280px] lg:shrink lg:gap-3",
        )}
      >
        <ImageSlotFrame
          image={item.image}
          slotDefinition={screenSlot}
          overrideDevice={deviceFrame}
          fallbackRatio="9:19.5"
          projectType={projectType}
          preferDeviceChrome
          bezelColor={DARK_BEZEL_COLOR}
          showDynamicIsland
          className={viewClass(
            isMobile,
            "w-[204px] max-w-none rounded-[32px] p-[8px] shadow-xl",
            "lg:w-full lg:max-w-[280px] lg:rounded-[46px] lg:p-[10px] lg:shadow-2xl",
          )}
          innerClassName={viewClass(isMobile, "rounded-[24px]", "lg:rounded-[36px]")}
        />
        {item.caption && (
          <figcaption
            style={MUTED_TEXT_STYLE}
            className="text-center font-medium text-[0.8125rem] leading-[1.4]"
          >
            {item.caption}
          </figcaption>
        )}
      </figure>
    );
  };

  return (
    <section
      id={id}
      data-section-type="ScreensGallery"
      data-variant={projectType}
      data-showcase-layout="band-offset"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "overflow-hidden px-[20px] py-[48px]",
        "lg:px-[56px] lg:py-[88px]",
      )}
    >
      <div className="mx-auto flex max-w-[1320px] flex-col gap-10 lg:gap-14">
        {(eyebrow || subtitle || heading) && (
          <div className="flex max-w-3xl flex-col gap-2">
            {eyebrow && (
              <span
                style={{ color: tokenColorVar("accent", "--primary") }}
                className="font-medium text-[0.75rem] uppercase tracking-[0.12em]"
              >
                {eyebrow}
              </span>
            )}
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-medium text-[1.75rem] leading-[1.15]",
                "lg:text-[2.25rem]",
              )}
            >
              {heading}
            </h2>
            {subtitle && (
              <p style={MUTED_TEXT_STYLE} className="text-[1rem] leading-[1.55] lg:text-[1.125rem]">
                {subtitle}
              </p>
            )}
          </div>
        )}

        <div className="relative">
          {!isMobile && (
            <div
              aria-hidden="true"
              style={resolveEditorialToneStyle("peri-gradient")}
              className="pointer-events-none absolute inset-x-6 top-[16%] bottom-[16%] rounded-[36px]"
            />
          )}

          {isMobile ? (
            <div
              style={resolveEditorialToneStyle("peri-gradient")}
              className="flex flex-row items-start gap-4 overflow-x-auto rounded-[28px] p-5"
            >
              {screens.map((item, idx) => renderPhoneFigure(item, idx))}
            </div>
          ) : (
            <div className="relative z-10 flex flex-col gap-12 py-4">
              {rowOne.length > 0 && (
                <div className="grid grid-cols-3 justify-items-center gap-8 pl-20">
                  {rowOne.map((item, idx) => renderPhoneFigure(item, idx))}
                </div>
              )}
              {rowTwo.length > 0 && (
                <div className="grid grid-cols-3 justify-items-center gap-8 pr-20">
                  {rowTwo.map((item, idx) => renderPhoneFigure(item, idx + 3))}
                </div>
              )}
              {extraRows.length > 0 && (
                <div className="grid grid-cols-3 justify-items-center gap-8">
                  {extraRows.map((item, idx) => renderPhoneFigure(item, idx + 6))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}

export function EditorialResultsPanel({
  id,
  introLabel,
  introBody,
  heading,
  disclaimer,
  subtitle,
  columns = 4,
  metrics,
  takeaways,
  closing,
  background,
  isMobile,
}: {
  id: string;
  introLabel?: string;
  introBody?: string;
  heading: string;
  disclaimer?: string;
  subtitle?: string;
  columns?: 2 | 3 | 4;
  metrics: Array<{ value: string; label: string; tag?: string }>;
  takeaways?: Array<{ title: string; body: string }>;
  closing?: string;
  background: string;
  isMobile: boolean;
}) {
  const desktopCols =
    columns === 2 ? "lg:grid-cols-2" : columns === 3 ? "lg:grid-cols-3" : "lg:grid-cols-4";

  return (
    <section
      id={id}
      data-section-type="Results"
      data-results-layout="editorial-panel"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[20px] pt-[48px] pb-[32px]",
        "lg:px-[56px] lg:pt-[72px] lg:pb-[48px]",
      )}
    >
      <div className="mx-auto flex max-w-[1320px] flex-col gap-12 lg:gap-16">
        {(introLabel || introBody) && (
          <div
            className={viewClass(
              isMobile,
              "flex flex-col items-start gap-3",
              "lg:flex-row lg:items-start lg:gap-16",
            )}
          >
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-medium text-[1.625rem] leading-[1.2]",
                "lg:w-[360px] lg:shrink-0 lg:text-[2.125rem]",
              )}
            >
              {introLabel || "Closing"}
            </h2>
            {introBody && (
              <p
                style={MUTED_TEXT_STYLE}
                className={viewClass(
                  isMobile,
                  "text-[1rem] leading-[1.6]",
                  "lg:max-w-[780px] lg:text-[1.1875rem] lg:leading-[1.62]",
                )}
              >
                {introBody}
              </p>
            )}
          </div>
        )}

        <div
          style={resolveEditorialToneStyle("stone")}
          className={viewClass(
            isMobile,
            "flex flex-col gap-6 rounded-[28px] p-6",
            "lg:gap-10 lg:rounded-[36px] lg:p-12",
          )}
        >
          <div
            className={viewClass(
              isMobile,
              "flex flex-col items-start gap-2",
              "lg:flex-row lg:items-baseline lg:justify-between lg:gap-6",
            )}
          >
            <h3
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-medium text-[1.5rem] leading-[1.2]",
                "lg:text-[2rem]",
              )}
            >
              {heading}
            </h3>
            {(disclaimer || subtitle) && (
              <p style={MUTED_TEXT_STYLE} className="text-[0.9375rem] lg:text-[1.0625rem]">
                {disclaimer || subtitle}
              </p>
            )}
          </div>

          <div
            className={viewClass(
              isMobile,
              "grid grid-cols-2 gap-3",
              cn("lg:gap-6", desktopCols),
            )}
          >
            {metrics.map((metric, idx) => (
              <div
                key={`${id}-ed-metric-${idx}`}
                style={{
                  backgroundColor: "var(--tpl-color-surface, var(--surface))",
                }}
                className={viewClass(
                  isMobile,
                  "flex flex-col items-start gap-2 rounded-[20px] p-5",
                  "lg:gap-3 lg:rounded-[28px] lg:p-9",
                )}
              >
                <span
                  style={HEADING_FONT_STYLE}
                  className={viewClass(
                    isMobile,
                    "font-medium text-[2.25rem] leading-[1.06] tracking-[-0.02em]",
                    "lg:text-[3.5rem]",
                  )}
                >
                  {metric.value}
                </span>
                <span
                  style={MUTED_TEXT_STYLE}
                  className={viewClass(
                    isMobile,
                    "text-[0.875rem] leading-[1.4]",
                    "lg:text-[1.0625rem]",
                  )}
                >
                  {metric.label}
                </span>
                {metric.tag && (
                  <span
                    style={MUTED_TEXT_STYLE}
                    className="pt-0.5 text-[0.75rem] tracking-[0.02em]"
                  >
                    {metric.tag}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>

        {takeaways && takeaways.length > 0 && (
          <div
            className={viewClass(
              isMobile,
              "grid grid-cols-1 gap-8",
              "lg:grid-cols-2 lg:gap-16",
            )}
          >
            {takeaways.map((item, idx) => (
              <div key={`${id}-ed-takeaway-${idx}`} className="flex flex-col gap-4">
                <h3
                  style={HEADING_FONT_STYLE}
                  className={viewClass(
                    isMobile,
                    "font-medium text-[1.5rem] leading-[1.2]",
                    "lg:text-[1.875rem]",
                  )}
                >
                  {item.title}
                </h3>
                <div className="flex flex-col gap-3">
                  {item.body
                    .split(/\n+/)
                    .map((line) => line.trim())
                    .filter(Boolean)
                    .map((paragraph, pIdx) => (
                      <p
                        key={`${id}-ed-takeaway-${idx}-p-${pIdx}`}
                        style={MUTED_TEXT_STYLE}
                        className={viewClass(
                          isMobile,
                          "text-[1rem] leading-[1.6]",
                          "lg:text-[1.125rem] lg:leading-[1.62]",
                        )}
                      >
                        {paragraph}
                      </p>
                    ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {closing && (
          <p style={MUTED_TEXT_STYLE} className="max-w-3xl text-[1.0625rem] leading-[1.6]">
            {closing}
          </p>
        )}
      </div>
    </section>
  );
}

export function EditorialThankYouPanel({
  id,
  heading,
  subheading,
  logo,
  primaryLabel,
  primaryHref,
  socialLinks,
  background,
  accent = "primary",
  slots,
  isMobile,
}: {
  id: string;
  heading: string;
  subheading?: string;
  logo?: ImageSlotValue;
  primaryLabel: string;
  primaryHref: string;
  socialLinks?: Array<{ platform: CtaSocialPlatform; label?: string; href: string }>;
  background: string;
  accent?: string;
  slots?: Record<string, TemplateSlotDefinition>;
  isMobile: boolean;
}) {
  const logoSlot = getSlotDefinition(slots, logo, "cta.logo");
  const safePrimaryHref = isSafeRichTextHref(primaryHref) ? primaryHref.trim() : "#";
  const primaryIsExternal = /^https?:\/\//i.test(safePrimaryHref);

  return (
    <section
      id={id}
      data-section-type="CTA"
      data-cta-layout="thank-you"
      style={buildSectionSurfaceStyle(background)}
      className={viewClass(
        isMobile,
        "px-[20px] pt-[24px] pb-[56px]",
        "lg:px-[56px] lg:pt-[32px] lg:pb-[72px]",
      )}
    >
      <div
        style={resolveEditorialToneStyle("peri")}
        className={viewClass(
          isMobile,
          "mx-auto flex max-w-[1320px] flex-col items-center gap-4 rounded-[28px] px-6 py-12 text-center",
          "lg:gap-5 lg:rounded-[36px] lg:px-16 lg:py-20",
        )}
      >
        {logo && (
          <div className="h-[68px] w-[144px] overflow-hidden rounded-[18px]">
            <ImageSlotFrame
              image={logo}
              slotDefinition={logoSlot}
              fallbackRatio="2:1"
              compact
              className="size-full rounded-[18px]"
              innerClassName="size-full rounded-[18px]"
            />
          </div>
        )}

        <h2
          style={HEADING_FONT_STYLE}
          className={viewClass(
            isMobile,
            "font-medium text-[2.5rem] leading-[1.08] tracking-[-0.025em]",
            "lg:text-[4.25rem]",
          )}
        >
          {heading}
        </h2>

        {subheading && (
          <p
            style={MUTED_TEXT_STYLE}
            className={viewClass(
              isMobile,
              "max-w-[540px] text-[1rem] leading-[1.55]",
              "lg:text-[1.1875rem]",
            )}
          >
            {subheading}
          </p>
        )}

        {socialLinks && socialLinks.length > 0 ? (
          <div className="flex flex-wrap items-center justify-center gap-3 pt-2">
            {socialLinks.map((item, idx) => {
              const safeHref = isSafeRichTextHref(item.href) ? item.href.trim() : "#";
              const isExt = /^https?:\/\//i.test(safeHref);
              return (
                <a
                  key={`${id}-social-${idx}`}
                  href={safeHref}
                  aria-label={item.label || item.platform}
                  title={item.label || item.platform}
                  rel={isExt ? "noopener noreferrer" : undefined}
                  style={{
                    backgroundColor:
                      "color-mix(in oklab, var(--tpl-color-primary, var(--primary)) 16%, var(--tpl-color-surface, var(--surface)))",
                    color: "var(--tpl-color-text, var(--foreground))",
                  }}
                  className="inline-flex size-[52px] items-center justify-center rounded-full transition-transform hover:scale-105"
                >
                  <SocialPlatformIcon platform={item.platform} className="size-5" />
                </a>
              );
            })}
          </div>
        ) : (
          <div className="pt-2">
            <a
              href={safePrimaryHref}
              rel={primaryIsExternal ? "noopener noreferrer" : undefined}
              style={{
                backgroundColor: tokenColorVar(accent, "--primary"),
                color: INVERSE_CHIP_TEXT,
              }}
              className="inline-flex items-center justify-center rounded-full px-7 py-3.5 font-medium text-[0.9375rem] transition-opacity hover:opacity-90"
            >
              {primaryLabel}
            </a>
          </div>
        )}
      </div>
    </section>
  );
}

export interface EditorialCustomLayoutProps {
  id: string;
  eyebrow?: string;
  heading: string;
  body: RichTextValue;
  layout: CustomSectionLayout;
  mockupStyle?: MockupStyle;
  accent?: string;
  brandName?: string;
  badgeText?: string;
  cards?: Array<{
    title: string;
    subtitle?: string;
    body: string;
    icon?: string;
    highlighted?: boolean;
  }>;
  swatches?: Array<{
    label: string;
    token: string;
    role?: string;
  }>;
  mediaItems?: CustomMediaItem[];
  image?: ImageSlotValue;
  background: string;
  projectType?: TemplateProjectType;
  slots?: Record<string, TemplateSlotDefinition>;
  theme?: TemplateTheme;
  isMobile: boolean;
}

export function renderEditorialCustomLayout(props: EditorialCustomLayoutProps) {
  const {
    id,
    eyebrow,
    heading,
    body,
    layout,
    brandName,
    badgeText,
    cards,
    swatches,
    mediaItems = [],
    image,
    background,
    projectType = "mobile",
    slots,
    isMobile,
  } = props;

  if (layout === "editorial-strip") {
    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="editorial-strip"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "px-[20px] py-[40px]",
          "lg:px-[56px] lg:py-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "mx-auto flex max-w-[1320px] flex-col items-start gap-3",
            "lg:flex-row lg:items-start lg:gap-16",
          )}
        >
          <div className={viewClass(isMobile, "w-full", "lg:w-[360px] lg:shrink-0")}>
            {eyebrow && (
              <span
                style={{ color: tokenColorVar("accent", "--primary") }}
                className="mb-1.5 block font-medium text-[0.75rem] uppercase tracking-[0.12em]"
              >
                {eyebrow}
              </span>
            )}
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-medium text-[1.625rem] leading-[1.2] tracking-[-0.015em]",
                "lg:text-[2.125rem]",
              )}
            >
              {heading}
            </h2>
          </div>

          <RichTextView
            value={body}
            idPrefix={`${id}-strip`}
            style={MUTED_TEXT_STYLE}
            className={viewClass(
              isMobile,
              "w-full text-[1rem] leading-[1.6]",
              "lg:max-w-[780px] lg:flex-1 lg:text-[1.1875rem] lg:leading-[1.62]",
            )}
          />
        </div>
      </section>
    );
  }

  if (layout === "feature-tiles") {
    const tiles = mediaItems.slice(0, 3);
    const defaultTones: Array<CustomMediaItem["tone"]> = ["butter", "peri", "stone"];
    const defaultIcons = ["wallet", "send", "arrow-down-to-line"];

    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="feature-tiles"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "px-[20px] py-[40px]",
          "lg:px-[56px] lg:py-[56px]",
        )}
      >
        <div className="mx-auto max-w-[1320px]">
          <div
            className={viewClass(
              isMobile,
              "grid grid-cols-1 gap-6",
              "lg:grid-cols-3 lg:gap-8",
            )}
          >
            {tiles.map((tile, idx) => {
              const tone = tile.tone ?? defaultTones[idx] ?? "stone";
              const iconKey = tile.icon || defaultIcons[idx] || "wallet";
              const primarySlot = getSlotDefinition(slots, tile.image, "custom.image");
              const secondarySlot = getSlotDefinition(
                slots,
                tile.secondaryImage,
                "custom.image",
              );
              const isHeaderBottom = idx === 1 && !isMobile;

              const headerNode = (
                <div className="relative z-10 flex items-center gap-4">
                  <span
                    style={{
                      backgroundColor: DARK_BEZEL_COLOR,
                      color: INVERSE_CHIP_TEXT,
                    }}
                    className={viewClass(
                      isMobile,
                      "inline-flex size-14 shrink-0 items-center justify-center rounded-full",
                      "lg:size-16",
                    )}
                  >
                    <EditorialFeatureIcon iconKey={iconKey} className="size-6" />
                  </span>
                  {tile.title && (
                    <h3
                      style={HEADING_FONT_STYLE}
                      className={viewClass(
                        isMobile,
                        "font-medium text-[1.375rem] leading-[1.2] tracking-[-0.015em]",
                        "lg:text-[1.75rem]",
                      )}
                    >
                      {tile.title}
                    </h3>
                  )}
                </div>
              );

              return (
                <article
                  key={`${id}-ftile-${idx}`}
                  style={resolveEditorialToneStyle(tone)}
                  className={viewClass(
                    isMobile,
                    "relative flex h-[480px] flex-col justify-between overflow-hidden rounded-[28px] p-6",
                    "lg:h-[680px] lg:rounded-[36px] lg:p-9",
                  )}
                >
                  {!isHeaderBottom && headerNode}

                  {idx === 0 ? (
                    <div
                      className={viewClass(
                        isMobile,
                        "mx-auto mt-6 -rotate-6",
                        "lg:mx-auto lg:mt-8 lg:-rotate-8",
                      )}
                    >
                      <ImageSlotFrame
                        image={tile.image}
                        slotDefinition={primarySlot}
                        fallbackRatio="9:19.5"
                        projectType={projectType}
                        preferDeviceChrome
                        bezelColor={DARK_BEZEL_COLOR}
                        showDynamicIsland
                        className={viewClass(
                          isMobile,
                          "w-[208px] max-w-none rounded-[34px] p-[8px] shadow-2xl",
                          "lg:w-[268px] lg:rounded-[44px] lg:p-[10px]",
                        )}
                        innerClassName={viewClass(isMobile, "rounded-[26px]", "lg:rounded-[34px]")}
                      />
                    </div>
                  ) : idx === 1 ? (
                    <div
                      className={viewClass(
                        isMobile,
                        "relative mx-auto mt-6 flex items-center justify-center",
                        "lg:relative lg:h-[480px] lg:w-full",
                      )}
                    >
                      {tile.secondaryImage && !isMobile && (
                        <div className="absolute -top-28 -left-16 rotate-[26deg] opacity-95">
                          <ImageSlotFrame
                            image={tile.secondaryImage}
                            slotDefinition={secondarySlot}
                            fallbackRatio="9:19.5"
                            projectType={projectType}
                            preferDeviceChrome
                            bezelColor={DARK_BEZEL_COLOR}
                            showDynamicIsland
                            className="w-[236px] max-w-none rounded-[40px] p-[9px] shadow-xl"
                            innerClassName="rounded-[31px]"
                          />
                        </div>
                      )}
                      <div
                        className={viewClass(
                          isMobile,
                          "rotate-[14deg]",
                          "lg:absolute lg:-top-6 lg:right-[-24px] lg:rotate-[26deg]",
                        )}
                      >
                        <ImageSlotFrame
                          image={tile.image}
                          slotDefinition={primarySlot}
                          fallbackRatio="9:19.5"
                          projectType={projectType}
                          preferDeviceChrome
                          bezelColor={DARK_BEZEL_COLOR}
                          showDynamicIsland
                          className={viewClass(
                            isMobile,
                            "w-[208px] max-w-none rounded-[34px] p-[8px] shadow-2xl",
                            "lg:w-[252px] lg:rounded-[42px] lg:p-[9px]",
                          )}
                          innerClassName={viewClass(
                            isMobile,
                            "rounded-[26px]",
                            "lg:rounded-[33px]",
                          )}
                        />
                      </div>
                    </div>
                  ) : (
                    <div
                      className={viewClass(
                        isMobile,
                        "relative mx-auto mt-6 flex items-center justify-center",
                        "lg:relative lg:mt-6 lg:h-[480px] lg:w-full",
                      )}
                    >
                      {tile.secondaryImage && !isMobile && (
                        <div className="absolute -top-8 -right-24 rotate-[26deg] opacity-95">
                          <ImageSlotFrame
                            image={tile.secondaryImage}
                            slotDefinition={secondarySlot}
                            fallbackRatio="9:19.5"
                            projectType={projectType}
                            preferDeviceChrome
                            bezelColor={DARK_BEZEL_COLOR}
                            showDynamicIsland
                            className="w-[236px] max-w-none rounded-[40px] p-[9px] shadow-xl"
                            innerClassName="rounded-[31px]"
                          />
                        </div>
                      )}
                      <div
                        className={viewClass(
                          isMobile,
                          "rotate-[14deg]",
                          "lg:absolute lg:top-20 lg:left-[-12px] lg:rotate-[26deg]",
                        )}
                      >
                        <ImageSlotFrame
                          image={tile.image}
                          slotDefinition={primarySlot}
                          fallbackRatio="9:19.5"
                          projectType={projectType}
                          preferDeviceChrome
                          bezelColor={DARK_BEZEL_COLOR}
                          showDynamicIsland
                          className={viewClass(
                            isMobile,
                            "w-[208px] max-w-none rounded-[34px] p-[8px] shadow-2xl",
                            "lg:w-[252px] lg:rounded-[42px] lg:p-[9px]",
                          )}
                          innerClassName={viewClass(
                            isMobile,
                            "rounded-[26px]",
                            "lg:rounded-[33px]",
                          )}
                        />
                      </div>
                    </div>
                  )}

                  {isHeaderBottom && headerNode}
                </article>
              );
            })}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "icon-features") {
    const defaultIcons = ["coins", "refresh-cw", "credit-card", "circle-dot"];
    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="icon-features"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "px-[20px] py-[48px]",
          "lg:px-[56px] lg:py-[72px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "mx-auto flex max-w-[1320px] flex-col items-start gap-8",
            "lg:flex-row lg:items-start lg:gap-16",
          )}
        >
          <div className={viewClass(isMobile, "w-full", "lg:w-[360px] lg:shrink-0")}>
            <h2
              style={HEADING_FONT_STYLE}
              className={viewClass(
                isMobile,
                "font-medium text-[1.625rem] leading-[1.2]",
                "lg:text-[2.125rem]",
              )}
            >
              {heading}
            </h2>
          </div>

          <div
            className={viewClass(
              isMobile,
              "grid w-full grid-cols-1 gap-7",
              "lg:flex-1 lg:grid-cols-2 lg:gap-x-14 lg:gap-y-14",
            )}
          >
            {(cards ?? []).map((card, idx) => (
              <article key={`${id}-ifeat-${idx}`} className="flex items-start gap-5">
                <span
                  style={{
                    backgroundColor: DARK_BEZEL_COLOR,
                    color: INVERSE_CHIP_TEXT,
                  }}
                  className={viewClass(
                    isMobile,
                    "inline-flex size-14 shrink-0 items-center justify-center rounded-[18px]",
                    "lg:size-[68px] lg:rounded-[20px]",
                  )}
                >
                  <EditorialFeatureIcon
                    iconKey={card.icon || defaultIcons[idx]}
                    className="size-6"
                  />
                </span>
                <div className="flex min-w-0 flex-1 flex-col gap-2">
                  <h3
                    style={HEADING_FONT_STYLE}
                    className={viewClass(
                      isMobile,
                      "font-semibold text-[1.1875rem] leading-[1.25]",
                      "lg:text-[1.375rem]",
                    )}
                  >
                    {card.title}
                  </h3>
                  <p style={MUTED_TEXT_STYLE} className="text-[1rem] leading-[1.6] lg:text-[1.0625rem]">
                    {card.body}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "lifestyle-composite") {
    const phoneItem = mediaItems[0];
    const cardItem = mediaItems[1];
    const photoItem = mediaItems[2];

    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="lifestyle-composite"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "px-[20px] py-[44px]",
          "lg:px-[56px] lg:py-[72px]",
        )}
      >
        <div className="relative mx-auto max-w-[1320px]">
          {!isMobile && (
            <div
              aria-hidden="true"
              style={resolveEditorialToneStyle("stone")}
              className="pointer-events-none absolute inset-x-0 top-[18%] bottom-[14%] rounded-[36px]"
            />
          )}

          <div
            className={viewClass(
              isMobile,
              "flex flex-col items-center gap-6",
              "lg:relative lg:z-10 lg:grid lg:grid-cols-12 lg:items-center lg:gap-8 lg:px-10",
            )}
          >
            {phoneItem && (
              <div
                className={viewClass(
                  isMobile,
                  "w-full flex justify-center",
                  "lg:col-span-4 lg:pt-20",
                )}
              >
                <ImageSlotFrame
                  image={phoneItem.image}
                  slotDefinition={getSlotDefinition(slots, phoneItem.image, "custom.image")}
                  fallbackRatio="9:19.5"
                  projectType={projectType}
                  preferDeviceChrome
                  bezelColor={DARK_BEZEL_COLOR}
                  showDynamicIsland
                  className={viewClass(
                    isMobile,
                    "w-[232px] max-w-none rounded-[36px] p-[8px] shadow-2xl",
                    "lg:w-[292px] lg:rounded-[48px] lg:p-[10px]",
                  )}
                  innerClassName={viewClass(isMobile, "rounded-[28px]", "lg:rounded-[38px]")}
                />
              </div>
            )}

            {cardItem && (
              <div
                className={viewClass(
                  isMobile,
                  "w-full max-w-[300px]",
                  "lg:col-span-3 lg:-mt-16",
                )}
              >
                <ImageSlotFrame
                  image={cardItem.image}
                  slotDefinition={getSlotDefinition(slots, cardItem.image, "custom.image")}
                  overrideDevice="none"
                  fallbackRatio="3:5"
                  className="w-full overflow-hidden rounded-[32px] shadow-md"
                  innerClassName="rounded-[32px]"
                />
              </div>
            )}

            {photoItem && (
              <div className={viewClass(isMobile, "w-full", "lg:col-span-5")}>
                <ImageSlotFrame
                  image={photoItem.image}
                  slotDefinition={getSlotDefinition(slots, photoItem.image, "custom.image")}
                  overrideDevice="none"
                  fallbackRatio="3:4"
                  className="w-full overflow-hidden rounded-[32px] shadow-md"
                  innerClassName="rounded-[32px]"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "branding-bento") {
    const icon1 = mediaItems[0];
    const icon2 = mediaItems[1];
    const icon3 = mediaItems[2];
    const construction = mediaItems[3];
    const appIcon = mediaItems[4];
    const watchItem = mediaItems[5];

    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="branding-bento"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "px-[20px] py-[44px]",
          "lg:px-[56px] lg:py-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "mx-auto grid max-w-[1320px] grid-cols-1 gap-6",
            "lg:grid-cols-12 lg:gap-8",
          )}
        >
          <div
            style={resolveEditorialToneStyle("peri")}
            className={viewClass(
              isMobile,
              "flex flex-col items-center justify-center gap-6 overflow-hidden rounded-[28px] p-6",
              "lg:col-span-7 lg:min-h-[760px] lg:gap-10 lg:rounded-[36px] lg:p-12",
            )}
          >
            <div
              style={{ backgroundColor: "var(--tpl-color-surface, var(--surface))" }}
              className={viewClass(
                isMobile,
                "grid w-full max-w-[360px] grid-cols-3 gap-3 rounded-[24px] p-4 shadow-lg",
                "lg:-rotate-6 lg:gap-5 lg:rounded-[30px] lg:p-7 lg:shadow-xl",
              )}
            >
              {[icon1, icon2, icon3].map((ic, idx) => (
                <div
                  key={`${id}-bento-ic-${idx}`}
                  className="aspect-square overflow-hidden rounded-[22px] lg:rounded-[32px]"
                >
                  {ic && (
                    <ImageSlotFrame
                      image={ic.image}
                      slotDefinition={getSlotDefinition(slots, ic.image, "hero.logo")}
                      fallbackRatio="1:1"
                      compact
                      className="size-full rounded-[22px] lg:rounded-[32px]"
                      innerClassName="size-full rounded-[22px] lg:rounded-[32px]"
                    />
                  )}
                </div>
              ))}
            </div>

            {construction && (
              <div
                style={{ backgroundColor: "var(--tpl-color-surface, var(--surface))" }}
                className={viewClass(
                  isMobile,
                  "w-full rounded-[24px] p-4 shadow-lg",
                  "lg:w-[88%] lg:-rotate-6 lg:rounded-[30px] lg:p-7 lg:shadow-xl",
                )}
              >
                <ImageSlotFrame
                  image={construction.image}
                  slotDefinition={getSlotDefinition(slots, construction.image, "custom.image")}
                  overrideDevice="none"
                  fallbackRatio="7:5"
                  className="w-full overflow-hidden rounded-[20px] lg:rounded-[26px]"
                  innerClassName="rounded-[20px] lg:rounded-[26px]"
                />
              </div>
            )}
          </div>

          <div
            className={viewClass(
              isMobile,
              "flex flex-col gap-6",
              "lg:col-span-5 lg:gap-8",
            )}
          >
            <div
              style={resolveEditorialToneStyle("butter")}
              className={viewClass(
                isMobile,
                "flex min-h-[240px] items-center justify-center rounded-[28px] p-8",
                "lg:min-h-[270px] lg:rounded-[36px]",
              )}
            >
              <div className="relative">
                <div
                  style={{ backgroundColor: DARK_BEZEL_COLOR }}
                  className="size-[152px] overflow-hidden rounded-[38px] p-2 shadow-xl lg:size-[176px] lg:rounded-[44px]"
                >
                  {appIcon ? (
                    <ImageSlotFrame
                      image={appIcon.image}
                      slotDefinition={getSlotDefinition(slots, appIcon.image, "hero.logo")}
                      fallbackRatio="1:1"
                      compact
                      className="size-full rounded-[32px] lg:rounded-[36px]"
                      innerClassName="size-full rounded-[32px] lg:rounded-[36px]"
                    />
                  ) : null}
                </div>
                {badgeText && (
                  <span
                    style={{
                      backgroundColor: "var(--tpl-color-surface, var(--surface))",
                      color: DARK_BEZEL_COLOR,
                    }}
                    className="absolute -top-4 -right-4 inline-flex size-12 items-center justify-center rounded-full font-semibold text-[0.9375rem] shadow-lg"
                  >
                    {badgeText}
                  </span>
                )}
              </div>
            </div>

            <div
              style={resolveEditorialToneStyle("stone")}
              className={viewClass(
                isMobile,
                "flex flex-1 items-center justify-center rounded-[28px] p-6",
                "lg:min-h-[458px] lg:rounded-[36px] lg:p-10",
              )}
            >
              {watchItem && (
                <div className="w-full max-w-[280px]">
                  <ImageSlotFrame
                    image={watchItem.image}
                    slotDefinition={getSlotDefinition(slots, watchItem.image, "custom.image")}
                    overrideDevice="none"
                    fallbackRatio="3:4"
                    className="w-full overflow-hidden rounded-[28px]"
                    innerClassName="rounded-[28px]"
                  />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    );
  }

  if (layout === "brand-guidelines") {
    const resolvedBrand = brandName?.trim() || "kovawallet";
    const logoImage = image;
    const logoSlot = getSlotDefinition(slots, logoImage, "hero.logo");
    const constructionSlides = mediaItems.slice(0, 3);

    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="brand-guidelines"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "px-[20px] py-[44px]",
          "lg:px-[56px] lg:py-[56px]",
        )}
      >
        <div className="mx-auto flex max-w-[1320px] flex-col gap-6 lg:gap-8">
          <div
            className={viewClass(
              isMobile,
              "grid grid-cols-1 gap-6",
              "lg:grid-cols-3 lg:gap-7",
            )}
          >
            {/* Slide 1 · Brand Lockup */}
            <div
              style={resolveEditorialToneStyle("peri")}
              className={viewClass(
                isMobile,
                "flex min-h-[240px] items-center justify-center rounded-[28px] p-8",
                "lg:min-h-[340px] lg:rounded-[36px] lg:p-10",
              )}
            >
              <div className="flex items-center gap-4">
                {logoImage && (
                  <div className="size-16 shrink-0 overflow-hidden rounded-[20px] lg:size-20 lg:rounded-[24px]">
                    <ImageSlotFrame
                      image={logoImage}
                      slotDefinition={logoSlot}
                      fallbackRatio="1:1"
                      compact
                      className="size-full rounded-[20px] lg:rounded-[24px]"
                      innerClassName="size-full rounded-[20px] lg:rounded-[24px]"
                    />
                  </div>
                )}
                <span
                  style={HEADING_FONT_STYLE}
                  className={viewClass(
                    isMobile,
                    "font-semibold text-[1.75rem] tracking-[-0.02em]",
                    "lg:text-[2.125rem]",
                  )}
                >
                  {resolvedBrand}
                </span>
              </div>
            </div>

            {/* Slide 2 · Brand Guidelines Cover */}
            <div
              style={resolveEditorialToneStyle("ink")}
              className={viewClass(
                isMobile,
                "flex min-h-[240px] flex-col justify-between rounded-[28px] p-8",
                "lg:min-h-[340px] lg:rounded-[36px] lg:p-10",
              )}
            >
              {logoImage ? (
                <div className="size-12 overflow-hidden rounded-xl">
                  <ImageSlotFrame
                    image={logoImage}
                    slotDefinition={logoSlot}
                    fallbackRatio="1:1"
                    compact
                    className="size-full rounded-xl"
                    innerClassName="size-full rounded-xl"
                  />
                </div>
              ) : (
                <span />
              )}

              <div
                style={HEADING_FONT_STYLE}
                className={viewClass(
                  isMobile,
                  "flex flex-col font-medium text-[2.25rem] leading-[1.05] tracking-[-0.02em]",
                  "lg:text-[3.25rem]",
                )}
              >
                <span className="text-white/50">{eyebrow || "Brand"}</span>
                <span className="text-white">{heading || "guidelines"}</span>
              </div>
            </div>

            {/* Slide 3 · Live Theme Color Palette */}
            <div
              style={resolveEditorialToneStyle("surface")}
              className={viewClass(
                isMobile,
                "flex min-h-[240px] flex-col justify-between rounded-[28px] border p-7",
                "lg:min-h-[340px] lg:rounded-[36px] lg:p-10",
              )}
            >
              <div className="flex items-center gap-2.5">
                {logoImage && (
                  <div className="size-8 overflow-hidden rounded-lg">
                    <ImageSlotFrame
                      image={logoImage}
                      slotDefinition={logoSlot}
                      fallbackRatio="1:1"
                      compact
                      className="size-full rounded-lg"
                      innerClassName="size-full rounded-lg"
                    />
                  </div>
                )}
                <span className="font-medium text-[0.9375rem]">{resolvedBrand}</span>
              </div>

              <div className="flex flex-col gap-5">
                <h3
                  style={HEADING_FONT_STYLE}
                  className="font-semibold text-[1.5rem] leading-[1.1] lg:text-[1.75rem]"
                >
                  Color
                  <br />
                  Palette
                </h3>

                {swatches && swatches.length > 0 && (
                  <div className="flex flex-wrap items-start gap-3.5">
                    {swatches.map((sw, idx) => (
                      <div
                        key={`${id}-gswatch-${idx}`}
                        className="flex flex-col items-center gap-1.5"
                      >
                        <span
                          style={{
                            backgroundColor: tokenColorVar(sw.token, "--primary"),
                            borderColor: "var(--tpl-color-line, var(--border))",
                          }}
                          className="size-11 rounded-full border lg:size-12"
                        />
                        <span style={MUTED_TEXT_STYLE} className="text-[0.6875rem]">
                          {sw.label}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {constructionSlides.length > 0 && (
            <div
              className={viewClass(
                isMobile,
                "grid grid-cols-1 gap-6",
                "lg:grid-cols-3 lg:gap-7",
              )}
            >
              {constructionSlides.map((slide, idx) => (
                <div
                  key={`${id}-gslide-${idx}`}
                  style={resolveEditorialToneStyle("surface")}
                  className={viewClass(
                    isMobile,
                    "rounded-[28px] border p-5",
                    "lg:rounded-[36px] lg:p-7",
                  )}
                >
                  <ImageSlotFrame
                    image={slide.image}
                    slotDefinition={getSlotDefinition(slots, slide.image, "custom.image")}
                    overrideDevice="none"
                    fallbackRatio="16:10"
                    className="w-full overflow-hidden rounded-[20px] lg:rounded-[24px]"
                    innerClassName="rounded-[20px] lg:rounded-[24px]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      </section>
    );
  }

  if (layout === "arch-phone-pair") {
    const leftPhone = mediaItems[0];
    const rightPhone = mediaItems[1];

    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="arch-phone-pair"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "overflow-hidden px-[20px] py-[56px]",
          "lg:px-[56px] lg:py-[96px]",
        )}
      >
        <div className="relative mx-auto flex max-w-[1120px] items-center justify-center">
          {/* 3 Rounded-Top Vertical Gradient Arches */}
          <div
            aria-hidden="true"
            className={viewClass(
              isMobile,
              "pointer-events-none absolute inset-x-4 top-8 bottom-8 grid grid-cols-3 gap-1",
              "lg:inset-x-28 lg:top-10 lg:bottom-6 lg:gap-1.5",
            )}
          >
            <div
              style={{
                backgroundImage:
                  "linear-gradient(180deg, var(--tpl-color-panelButter, color-mix(in oklab, var(--tpl-color-accent, var(--accent)) 24%, var(--tpl-color-surface, var(--surface)))) 0%, transparent 100%)",
              }}
              className="h-full rounded-t-full"
            />
            <div
              style={{
                backgroundImage:
                  "linear-gradient(180deg, var(--tpl-color-panelStone, var(--tpl-color-surfaceAlt, var(--sunken))) 0%, transparent 100%)",
              }}
              className="h-full rounded-t-full"
            />
            <div
              style={{
                backgroundImage:
                  "linear-gradient(180deg, var(--tpl-color-panelPeriDeep, color-mix(in oklab, var(--tpl-color-primary, var(--primary)) 24%, var(--tpl-color-background, var(--background)))) 0%, transparent 100%)",
              }}
              className="h-full rounded-t-full"
            />
          </div>

          <div
            className={viewClass(
              isMobile,
              "relative z-10 flex flex-col items-center gap-8 py-6",
              "lg:flex-row lg:items-start lg:justify-center lg:gap-8 lg:py-12",
            )}
          >
            {leftPhone && (
              <div className={viewClass(isMobile, "rotate-[12deg]", "lg:-mt-6 lg:rotate-[20deg]")}>
                <ImageSlotFrame
                  image={leftPhone.image}
                  slotDefinition={getSlotDefinition(slots, leftPhone.image, "custom.image")}
                  fallbackRatio="9:19.5"
                  projectType={projectType}
                  preferDeviceChrome
                  bezelColor={DARK_BEZEL_COLOR}
                  showDynamicIsland
                  className={viewClass(
                    isMobile,
                    "w-[216px] max-w-none rounded-[36px] p-[8px] shadow-2xl",
                    "lg:w-[292px] lg:rounded-[48px] lg:p-[10px]",
                  )}
                  innerClassName={viewClass(isMobile, "rounded-[28px]", "lg:rounded-[38px]")}
                />
              </div>
            )}

            {rightPhone && (
              <div className={viewClass(isMobile, "rotate-[12deg]", "lg:mt-48 lg:rotate-[20deg]")}>
                <ImageSlotFrame
                  image={rightPhone.image}
                  slotDefinition={getSlotDefinition(slots, rightPhone.image, "custom.image")}
                  fallbackRatio="9:19.5"
                  projectType={projectType}
                  preferDeviceChrome
                  bezelColor={DARK_BEZEL_COLOR}
                  showDynamicIsland
                  className={viewClass(
                    isMobile,
                    "w-[216px] max-w-none rounded-[36px] p-[8px] shadow-2xl",
                    "lg:w-[292px] lg:rounded-[48px] lg:p-[10px]",
                  )}
                  innerClassName={viewClass(isMobile, "rounded-[28px]", "lg:rounded-[38px]")}
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  if (layout === "bento-collage") {
    const brandCard = mediaItems[0];
    const cropPhoneA = mediaItems[1];
    const lifestylePhoto = mediaItems[2];
    const cropPhoneB = mediaItems[3];
    const widgetCard = mediaItems[4];
    const straightPhone = mediaItems[5];

    return (
      <section
        id={id}
        data-section-type="Custom"
        data-custom-layout="bento-collage"
        style={buildSectionSurfaceStyle(background)}
        className={viewClass(
          isMobile,
          "px-[20px] py-[44px]",
          "lg:px-[56px] lg:py-[56px]",
        )}
      >
        <div
          className={viewClass(
            isMobile,
            "mx-auto grid max-w-[1320px] grid-cols-1 gap-6",
            "lg:grid-cols-12 lg:gap-7",
          )}
        >
          {/* Column 1 */}
          <div className={viewClass(isMobile, "flex flex-col gap-6", "lg:col-span-3 lg:gap-7")}>
            {brandCard && (
              <div
                style={resolveEditorialToneStyle("ink")}
                className="overflow-hidden rounded-[28px] p-3 lg:h-[490px] lg:rounded-[34px]"
              >
                <ImageSlotFrame
                  image={brandCard.image}
                  slotDefinition={getSlotDefinition(slots, brandCard.image, "custom.image")}
                  overrideDevice="none"
                  fallbackRatio="4:5"
                  className="size-full overflow-hidden rounded-[22px] lg:rounded-[26px]"
                  innerClassName="size-full rounded-[22px] lg:rounded-[26px]"
                />
              </div>
            )}

            {cropPhoneA && (
              <div
                style={resolveEditorialToneStyle("butter")}
                className="relative h-[200px] overflow-hidden rounded-[28px] lg:h-[210px] lg:rounded-[34px]"
              >
                <div className="absolute -top-10 left-8 rotate-[26deg]">
                  <ImageSlotFrame
                    image={cropPhoneA.image}
                    slotDefinition={getSlotDefinition(slots, cropPhoneA.image, "custom.image")}
                    fallbackRatio="9:19.5"
                    projectType={projectType}
                    preferDeviceChrome
                    bezelColor={DARK_BEZEL_COLOR}
                    showDynamicIsland
                    className="w-[220px] max-w-none rounded-[36px] p-[8px] shadow-xl"
                    innerClassName="rounded-[28px]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Column 2 */}
          <div className={viewClass(isMobile, "flex flex-col gap-6", "lg:col-span-5 lg:gap-7")}>
            {lifestylePhoto && (
              <div className="overflow-hidden rounded-[28px] lg:h-[490px] lg:rounded-[34px]">
                <ImageSlotFrame
                  image={lifestylePhoto.image}
                  slotDefinition={getSlotDefinition(slots, lifestylePhoto.image, "custom.image")}
                  overrideDevice="none"
                  fallbackRatio="14:15"
                  className="size-full overflow-hidden rounded-[28px] lg:rounded-[34px]"
                  innerClassName="size-full rounded-[28px] lg:rounded-[34px]"
                />
              </div>
            )}

            {cropPhoneB && (
              <div
                style={resolveEditorialToneStyle("stone")}
                className="relative h-[200px] overflow-hidden rounded-[28px] lg:h-[210px] lg:rounded-[34px]"
              >
                <div className="absolute -top-6 left-16 rotate-[54deg]">
                  <ImageSlotFrame
                    image={cropPhoneB.image}
                    slotDefinition={getSlotDefinition(slots, cropPhoneB.image, "custom.image")}
                    fallbackRatio="9:19.5"
                    projectType={projectType}
                    preferDeviceChrome
                    bezelColor={DARK_BEZEL_COLOR}
                    showDynamicIsland
                    className="w-[236px] max-w-none rounded-[38px] p-[8px] shadow-xl"
                    innerClassName="rounded-[30px]"
                  />
                </div>
              </div>
            )}
          </div>

          {/* Column 3 */}
          <div className={viewClass(isMobile, "flex flex-col gap-6", "lg:col-span-4 lg:gap-7")}>
            {widgetCard && (
              <div
                style={resolveEditorialToneStyle("peri")}
                className="flex h-[240px] items-center justify-center overflow-hidden rounded-[28px] p-6 lg:h-[260px] lg:rounded-[34px]"
              >
                <div
                  style={{ backgroundColor: "var(--tpl-color-surface, var(--surface))" }}
                  className="w-full max-w-[320px] -rotate-6 rounded-[24px] p-4 shadow-xl"
                >
                  <ImageSlotFrame
                    image={widgetCard.image}
                    slotDefinition={getSlotDefinition(slots, widgetCard.image, "custom.image")}
                    overrideDevice="none"
                    fallbackRatio="2:1"
                    className="w-full overflow-hidden rounded-[18px]"
                    innerClassName="rounded-[18px]"
                  />
                </div>
              </div>
            )}

            {straightPhone && (
              <div
                style={resolveEditorialToneStyle("stone")}
                className="relative flex h-[380px] items-start justify-center overflow-hidden rounded-[28px] pt-8 lg:h-[440px] lg:rounded-[34px] lg:pt-10"
              >
                <ImageSlotFrame
                  image={straightPhone.image}
                  slotDefinition={getSlotDefinition(slots, straightPhone.image, "custom.image")}
                  fallbackRatio="9:19.5"
                  projectType={projectType}
                  preferDeviceChrome
                  bezelColor={DARK_BEZEL_COLOR}
                  showDynamicIsland
                  className="w-[236px] max-w-none rounded-[38px] p-[9px] shadow-2xl lg:w-[258px] lg:rounded-[42px]"
                  innerClassName="rounded-[30px] lg:rounded-[33px]"
                />
              </div>
            )}
          </div>
        </div>
      </section>
    );
  }

  return null;
}
