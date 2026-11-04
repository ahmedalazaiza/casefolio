export interface RgbChannels {
  r: number;
  g: number;
  b: number;
}

export interface ThemeContrastIssue {
  id: string;
  foregroundToken: string;
  backgroundToken: string;
  foregroundHex: string;
  backgroundHex: string;
  ratio: number;
  minimumRatio: number;
}

export const WCAG_AA_NORMAL_TEXT_RATIO = 4.5;

const HEX_SHORT_REGEX = /^#([0-9a-fA-F]{3})$/;
const HEX_FULL_REGEX = /^#([0-9a-fA-F]{6})$/;

export function normalizeHexColor(input: string): string | null {
  const trimmed = input.trim();
  const withHash = trimmed.startsWith("#") ? trimmed : `#${trimmed}`;

  const fullMatch = HEX_FULL_REGEX.exec(withHash);
  if (fullMatch?.[1]) {
    return `#${fullMatch[1].toUpperCase()}`;
  }

  const shortMatch = HEX_SHORT_REGEX.exec(withHash);
  if (shortMatch?.[1]) {
    const [r, g, b] = shortMatch[1].split("");
    return `#${r}${r}${g}${g}${b}${b}`.toUpperCase();
  }

  return null;
}

export function parseHexToRgb(hex: string): RgbChannels | null {
  const normalized = normalizeHexColor(hex);
  if (!normalized) return null;

  const r = Number.parseInt(normalized.slice(1, 3), 16);
  const g = Number.parseInt(normalized.slice(3, 5), 16);
  const b = Number.parseInt(normalized.slice(5, 7), 16);

  if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
    return null;
  }

  return { r, g, b };
}

function channelToLinear(channel8Bit: number): number {
  const srgb = channel8Bit / 255;
  return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
}

/**
 * Computes WCAG 2.1 relative luminance in `[0, 1]`.
 */
export function getRelativeLuminance(hex: string): number | null {
  const rgb = parseHexToRgb(hex);
  if (!rgb) return null;
  const r = channelToLinear(rgb.r);
  const g = channelToLinear(rgb.g);
  const b = channelToLinear(rgb.b);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/**
 * Computes WCAG 2.1 contrast ratio `(L_lighter + 0.05) / (L_darker + 0.05)`.
 */
export function calculateContrastRatio(hexA: string, hexB: string): number | null {
  const lumA = getRelativeLuminance(hexA);
  const lumB = getRelativeLuminance(hexB);
  if (lumA === null || lumB === null) {
    return null;
  }
  const lighter = Math.max(lumA, lumB);
  const darker = Math.min(lumA, lumB);
  return Math.round(((lighter + 0.05) / (darker + 0.05)) * 100) / 100;
}

/**
 * Evaluates key foreground/background token pairs against WCAG AA 4.5:1 normal text contrast.
 */
export function evaluateThemeContrastIssues(
  colors: Record<string, string>,
  minimumRatio: number = WCAG_AA_NORMAL_TEXT_RATIO,
): ThemeContrastIssue[] {
  const pairs: Array<{ fg: string; bg: string }> = [
    { fg: "text", bg: "background" },
    { fg: "text", bg: "surface" },
  ];

  const issues: ThemeContrastIssue[] = [];

  for (const pair of pairs) {
    const fgHex = colors[pair.fg];
    const bgHex = colors[pair.bg];
    if (!fgHex || !bgHex) continue;

    const ratio = calculateContrastRatio(fgHex, bgHex);
    if (ratio !== null && ratio < minimumRatio) {
      issues.push({
        id: `${pair.fg}-on-${pair.bg}`,
        foregroundToken: pair.fg,
        backgroundToken: pair.bg,
        foregroundHex: fgHex,
        backgroundHex: bgHex,
        ratio,
        minimumRatio,
      });
    }
  }

  return issues;
}
