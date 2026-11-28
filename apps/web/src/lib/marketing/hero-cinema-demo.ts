import {
  CURATED_COLOR_PRESETS,
  type CuratedColorPalettePreset,
} from "@/lib/template/curated-themes";
import type {
  PuckDocument,
  TemplateSlotDefinition,
  TemplateTheme,
} from "@/lib/template/schema";

export const HERO_CINEMA_TEMPLATE_META = {
  slug: "cinema",
  name: ".Cinema — Ticket Booking",
  templateLabel: "Cinema",
  version: "1.0.0",
  type: "both" as const,
};

export const HERO_CINEMA_DEFAULT_THEME: TemplateTheme = {
  colors: {
    primary: "#E50914",
    secondary: "#272730",
    background: "#0A0A0C",
    surface: "#141418",
    text: "#FAFAFC",
    textMuted: "#9E9EA8",
    accent: "#FF7A00",
    success: "#22C55E",
    danger: "#EF4444",
    warning: "#F97316",
    info: "#0EA5E9",
  },
  fonts: {
    heading: {
      family: "Plus Jakarta Sans",
      weights: [600, 700, 800],
    },
    body: {
      family: "Inter",
      weights: [400, 500, 600],
    },
  },
  typography: {
    display: { font: "heading", size: 72, weight: 800, lineHeight: 1.06 },
    h2: { font: "heading", size: 40, weight: 700, lineHeight: 1.18 },
    body: { font: "body", size: 18, weight: 400, lineHeight: 1.6 },
    caption: { font: "body", size: 14, weight: 500, lineHeight: 1.4 },
  },
};

export const HERO_CINEMA_SLOTS: Record<string, TemplateSlotDefinition> = {
  "hero.logo": { ratio: "1:1", minWidth: 120, device: "none" },
  "hero.mockup": { ratio: "9:19.5", minWidth: 390, device: "iphone" },
  "overview.banner": { ratio: "16:9", minWidth: 1200, device: "macbook" },
  "process.step.image": { ratio: "4:3", minWidth: 600, device: "none" },
  "wireframe.screen": { ratio: "9:19.5", minWidth: 390, device: "none" },
  "gallery.screen": { ratio: "9:19.5", minWidth: 390, device: "iphone" },
  "spotlight.mockup": { ratio: "9:19.5", minWidth: 390, device: "iphone" },
  "custom.image": { ratio: "16:10", minWidth: 1000, device: "macbook" },
};

export const HERO_CINEMA_PALETTE_PRESETS: readonly CuratedColorPalettePreset[] = [
  {
    id: "cinema-crimson",
    name: "Cinema Crimson",
    colors: { ...HERO_CINEMA_DEFAULT_THEME.colors },
  },
  ...CURATED_COLOR_PRESETS.filter((preset) =>
    ["obsidian-gold", "indigo-studio", "emerald-slate", "editorial-cream"].includes(preset.id),
  ),
];

export const HERO_CINEMA_DEFAULT_PUCK: PuckDocument = {
  root: {
    props: {
      title: HERO_CINEMA_TEMPLATE_META.name,
      themeRef: "template.theme",
    },
  },
  content: [
    {
      type: "Hero",
      props: {
        id: "Hero-1",
        hidden: false,
        eyebrow: "UX/UI CASE STUDY · MOBILE APP",
        title: ".Cinema",
        subtitle:
          "Reimagining movie discovery, real-time auditorium seat selection, and frictionless cinema checkout for dark-room environments.",
        tags: [
          { label: "UI/UX Design" },
          { label: "Mobile App" },
          { label: "iOS & Android" },
          { label: "Design System" },
        ],
        layout: "split-right",
        mockupStyle: "tilt-right",
        glow: true,
        logo: {
          slot: "hero.logo",
          src: "",
          alt: ".Cinema brand emblem",
          crop: null,
        },
        mockup: {
          slot: "hero.mockup",
          src: "",
          alt: ".Cinema splash screen",
          crop: null,
          device: "iphone",
        },
        background: "background",
        accent: "primary",
      },
    },
    {
      type: "Overview",
      props: {
        id: "Overview-1",
        hidden: false,
        eyebrow: "01 · OVERVIEW",
        heading: "Cinema booking is broken.",
        highlight: "We fixed it.",
        summary:
          "Most cinema apps bury showtimes behind pop-up ads and force sign-up before revealing available seats. .Cinema streamlines booking from trailer to live QR pass into a 2-minute dark-mode experience.",
        meta: [
          { label: "Role", value: "Lead Product Designer" },
          { label: "Timeline", value: "8 Weeks" },
          { label: "Platform", value: "iOS & Android" },
          { label: "Screens", value: "35+ Hi-Fi Screens" },
        ],
        background: "surface",
        accent: "primary",
      },
    },
    {
      type: "ScreensGallery",
      props: {
        id: "ScreensGallery-final",
        hidden: false,
        eyebrow: "02 · FINAL UI DESIGN",
        heading: "Crafted for dark-room clarity",
        subtitle:
          "Discovery, real-time auditorium seat selection, and instant perforated wallet passes.",
        columns: 3,
        showcaseLayout: "staggered",
        deviceFrame: "iphone",
        screens: [
          {
            caption: "01 · Now Showing Feed",
            image: {
              slot: "gallery.screen",
              src: "",
              alt: "Home movie discovery feed",
              crop: null,
            },
          },
          {
            caption: "02 · Live Seat Matrix",
            image: {
              slot: "gallery.screen",
              src: "",
              alt: "Interactive auditorium seat map",
              crop: null,
            },
          },
          {
            caption: "03 · Perforated QR Pass",
            image: {
              slot: "gallery.screen",
              src: "",
              alt: "Mobile QR cinema ticket pass",
              crop: null,
            },
          },
        ],
        background: "background",
      },
    },
    {
      type: "Custom",
      props: {
        id: "Custom-spotlight",
        hidden: false,
        eyebrow: "03 · FEATURE SPOTLIGHT",
        heading: "Interactive auditorium seat map",
        layout: "split-right",
        mockupStyle: "straight",
        accent: "primary",
        body: "Redesigned as a tactile, zero-pinch canvas that guides moviegoers to the best acoustic view in seconds.",
        bullets: [
          { text: "Curved laser screen arc establishes instant spatial orientation" },
          { text: "Three-state high-contrast seat tokens protect night vision" },
          { text: "Sticky bottom summary updates row, seat numbers, and total live" },
        ],
        image: {
          slot: "spotlight.mockup",
          src: "",
          alt: "Interactive cinema seat selection spotlight",
          crop: null,
          device: "iphone",
        },
        background: "surface",
      },
    },
    {
      type: "Results",
      props: {
        id: "Results-1",
        hidden: false,
        eyebrow: "04 · IMPACT & LEARNINGS",
        heading: "Measurable booking impact",
        subtitle:
          "Moderated usability testing across 12 participants comparing the legacy flow against .Cinema.",
        columns: 2,
        accent: "primary",
        metrics: [
          { value: "+47%", label: "Faster seat-selection completion vs. legacy grids" },
          { value: "2m 10s", label: "Median time from launch to confirmed QR pass" },
          { value: "4.9★", label: "Post-test usability satisfaction score" },
          { value: "-38%", label: "Reduction in checkout drop-off rate" },
        ],
        takeaways: [
          {
            title: "Context beats decoration",
            body: "Calibrating obsidian surfaces and thumb-zone controls for dim halls lifted task speed.",
          },
          {
            title: "Defer authentication",
            body: "Letting users pick live seats first built commitment before biometric checkout.",
          },
        ],
        background: "background",
      },
    },
  ],
  zones: {},
};
