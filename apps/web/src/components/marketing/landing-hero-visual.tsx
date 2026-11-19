"use client";

import { AlertTriangle, ArrowLeft, Cloud, Redo2, Undo2, Upload } from "lucide-react";
import { useState } from "react";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import type { LandingPublishedTemplateItem } from "@/lib/marketing/landing-stats";
import {
  V3_ALT_TOKENS,
  V3_DEFAULT_TOKENS,
  V3_EDITOR_FONTS,
  V3_EDITOR_SLOTS,
  type V3EditorSlotItem,
  type V3ShowcaseTabId,
} from "@/lib/marketing/v3-landing-data";
import { cn } from "@/lib/utils";

function SlotStatusBadge({ item }: { item: V3EditorSlotItem }) {
  const toneClass =
    item.status === "filled-gold" || item.status === "filled-indigo"
      ? "bg-[var(--cf-mock-status-filled-bg)] text-[var(--cf-mock-status-filled-fg)]"
      : item.status === "uploading"
        ? "bg-[var(--cf-mock-status-upload-bg)] text-[var(--cf-mock-status-upload-fg)]"
        : item.status === "empty"
          ? "bg-[var(--cf-mock-status-empty-bg)] text-[var(--cf-mock-status-empty-fg)]"
          : "bg-[var(--cf-mock-status-failed-bg)] text-[var(--cf-mock-status-failed-fg)]";

  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center gap-1 rounded-full px-1.5 py-0.5 text-[0.5625rem] leading-none font-medium",
        toneClass,
      )}
    >
      <span className="size-1 rounded-full bg-current" />
      <span>{item.badge}</span>
    </span>
  );
}

function SlotThumb({ status }: { status: V3EditorSlotItem["status"] }) {
  if (status === "filled-gold") {
    return (
      <span className="h-6 w-4 shrink-0 rounded-xs bg-gradient-to-b from-[var(--cf-mock-orbit-gold-soft)] to-[var(--cf-mock-orbit-gold)]" />
    );
  }
  if (status === "filled-indigo") {
    return (
      <span className="h-6 w-4 shrink-0 rounded-xs bg-gradient-to-b from-[var(--cf-mock-orbit-indigo)] to-[var(--cf-mock-orbit-indigo-deep)]" />
    );
  }
  if (status === "failed") {
    return (
      <span className="h-6 w-4 shrink-0 rounded-xs bg-[var(--cf-mock-status-failed-bg)]" />
    );
  }
  return (
    <span className="h-6 w-4 shrink-0 rounded-xs border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-subtle)]" />
  );
}

