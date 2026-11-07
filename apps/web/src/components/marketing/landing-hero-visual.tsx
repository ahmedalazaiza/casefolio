"use client";

import {
  AlertCircle,
  ArrowLeft,
  Check,
  CheckCircle2,
  CloudCheck,
  Laptop,
  Monitor,
  Redo2,
  Smartphone,
  Sparkles,
  Undo2,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { cn } from "@/lib/utils";

type DemoProjectKey = "cinema" | "orbit" | "meridian";
type DemoPaletteKey = "crimson" | "indigo" | "gold" | "emerald";
type DemoDeviceKey = "iphone" | "android" | "macbook";

interface DemoProjectSpec {
  key: DemoProjectKey;
  label: string;
  templateBadge: string;
  projectTitle: string;
  eyebrow: string;
  heroTitle: string;
  heroSubtitle: string;
  role: string;
  client: string;
  year: string;
  defaultDevice: DemoDeviceKey;
  defaultPalette: DemoPaletteKey;
  screens: readonly {
    title: string;
    ratio: string;
    src: string;
  }[];
}

const DEMO_PROJECTS: Record<DemoProjectKey, DemoProjectSpec> = {
  cinema: {
    key: "cinema",
    label: ".Cinema · Mobile + Web",
    templateBadge: "Cinema · v1.0.0 · 14 sections",
    projectTitle: ".Cinema — Movie ticket booking",
    eyebrow: "ENTERTAINMENT · MOBILE + WEB",
    heroTitle: "Skip the line. Pick the perfect auditorium seat.",
    heroSubtitle:
      "Dark-room ticket discovery, tactile seat selection, and instant live QR passes.",
    role: "Lead Product Designer",
    client: ".Cinema",
    year: "2026",
    defaultDevice: "iphone",
    defaultPalette: "crimson",
    screens: [
      {
        title: "Splash",
        ratio: "9:19.5",
        src: "/templates/cinema/hero-splash.svg",
      },
      {
        title: "Showtimes",
        ratio: "9:19.5",
        src: "/templates/cinema/screen-home.svg",
      },
      {
        title: "Seat Map",
        ratio: "9:19.5",
        src: "/templates/cinema/screen-seats.svg",
      },
    ],
  },
  orbit: {
    key: "orbit",
    label: "Orbit · Mobile App",
    templateBadge: "Orbit · v1.0.0 · 6 sections",
    projectTitle: "Orbit — Calm debt & wallet planner",
    eyebrow: "FINTECH · MOBILE APP",
    heroTitle: "Debt, finally under calm control.",
    heroSubtitle:
      "Automated snowball milestones and interest-saved tracking built for first-time savers.",
    role: "Senior Product Designer",
    client: "Orbit Money",
    year: "2026",
    defaultDevice: "iphone",
    defaultPalette: "indigo",
    screens: [
      {
        title: "Wallet Home",
        ratio: "9:19.5",
        src: "/landing/orbit-home.svg",
      },
      {
        title: "Snowball Plan",
        ratio: "9:19.5",
        src: "/landing/orbit-plan.svg",
      },
      {
        title: "Live Pass",
        ratio: "9:19.5",
        src: "/templates/cinema/screen-success.svg",
      },
    ],
  },
  meridian: {
    key: "meridian",
    label: "Meridian · Web SaaS",
    templateBadge: "Meridian · v1.0.0 · 6 sections",
    projectTitle: "Meridian — Enterprise Revenue OS",
    eyebrow: "B2B SAAS · WEBSITE",
    heroTitle: "Turning raw pipeline telemetry into instant commits.",
    heroSubtitle:
      "Zero-SQL cohort forecasts and executive revenue workspaces in crisp browser frames.",
    role: "Staff Designer",
    client: "Meridian Cloud",
    year: "2026",
    defaultDevice: "macbook",
    defaultPalette: "indigo",
    screens: [
      {
        title: "Revenue Command",
        ratio: "16:10",
        src: "/landing/meridian-dashboard.svg",
      },
      {
        title: "Export Deck",
        ratio: "16:9",
        src: "/landing/export-bundle-preview.svg",
      },
      {
        title: "Seat Checkout",
        ratio: "9:19.5",
        src: "/templates/cinema/screen-checkout.svg",
      },
    ],
  },
};

const PALETTE_OPTIONS: readonly {
  key: DemoPaletteKey;
  label: string;
  tokenName: string;
  dotClass: string;
  accentTextClass: string;
  pillClass: string;
}[] = [
  {
    key: "crimson",
    label: "Crimson Theater",
    tokenName: "token.crimson",
    dotClass: "bg-[var(--tmpl-secondary)]",
    accentTextClass: "text-[var(--tmpl-secondary)]",
    pillClass: "border-[var(--tmpl-secondary)]/50 bg-[var(--tmpl-secondary)]/15",
  },
  {
    key: "indigo",
    label: "Indigo Studio",
    tokenName: "token.indigo",
    dotClass: "bg-primary",
    accentTextClass: "text-primary",
    pillClass: "border-primary/50 bg-primary/15",
  },
  {
    key: "gold",
    label: "Obsidian Gold",
    tokenName: "token.gold",
    dotClass: "bg-[var(--tmpl-primary)]",
    accentTextClass: "text-[var(--tmpl-primary)]",
    pillClass: "border-[var(--tmpl-primary)]/50 bg-[var(--tmpl-primary)]/15",
  },
  {
    key: "emerald",
    label: "Emerald Signal",
    tokenName: "token.emerald",
    dotClass: "bg-success",
    accentTextClass: "text-success",
    pillClass: "border-success/50 bg-success/15",
  },
] as const;

const DEVICE_OPTIONS: readonly {
  key: DemoDeviceKey;
  label: string;
  icon: typeof Smartphone;
}[] = [
  { key: "iphone", label: "iPhone 16 Pro", icon: Smartphone },
  { key: "android", label: "Android", icon: Smartphone },
  { key: "macbook", label: "MacBook / Web", icon: Laptop },
] as const;

export function LandingHeroVisual() {
  const [activeProject, setActiveProject] = useState<DemoProjectKey>("cinema");
  const [activePalette, setActivePalette] = useState<DemoPaletteKey>("crimson");
  const [activeDevice, setActiveDevice] = useState<DemoDeviceKey>("iphone");
  const [slotFilled, setSlotFilled] = useState(false);

  const project = DEMO_PROJECTS[activeProject];
  const palette =
    PALETTE_OPTIONS.find((item) => item.key === activePalette) ??
    PALETTE_OPTIONS[0]!;

  const handleSelectProject = (nextKey: DemoProjectKey) => {
    const spec = DEMO_PROJECTS[nextKey];
    setActiveProject(nextKey);
    setActiveDevice(spec.defaultDevice);
    setActivePalette(spec.defaultPalette);
  };

  const handleSelectDevice = (nextDevice: DemoDeviceKey) => {
    setActiveDevice(nextDevice);
  };

  const handleSelectPalette = (nextPalette: DemoPaletteKey) => {
    setActivePalette(nextPalette);
  };

  const handleSnapMissingSlot = () => {
    setSlotFilled(true);
  };

  const filledCount = slotFilled ? 6 : 5;
  const isWidescreen = activeDevice === "macbook";

  return (
    <figure
      id="hero-playground"
      aria-label="Casefolio editor preview showing customizable tokens, live case study canvas, and screenshot slot validation"
      className="border-border bg-card shadow-overlay relative mx-auto w-full max-w-6xl scroll-mt-28 overflow-hidden rounded-2xl border text-left"
    >
      {/* Interactive Studio Bar — Switch real templates right inside the Hero */}
      <div className="border-border bg-surface/90 flex flex-wrap items-center justify-between gap-2 border-b px-3 py-2 sm:px-5">
        <div className="flex items-center gap-2">
          <span className="bg-accent text-accent-foreground type-caption inline-flex items-center gap-1 rounded-full px-2.5 py-0.5">
            <Sparkles className="size-3" />
            <span>Interactive Live Editor</span>
          </span>
          <span className="text-muted-foreground type-caption hidden sm:inline">
            Switch templates, theme tokens, or hardware bezels live
          </span>
        </div>

        <div
          role="tablist"
          aria-label="Preview live templates"
          className="bg-sunken border-border inline-flex items-center gap-1 rounded-full border p-0.5"
        >
          {(Object.keys(DEMO_PROJECTS) as DemoProjectKey[]).map((key) => {
            const item = DEMO_PROJECTS[key];
            const selected = key === activeProject;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={selected}
                onClick={() => handleSelectProject(key)}
                className={cn(
                  "type-caption focus-visible:ring-ring/40 rounded-full px-2.5 py-1 transition-all outline-none focus-visible:ring-2",
                  selected
                    ? "bg-elevated text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Editor Top Chrome */}
      <div className="border-border bg-card flex h-14 items-center justify-between gap-3 border-b px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            aria-hidden="true"
            className="border-border bg-elevated text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md border"
          >
            <ArrowLeft className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-foreground type-body-s-strong truncate">
              {project.projectTitle}
            </p>
            <p className="text-muted-foreground type-caption flex items-center gap-1">
              <CloudCheck className="text-success size-3 shrink-0" />
              <span>Autosaved · {filledCount}/6 slots ready</span>
            </p>
          </div>
        </div>

        {/* Device frame switcher inside editor top bar */}
        <div
          role="group"
          aria-label="Hardware device mockup switcher"
          className="bg-sunken border-border hidden items-center gap-0.5 rounded-full border p-1 md:inline-flex"
        >
          {DEVICE_OPTIONS.map((device) => {
            const Icon = device.icon;
            const selected = activeDevice === device.key;
            return (
              <button
                key={device.key}
                type="button"
                aria-pressed={selected}
                onClick={() => handleSelectDevice(device.key)}
                className={cn(
                  "type-caption focus-visible:ring-ring/40 inline-flex items-center gap-1.5 rounded-full px-3 py-1 transition-all outline-none focus-visible:ring-2",
                  selected
                    ? "bg-elevated text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="size-3" />
                <span>{device.label}</span>
              </button>
            );
          })}
        </div>

        <div className="flex items-center gap-2">
          <span
            aria-hidden="true"
            className="border-border bg-elevated text-muted-foreground hidden size-7.5 items-center justify-center rounded-md border sm:inline-flex"
          >
            <Undo2 className="size-3.5" />
          </span>
          <span
            aria-hidden="true"
            className="border-border bg-elevated text-muted-foreground hidden size-7.5 items-center justify-center rounded-md border sm:inline-flex"
          >
            <Redo2 className="size-3.5" />
          </span>
          <Link
            href={`/new?template=${activeProject === "cinema" ? "cinema" : activeProject === "orbit" ? "orbit" : "meridian-pro"}`}
            className="bg-primary text-primary-foreground hover:bg-primary/90 type-caption inline-flex items-center gap-1 rounded-full px-3.5 py-1.5 transition-colors"
          >
            <Sparkles className="size-3" />
            <span>Open in editor</span>
          </Link>
        </div>
      </div>

      {/* Editor 3-column workspace */}
      <div className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Interactive Style & Hardware Controls */}
        <div className="border-border bg-card flex flex-col gap-4 border-b p-4 sm:p-5 lg:col-span-3 lg:border-r lg:border-b-0">
          <div className="flex items-center justify-between">
            <span className="text-muted-foreground type-overline">
              1 · Theme Tokens
            </span>
            <span className="text-muted-foreground type-caption">Curated</span>
          </div>

          <div className="grid grid-cols-2 gap-2 lg:grid-cols-1">
            {PALETTE_OPTIONS.map((item) => {
              const selected = item.key === activePalette;
              return (
                <button
                  key={item.key}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => handleSelectPalette(item.key)}
                  className={cn(
                    "focus-visible:ring-ring/40 flex items-center justify-between rounded-lg border px-2.5 py-2 text-left transition-all outline-none focus-visible:ring-2",
                    selected
                      ? "border-primary bg-accent/50 shadow-xs"
                      : "border-border bg-surface hover:border-border-strong",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className={cn("size-3.5 rounded-full", item.dotClass)} />
                    <span className="text-foreground type-caption">
                      {item.label}
                    </span>
                  </span>
                  <span className="text-muted-foreground font-mono type-caption hidden xl:inline">
                    {item.tokenName}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="border-border flex flex-col gap-2 border-t pt-3.5">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground type-overline">
                2 · Hardware Frame
              </span>
              <span className="text-muted-foreground type-caption">7 models</span>
            </div>
            <div className="grid grid-cols-3 gap-1.5 lg:grid-cols-1">
              {DEVICE_OPTIONS.map((device) => {
                const selected = activeDevice === device.key;
                return (
                  <button
                    key={device.key}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => handleSelectDevice(device.key)}
                    className={cn(
                      "type-caption focus-visible:ring-ring/40 flex items-center justify-between rounded-md border px-2.5 py-1.5 transition-all outline-none focus-visible:ring-2",
                      selected
                        ? "border-primary bg-elevated text-foreground"
                        : "border-border bg-surface text-muted-foreground hover:text-foreground",
                    )}
                  >
                    <span>{device.label}</span>
                    {selected && <Check className="text-primary size-3" />}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="border-border hidden flex-col gap-1.5 border-t pt-3.5 lg:flex">
            <span className="text-muted-foreground type-overline">
              Heading Typography
            </span>
            <div className="border-border bg-surface flex items-center justify-between rounded-md border px-3 py-2">
              <span className="font-display text-foreground type-body-s-strong">
                Bricolage Grotesque
              </span>
              <span className="text-muted-foreground type-caption">Display</span>
            </div>
          </div>
        </div>

        {/* Center: Live Case Study Canvas with Real Vector UI Screens */}
        <div className="bg-sunken flex flex-col gap-4 p-3 sm:p-6 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="bg-elevated text-foreground border-border type-caption rounded-full border px-2.5 py-0.5">
              {project.templateBadge}
            </span>
            <span className="text-muted-foreground type-caption">
              Same renderer for live page, PNG &amp; PDF
            </span>
          </div>

          <div className="bg-[var(--tmpl-bg)] text-[var(--tmpl-text)] shadow-card flex flex-1 flex-col justify-between gap-6 rounded-xl border border-[var(--tmpl-line)] p-5 sm:p-6">
            <div className="flex flex-col gap-4">
              <div className="flex items-center justify-between gap-3">
                <span
                  className={cn(
                    "type-overline inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5",
                    palette.pillClass,
                    palette.accentTextClass,
                  )}
                >
                  <span className={cn("size-1.5 rounded-full", palette.dotClass)} />
                  {project.eyebrow}
                </span>
                <span className="text-[var(--tmpl-muted)] type-caption">
                  {project.year}
                </span>
              </div>

              <div className="flex flex-col gap-2">
                <p className="type-heading-l text-[var(--tmpl-text)] text-balance">
                  {project.heroTitle}
                </p>
                <p className="text-[var(--tmpl-muted)] type-body-s max-w-lg">
                  {project.heroSubtitle}
                </p>
              </div>

              <div className="grid max-w-sm grid-cols-3 gap-3 border-t border-[var(--tmpl-line)] pt-3">
                <div>
                  <p className="text-[var(--tmpl-muted)] type-overline">Role</p>
                  <p className="type-caption mt-0.5 truncate">{project.role}</p>
                </div>
                <div>
                  <p className="text-[var(--tmpl-muted)] type-overline">Client</p>
                  <p className="type-caption mt-0.5 truncate">{project.client}</p>
                </div>
                <div>
                  <p className="text-[var(--tmpl-muted)] type-overline">Device</p>
                  <p className={cn("type-caption mt-0.5 truncate", palette.accentTextClass)}>
                    {activeDevice === "iphone"
                      ? "iPhone 16 Pro"
                      : activeDevice === "android"
                        ? "Android"
                        : "MacBook Pro"}
                  </p>
                </div>
              </div>
            </div>

            {/* Live Hardware Frames Rendering Real App/Web Screens */}
            {isWidescreen ? (
              <div className="flex flex-col gap-3">
                <div className="overflow-hidden rounded-xl border border-[var(--tmpl-line)] bg-inverse shadow-card">
                  <div className="flex h-6 items-center gap-1.5 border-b border-[var(--tmpl-line)] px-3">
                    <span className="bg-border-strong size-2 rounded-full" />
                    <span className="bg-border-strong size-2 rounded-full" />
                    <span className="bg-border-strong size-2 rounded-full" />
                    <span className="text-[var(--tmpl-muted)] font-mono type-caption mx-auto">
                      app.meridian.cloud/revenue
                    </span>
                  </div>
                  <img
                    src="/landing/meridian-dashboard.svg"
                    alt={`${project.client} widescreen web mockup`}
                    className="aspect-16/10 w-full object-cover"
                  />
                </div>
              </div>
            ) : (
              <div className="grid grid-cols-3 gap-2.5 pt-1 sm:gap-3.5">
                {project.screens.map((screen, idx) => {
                  const isThirdSlot = idx === 2;
                  const showFilled = !isThirdSlot || slotFilled;

                  return (
                    <div key={screen.title} className="flex flex-col gap-1.5">
                      {showFilled ? (
                        <div
                          className={cn(
                            "relative overflow-hidden border-2 border-[var(--tmpl-line)] bg-inverse p-1 shadow-card transition-all duration-300",
                            activeDevice === "iphone"
                              ? "rounded-2xl sm:rounded-3xl"
                              : "rounded-xl sm:rounded-2xl",
                          )}
                        >
                          {activeDevice === "iphone" ? (
                            <span
                              aria-hidden="true"
                              className="bg-inverse pointer-events-none absolute top-2 left-1/2 z-10 h-2 w-8 -translate-x-1/2 rounded-full"
                            />
                          ) : (
                            <span
                              aria-hidden="true"
                              className="bg-inverse pointer-events-none absolute top-2 left-1/2 z-10 size-1.5 -translate-x-1/2 rounded-full"
                            />
                          )}
                          <img
                            src={screen.src}
                            alt={`${project.client} ${screen.title} screen`}
                            className="aspect-9/19 w-full rounded-xl object-cover sm:rounded-2xl"
                          />
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleSnapMissingSlot}
                          className="border-primary bg-primary/10 hover:bg-primary/20 focus-visible:ring-ring/40 flex aspect-9/19 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed p-2 text-center transition-all outline-none focus-visible:ring-2 sm:rounded-3xl"
                        >
                          <span className="bg-primary text-primary-foreground inline-flex size-8 items-center justify-center rounded-full shadow-xs">
                            <Upload className="size-3.5" />
                          </span>
                          <span className="text-[var(--tmpl-text)] type-caption">
                            Drop {screen.title}
                          </span>
                          <span className="text-[var(--tmpl-muted)] font-mono type-caption">
                            {screen.ratio}
                          </span>
                        </button>
                      )}
                      <span className="text-[var(--tmpl-muted)] type-caption truncate text-center">
                        {screen.title}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Right: Interactive Slot Validator & Pre-publish Readiness */}
        <div className="border-border bg-card flex flex-col gap-3.5 p-4 sm:p-5 lg:col-span-3 lg:border-l">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground type-body-s-strong">
              3 · Slot Check
            </span>
            <span
              className={cn(
                "type-caption rounded-full px-2 py-0.5",
                slotFilled
                  ? "bg-success-soft text-foreground"
                  : "bg-sunken text-muted-foreground",
              )}
            >
              {filledCount} / 6 ready
            </span>
          </div>

          {slotFilled ? (
            <div className="bg-success-soft border-success/30 text-foreground flex items-start gap-2 rounded-lg border p-3">
              <CheckCircle2 className="text-success mt-0.5 size-4 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <span className="type-caption font-semibold">
                  Pre-publish check passed
                </span>
                <span className="text-muted-foreground type-caption">
                  All ratio-locked slots filled · Ready to publish
                </span>
              </div>
            </div>
          ) : (
            <div className="bg-warning-soft border-warning/30 text-foreground flex flex-col gap-2.5 rounded-lg border p-3">
              <div className="flex items-start gap-2">
                <AlertCircle className="text-warning mt-0.5 size-4 shrink-0" />
                <span className="type-caption">
                  1 required slot empty: “{project.screens[2]?.title}”
                </span>
              </div>
              <button
                type="button"
                onClick={handleSnapMissingSlot}
                className="bg-primary text-primary-foreground hover:bg-primary/90 focus-visible:ring-ring/40 type-caption inline-flex w-full items-center justify-center gap-1.5 rounded-md px-3 py-2 transition-colors outline-none focus-visible:ring-2"
              >
                <Upload className="size-3.5" />
                <span>Snap screen into slot</span>
              </button>
            </div>
          )}

          <span className="text-muted-foreground type-overline pt-1">
            Ratio-Locked Slots
          </span>

          <div className="flex flex-col gap-2">
            {project.screens.map((slot, index) => {
              const isReady = index < 2 || slotFilled;
              return (
                <div
                  key={slot.title}
                  className="border-border bg-surface flex items-center justify-between gap-2 rounded-lg border p-2"
                >
                  <div className="flex min-w-0 items-center gap-2">
                    <img
                      src={slot.src}
                      alt=""
                      aria-hidden="true"
                      className={cn(
                        "h-8 w-6 shrink-0 rounded-xs object-cover",
                        !isReady && "opacity-35 grayscale",
                      )}
                    />
                    <div className="min-w-0">
                      <p className="text-foreground type-caption truncate">
                        {slot.title}
                      </p>
                      <p className="text-muted-foreground type-caption truncate">
                        Ratio · {slot.ratio}
                      </p>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "type-caption inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5",
                      isReady
                        ? "bg-success-soft text-foreground"
                        : "bg-warning-soft text-foreground",
                    )}
                  >
                    <span
                      className={cn(
                        "size-1.5 rounded-full",
                        isReady ? "bg-success" : "bg-warning",
                      )}
                    />
                    {isReady ? "Filled" : "Empty"}
                  </span>
                </div>
              );
            })}
          </div>

          <div className="border-border bg-surface mt-auto flex items-center justify-between rounded-lg border px-3 py-2.5">
            <span className="text-muted-foreground type-caption flex items-center gap-1.5">
              <Monitor className="size-3.5" />
              <span>Responsive 375px + 1440px</span>
            </span>
            <span className="text-success type-caption">Verified</span>
          </div>
        </div>
      </div>
    </figure>
  );
}
