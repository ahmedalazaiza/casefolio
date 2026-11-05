import {
  AlertCircle,
  ArrowLeft,
  CloudCheck,
  Redo2,
  RefreshCw,
  Undo2,
  Upload,
} from "lucide-react";

const TOKEN_SWATCHES = [
  {
    label: "Primary",
    tokenCode: "token.gold",
    swatchClassName: "bg-[var(--tmpl-primary)]",
  },
  {
    label: "Secondary",
    tokenCode: "token.indigo",
    swatchClassName: "bg-primary",
  },
  {
    label: "Background",
    tokenCode: "token.obsidian",
    swatchClassName: "bg-[var(--tmpl-bg)]",
  },
  {
    label: "Text",
    tokenCode: "token.ivory",
    swatchClassName: "bg-[var(--tmpl-text)] border border-border",
  },
] as const;

const SLOT_ROWS = [
  {
    name: "Home",
    spec: "Phone · 9:19.5",
    statusLabel: "Filled",
    thumbClass: "bg-gradient-to-b from-[var(--tmpl-primary)]/90 to-[var(--tmpl-primary)]/35",
    badgeClass: "bg-success-soft text-foreground",
    dotClass: "bg-success",
  },
  {
    name: "Plan",
    spec: "Phone · 9:19.5",
    statusLabel: "Filled",
    thumbClass: "bg-gradient-to-b from-primary/90 to-primary/40",
    badgeClass: "bg-success-soft text-foreground",
    dotClass: "bg-success",
  },
  {
    name: "Insights",
    spec: "Phone · 9:19.5",
    statusLabel: "64%",
    thumbClass: "bg-sunken border border-border",
    badgeClass: "bg-accent text-accent-foreground",
    dotClass: "bg-accent-foreground",
  },
  {
    name: "Onboarding",
    spec: "Phone · 9:19.5",
    statusLabel: "Empty",
    thumbClass: "bg-sunken border border-border",
    badgeClass: "bg-warning-soft text-foreground",
    dotClass: "bg-warning",
  },
  {
    name: "Settings",
    spec: "Phone · 9:19.5",
    statusLabel: "Failed",
    thumbClass: "bg-destructive-soft border border-destructive/20",
    badgeClass: "bg-destructive-soft text-destructive",
    dotClass: "bg-destructive",
  },
] as const;