/** Artwork for "Frame" (Website template: Giving made human again) & "Orbit" (Mobile app template: Debt, finally under control) */
export function V3TemplateArtwork({
  variant,
  compact = false,
}: {
  variant: "frame" | "orbit";
  compact?: boolean;
}) {
  if (variant === "frame") {
    return (
      <div
        aria-hidden="true"
        className="flex h-full w-full flex-col justify-between overflow-hidden rounded-xl border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-frame-bg)] px-4 pt-4 pb-0 text-[var(--cf-mock-frame-fg)] sm:px-5 sm:pt-5 sm:pb-0"
      >
        <div className="flex items-center justify-between text-[0.5625rem] text-[var(--cf-mock-frame-muted)]">
          <span className="inline-flex items-center gap-1.5 font-semibold text-[var(--cf-mock-frame-fg)]">
            <span className="size-1.5 rounded-full bg-[var(--cf-mock-frame-dot)]" />
            <span>Ghaith</span>
          </span>
          <span className="hidden gap-2.5 sm:inline-flex">
            <span>Context</span>
            <span>Approach</span>
            <span>Pages</span>
            <span>Impact</span>
          </span>
        </div>

        <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-12 sm:items-end">
          <div className="sm:col-span-7">
            <p className="text-[0.5rem] font-semibold tracking-wider text-[var(--cf-mock-frame-accent)] uppercase">
              Case study · Website · 2026
            </p>
            <p
              className={cn(
                "mt-1 font-display leading-[1.06] font-semibold tracking-tight text-[var(--cf-mock-frame-fg)]",
                compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
              )}
            >
              Giving made human again
            </p>
          </div>
          <div className="hidden flex-col gap-2 text-[0.5rem] leading-tight text-[var(--cf-mock-frame-muted)] sm:col-span-5 sm:flex">
            <p>
              A humanitarian sponsorship platform that connects donors with
              families — transparently.
            </p>
            <div className="flex gap-3 text-[0.45rem] uppercase">
              <span>Role · Product</span>
              <span>2026</span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex-1 overflow-hidden rounded-t-lg border border-b-0 border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)]">
          <div className="flex h-4 items-center justify-between border-b border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-subtle)] px-2.5">
            <span className="font-mono text-[0.45rem] font-medium text-[var(--cf-mock-chrome-muted)]">
              ghaith.org/impact
            </span>
            <span className="font-mono text-[0.45rem] text-[var(--cf-mock-chrome-muted)]">
              16:10
            </span>
          </div>
          <div className="grid h-full min-h-24 grid-cols-12 gap-2 p-2.5">
            <div className="col-span-7 flex flex-col justify-between rounded-md bg-[var(--cf-royal)] p-2.5 text-[var(--cf-text-on-royal)]">
              <span className="w-fit rounded-xs bg-[var(--cf-bg-accent)] px-1.5 py-0.5 font-mono text-[0.45rem] font-bold text-[var(--cf-text-on-accent)] uppercase">
                Verified flow
              </span>
              <div>
                <p className="font-display text-xs leading-tight font-bold">
                  100% direct family aid
                </p>
                <p className="mt-0.5 text-[0.45rem] opacity-85">
                  Zero-fee donor ledger
                </p>
              </div>
            </div>
            <div className="col-span-5 flex flex-col gap-2">
              <div className="flex flex-1 flex-col justify-between rounded-md border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-subtle)] p-2">
                <span className="font-mono text-[0.45rem] text-[var(--cf-mock-chrome-muted)] uppercase">
                  Completion
                </span>
                <span className="font-display text-sm leading-none font-bold text-[var(--cf-mock-chrome-ink)]">
                  +42%
                </span>
              </div>
              <div className="flex flex-1 flex-col justify-between rounded-md bg-[var(--cf-ink)] p-2 text-[var(--cf-text-on-ink)]">
                <span className="font-mono text-[0.45rem] text-[var(--cf-bg-accent)] uppercase">
                  Payout
                </span>
                <span className="font-display text-xs leading-none font-bold">
                  24 hrs
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      className="flex h-full w-full flex-col justify-between overflow-hidden rounded-xl bg-[var(--cf-mock-orbit-bg)] px-4 pt-4 pb-0 text-[var(--cf-mock-orbit-fg)] sm:px-5 sm:pt-5 sm:pb-0"
    >
      <div className="flex items-center justify-between text-[0.5625rem] text-[var(--cf-mock-orbit-muted)]">
        <span className="font-semibold text-[var(--cf-mock-orbit-fg)]">
          Mosaed
        </span>
        <span className="hidden gap-2.5 sm:inline-flex">
          <span>Overview</span>
          <span>Process</span>
          <span>Screens</span>
          <span>Results</span>
        </span>
      </div>

      <div className="mt-3">
        <p className="text-[0.5rem] font-medium tracking-wider text-[var(--cf-mock-orbit-gold)] uppercase">
          Case study · Mobile app · 2026
        </p>
        <p
          className={cn(
            "mt-1 font-display leading-[1.06] font-semibold tracking-tight text-[var(--cf-mock-orbit-fg)]",
            compact ? "text-lg sm:text-xl" : "text-xl sm:text-2xl",
          )}
        >
          Debt, finally under control
        </p>
        <p className="mt-1.5 line-clamp-2 max-w-xs text-[0.5625rem] leading-relaxed text-[var(--cf-mock-orbit-muted)]">
          A calm money app that helps people track, plan and pay off personal
          debts — without the anxiety.
        </p>
      </div>

      <div className="mt-3 rounded-t-xl bg-[var(--cf-mock-orbit-gold)] px-3 pt-3">
        <div className="grid grid-cols-3 items-end gap-2">
          <div className="h-16 rounded-t-lg border-2 border-[var(--cf-mock-orbit-bg)] bg-gradient-to-b from-[var(--cf-mock-orbit-fg)] to-[var(--cf-mock-orbit-gold-soft)]" />
          <div className="h-20 rounded-t-lg border-2 border-[var(--cf-mock-orbit-bg)] bg-gradient-to-b from-[var(--cf-mock-orbit-indigo-deep)] to-[var(--cf-mock-orbit-bg)]" />
          <div className="h-16 rounded-t-lg border-2 border-[var(--cf-mock-orbit-bg)] bg-gradient-to-b from-[var(--cf-mock-orbit-fg)] to-[var(--cf-mock-orbit-gold-soft)]" />
        </div>
      </div>
    </div>
  );
}

