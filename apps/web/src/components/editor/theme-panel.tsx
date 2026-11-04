"use client";

import { AlertTriangle, RotateCcw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
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
    <div data-testid="editor-style-panel" className="flex flex-col gap-6">
      {/* WCAG 2.1 Contrast Warning (< 4.5:1) */}
      {contrastIssues.length > 0 && (
        <div
          role="alert"
          data-testid="theme-contrast-warning"
          className="border-warning/40 bg-warning-soft text-foreground flex items-start gap-2.5 rounded-xl border p-3.5"
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

      {/* Curated Palette Presets */}
      <div className="flex flex-col gap-2.5">
        <span className="text-tertiary type-overline">Palette presets</span>
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
                  "flex flex-col items-start gap-2 rounded-xl border p-2.5 text-left transition-colors",
                  isActive
                    ? "border-primary bg-accent/40"
                    : "border-border bg-card hover:border-border-strong",
                )}
              >
                <div className="flex items-center gap-1">
                  {["primary", "secondary", "background", "text"].map((tokenKey) => (
                    <span
                      key={tokenKey}
                      style={{ backgroundColor: preset.colors[tokenKey] }}
                      className="border-border inline-block size-4 rounded-full border"
                    />
                  ))}
                </div>
                <span className="text-foreground type-caption font-medium">{preset.name}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* Individual Template Color Tokens (matches Figma 2:4396) */}
      <div className="border-border flex flex-col gap-3 border-t pt-4">
        <span className="text-tertiary type-overline">Colors · Template tokens</span>
        <div className="flex flex-col gap-2">
          {Object.entries(theme.colors).map(([tokenName, colorValue]) => {
            const label = formatColorTokenLabel(tokenName);
            const draftValue = hexDrafts[tokenName] ?? colorValue;

            return (
              <div
                key={tokenName}
                className="border-border bg-card flex items-center justify-between gap-2.5 rounded-xl border px-3 py-2"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <label className="border-border relative inline-flex size-7 shrink-0 cursor-pointer overflow-hidden rounded-md border">
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
                  className="text-tertiary focus:text-foreground focus:border-ring w-20 rounded-md border border-transparent bg-transparent px-1.5 py-0.5 text-right font-mono text-xs uppercase outline-none"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Curated Licensed Fonts (matches Figma 2:4417) */}
      <div className="border-border flex flex-col gap-3 border-t pt-4">
        <span className="text-tertiary type-overline">Fonts</span>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="theme-font-pair">Font pair</Label>
          <select
            id="theme-font-pair"
            aria-label="Font pair"
            value={activeFontPairId}
            onChange={(e) => handleApplyFontPair(e.target.value)}
            className="border-input bg-card text-foreground type-body-s focus-visible:ring-ring/40 h-10 w-full rounded-lg border px-3 outline-none focus-visible:ring-2"
          >
            {CURATED_FONT_PAIRS.map((pair) => (
              <option key={pair.id} value={pair.id}>
                {pair.label}
              </option>
            ))}
            {activeFontPairId === "custom" && <option value="custom">Custom pair</option>}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="theme-heading-font">Heading</Label>
          <select
            id="theme-heading-font"
            aria-label="Heading font"
            value={theme.fonts.heading.family}
            onChange={(e) => handleUpdateFontFamily("heading", e.target.value)}
            className="border-input bg-card text-foreground type-body-s-strong focus-visible:ring-ring/40 h-10 w-full rounded-lg border px-3 outline-none focus-visible:ring-2"
          >
            {availableFontFamilies.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1.5">
          <Label htmlFor="theme-body-font">Body</Label>
          <select
            id="theme-body-font"
            aria-label="Body font"
            value={theme.fonts.body.family}
            onChange={(e) => handleUpdateFontFamily("body", e.target.value)}
            className="border-input bg-card text-foreground type-body-s-strong focus-visible:ring-ring/40 h-10 w-full rounded-lg border px-3 outline-none focus-visible:ring-2"
          >
            {availableFontFamilies.map((family) => (
              <option key={family} value={family}>
                {family}
              </option>
            ))}
          </select>
        </div>

        <span className="text-tertiary type-caption">Curated, open-licensed font catalog</span>
      </div>

      <div className="border-border border-t pt-3">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="w-fit"
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