export function LandingHeroVisual() {
  return (
    <figure
      aria-label="Casefolio editor preview showing customizable tokens, live Orbit case study canvas, and screenshot slot validation"
      className="border-border bg-card shadow-overlay mx-auto w-full max-w-6xl overflow-hidden rounded-xl border text-left"
    >
      {/* Editor top bar (Figma 27:6759) */}
      <div
        aria-hidden="true"
        className="border-border bg-card flex h-14 items-center justify-between gap-3 border-b px-3 sm:px-5"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span className="border-border bg-elevated text-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md border">
            <ArrowLeft className="size-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-foreground type-body-s-strong truncate">
              Mosaed — Smart debt management
            </p>
            <p className="text-muted-foreground type-caption flex items-center gap-1">
              <CloudCheck className="text-success size-3 shrink-0" />
              <span>Saved · just now</span>
            </p>
          </div>
        </div>

        <div className="bg-sunken hidden items-center rounded-full p-1 md:inline-flex">
          <span className="bg-elevated text-foreground type-caption rounded-full px-3 py-1 shadow-xs">
            Desktop
          </span>
          <span className="text-muted-foreground type-caption rounded-full px-3 py-1">
            Mobile
          </span>
        </div>

        <div className="flex items-center gap-2">
          <span className="border-border bg-elevated text-muted-foreground hidden size-7.5 items-center justify-center rounded-md border sm:inline-flex">
            <Undo2 className="size-3.5" />
          </span>
          <span className="border-border bg-elevated text-muted-foreground hidden size-7.5 items-center justify-center rounded-md border sm:inline-flex">
            <Redo2 className="size-3.5" />
          </span>
          <span className="border-border bg-elevated text-foreground type-caption hidden rounded-full border px-3 py-1.5 sm:inline-flex">
            Preview
          </span>
          <span className="bg-primary text-primary-foreground type-caption inline-flex rounded-full px-3.5 py-1.5">
            Publish
          </span>
        </div>
      </div>

      {/* Editor 3-column workspace (Figma 27:6785) */}
      <div aria-hidden="true" className="grid grid-cols-1 lg:grid-cols-12">
        {/* Left: Customize panel (Figma 27:6786) */}
        <div className="border-border bg-card hidden flex-col gap-5 border-r p-5 lg:col-span-3 lg:flex">
          <div className="bg-sunken flex items-center rounded-full p-1">
            <span className="bg-elevated text-foreground type-caption flex-1 rounded-full py-1 text-center shadow-xs">
              Style
            </span>
            <span className="text-muted-foreground type-caption flex-1 rounded-full py-1 text-center">
              Content
            </span>
            <span className="text-muted-foreground type-caption flex-1 rounded-full py-1 text-center">
              Sections
            </span>
          </div>

          <div className="flex flex-col gap-2">
            <span className="text-muted-foreground type-overline">
              Colors · Template tokens
            </span>
            <div className="flex flex-col gap-2">
              {TOKEN_SWATCHES.map((token) => (
                <div
                  key={token.label}
                  className="border-border bg-surface flex items-center justify-between rounded-md border px-2.5 py-2"
                >
                  <span className="flex items-center gap-2">
                    <span className={`size-4 rounded-xs ${token.swatchClassName}`} />
                    <span className="text-foreground type-caption">{token.label}</span>
                  </span>
                  <span className="text-muted-foreground font-mono type-caption">
                    {token.tokenCode}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="border-border flex flex-col gap-2.5 border-t pt-4">
            <span className="text-muted-foreground type-overline">Fonts</span>
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-caption">Heading</span>
              <div className="border-border bg-elevated text-foreground type-body-s rounded-md border px-3 py-1.5">
                Instrument Serif
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-caption">Body</span>
              <div className="border-border bg-elevated text-foreground type-body-s rounded-md border px-3 py-1.5">
                Editorial Sans
              </div>
              <span className="text-muted-foreground type-caption">
                Curated, licensed font pairs
              </span>
            </div>
          </div>

          <div className="border-border flex flex-col gap-2 border-t pt-4">
            <span className="text-muted-foreground type-overline">Text</span>
            <span className="text-foreground type-caption">Hero title</span>
            <div className="border-primary bg-elevated text-foreground ring-ring/20 type-body-s rounded-md border px-3 py-1.5 ring-2">
              Debt, finally under control
            </div>
          </div>

          <p className="text-muted-foreground type-caption mt-auto pt-1">
            Reset to template defaults
          </p>
        </div>

        {/* Center: Live preview canvas (Figma 27:6806) */}
        <div className="bg-sunken flex flex-col gap-4 p-3 sm:p-6 lg:col-span-6">
          <div className="flex flex-wrap items-center justify-center gap-2 text-center">
            <span className="bg-elevated text-foreground border-border type-caption rounded-full border px-2.5 py-0.5">
              Orbit · v1.0
            </span>
            <span className="text-muted-foreground type-caption">
              Live preview · same renderer as publish &amp; export
            </span>
          </div>

          <div className="bg-[var(--tmpl-bg)] text-[var(--tmpl-text)] shadow-card flex flex-1 flex-col justify-between gap-6 rounded-xl p-5 sm:p-7">
            <div className="flex flex-col gap-5">
              <div className="flex items-center justify-between gap-3">
                <span className="type-body-s-strong">Mosaed</span>
                <span className="text-[var(--tmpl-primary)] type-overline">
                  Case study · 2026
                </span>
              </div>

              <div className="flex flex-col gap-2.5">
                <p className="type-display-m max-w-md">Debt, finally under control</p>
                <p className="text-[var(--tmpl-muted)] type-body-s max-w-md">
                  A calm money app that helps people track, plan and pay off personal
                  debts.
                </p>
              </div>

              <div className="grid max-w-xs grid-cols-3 gap-4 pt-1">
                <div>
                  <p className="text-[var(--tmpl-muted)] type-overline">Role</p>
                  <p className="type-caption mt-0.5">Lead designer</p>
                </div>
                <div>
                  <p className="text-[var(--tmpl-muted)] type-overline">Client</p>
                  <p className="type-caption mt-0.5">Mosaed</p>
                </div>
                <div>
                  <p className="text-[var(--tmpl-muted)] type-overline">Year</p>
                  <p className="type-caption mt-0.5">2026</p>
                </div>
              </div>
            </div>

            {/* 3 phone screen slots (Figma 27:6828) */}
            <div className="grid grid-cols-3 gap-2.5 pt-2 sm:gap-3.5">
              <div className="relative flex h-44 flex-col justify-end rounded-lg bg-gradient-to-b from-[var(--tmpl-primary)]/90 to-[var(--tmpl-primary)]/40 p-2.5 sm:h-64">
                <span className="bg-[var(--tmpl-bg)] text-[var(--tmpl-text)] type-caption inline-flex items-center gap-1 self-end rounded-full px-2.5 py-0.5">
                  <RefreshCw className="size-2.5" />
                  Replace
                </span>
              </div>

              <div className="from-primary/90 to-primary/45 relative flex h-44 flex-col justify-end rounded-lg bg-gradient-to-b p-2.5 sm:h-64">
                <span className="bg-[var(--tmpl-bg)] text-[var(--tmpl-text)] type-caption inline-flex items-center gap-1 self-end rounded-full px-2.5 py-0.5">
                  <RefreshCw className="size-2.5" />
                  Replace
                </span>
              </div>

              <div className="border-primary bg-card text-card-foreground flex h-44 flex-col items-center justify-center gap-2 rounded-lg border-2 p-2.5 text-center sm:h-64">
                <span className="text-foreground type-caption">Uploading… 64%</span>
                <span className="bg-sunken h-1.5 w-full overflow-hidden rounded-full">
                  <span className="bg-primary block h-full w-2/3 rounded-full" />
                </span>
                <span className="text-muted-foreground type-caption hidden truncate sm:block">
                  home-screen@2x.png
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Screenshots panel (Figma 27:6832) */}
        <div className="border-border bg-card hidden flex-col gap-3.5 border-l p-5 lg:col-span-3 lg:flex">
          <div className="flex items-center justify-between gap-2">
            <span className="text-foreground type-body-s-strong">Screenshots</span>
            <span className="text-muted-foreground type-caption">3 / 6 slots</span>
          </div>

          <div className="border-border-strong bg-surface flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed p-4 text-center">
            <span className="bg-accent text-accent-foreground inline-flex size-8 items-center justify-center rounded-full">
              <Upload className="size-3.5" />
            </span>
            <span className="text-foreground type-caption">Drop screenshots</span>
            <span className="text-muted-foreground type-caption">
              PNG / JPG · up to 15 MB
            </span>
          </div>

          <div className="bg-warning-soft text-foreground flex items-start gap-2 rounded-lg p-2.5">
            <AlertCircle className="text-warning mt-0.5 size-3.5 shrink-0" />
            <span className="type-caption">
              1 required slot is empty: “Onboarding”
            </span>
          </div>

          <span className="text-muted-foreground type-overline pt-1">Slots</span>

          <div className="flex flex-col gap-2">
            {SLOT_ROWS.map((slot) => (
              <div
                key={slot.name}
                className="border-border bg-surface flex items-center justify-between gap-2 rounded-lg border p-2"
              >
                <div className="flex min-w-0 items-center gap-2">
                  <span className={`h-8 w-6 shrink-0 rounded-xs ${slot.thumbClass}`} />
                  <div className="min-w-0">
                    <p className="text-foreground type-caption truncate">{slot.name}</p>
                    <p className="text-muted-foreground type-caption truncate">
                      {slot.spec}
                    </p>
                  </div>
                </div>
                <span
                  className={`type-caption inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 ${slot.badgeClass}`}
                >
                  <span className={`size-1.5 rounded-full ${slot.dotClass}`} />
                  {slot.statusLabel}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