/** Hero 3-card stage (Figma 85:7741 Desktop / 87:9625 Mobile) */
export function LandingHeroVisual({
  publishedTemplates = [],
}: {
  publishedTemplates?: readonly LandingPublishedTemplateItem[];
} = {}) {
  const [previewDevice, setPreviewDevice] = useState<"desktop" | "mobile">(
    "desktop",
  );
  const leftTemplate = publishedTemplates[0] ?? null;
  const rightTemplate = publishedTemplates[1] ?? publishedTemplates[0] ?? null;

  return (
    <figure
      aria-label="Interactive preview of the Casefolio editor and curated templates"
      className="relative mx-auto w-full max-w-[75rem] pt-2 select-none"
    >
      <div className="relative flex items-end justify-center">
        {/* Left Tilted Template Card — Published Cover or Frame (Fans outward left on scroll) */}
        <div
          aria-hidden="true"
          data-hero-card-left=""
          className="pointer-events-none absolute -bottom-4 left-0 z-0 w-[44%] max-w-[26rem] will-change-transform sm:-bottom-6 lg:left-4"
        >
          <div className="-translate-x-6 -rotate-6 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-2.5 sm:translate-x-2 sm:p-3.5">
            <div className="h-44 sm:h-64 lg:h-72">
              {leftTemplate ? (
                <TemplateThumbnail
                  coverUrl={leftTemplate.coverUrl}
                  slug={leftTemplate.slug}
                  name={leftTemplate.name}
                  theme={leftTemplate.theme ?? null}
                  className="size-full rounded-xl border border-[var(--cf-border-subtle)]"
                />
              ) : (
                <V3TemplateArtwork variant="frame" compact />
              )}
            </div>
          </div>
        </div>

        {/* Right Tilted Template Card — Published Cover or Orbit (Fans outward right on scroll) */}
        <div
          aria-hidden="true"
          data-hero-card-right=""
          className="pointer-events-none absolute -bottom-4 right-0 z-0 w-[44%] max-w-[26rem] will-change-transform sm:-bottom-6 lg:right-4"
        >
          <div className="translate-x-6 rotate-6 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-2.5 sm:-translate-x-2 sm:p-3.5">
            <div className="h-44 sm:h-64 lg:h-72">
              {rightTemplate ? (
                <TemplateThumbnail
                  coverUrl={rightTemplate.coverUrl}
                  slug={rightTemplate.slug}
                  name={rightTemplate.name}
                  theme={rightTemplate.theme ?? null}
                  className="size-full rounded-xl border border-[var(--cf-border-subtle)]"
                />
              ) : (
                <V3TemplateArtwork variant="orbit" compact />
              )}
            </div>
          </div>
        </div>

        {/* Center Flat Window — Casefolio Editor (Lifts forward on scroll) */}
        <div
          data-hero-card-center=""
          className="relative z-10 w-[86%] max-w-[46rem] overflow-hidden rounded-t-2xl border border-b-0 border-[var(--cf-border-subtle)] bg-[var(--cf-mock-chrome-bg)] text-[var(--cf-mock-chrome-ink)] will-change-transform sm:w-[82%] lg:w-[45rem]"
        >
          {/* Editor Top Bar */}
          <div className="flex items-center justify-between gap-2 border-b border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] px-3 py-2 sm:px-4">
            <div className="flex min-w-0 items-center gap-2">
              <span
                aria-hidden="true"
                className="inline-flex size-5 shrink-0 items-center justify-center rounded-md border border-[var(--cf-mock-chrome-border)] text-[var(--cf-mock-chrome-ink)]"
              >
                <ArrowLeft className="size-2.5" />
              </span>
              <div className="min-w-0">
                <p className="truncate text-[0.6875rem] leading-tight font-semibold text-[var(--cf-mock-chrome-ink)]">
                  Mosaed — Smart debt management
                </p>
                <p className="inline-flex items-center gap-1 text-[0.5625rem] leading-none text-[var(--cf-mock-chrome-muted)]">
                  <Cloud
                    aria-hidden="true"
                    className="size-2.5 text-[var(--cf-mock-status-filled-fg)]"
                  />
                  <span>Saved · just now</span>
                </p>
              </div>
            </div>

            {/* Interactive Desktop / Mobile Switch */}
            <div
              role="group"
              aria-label="Preview viewport"
              className="hidden items-center rounded-md bg-[var(--cf-mock-chrome-subtle)] p-0.5 sm:inline-flex"
            >
              <button
                type="button"
                onClick={() => setPreviewDevice("desktop")}
                aria-pressed={previewDevice === "desktop"}
                className={cn(
                  "rounded-xs px-2 py-0.5 text-[0.625rem] font-medium transition-colors",
                  previewDevice === "desktop"
                    ? "border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] text-[var(--cf-mock-chrome-ink)]"
                    : "text-[var(--cf-mock-chrome-muted)]",
                )}
              >
                Desktop
              </button>
              <button
                type="button"
                onClick={() => setPreviewDevice("mobile")}
                aria-pressed={previewDevice === "mobile"}
                className={cn(
                  "rounded-xs px-2 py-0.5 text-[0.625rem] font-medium transition-colors",
                  previewDevice === "mobile"
                    ? "border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] text-[var(--cf-mock-chrome-ink)]"
                    : "text-[var(--cf-mock-chrome-muted)]",
                )}
              >
                Mobile
              </button>
            </div>

            <div aria-hidden="true" className="flex items-center gap-1.5">
              <span className="hidden size-5 items-center justify-center rounded-md border border-[var(--cf-mock-chrome-border)] text-[var(--cf-mock-chrome-muted)] md:inline-flex">
                <Undo2 className="size-2.5" />
              </span>
              <span className="hidden size-5 items-center justify-center rounded-md border border-[var(--cf-mock-chrome-border)] text-[var(--cf-mock-chrome-muted)] md:inline-flex">
                <Redo2 className="size-2.5" />
              </span>
              <span className="hidden rounded-md border border-[var(--cf-mock-chrome-border)] px-2 py-0.5 text-[0.625rem] font-medium text-[var(--cf-mock-chrome-ink)] sm:inline-block">
                Preview
              </span>
              <span className="rounded-md bg-[var(--cf-mock-publish-bg)] px-2.5 py-0.5 text-[0.625rem] font-medium text-[var(--cf-mock-publish-fg)]">
                Publish
              </span>
            </div>
          </div>

          {/* Editor 3-Pane Workspace */}
          <div
            aria-hidden="true"
            className="grid grid-cols-1 bg-[var(--cf-mock-chrome-canvas)] sm:grid-cols-[10.5rem_1fr_9.75rem]"
          >
            {/* Left Customize Panel */}
            <div className="hidden flex-col gap-3 border-r border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] p-3 sm:flex">
              <div className="grid grid-cols-3 rounded-md bg-[var(--cf-mock-chrome-subtle)] p-0.5 text-center text-[0.5625rem] font-medium">
                <span className="rounded-xs border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] py-0.5 text-[var(--cf-mock-chrome-ink)]">
                  Style
                </span>
                <span className="py-0.5 text-[var(--cf-mock-chrome-muted)]">
                  Content
                </span>
                <span className="py-0.5 text-[var(--cf-mock-chrome-muted)]">
                  Sections
                </span>
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-[0.5rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                  Colors · Template tokens
                </p>
                {V3_DEFAULT_TOKENS.map((token) => (
                  <div
                    key={token.label}
                    className="flex items-center justify-between rounded-md border border-[var(--cf-mock-chrome-border)] px-2 py-1"
                  >
                    <span className="inline-flex items-center gap-1.5 text-[0.5625rem] font-medium text-[var(--cf-mock-chrome-ink)]">
                      <span
                        className={cn("size-3 rounded-xs", token.swatchClass)}
                      />
                      <span>{token.label}</span>
                    </span>
                    <span className="font-mono text-[0.5rem] text-[var(--cf-mock-chrome-muted)]">
                      {token.hex}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-col gap-1.5">
                <p className="text-[0.5rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                  Fonts
                </p>
                <div className="rounded-md border border-[var(--cf-mock-chrome-border)] px-2 py-1 text-[0.5625rem] font-medium text-[var(--cf-mock-chrome-ink)]">
                  {V3_EDITOR_FONTS.defaultHeading}
                </div>
                <div className="rounded-md border border-[var(--cf-mock-chrome-border)] px-2 py-1 text-[0.5625rem] font-medium text-[var(--cf-mock-chrome-ink)]">
                  {V3_EDITOR_FONTS.body}
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <p className="text-[0.5rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                  Hero title
                </p>
                <div className="rounded-md border-[1.5px] border-[var(--cf-mock-publish-bg)] bg-[var(--cf-mock-chrome-bg)] px-2 py-1 text-[0.5625rem] font-medium text-[var(--cf-mock-chrome-ink)]">
                  Debt, finally under control
                </div>
              </div>
            </div>

            {/* Center Live Preview Canvas */}
            <div className="flex flex-col items-center px-3 pt-3 sm:px-4">
              <div className="mb-2 flex flex-wrap items-center justify-center gap-1.5 text-[0.5625rem] text-[var(--cf-mock-chrome-muted)]">
                <span className="rounded-full border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] px-2 py-0.5 font-medium text-[var(--cf-mock-chrome-ink)]">
                  Orbit · v1.0
                </span>
                <span className="hidden md:inline">
                  Live preview · same renderer as publish &amp; export
                </span>
              </div>

              <div
                className={cn(
                  "flex w-full flex-col justify-between overflow-hidden rounded-t-xl bg-[var(--cf-mock-orbit-bg)] p-4 text-[var(--cf-mock-orbit-fg)] transition-all duration-200 sm:p-5",
                  previewDevice === "mobile" ? "max-w-[16rem]" : "max-w-full",
                )}
              >
                <div className="flex items-center justify-between text-[0.5625rem]">
                  <span className="font-semibold text-[var(--cf-mock-orbit-fg)]">
                    Mosaed
                  </span>
                  <span className="text-[0.5rem] tracking-wider text-[var(--cf-mock-orbit-gold)] uppercase">
                    Case study · 2026
                  </span>
                </div>

                <div className="mt-4">
                  <p className="font-display text-lg leading-[1.08] font-bold tracking-tight text-[var(--cf-mock-orbit-fg)] sm:text-2xl">
                    Debt, finally under control
                  </p>
                  <p className="mt-1.5 text-[0.625rem] leading-relaxed text-[var(--cf-mock-orbit-muted)]">
                    A calm money app that helps people track, plan and pay off
                    personal debts.
                  </p>
                </div>

                <div className="mt-3 flex gap-5 text-[0.5rem]">
                  <div>
                    <p className="text-[var(--cf-mock-orbit-gold)] uppercase">
                      Role
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--cf-mock-orbit-fg)]">
                      Lead designer
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--cf-mock-orbit-gold)] uppercase">
                      Client
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--cf-mock-orbit-fg)]">
                      Mosaed
                    </p>
                  </div>
                  <div>
                    <p className="text-[var(--cf-mock-orbit-gold)] uppercase">
                      Year
                    </p>
                    <p className="mt-0.5 font-medium text-[var(--cf-mock-orbit-fg)]">
                      2026
                    </p>
                  </div>
                </div>

                <div className="mt-4 grid grid-cols-3 gap-2.5">
                  <div className="h-28 rounded-t-xl bg-gradient-to-b from-[var(--cf-mock-orbit-fg)] to-[var(--cf-mock-orbit-gold)] sm:h-36" />
                  <div className="h-28 rounded-t-xl bg-gradient-to-b from-[var(--cf-mock-orbit-indigo-deep)] to-[var(--cf-mock-orbit-indigo)] sm:h-36" />
                  <div className="flex h-28 flex-col justify-end rounded-t-xl border-[1.5px] border-b-0 border-[var(--cf-mock-publish-bg)] bg-[var(--cf-mock-chrome-bg)] p-2 text-[var(--cf-mock-chrome-ink)] sm:h-36">
                    <p className="text-[0.5rem] font-semibold">
                      Uploading… 64%
                    </p>
                    <div className="mt-1 h-1 w-full overflow-hidden rounded-full bg-[var(--cf-mock-chrome-subtle)]">
                      <div className="h-full w-2/3 rounded-full bg-[var(--cf-mock-publish-bg)]" />
                    </div>
                    <p className="mt-1 truncate text-[0.45rem] text-[var(--cf-mock-chrome-muted)]">
                      home-screen@2x.png
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Screenshots Slots Panel */}
            <div className="hidden flex-col gap-2.5 border-l border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] p-3 sm:flex">
              <div className="flex items-baseline justify-between">
                <p className="text-[0.6875rem] font-semibold text-[var(--cf-mock-chrome-ink)]">
                  Screenshots
                </p>
                <span className="text-[0.5rem] text-[var(--cf-mock-chrome-muted)]">
                  3 / 6 slots
                </span>
              </div>

              <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-subtle)]/50 px-2 py-3 text-center">
                <span className="inline-flex size-5 items-center justify-center rounded-full bg-[var(--cf-mock-status-upload-bg)] text-[var(--cf-mock-publish-bg)]">
                  <Upload className="size-2.5" />
                </span>
                <p className="text-[0.5625rem] font-medium text-[var(--cf-mock-chrome-ink)]">
                  Drop screenshots
                </p>
                <p className="text-[0.45rem] text-[var(--cf-mock-chrome-muted)]">
                  PNG / JPG · auto-framed
                </p>
              </div>

              <p className="text-[0.5rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                Slots
              </p>

              <div className="flex flex-col gap-1.5">
                {V3_EDITOR_SLOTS.map((slot) => (
                  <div
                    key={slot.name}
                    className="flex items-center justify-between gap-1.5 rounded-md border border-[var(--cf-mock-chrome-border)] p-1.5"
                  >
                    <div className="flex min-w-0 items-center gap-1.5">
                      <SlotThumb status={slot.status} />
                      <div className="min-w-0">
                        <p className="truncate text-[0.5625rem] leading-tight font-medium text-[var(--cf-mock-chrome-ink)]">
                          {slot.name}
                        </p>
                        <p className="truncate text-[0.45rem] text-[var(--cf-mock-chrome-muted)]">
                          {slot.meta}
                        </p>
                      </div>
                    </div>
                    <SlotStatusBadge item={slot} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Cropped left/center Editor Style Panel Media for Feature Panel 1 */
export function V3TemplatesPanelMedia() {
  return (
    <div
      aria-hidden="true"
      className="v3-pattern-dots-light relative flex h-full min-h-72 w-full items-end justify-end overflow-hidden bg-[var(--cf-bg-surface)] pt-8 pl-6 sm:min-h-96 sm:pt-12 sm:pl-10 lg:pt-14 lg:pl-12"
    >
      <div
        data-panel-media=""
        className="w-full min-w-[22rem] overflow-hidden rounded-tl-2xl border-t border-l border-[var(--cf-border-subtle)] bg-[var(--cf-mock-chrome-bg)] text-[var(--cf-mock-chrome-ink)] will-change-transform"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[var(--cf-mock-chrome-border)] px-4 py-2.5">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex size-5 items-center justify-center rounded-md border border-[var(--cf-mock-chrome-border)]">
              <ArrowLeft className="size-3" />
            </span>
            <div>
              <p className="text-xs font-semibold">
                Mosaed — Smart debt management
              </p>
              <p className="text-[0.625rem] text-[var(--cf-mock-chrome-muted)]">
                Saved · just now
              </p>
            </div>
          </div>
          <div className="inline-flex rounded-md bg-[var(--cf-mock-chrome-subtle)] p-0.5 text-[0.625rem] font-medium">
            <span className="rounded-xs border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] px-2 py-0.5">
              Desktop
            </span>
            <span className="px-2 py-0.5 text-[var(--cf-mock-chrome-muted)]">
              Mobile
            </span>
          </div>
        </div>

        {/* Left tokens + Live preview */}
        <div className="grid grid-cols-[11rem_1fr] bg-[var(--cf-mock-chrome-canvas)]">
          <div className="flex flex-col gap-3 border-r border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] p-3.5">
            <div className="grid grid-cols-3 rounded-md bg-[var(--cf-mock-chrome-subtle)] p-0.5 text-center text-[0.625rem] font-medium">
              <span className="rounded-xs border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] py-0.5">
                Style
              </span>
              <span className="py-0.5 text-[var(--cf-mock-chrome-muted)]">
                Content
              </span>
              <span className="py-0.5 text-[var(--cf-mock-chrome-muted)]">
                Sections
              </span>
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-[0.5625rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                Colors · Template tokens
              </p>
              {V3_DEFAULT_TOKENS.map((token) => (
                <div
                  key={token.label}
                  className="flex items-center justify-between rounded-md border border-[var(--cf-mock-chrome-border)] px-2 py-1.5"
                >
                  <span className="inline-flex items-center gap-1.5 text-[0.625rem] font-medium">
                    <span
                      className={cn("size-3.5 rounded-xs", token.swatchClass)}
                    />
                    <span>{token.label}</span>
                  </span>
                  <span className="font-mono text-[0.5625rem] text-[var(--cf-mock-chrome-muted)]">
                    {token.hex}
                  </span>
                </div>
              ))}
            </div>

            <div className="flex flex-col gap-1.5">
              <p className="text-[0.5625rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                Fonts
              </p>
              <div className="rounded-md border border-[var(--cf-mock-chrome-border)] px-2.5 py-1.5 text-[0.625rem] font-medium">
                {V3_EDITOR_FONTS.defaultHeading}
              </div>
              <div className="rounded-md border border-[var(--cf-mock-chrome-border)] px-2.5 py-1.5 text-[0.625rem] font-medium">
                {V3_EDITOR_FONTS.body}
              </div>
            </div>
          </div>

          <div className="pt-4 pl-4">
            <div className="flex h-full flex-col justify-between rounded-tl-xl bg-[var(--cf-mock-orbit-bg)] p-5 text-[var(--cf-mock-orbit-fg)]">
              <div>
                <p className="text-xs font-semibold">Mosaed</p>
                <p className="mt-4 font-display text-2xl leading-tight font-bold">
                  Debt, finally under control
                </p>
                <p className="mt-2 text-xs text-[var(--cf-mock-orbit-muted)]">
                  A calm money app that helps people track, plan and pay off
                  personal debts.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="h-24 rounded-t-xl bg-gradient-to-b from-[var(--cf-mock-orbit-fg)] to-[var(--cf-mock-orbit-gold)]" />
                <div className="h-24 rounded-t-xl bg-gradient-to-b from-[var(--cf-mock-orbit-indigo-deep)] to-[var(--cf-mock-orbit-indigo)]" />
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Cropped right/center Editor Slots Panel Media for Feature Panel 2 */
export function V3EditorSlotsPanelMedia() {
  return (
    <div
      aria-hidden="true"
      className="v3-pattern-dots-light relative flex h-full min-h-72 w-full items-end justify-start overflow-hidden bg-[var(--cf-bg-surface)] pt-8 pr-6 sm:min-h-96 sm:pt-12 sm:pr-10 lg:pt-14 lg:pr-12"
    >
      <div
        data-panel-media=""
        className="w-full min-w-[22rem] overflow-hidden rounded-tr-2xl border-t border-r border-[var(--cf-border-subtle)] bg-[var(--cf-mock-chrome-bg)] text-[var(--cf-mock-chrome-ink)] will-change-transform"
      >
        {/* Top bar */}
        <div className="flex items-center justify-between border-b border-[var(--cf-mock-chrome-border)] px-4 py-2.5">
          <div className="inline-flex rounded-md bg-[var(--cf-mock-chrome-subtle)] p-0.5 text-[0.625rem] font-medium">
            <span className="rounded-xs border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] px-2 py-0.5">
              Desktop
            </span>
            <span className="px-2 py-0.5 text-[var(--cf-mock-chrome-muted)]">
              Mobile
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="rounded-md border border-[var(--cf-mock-chrome-border)] px-2.5 py-0.5 text-[0.625rem] font-medium">
              Preview
            </span>
            <span className="rounded-md bg-[var(--cf-mock-publish-bg)] px-2.5 py-0.5 text-[0.625rem] font-medium text-[var(--cf-mock-publish-fg)]">
              Publish
            </span>
          </div>
        </div>

        {/* Center right crop + Slots panel with empty-slot alert */}
        <div className="grid grid-cols-[1fr_12.5rem] bg-[var(--cf-mock-chrome-canvas)]">
          <div className="pt-4 pr-4">
            <div className="flex h-full flex-col justify-between rounded-tr-xl bg-[var(--cf-mock-orbit-bg)] p-5 text-[var(--cf-mock-orbit-fg)]">
              <div>
                <p className="text-[0.5625rem] tracking-wider text-[var(--cf-mock-orbit-gold)] uppercase">
                  Case study · 2026
                </p>
                <p className="mt-3 font-display text-2xl leading-tight font-bold">
                  finally under control
                </p>
                <p className="mt-2 text-xs text-[var(--cf-mock-orbit-muted)]">
                  Track, plan and pay off personal debts.
                </p>
              </div>
              <div className="mt-5 grid grid-cols-2 gap-3">
                <div className="h-24 rounded-t-xl bg-gradient-to-b from-[var(--cf-mock-orbit-indigo-deep)] to-[var(--cf-mock-orbit-indigo)]" />
                <div className="h-24 rounded-t-xl bg-[var(--cf-mock-chrome-bg)]" />
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2.5 border-l border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] p-3.5">
            <div className="flex items-baseline justify-between">
              <p className="text-xs font-semibold">Screenshots</p>
              <span className="text-[0.5625rem] text-[var(--cf-mock-chrome-muted)]">
                3 / 6 slots
              </span>
            </div>

            <div className="flex flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-subtle)]/50 px-2 py-3 text-center">
              <Upload className="size-3.5 text-[var(--cf-mock-publish-bg)]" />
              <p className="text-[0.625rem] font-medium">Drop screenshots</p>
            </div>

            {/* Required slot warning (Figma 86:7992) */}
            <div className="flex items-start gap-1.5 rounded-lg bg-[var(--cf-mock-status-empty-bg)] p-2 text-[var(--cf-mock-status-empty-fg)]">
              <AlertTriangle className="mt-0.5 size-3 shrink-0" />
              <p className="text-[0.5625rem] leading-snug font-medium">
                1 required slot is empty: “Onboarding”
              </p>
            </div>

            <div className="flex flex-col gap-1.5">
              {V3_EDITOR_SLOTS.slice(0, 4).map((slot) => (
                <div
                  key={slot.name}
                  className="flex items-center justify-between gap-1.5 rounded-md border border-[var(--cf-mock-chrome-border)] p-1.5"
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    <SlotThumb status={slot.status} />
                    <div className="min-w-0">
                      <p className="truncate text-[0.625rem] leading-tight font-medium">
                        {slot.name}
                      </p>
                      <p className="truncate text-[0.5rem] text-[var(--cf-mock-chrome-muted)]">
                        {slot.meta}
                      </p>
                    </div>
                  </div>
                  <SlotStatusBadge item={slot} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

/** Interactive Dark Showcase Preview Window (Figma 87:8019) */
export function V3ShowcaseEditorPreview({
  activeTab,
}: {
  activeTab: V3ShowcaseTabId;
}) {
  const isTealTheme = activeTab === "tokens";
  const isAltFont = activeTab === "fonts";
  const isSectionsMode = activeTab === "sections";
  const tokens = isTealTheme ? V3_ALT_TOKENS : V3_DEFAULT_TOKENS;

  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[1.25rem] border border-[var(--cf-border-inverse)] bg-[var(--cf-mock-chrome-bg)] text-[var(--cf-mock-chrome-ink)] shadow-[var(--cf-shadow-card)] lg:rounded-[1.75rem]"
    >
      {/* Editor bar */}
      <div className="flex items-center justify-between border-b border-[var(--cf-mock-chrome-border)] px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="inline-flex size-2 rounded-full bg-[var(--cf-mock-chrome-border)]" />
          <span className="text-[0.6875rem] font-medium text-[var(--cf-mock-chrome-muted)]">
            Orbit · v1.0
          </span>
        </div>

        <div className="inline-flex rounded-md bg-[var(--cf-mock-chrome-subtle)] p-0.5 text-[0.625rem] font-medium">
          <span className="rounded-xs border border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] px-2.5 py-0.5">
            Desktop
          </span>
          <span className="px-2.5 py-0.5 text-[var(--cf-mock-chrome-muted)]">
            Mobile
          </span>
        </div>

        <span className="text-[0.625rem] font-medium text-[var(--cf-mock-chrome-muted)]">
          {activeTab === "slots" && "9:19.5 locked"}
          {activeTab === "tokens" && "Tokens synced"}
          {activeTab === "fonts" && V3_EDITOR_FONTS.altHeading}
          {activeTab === "sections" && "3 / 4 visible"}
        </span>
      </div>

      {/* Cropped Editor Workspace spotlighting the live canvas */}
      <div className="grid grid-cols-1 bg-[var(--cf-mock-chrome-canvas)] sm:grid-cols-[8.5rem_1fr]">
        {/* Left contextual inspector strip */}
        <div className="hidden flex-col gap-2.5 border-r border-[var(--cf-mock-chrome-border)] bg-[var(--cf-mock-chrome-bg)] p-3 sm:flex">
          {isSectionsMode ? (
            <>
              <p className="text-[0.5rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                Sections
              </p>
              {[
                { name: "Hero", visible: true },
                { name: "Challenge", visible: true },
                { name: "Key screens", visible: true },
                { name: "Outcomes", visible: false },
              ].map((sec) => (
                <div
                  key={sec.name}
                  className={cn(
                    "flex items-center justify-between rounded-md border px-2 py-1.5 text-[0.625rem] font-medium",
                    sec.visible
                      ? "border-[var(--cf-mock-chrome-border)] text-[var(--cf-mock-chrome-ink)]"
                      : "border-dashed border-[var(--cf-mock-chrome-border)] text-[var(--cf-mock-chrome-muted)] opacity-60",
                  )}
                >
                  <span>{sec.name}</span>
                  <span className="text-[0.5rem]">
                    {sec.visible ? "Shown" : "Hidden"}
                  </span>
                </div>
              ))}
            </>
          ) : (
            <>
              <p className="text-[0.5rem] font-semibold tracking-wider text-[var(--cf-mock-chrome-muted)] uppercase">
                {isAltFont ? "Font pair" : "Tokens"}
              </p>
              {tokens.map((tok) => (
                <div
                  key={tok.label}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md border px-2 py-1 text-[0.5625rem] font-medium transition-colors",
                    isTealTheme
                      ? "border-[var(--cf-mock-publish-bg)]/40 bg-[var(--cf-mock-status-upload-bg)]/30"
                      : "border-[var(--cf-mock-chrome-border)]",
                  )}
                >
                  <span className={cn("size-2.5 rounded-xs", tok.swatchClass)} />
                  <span className="truncate">{tok.label}</span>
                </div>
              ))}
              <div
                className={cn(
                  "mt-1 rounded-md border px-2 py-1.5 text-[0.5625rem] font-medium",
                  isAltFont
                    ? "border-[var(--cf-mock-publish-bg)] bg-[var(--cf-mock-status-upload-bg)]/40"
                    : "border-[var(--cf-mock-chrome-border)]",
                )}
              >
                {isAltFont
                  ? V3_EDITOR_FONTS.altHeading
                  : V3_EDITOR_FONTS.defaultHeading}
              </div>
            </>
          )}
        </div>

        {/* Center Live Case Study Preview */}
        <div className="px-4 pt-4 sm:px-6 sm:pt-5">
          <p className="mb-2.5 text-center text-[0.5625rem] text-[var(--cf-mock-chrome-muted)]">
            Orbit · v1.0 · Live preview · same renderer as publish &amp; export
          </p>

          <div
            className={cn(
              "flex flex-col justify-between overflow-hidden rounded-t-2xl p-5 transition-colors duration-300 sm:p-6",
              isTealTheme
                ? "bg-[var(--cf-mock-teal-bg)] text-[var(--cf-mock-orbit-fg)]"
                : "bg-[var(--cf-mock-orbit-bg)] text-[var(--cf-mock-orbit-fg)]",
            )}
          >
            <div className="flex items-center justify-between text-xs">
              <span className="font-semibold">Mosaed</span>
              <span
                className={cn(
                  "text-[0.5625rem] tracking-wider uppercase",
                  isTealTheme
                    ? "text-[var(--cf-mock-teal-accent)]"
                    : "text-[var(--cf-mock-orbit-gold)]",
                )}
              >
                Case study · 2026
              </span>
            </div>

            <div className="mt-5">
              <p
                className={cn(
                  "text-2xl leading-[1.08] font-bold tracking-tight sm:text-3xl",
                  isAltFont ? "font-editorial italic font-normal" : "font-display",
                )}
              >
                Debt, finally under control
              </p>
              <p className="mt-2 max-w-md text-xs leading-relaxed text-[var(--cf-mock-orbit-muted)]">
                A calm money app that helps people track, plan and pay off
                personal debts.
              </p>
            </div>

            {!isSectionsMode && (
              <div className="mt-4 flex gap-6 text-[0.5625rem]">
                <div>
                  <p
                    className={cn(
                      "uppercase",
                      isTealTheme
                        ? "text-[var(--cf-mock-teal-accent)]"
                        : "text-[var(--cf-mock-orbit-gold)]",
                    )}
                  >
                    Role
                  </p>
                  <p className="mt-0.5 font-medium">Lead designer</p>
                </div>
                <div>
                  <p
                    className={cn(
                      "uppercase",
                      isTealTheme
                        ? "text-[var(--cf-mock-teal-accent)]"
                        : "text-[var(--cf-mock-orbit-gold)]",
                    )}
                  >
                    Client
                  </p>
                  <p className="mt-0.5 font-medium">Mosaed</p>
                </div>
                <div>
                  <p
                    className={cn(
                      "uppercase",
                      isTealTheme
                        ? "text-[var(--cf-mock-teal-accent)]"
                        : "text-[var(--cf-mock-orbit-gold)]",
                    )}
                  >
                    Year
                  </p>
                  <p className="mt-0.5 font-medium">2026</p>
                </div>
              </div>
            )}

            <div className="mt-5 grid grid-cols-3 gap-3">
              <div
                className={cn(
                  "h-28 rounded-t-xl sm:h-36",
                  isTealTheme
                    ? "bg-gradient-to-b from-[var(--cf-mock-orbit-fg)] to-[var(--cf-mock-teal-accent)]"
                    : "bg-gradient-to-b from-[var(--cf-mock-orbit-fg)] to-[var(--cf-mock-orbit-gold)]",
                )}
              />
              <div
                className={cn(
                  "h-28 rounded-t-xl sm:h-36",
                  isTealTheme
                    ? "bg-gradient-to-b from-[var(--cf-mock-teal-secondary)] to-[var(--cf-mock-orbit-indigo)]"
                    : "bg-gradient-to-b from-[var(--cf-mock-orbit-indigo-deep)] to-[var(--cf-mock-orbit-indigo)]",
                )}
              />
              <div className="flex h-28 flex-col justify-end rounded-t-xl bg-[var(--cf-mock-chrome-bg)] p-2.5 text-[var(--cf-mock-chrome-ink)] sm:h-36">
                <p className="text-[0.5625rem] font-semibold">Phone · 9:19.5</p>
                <p className="mt-0.5 text-[0.5rem] text-[var(--cf-mock-chrome-muted)]">
                  Auto-cropped slot
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
