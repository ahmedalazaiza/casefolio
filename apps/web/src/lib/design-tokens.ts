export interface ColorTokenSpec {
  figmaName: string;
  cssVar: `--${string}`;
  role: string;
}

export interface TypeScaleSpec {
  name: string;
  className: string;
  cssSizeVar: `--${string}`;
  sample: string;
}

export interface RadiusTokenSpec {
  figmaName: string;
  cssVar: `--${string}`;
}

export const COLOR_TOKENS: readonly ColorTokenSpec[] = [
  { figmaName: "bg/canvas", cssVar: "--bg-canvas", role: "Page canvas" },
  { figmaName: "bg/surface", cssVar: "--bg-surface", role: "Subtle surface & shells" },
  { figmaName: "bg/elevated", cssVar: "--bg-elevated", role: "Cards, modals, active pills" },
  { figmaName: "bg/sunken", cssVar: "--bg-sunken", role: "Segmented tracks & muted wells" },
  { figmaName: "bg/inverse", cssVar: "--bg-inverse", role: "Inverse cards & buttons" },
  { figmaName: "text/primary", cssVar: "--text-primary", role: "Primary headings & copy" },
  { figmaName: "text/secondary", cssVar: "--text-secondary", role: "Supporting body text" },
  { figmaName: "text/tertiary", cssVar: "--text-tertiary", role: "Placeholders & metadata" },
  { figmaName: "text/inverse", cssVar: "--text-inverse", role: "Text on inverse fills" },
  { figmaName: "border/default", cssVar: "--border-default", role: "Hairlines & card borders" },
  { figmaName: "border/strong", cssVar: "--border-strong", role: "Emphasized outlines" },
  { figmaName: "accent/primary", cssVar: "--accent-primary", role: "Brand indigo action" },
  { figmaName: "accent/on-primary", cssVar: "--accent-on-primary", role: "Label on brand action" },
  { figmaName: "accent/soft", cssVar: "--accent-soft", role: "Accent tint & badge fill" },
  { figmaName: "accent/secondary", cssVar: "--accent-secondary", role: "Neutral strong accent" },
  {
    figmaName: "accent/secondary-soft",
    cssVar: "--accent-secondary-soft",
    role: "Neutral chip & Pro pill fill",
  },
  { figmaName: "status/success", cssVar: "--status-success", role: "Published & success state" },
  {
    figmaName: "status/success-soft",
    cssVar: "--status-success-soft",
    role: "Published badge tint",
  },
  { figmaName: "status/warning", cssVar: "--status-warning", role: "Draft & warning state" },
  { figmaName: "status/warning-soft", cssVar: "--status-warning-soft", role: "Draft badge tint" },
  { figmaName: "status/danger", cssVar: "--status-danger", role: "Error & destructive state" },
  {
    figmaName: "status/danger-soft",
    cssVar: "--status-danger-soft",
    role: "Danger button & badge tint",
  },
] as const;

export const TYPE_SCALE_TOKENS: readonly TypeScaleSpec[] = [
  {
    name: "Display/XL",
    className: "type-display-xl",
    cssSizeVar: "--size-display-xl",
    sample: "Case studies, beautifully",
  },
  {
    name: "Display/L",
    className: "type-display-l",
    cssSizeVar: "--size-display-l",
    sample: "Your case studies",
  },
  {
    name: "Display/M",
    className: "type-display-m",
    cssSizeVar: "--size-display-m",
    sample: "Name your case study",
  },
  {
    name: "Heading/L",
    className: "type-heading-l",
    cssSizeVar: "--size-heading-l",
    sample: "Heading large",
  },
  {
    name: "Heading/M",
    className: "type-heading-m",
    cssSizeVar: "--size-heading-m",
    sample: "Heading medium",
  },
  {
    name: "Heading/S",
    className: "type-heading-s",
    cssSizeVar: "--size-heading-s",
    sample: "Heading small",
  },
  {
    name: "Body/L",
    className: "type-body-l",
    cssSizeVar: "--size-body-l",
    sample: "Body large — for intros and descriptions.",
  },
  {
    name: "Body/M",
    className: "type-body-m",
    cssSizeVar: "--size-body-m",
    sample: "Body medium — default UI text.",
  },
  {
    name: "Body/S",
    className: "type-body-s",
    cssSizeVar: "--size-body-s",
    sample: "Body small — meta and helper text.",
  },
  {
    name: "Caption",
    className: "type-caption",
    cssSizeVar: "--size-caption",
    sample: "Caption — labels and badges",
  },
  {
    name: "Overline",
    className: "type-overline",
    cssSizeVar: "--size-overline",
    sample: "Overline · section label",
  },
] as const;

export const RADIUS_TOKENS: readonly RadiusTokenSpec[] = [
  { figmaName: "radius/xs", cssVar: "--radius-xs" },
  { figmaName: "radius/sm", cssVar: "--radius-sm" },
  { figmaName: "radius/md", cssVar: "--radius-md" },
  { figmaName: "radius/lg", cssVar: "--radius-lg" },
  { figmaName: "radius/xl", cssVar: "--radius-xl" },
  { figmaName: "radius/full", cssVar: "--radius-full" },
] as const;

