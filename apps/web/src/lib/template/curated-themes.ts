import type { TemplateTheme } from "@/lib/template/schema";

type TemplateFontDefinition = TemplateTheme["fonts"]["heading"];

export interface CuratedColorPalettePreset {
  id: string;
  name: string;
  colors: Record<string, string>;
}

export interface CuratedFontOption {
  family: string;
  category: "sans" | "serif" | "display";
  weights: number[];
  googleFamilyParam: string | null;
}

export interface CuratedFontPair {
  id: string;
  label: string;
  headingFamily: string;
  bodyFamily: string;
}

export const CURATED_COLOR_PRESETS: readonly CuratedColorPalettePreset[] = [
  {
    id: "indigo-studio",
    name: "Indigo Studio",
    colors: {
      primary: "#4F46E5",
      secondary: "#0EA5E9",
      background: "#FFFFFF",
      surface: "#F5F5F7",
      text: "#0B0B0F",
      textMuted: "#52525B",
      accent: "#EEF2FF",
    },
  },
  {
    id: "obsidian-gold",
    name: "Obsidian Gold",
    colors: {
      primary: "#E6C36A",
      secondary: "#6C5CE7",
      background: "#121110",
      surface: "#1C1A18",
      text: "#F5F0E6",
      textMuted: "#B8B0A2",
      accent: "#2A251D",
    },
  },
  {
    id: "emerald-slate",
    name: "Emerald Slate",
    colors: {
      primary: "#059669",
      secondary: "#0284C7",
      background: "#F8FAFC",
      surface: "#F1F5F9",
      text: "#0F172A",
      textMuted: "#475569",
      accent: "#ECFDF5",
    },
  },
  {
    id: "editorial-cream",
    name: "Editorial Cream",
    colors: {
      primary: "#9A3412",
      secondary: "#B45309",
      background: "#FAF7F2",
      surface: "#F2ECE1",
      text: "#1C1917",
      textMuted: "#57534E",
      accent: "#FFEDD5",
    },
  },
] as const;

export const CURATED_FONT_CATALOG: readonly CuratedFontOption[] = [
  {
    family: "Geist",
    category: "sans",
    weights: [400, 500, 600, 700],
    googleFamilyParam: null,
  },
  {
    family: "Instrument Serif",
    category: "serif",
    weights: [400],
    googleFamilyParam: "Instrument+Serif:ital@0;1",
  },
  {
    family: "Plus Jakarta Sans",
    category: "sans",
    weights: [400, 500, 600, 700],
    googleFamilyParam: "Plus+Jakarta+Sans:wght@400;500;600;700",
  },
  {
    family: "Inter",
    category: "sans",
    weights: [400, 500, 600, 700],
    googleFamilyParam: "Inter:wght@400;500;600;700",
  },
  {
    family: "DM Sans",
    category: "sans",
    weights: [400, 500, 600, 700],
    googleFamilyParam: "DM+Sans:wght@400;500;600;700",
  },
  {
    family: "Space Grotesk",
    category: "display",
    weights: [500, 600, 700],
    googleFamilyParam: "Space+Grotesk:wght@500;600;700",
  },
  {
    family: "Playfair Display",
    category: "serif",
    weights: [500, 600, 700],
    googleFamilyParam: "Playfair+Display:wght@500;600;700",
  },
  {
    family: "Fraunces",
    category: "serif",
    weights: [500, 600, 700],
    googleFamilyParam: "Fraunces:wght@500;600;700",
  },
  {
    family: "Lora",
    category: "serif",
    weights: [400, 500, 600],
    googleFamilyParam: "Lora:wght@400;500;600",
  },
  {
    family: "Sora",
    category: "display",
    weights: [400, 500, 600, 700],
    googleFamilyParam: "Sora:wght@400;500;600;700",
  },
  {
    family: "Manrope",
    category: "sans",
    weights: [400, 500, 600, 700],
    googleFamilyParam: "Manrope:wght@400;500;600;700",
  },
] as const;

export const CURATED_FONT_PAIRS: readonly CuratedFontPair[] = [
  {
    id: "geist-modern",
    label: "Geist · Modern UI",
    headingFamily: "Geist",
    bodyFamily: "Geist",
  },
  {
    id: "instrument-editorial",
    label: "Instrument Serif + Geist",
    headingFamily: "Instrument Serif",
    bodyFamily: "Geist",
  },
  {
    id: "space-dm",
    label: "Space Grotesk + DM Sans",
    headingFamily: "Space Grotesk",
    bodyFamily: "DM Sans",
  },
  {
    id: "playfair-inter",
    label: "Playfair Display + Inter",
    headingFamily: "Playfair Display",
    bodyFamily: "Inter",
  },
  {
    id: "fraunces-jakarta",
    label: "Fraunces + Plus Jakarta Sans",
    headingFamily: "Fraunces",
    bodyFamily: "Plus Jakarta Sans",
  },
] as const;

const TOKEN_DISPLAY_LABELS: Record<string, string> = {
  primary: "Primary",
  secondary: "Secondary",
  background: "Background",
  surface: "Surface",
  text: "Text",
  textMuted: "Text muted",
  accent: "Accent",
};

export function formatColorTokenLabel(token: string): string {
  return (
    TOKEN_DISPLAY_LABELS[token] ??
    token
      .replace(/([a-z])([A-Z])/g, "$1 $2")
      .replace(/^./, (char) => char.toUpperCase())
  );
}

export function resolveFontDefinition(family: string): TemplateFontDefinition {
  const match = CURATED_FONT_CATALOG.find((item) => item.family === family);
  return {
    family,
    weights: match ? [...match.weights] : [400, 600, 700],
  };
}

export function buildGoogleFontsStylesheetHref(theme?: TemplateTheme): string | null {
  if (!theme) return null;
  const families = new Set<string>();
  if (theme.fonts.heading?.family) families.add(theme.fonts.heading.family);
  if (theme.fonts.body?.family) families.add(theme.fonts.body.family);

  const params: string[] = [];
  for (const family of families) {
    const entry = CURATED_FONT_CATALOG.find((item) => item.family === family);
    if (entry?.googleFamilyParam) {
      params.push(`family=${entry.googleFamilyParam}`);
    }
  }

  if (params.length === 0) return null;
  return `https://fonts.googleapis.com/css2?${params.join("&")}&display=swap`;
}

export function ensureThemeFontsLoaded(theme?: TemplateTheme): void {
  if (typeof document === "undefined") return;
  const href = buildGoogleFontsStylesheetHref(theme);
  if (!href) return;

  const existing = document.head.querySelector<HTMLLinkElement>(
    'link[data-casefolio-theme-fonts="true"]',
  );
  if (existing) {
    if (existing.href !== href) {
      existing.href = href;
    }
    return;
  }

  const link = document.createElement("link");
  link.rel = "stylesheet";
  link.href = href;
  link.setAttribute("data-casefolio-theme-fonts", "true");
  document.head.appendChild(link);
}
