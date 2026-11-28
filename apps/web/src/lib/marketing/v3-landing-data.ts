export interface V3EditorTokenItem {
  label: string;
  hex: string;
  swatchClass: string;
}

export interface V3EditorSlotItem {
  name: string;
  meta: string;
  badge: string;
  status: "filled-gold" | "filled-indigo" | "uploading" | "empty" | "failed";
}

export type V3ShowcaseTabId = "slots" | "tokens" | "fonts" | "sections";

export interface V3ShowcaseTabItem {
  id: V3ShowcaseTabId;
  label: string;
  caption: string;
}

export const V3_DEFAULT_TOKENS: readonly V3EditorTokenItem[] = [
  {
    label: "Accent",
    hex: "#E7FF68",
    swatchClass: "bg-[var(--cf-lp-lime)]",
  },
  {
    label: "Cobalt",
    hex: "#283FD6",
    swatchClass: "bg-[var(--cf-lp-cobalt)]",
  },
  {
    label: "Background",
    hex: "#20211D",
    swatchClass: "bg-[var(--cf-lp-dark)]",
  },
  {
    label: "Paper",
    hex: "#F4F1EA",
    swatchClass: "bg-[var(--cf-lp-cream)] border border-[var(--cf-mock-chrome-border)]",
  },
];

export const V3_ALT_TOKENS: readonly V3EditorTokenItem[] = [
  {
    label: "Accent",
    hex: "#E7FF68",
    swatchClass: "bg-[var(--cf-lp-lime)]",
  },
  {
    label: "Terracotta",
    hex: "#B9441E",
    swatchClass: "bg-[var(--cf-lp-terracotta)]",
  },
  {
    label: "Background",
    hex: "#241D21",
    swatchClass: "bg-[var(--cf-lp-mauve-ink)]",
  },
  {
    label: "Mauve",
    hex: "#D8AEB8",
    swatchClass: "bg-[var(--cf-lp-mauve)] border border-[var(--cf-mock-chrome-border)]",
  },
];

export const V3_EDITOR_FONTS = {
  defaultHeading: "Georgia",
  altHeading: "Instrument Serif",
  body: "Manrope",
  caption: "Curated, licensed list",
} as const;

export const V3_EDITOR_SLOTS: readonly V3EditorSlotItem[] = [
  {
    name: "Home",
    meta: "Phone · 9:19.5",
    badge: "Filled",
    status: "filled-gold",
  },
  {
    name: "Plan",
    meta: "Phone · 9:19.5",
    badge: "Filled",
    status: "filled-indigo",
  },
  {
    name: "Insights",
    meta: "Phone · 9:19.5",
    badge: "64%",
    status: "uploading",
  },
  {
    name: "Onboarding",
    meta: "Phone · 9:19.5",
    badge: "Empty",
    status: "empty",
  },
  {
    name: "Settings",
    meta: "Phone · 9:19.5",
    badge: "Failed",
    status: "failed",
  },
];

export const V3_SHOWCASE_TABS: readonly V3ShowcaseTabItem[] = [
  {
    id: "slots",
    label: "Ratio-locked image slots",
    caption: "Every phone, tablet and browser frame locks aspect ratio and flags empty required slots before publish.",
  },
  {
    id: "tokens",
    label: "Template color tokens",
    caption: "Swap Primary, Secondary, Background and Text tokens across the whole case study in one click.",
  },
  {
    id: "fonts",
    label: "Font pairs per template",
    caption: "Switch between licensed display and body type pairings tuned specifically for each template.",
  },
  {
    id: "sections",
    label: "Show or hide sections",
    caption: "Toggle Challenge, Approach, Key Flows or Outcomes without breaking vertical rhythm.",
  },
];

export const V3_FEATURE_CARDS = [
  {
    title: "Structure that guides",
    body: "Proven narrative flows help you frame the problem, process, and impact without staring at a blank page.",
  },
  {
    title: "Screens that behave",
    body: "Drop in your work. We handle ratios, device frames, alignment, and rhythm across every screen.",
  },
  {
    title: "Publish it anywhere",
    body: "Export your full case study directly to Layerat, share a live link, or export PDF and 2× PNG. One story, every channel.",
  },
] as const;

export const V3_FAQ_ITEMS = [
  {
    question: "Can I use my own brand styles?",
    answer:
      "Yes. Control color, typography, cover art, and optional sections while the template preserves layout rhythm and contrast discipline.",
  },
  {
    question: "What can I export?",
    answer:
      "Export your full case study to Layerat (1,400px seamless pack), publish a live responsive link, or download selectable-text PDF and full-length 2× Retina PNG files.",
  },
  {
    question: "Is Casefolio only for individuals?",
    answer:
      "No. Start free with 1 lifetime Case Study ($0 forever), upgrade to Pro ($7.99/mo) for up to 10 rotatable stories and custom /p/ URLs, or scale with Team workspaces featuring shared libraries and multi-seat collaboration.",
  },
] as const;

export interface V3MarqueeTemplateCard {
  id: string;
  variant: "orbit" | "frame";
  name: string;
  version: string;
  subtitle: string;
  href: string;
}

export const V3_MARQUEE_CARDS: readonly V3MarqueeTemplateCard[] = [
  {
    id: "frame-1",
    variant: "frame",
    name: "Frame",
    version: "v1.0",
    subtitle: "Website · Challenge · approach · key pages",
    href: "/templates",
  },
  {
    id: "orbit-1",
    variant: "orbit",
    name: "Orbit",
    version: "v1.0",
    subtitle: "Mobile app · Hero · flows · screens grid",
    href: "/new?template=orbit",
  },
  {
    id: "frame-2",
    variant: "frame",
    name: "Frame",
    version: "v1.0",
    subtitle: "Website · Challenge · approach · key pages",
    href: "/templates",
  },
  {
    id: "orbit-2",
    variant: "orbit",
    name: "Orbit",
    version: "v1.0",
    subtitle: "Mobile app · Hero · flows · screens grid",
    href: "/new?template=orbit",
  },
];

