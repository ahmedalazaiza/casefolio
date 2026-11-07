"use client";

import { AlertTriangle, Check, Palette, RotateCcw, ShieldCheck, Type } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { evaluateThemeContrastIssues, normalizeHexColor } from "@/lib/template/contrast";
import {
  CURATED_COLOR_PRESETS,
  CURATED_FONT_CATALOG,
  CURATED_FONT_PAIRS,
  ensureThemeFontsLoaded,
  formatColorTokenLabel,
  resolveFontDefinition,
} from "@/lib/template/curated-themes";
import type { TemplateTheme } from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export interface ThemePanelProps {
  theme: TemplateTheme;
  onChangeTheme: (nextTheme: TemplateTheme) => void;
  onResetToDefaults: () => void;
}

export function ThemePanel({ theme, onChangeTheme, onResetToDefaults }: ThemePanelProps) {
  const [hexDrafts, setHexDrafts] = useState<Record<string, string>>({});

  useEffect(() => {
    ensureThemeFontsLoaded(theme);
  }, [theme]);

  const contrastIssues = useMemo(
    () => evaluateThemeContrastIssues(theme.colors),
    [theme.colors],
  );

  const availableFontFamilies = useMemo(() => {
    const names = new Set<string>(CURATED_FONT_CATALOG.map((item) => item.family));
    if (theme.fonts.heading?.family) names.add(theme.fonts.heading.family);
    if (theme.fonts.body?.family) names.add(theme.fonts.body.family);
    return Array.from(names);
  }, [theme.fonts.body?.family, theme.fonts.heading?.family]);

  const activeFontPairId = useMemo(() => {
    const match = CURATED_FONT_PAIRS.find(
      (pair) =>
        pair.headingFamily === theme.fonts.heading.family &&
        pair.bodyFamily === theme.fonts.body.family,
    );
    return match?.id ?? "custom";
  }, [theme.fonts.body.family, theme.fonts.heading.family]);

  const handleUpdateColor = (token: string, nextHex: string) => {
    const normalized = normalizeHexColor(nextHex);
    if (!normalized) return;

    onChangeTheme({
      ...theme,
      colors: {
        ...theme.colors,
        [token]: normalized,
      },
    });
  };

  const handleApplyPalettePreset = (presetColors: Record<string, string>) => {
    const mergedColors: Record<string, string> = { ...theme.colors };
    for (const [token, value] of Object.entries(presetColors)) {
      if (token in mergedColors || token === "secondary" || token === "textMuted" || token === "accent") {
        mergedColors[token] = value;
      }
    }
    setHexDrafts({});
    onChangeTheme({
      ...theme,
      colors: mergedColors,
    });
  };

  const handleUpdateFontFamily = (role: "heading" | "body", family: string) => {
    onChangeTheme({
      ...theme,
      fonts: {
        ...theme.fonts,
        [role]: resolveFontDefinition(family),
      },
    });
  };

  const handleApplyFontPair = (pairId: string) => {
    const pair = CURATED_FONT_PAIRS.find((item) => item.id === pairId);
    if (!pair) return;

    onChangeTheme({
      ...theme,
      fonts: {
        ...theme.fonts,
        heading: resolveFontDefinition(pair.headingFamily),
        body: resolveFontDefinition(pair.bodyFamily),
      },
    });
  };

  return (
    <div data-testid="editor-style-panel" className="flex flex-col gap-4">
      {/* WCAG 2.1 Contrast Warning (< 4.5:1) */}
      {contrastIssues.length > 0 && (
        <div
          role="alert"
          data-testid="theme-contrast-warning"
          className="border-warning/40 bg-warning-soft text-foreground flex items-start gap-2.5 rounded-2xl border p-3.5"
        >
          <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
          <div className="flex flex-col gap-1">
            <span className="type-body-s-strong">Low text contrast (&lt; 4.5:1)</span>
            {contrastIssues.map((issue) => (
              <span key={issue.id} className="text-muted-foreground type-caption">
                {formatColorTokenLabel(issue.foregroundToken)} on{" "}
                {formatColorTokenLabel(issue.backgroundToken)} is{" "}
                <strong className="text-foreground font-mono">{issue.ratio}:1</strong> (minimum{" "}
                {issue.minimumRatio}:1 recommended).
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Card 1: Curated Palette Presets */}
      <section className="border-border/70 bg-elevated flex flex-col gap-3 rounded-2xl border p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-accent text-accent-foreground inline-flex size-6 items-center justify-center rounded-full">
              <Palette className="size-3.5" />
            </span>
            <span className="text-foreground type-body-s-strong">Palette presets</span>
          </div>
          <span className="text-tertiary type-caption">{CURATED_COLOR_PRESETS.length} themes</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {CURATED_COLOR_PRESETS.map((preset) => {
            const isActive =
              theme.colors.primary?.toUpperCase() === preset.colors.primary?.toUpperCase() &&
              theme.colors.background?.toUpperCase() === preset.colors.background?.toUpperCase();

            return (
              <button
                key={preset.id}
                type="button"
                data-testid={`palette-preset-${preset.id}`}
                onClick={() => handleApplyPalettePreset(preset.colors)}
                className={cn(
                  "group relative flex flex-col items-start gap-2 rounded-xl border p-2.5 text-left transition-all",
                  isActive
                    ? "border-primary bg-accent/55 shadow-2xs"
                    : "border-border/70 bg-surface/60 hover:border-border-strong hover:bg-surface",
                )}
              >
                <div className="flex w-full items-center justify-between gap-1">
                  <div className="flex items-center -space-x-1">
                    {["primary", "secondary", "background", "text"].map((tokenKey) => (
                      <span
                        key={tokenKey}
                        style={{ backgroundColor: preset.colors[tokenKey] }}
                        className="border-elevated inline-block size-4.5 rounded-full border-2 shadow-2xs"
                      />
                    ))}
                  </div>
                  {isActive && (
                    <span className="bg-primary text-primary-foreground inline-flex size-4 items-center justify-center rounded-full">
                      <Check className="size-2.5" />
                    </span>
                  )}
                </div>
                <span className="text-foreground type-caption font-medium">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </section>

      {/* Card 2: Individual Template Color Tokens */}
      <section className="border-border/70 bg-elevated flex flex-col gap-3 rounded-2xl border p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <span className="text-foreground type-body-s-strong">Color tokens</span>
          {contrastIssues.length === 0 ? (
            <Badge tone="published" withDot={false} className="gap-1">
              <ShieldCheck className="size-3" />
              <span>WCAG AA</span>
            </Badge>
          ) : (
            <Badge tone="draft" withDot={false}>
              Check contrast
            </Badge>
          )}
        </div>

        <div className="flex flex-col gap-1.5">
          {Object.entries(theme.colors).map(([tokenName, colorValue]) => {
            const label = formatColorTokenLabel(tokenName);
            const draftValue = hexDrafts[tokenName] ?? colorValue;

            return (
              <div
                key={tokenName}
                className="border-border/60 bg-surface/60 hover:border-border-strong flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2 transition-colors"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <label className="border-border relative inline-flex size-7 shrink-0 cursor-pointer overflow-hidden rounded-full border shadow-2xs">
                    <span
                      aria-hidden="true"
                      style={{ backgroundColor: colorValue }}
                      className="block size-full"
                    />
                    <input
                      type="color"
                      aria-label={`${label} color picker`}
                      value={colorValue}
                      onChange={(e) => {
                        setHexDrafts((prev) => {
                          const next = { ...prev };
                          delete next[tokenName];
                          return next;
                        });
                        handleUpdateColor(tokenName, e.target.value);
                      }}
                      className="absolute inset-0 size-full cursor-pointer opacity-0"
                    />
                  </label>
                  <span className="text-foreground type-body-s-strong truncate">{label}</span>
                </div>

                <input
                  type="text"
                  aria-label={`${label} hex code`}
                  value={draftValue}
                  maxLength={7}
                  onChange={(e) => {
                    const raw = e.target.value;
                    setHexDrafts((prev) => ({ ...prev, [tokenName]: raw }));
                    const normalized = normalizeHexColor(raw);
                    if (normalized) {
                      handleUpdateColor(tokenName, normalized);
                    }
                  }}
                  onBlur={() => {
                    setHexDrafts((prev) => {
                      const next = { ...prev };
                      delete next[tokenName];
                      return next;
                    });
                  }}
                  className="text-muted-foreground focus:text-foreground focus:border-ring bg-elevated/80 w-21 rounded-full border border-transparent px-2.5 py-1 text-right font-mono text-xs uppercase outline-none"
                />
              </div>
            );
          })}
        </div>
      </section>

      {/* Card 3: Curated Licensed Fonts */}
      <section className="border-border/70 bg-elevated flex flex-col gap-3.5 rounded-2xl border p-4 shadow-2xs">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="bg-accent text-accent-foreground inline-flex size-6 items-center justify-center rounded-full">
              <Type className="size-3.5" />
            </span>
            <span className="text-foreground type-body-s-strong">Typography</span>
          </div>
          <span className="text-tertiary type-caption">Open-licensed</span>
        </div>

        {/* Live specimen preview */}
        <div className="border-border/60 bg-surface/70 flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5">
          <div className="flex min-w-0 flex-col gap-0.5">
            <span
              style={{ fontFamily: `"${theme.fonts.heading.family}", sans-serif` }}
              className="text-foreground truncate text-base font-medium tracking-tight"
            >
              {theme.fonts.heading.family}
            </span>
            <span
              style={{ fontFamily: `"${theme.fonts.body.family}", sans-serif` }}
              className="text-muted-foreground type-caption truncate"
            >
              Body in {theme.fonts.body.family}
            </span>
          </div>
          <span
            aria-hidden="true"
            style={{ fontFamily: `"${theme.fonts.heading.family}", sans-serif` }}
            className="text-primary shrink-0 text-2xl font-medium tracking-tight"
          >
            Aa
          </span>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="theme-font-pair" className="text-muted-foreground type-caption">
            Curated pairing
          </Label>
          <select
            id="theme-font-pair"
            aria-label="Font pair"
            value={activeFontPairId}
            onChange={(e) => handleApplyFontPair(e.target.value)}
            className="border-border bg-surface/60 text-foreground type-body-s focus-visible:ring-ring/40 h-10 w-full rounded-xl border px-3 outline-none focus-visible:ring-2"
          >
            {CURATED_FONT_PAIRS.map((pair) => (
              <option key={pair.id} value={pair.id}>
                {pair.label}
              </option>
            ))}
            {activeFontPairId === "custom" && <option value="custom">Custom pair</option>}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-2.5">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="theme-heading-font" className="text-muted-foreground type-caption">
              Heading
            </Label>
            <select
              id="theme-heading-font"
              aria-label="Heading font"
              value={theme.fonts.heading.family}
              onChange={(e) => handleUpdateFontFamily("heading", e.target.value)}
              className="border-border bg-surface/60 text-foreground type-body-s-strong focus-visible:ring-ring/40 h-9.5 w-full rounded-xl border px-2.5 outline-none focus-visible:ring-2"
            >
              {availableFontFamilies.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="theme-body-font" className="text-muted-foreground type-caption">
              Body
            </Label>
            <select
              id="theme-body-font"
              aria-label="Body font"
              value={theme.fonts.body.family}
              onChange={(e) => handleUpdateFontFamily("body", e.target.value)}
              className="border-border bg-surface/60 text-foreground type-body-s-strong focus-visible:ring-ring/40 h-9.5 w-full rounded-xl border px-2.5 outline-none focus-visible:ring-2"
            >
              {availableFontFamilies.map((family) => (
                <option key={family} value={family}>
                  {family}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <div className="pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="w-full justify-center"
          onClick={() => {
            setHexDrafts({});
            onResetToDefaults();
          }}
        >
          <RotateCcw className="size-3.5" />
          Reset to template defaults
        </Button>
      </div>
    </div>
  );
}
