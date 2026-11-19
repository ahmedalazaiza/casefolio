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
    label: "Primary",
    hex: "#E6C36A",
    swatchClass: "bg-[var(--cf-mock-orbit-gold)]",
  },
  {
    label: "Secondary",
    hex: "#6C5CE7",
    swatchClass: "bg-[var(--cf-mock-orbit-indigo)]",
  },
  {
    label: "Background",
    hex: "#121110",
    swatchClass: "bg-[var(--cf-mock-orbit-bg)]",
  },
  {
    label: "Text",
    hex: "#F5F0E6",
    swatchClass: "bg-[var(--cf-mock-orbit-fg)] border border-[var(--cf-mock-chrome-border)]",
  },
];

export const V3_ALT_TOKENS: readonly V3EditorTokenItem[] = [
  {
    label: "Primary",
    hex: "#5EEAD4",
    swatchClass: "bg-[var(--cf-mock-teal-accent)]",
  },
  {
    label: "Secondary",
    hex: "#38BDF8",
    swatchClass: "bg-[var(--cf-mock-teal-secondary)]",
  },
  {
    label: "Background",
    hex: "#0D1918",
    swatchClass: "bg-[var(--cf-mock-teal-bg)]",
  },
  {
    label: "Text",
    hex: "#F5F0E6",
    swatchClass: "bg-[var(--cf-mock-orbit-fg)] border border-[var(--cf-mock-chrome-border)]",
  },
];

export const V3_EDITOR_FONTS = {
  defaultHeading: "Instrument Serif",
  altHeading: "Bricolage Grotesque",
  body: "Geist",
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
    title: "Publish a public page",
    body: "Share one link to a responsive case study page.",
  },
  {
    title: "Export PNG & PDF",
    body: "Download the finished case study as image or document files.",
  },
  {
    title: "Versioned templates",
    body: "Your project stays pinned to the template version it started with.",
  },
] as const;

export const V3_FAQ_ITEMS = [
  {
    question: "Who designs the templates?",
    answer: "The Casefolio team designs, versions and uploads every template.",
  },
  {
    question: "Can I use my own colors and fonts?",
    answer:
      "Yes. Every template includes editable color tokens and curated font pairs so you can match your project’s brand while keeping spacing and contrast intact.",
  },
  {
    question: "What can I export?",
    answer:
      "Publish a responsive public case study URL or export high-resolution PNG images (including 1400px Behance slices) and print-ready PDF documents.",
  },
  {
    question: "Do you support Mobile + Web in one case study?",
    answer:
      "Yes. Pick a Mobile, Website, or combined multi-platform template with ratio-locked phone, tablet, and desktop browser slots in one flow.",
  },
  {
    question: "What happens to published pages if I cancel?",
    answer:
      "Nothing is deleted. Free ($0) includes 1 lifetime Case Study credit, Pro ($7.99/mo · $79.90/yr with 2 months free) includes up to 10 rotatable Case Studies and custom Case Study URLs (/p/your-custom-slug), and Teams ($5.99/seat/mo · 2 months free on annual, 2–25 seats) includes unlimited shared Case Studies. If you cancel, 1 project stays live on Free while extra projects remain safely locked until you upgrade again.",
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

