import type { PlanTier } from "@casefolio/db";
import { z } from "zod";
import {
  ANNUAL_FREE_MONTHS,
  BILLING_PLAN_CATALOG,
  type BillingInterval,
  type BillingPlanDefinition,
  FREE_LIFETIME_PROJECT_LIMIT,
  PAID_GRACE_DURATION_DAYS,
  PRO_MAX_PROJECTS,
  TEAMS_CALCULATOR_DEFAULT_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
  UNLIMITED_CASE_STUDIES,
  type TeamsPriceResult,
} from "@/lib/billing/plans";
import {
  FREE_MONTHLY_EXPORT_LIMIT,
  PRO_MONTHLY_EXPORT_LIMIT,
  TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT,
} from "@/lib/exports/types";
import { V3_FAQ_ITEMS, V3_FEATURE_CARDS, V3_SHOWCASE_TABS } from "@/lib/marketing/v3-landing-data";

export const CMS_ICON_NAMES = [
  "Globe",
  "FileDown",
  "Layers",
  "Sparkles",
  "Compass",
  "Cpu",
  "Palette",
  "FileOutput",
  "ShieldCheck",
  "Zap",
  "Users",
  "LockKeyhole",
  "ImageOff",
  "Cookie",
  "FileCheck2",
  "CreditCard",
  "ShieldAlert",
] as const;

export type CmsIconName = (typeof CMS_ICON_NAMES)[number];

export const cmsAssetUrlSchema = z
  .string()
  .trim()
  .max(600)
  .refine(
    (val) =>
      val === "" ||
      val.startsWith("/cdn/") ||
      val.startsWith("/") ||
      /^https?:\/\/.+/i.test(val),
    "Must be a relative path (/cdn/...) or valid http(s) URL.",
  );

export const cmsLinkSchema = z.object({
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(300),
});

export const cmsFooterColumnSchema = z.object({
  heading: z.string().trim().min(1).max(50),
  links: z.array(cmsLinkSchema).min(1).max(10),
});

export const cmsSocialLinkSchema = z.object({
  platform: z.enum(["x", "linkedin", "dribbble", "behance", "github", "instagram", "youtube", "custom"]),
  label: z.string().trim().min(1).max(60),
  href: z.string().trim().min(1).max(300),
  customIconUrl: cmsAssetUrlSchema.optional().default(""),
});

export const cmsBrandSchema = z.object({
  siteName: z.string().trim().min(1).max(60),
  logoImageUrl: cmsAssetUrlSchema.default(""),
  announcementTag: z.string().trim().max(24).default("New"),
  announcementText: z.string().trim().max(120).default("Mobile + Website templates"),
  announcementCtaLabel: z.string().trim().max(60).default("Browse templates →"),
  announcementCtaHref: z.string().trim().max(200).default("/templates"),
  navLinks: z.array(cmsLinkSchema).min(1).max(8),
  footerTagline: z.string().trim().min(1).max(320),
  copyrightText: z.string().trim().min(1).max(120),
  footerColumns: z.array(cmsFooterColumnSchema).min(1).max(4),
  socialLinks: z.array(cmsSocialLinkSchema).max(10),
});

export const cmsWorkflowSpecSchema = z.object({
  label: z.string().trim().min(1).max(30),
  value: z.string().trim().min(1).max(40),
});

export const cmsWorkflowPanelSchema = z.object({
  step: z.string().trim().min(1).max(8),
  badgeLabel: z.string().trim().min(1).max(40),
  metaLabel: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(400),
  specs: z.array(cmsWorkflowSpecSchema).min(1).max(4),
  ctaLabel: z.string().trim().min(1).max(50),
  ctaHref: z.string().trim().min(1).max(200),
  imageUrl: cmsAssetUrlSchema.default(""),
});

export const cmsFeatureCardSchema = z.object({
  title: z.string().trim().min(1).max(80),
  body: z.string().trim().min(1).max(240),
  iconName: z.enum(CMS_ICON_NAMES).default("Globe"),
  customIconUrl: cmsAssetUrlSchema.default(""),
});

export const cmsFaqItemSchema = z.object({
  question: z.string().trim().min(1).max(200),
  answer: z.string().trim().min(1).max(1200),
});

export const cmsLandingSchema = z.object({
  heroEyebrowStep: z.string().trim().min(1).max(8),
  heroEyebrowText: z.string().trim().min(1).max(60),
  heroTitleLead: z.string().trim().min(1).max(120),
  heroTitleHighlight: z.string().trim().min(1).max(60),
  heroTitleTrail: z.string().trim().max(80).default("case studies"),
  heroSubtitle: z.string().trim().min(1).max(360),
  primaryCtaLabel: z.string().trim().min(1).max(50),
  primaryCtaHref: z.string().trim().min(1).max(200),
  secondaryCtaLabel: z.string().trim().min(1).max(50),
  secondaryCtaHref: z.string().trim().min(1).max(200),
  heroMockupImageUrl: cmsAssetUrlSchema.default(""),
  workflowEyebrow: z.string().trim().min(1).max(60),
  workflowTitleLead: z.string().trim().min(1).max(60),
  workflowTitleHighlight: z.string().trim().min(1).max(60),
  workflowTitleTrail: z.string().trim().max(80).default("ready the moment you are"),
  workflowPanels: z.array(cmsWorkflowPanelSchema).min(1).max(4),
  featureCards: z.array(cmsFeatureCardSchema).min(1).max(6),
  showcaseEyebrow: z.string().trim().min(1).max(60),
  showcaseTitleHighlight: z.string().trim().min(1).max(40),
  showcaseTitleMiddle: z.string().trim().max(80).default("that keep every"),
  showcaseTitleTrail: z.string().trim().max(80).default("case study consistent"),
  showcaseTabs: z
    .array(
      z.object({
        id: z.enum(["slots", "tokens", "fonts", "sections"]),
        label: z.string().trim().min(1).max(80),
        caption: z.string().trim().min(1).max(240),
      }),
    )
    .min(1)
    .max(4),
  faqEyebrow: z.string().trim().min(1).max(60),
  faqTitleLead: z.string().trim().min(1).max(80),
  faqTitleHighlight: z.string().trim().min(1).max(60),
  faqCtaLabel: z.string().trim().min(1).max(50),
  faqCtaHref: z.string().trim().min(1).max(200),
  faqItems: z.array(cmsFaqItemSchema).min(1).max(16),
  finalCtaEyebrow: z.string().trim().min(1).max(50),
  finalCtaTitleLead: z.string().trim().min(1).max(80),
  finalCtaTitleHighlight: z.string().trim().min(1).max(60),
  finalCtaButtonLabel: z.string().trim().min(1).max(50),
  finalCtaButtonHref: z.string().trim().min(1).max(200),
});

export const cmsTeamMemberSchema = z.object({
  id: z.string().trim().min(1).max(16),
  initials: z.string().trim().min(1).max(4),
  name: z.string().trim().min(1).max(80),
  role: z.string().trim().min(1).max(100),
  discipline: z.string().trim().min(1).max(60),
  location: z.string().trim().min(1).max(60),
  bio: z.string().trim().min(1).max(420),
  focus: z.array(z.string().trim().min(1).max(40)).min(1).max(8),
  tone: z.enum(["royal", "lime", "ink"]).default("royal"),
  avatarImageUrl: cmsAssetUrlSchema.default(""),
  linkUrl: z.string().trim().max(300).default(""),
});

export const cmsTeamPrincipleSchema = z.object({
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(320),
  iconName: z.enum(CMS_ICON_NAMES).default("Palette"),
  customIconUrl: cmsAssetUrlSchema.default(""),
});

export const cmsTeamSchema = z.object({
  eyebrowStep: z.string().trim().min(1).max(8),
  eyebrowText: z.string().trim().min(1).max(60),
  heroTitleLead: z.string().trim().min(1).max(100),
  heroTitleHighlight: z.string().trim().min(1).max(60),
  heroSubtitle: z.string().trim().min(1).max(360),
  badges: z.array(z.string().trim().min(1).max(50)).min(1).max(6),
  rosterEyebrow: z.string().trim().min(1).max(50),
  rosterHeading: z.string().trim().min(1).max(100),
  rosterDescription: z.string().trim().min(1).max(280),
  members: z.array(cmsTeamMemberSchema).min(1).max(20),
  principlesEyebrow: z.string().trim().min(1).max(50),
  principlesHeading: z.string().trim().min(1).max(100),
  principles: z.array(cmsTeamPrincipleSchema).min(1).max(6),
  ctaEyebrow: z.string().trim().min(1).max(50),
  ctaTitleLead: z.string().trim().min(1).max(80),
  ctaTitleHighlight: z.string().trim().min(1).max(60),
  ctaBody: z.string().trim().min(1).max(280),
  ctaButtonLabel: z.string().trim().min(1).max(50),
  ctaButtonHref: z.string().trim().min(1).max(200),
});

export const cmsAboutMetricSchema = z.object({
  value: z.string().trim().min(1).max(24),
  label: z.string().trim().min(1).max(60),
  detail: z.string().trim().min(1).max(220),
});

export const cmsAboutPillarSchema = z.object({
  step: z.string().trim().min(1).max(8),
  title: z.string().trim().min(1).max(100),
  body: z.string().trim().min(1).max(480),
  iconName: z.enum(CMS_ICON_NAMES).default("Layers"),
  customIconUrl: cmsAssetUrlSchema.default(""),
  footerNote: z.string().trim().min(1).max(80),
});

export const cmsAboutComparisonRowSchema = z.object({
  topic: z.string().trim().min(1).max(60),
  generic: z.string().trim().min(1).max(180),
  casefolio: z.string().trim().min(1).max(180),
});

export const cmsAboutSchema = z.object({
  eyebrowStep: z.string().trim().min(1).max(8),
  eyebrowText: z.string().trim().min(1).max(60),
  heroTitleLead: z.string().trim().min(1).max(80),
  heroTitleHighlight: z.string().trim().min(1).max(60),
  heroTitleTrail: z.string().trim().max(80),
  heroSubtitle: z.string().trim().min(1).max(380),
  metrics: z.array(cmsAboutMetricSchema).min(1).max(6),
  philosophyEyebrow: z.string().trim().min(1).max(50),
  philosophyTitleLead: z.string().trim().min(1).max(80),
  philosophyTitleHighlight: z.string().trim().min(1).max(60),
  philosophyTitleTrail: z.string().trim().max(80),
  philosophySubtitle: z.string().trim().min(1).max(360),
  pillars: z.array(cmsAboutPillarSchema).min(1).max(6),
  comparisonEyebrow: z.string().trim().min(1).max(60),
  comparisonTitle: z.string().trim().min(1).max(120),
  comparisonBadge: z.string().trim().min(1).max(60),
  comparisonRows: z.array(cmsAboutComparisonRowSchema).min(1).max(10),
  ctaEyebrow: z.string().trim().min(1).max(50),
  ctaTitleLead: z.string().trim().min(1).max(80),
  ctaTitleHighlight: z.string().trim().min(1).max(60),
  ctaBody: z.string().trim().min(1).max(320),
});

export const cmsPlanTierConfigSchema = z.object({
  name: z.string().trim().min(1).max(40),
  tagline: z.string().trim().min(1).max(200),
  scopeSummary: z.string().trim().min(1).max(120),
  includesLabel: z.string().trim().max(80).default(""),
  ctaLabel: z.string().trim().min(1).max(50),
  badgeLabel: z.string().trim().max(40).default(""),
  monthlyPriceCents: z.number().int().min(0).max(5_000_000),
  yearlyTotalCents: z.number().int().min(0).max(50_000_000),
  yearlyMonthlyEquivalentCents: z.number().int().min(0).max(5_000_000),
  yearlySavingsPercent: z.number().int().min(0).max(90),
  maxCaseStudies: z.number().int().min(-1).max(10000),
  minSeats: z.number().int().min(1).max(50),
  maxSeats: z.number().int().min(1).max(500),
  defaultSeats: z.number().int().min(1).max(500),
  customSlugEnabled: z.boolean(),
  watermarkEnabled: z.boolean(),
  features: z.array(z.string().trim().min(1).max(180)).min(1).max(12),
});

export const cmsComparisonCellSchema = z.union([
  z.boolean(),
  z.string().trim().min(1).max(160),
  z.object({
    included: z.boolean(),
    detail: z.string().trim().min(1).max(120),
  }),
]);

export const cmsComparisonGroupSchema = z.object({
  id: z.string().trim().min(1).max(40),
  title: z.string().trim().min(1).max(100),
  description: z.string().trim().min(1).max(240),
  iconName: z.enum(CMS_ICON_NAMES).default("FolderKanban" as never).catch("Layers"),
  rows: z.array(
    z.object({
      feature: z.string().trim().min(1).max(140),
      hint: z.string().trim().max(240).optional(),
      free: cmsComparisonCellSchema,
      pro: cmsComparisonCellSchema,
      team: cmsComparisonCellSchema,
    }),
  ),
});

export const cmsPricingSchema = z.object({
  heroEyebrowStep: z.string().trim().min(1).max(8),
  heroEyebrowText: z.string().trim().min(1).max(60),
  heroTitleLead: z.string().trim().min(1).max(100),
  heroTitleHighlight: z.string().trim().min(1).max(60),
  heroSubtitle: z.string().trim().min(1).max(400),
  popularTier: z.enum(["free", "pro", "team"]).default("pro"),
  popularBadgeText: z.string().trim().min(1).max(40).default("Most popular"),
  annualBadgeLabel: z.string().trim().min(1).max(50).default("2 months free"),
  annualPillText: z.string().trim().min(1).max(80).default("Teams: 2–25 seats · Annual = 2 months free"),
  tiers: z.object({
    free: cmsPlanTierConfigSchema,
    pro: cmsPlanTierConfigSchema,
    team: cmsPlanTierConfigSchema,
  }),
  paddlePriceOverrides: z
    .object({
      pro_monthly: z.string().trim().max(100).default(""),
      pro_yearly: z.string().trim().max(100).default(""),
      team_monthly: z.string().trim().max(100).default(""),
      team_yearly: z.string().trim().max(100).default(""),
    })
    .default({
      pro_monthly: "",
      pro_yearly: "",
      team_monthly: "",
      team_yearly: "",
    }),
  comparisonGroups: z.array(cmsComparisonGroupSchema).min(1).max(10),
  faqs: z.array(cmsFaqItemSchema).min(1).max(12),
});

export const cmsLegalPillarSchema = z.object({
  title: z.string().trim().min(1).max(100),
  detail: z.string().trim().min(1).max(260),
  iconName: z.enum(CMS_ICON_NAMES).default("ShieldCheck"),
  customIconUrl: cmsAssetUrlSchema.default(""),
});

export const cmsLegalClauseSchema = z.object({
  id: z.string().trim().min(1).max(40),
  step: z.string().trim().min(1).max(8),
  title: z.string().trim().min(1).max(120),
  summary: z.string().trim().min(1).max(220),
  body: z.string().trim().min(1).max(2000),
});

export const cmsLegalAndHelpSchema = z.object({
  privacyEyebrow: z.string().trim().min(1).max(60),
  privacyTitleLead: z.string().trim().min(1).max(40),
  privacyTitleHighlight: z.string().trim().min(1).max(40),
  privacySubtitle: z.string().trim().min(1).max(320),
  privacyEffectiveLine: z.string().trim().min(1).max(160),
  privacyPillars: z.array(cmsLegalPillarSchema).min(1).max(6),
  privacyClauses: z.array(cmsLegalClauseSchema).min(1).max(12),
  termsEyebrow: z.string().trim().min(1).max(60),
  termsTitleLead: z.string().trim().min(1).max(40),
  termsTitleHighlight: z.string().trim().min(1).max(40),
  termsSubtitle: z.string().trim().min(1).max(320),
  termsEffectiveLine: z.string().trim().min(1).max(160),
  termsHighlights: z.array(cmsLegalPillarSchema).min(1).max(6),
  termsClauses: z.array(cmsLegalClauseSchema).min(1).max(12),
  helpEyebrow: z.string().trim().min(1).max(60),
  helpTitle: z.string().trim().min(1).max(120),
  helpSubtitle: z.string().trim().min(1).max(320),
  helpNoticeBanner: z.string().trim().max(240).default(""),
});

export const siteCmsContentSchema = z.object({
  version: z.number().int().min(1).default(1),
  updatedAtIso: z.string().optional(),
  brand: cmsBrandSchema,
  landing: cmsLandingSchema,
  team: cmsTeamSchema,
  about: cmsAboutSchema,
  pricing: cmsPricingSchema,
  legalAndHelp: cmsLegalAndHelpSchema,
});

export type SiteCmsContent = z.infer<typeof siteCmsContentSchema>;
export type CmsSectionKey = "brand" | "landing" | "team" | "about" | "pricing" | "legalAndHelp";

export const CMS_SECTION_SCHEMAS = {
  brand: cmsBrandSchema,
  landing: cmsLandingSchema,
  team: cmsTeamSchema,
  about: cmsAboutSchema,
  pricing: cmsPricingSchema,
  legalAndHelp: cmsLegalAndHelpSchema,
} as const;

export const DEFAULT_SITE_CMS_CONTENT: SiteCmsContent = {
  version: 1,
  brand: {
    siteName: "Casefolio",
    logoImageUrl: "",
    announcementTag: "New",
    announcementText: "Mobile + Website templates",
    announcementCtaLabel: "Browse templates →",
    announcementCtaHref: "/templates",
    navLinks: [
      { label: "Home", href: "/" },
      { label: "Templates", href: "/templates" },
      { label: "Pricing", href: "/pricing" },
      { label: "How it works", href: "/#how-it-works" },
      { label: "FAQ", href: "/#faq" },
    ],
    footerTagline:
      "The constrained case study studio for product designers, agencies, and creative teams. Pick a layout, drop in screens, and ship.",
    copyrightText: "© 2026 Casefolio · A product of LAYERAT",
    footerColumns: [
      {
        heading: "Product",
        links: [
          { label: "Home", href: "/" },
          { label: "Templates", href: "/templates" },
          { label: "Pricing", href: "/pricing" },
          { label: "How it works", href: "/#how-it-works" },
          { label: "FAQ", href: "/#faq" },
        ],
      },
      {
        heading: "Company",
        links: [
          { label: "About us", href: "/about" },
          { label: "Our team", href: "/team" },
          { label: "Help center", href: "/help" },
          { label: "Contact", href: "/help/contact" },
        ],
      },
      {
        heading: "Legal",
        links: [
          { label: "Terms of use", href: "/terms" },
          { label: "Privacy policy", href: "/privacy" },
          { label: "Refund policy", href: "/terms#refunds" },
        ],
      },
    ],
    socialLinks: [
      { platform: "x", label: "Casefolio on X", href: "https://x.com/casefolio", customIconUrl: "" },
      { platform: "linkedin", label: "Casefolio on LinkedIn", href: "https://linkedin.com/company/casefolio", customIconUrl: "" },
      { platform: "dribbble", label: "Casefolio on Dribbble", href: "https://dribbble.com/casefolio", customIconUrl: "" },
      { platform: "behance", label: "Casefolio on Behance", href: "https://behance.net/casefolio", customIconUrl: "" },
      { platform: "github", label: "Casefolio on GitHub", href: "https://github.com/casefolio", customIconUrl: "" },
    ],
  },
  landing: {
    heroEyebrowStep: "01",
    heroEyebrowText: "Curated Case Study Studio",
    heroTitleLead: "Turn finished projects into",
    heroTitleHighlight: "publishable",
    heroTitleTrail: "case studies",
    heroSubtitle:
      "Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a page or export PNG & PDF.",
    primaryCtaLabel: "Start free",
    primaryCtaHref: "/sign-up",
    secondaryCtaLabel: "Browse templates",
    secondaryCtaHref: "/templates",
    heroMockupImageUrl: "",
    workflowEyebrow: "Structured Workflow",
    workflowTitleLead: "Built for",
    workflowTitleHighlight: "case studies",
    workflowTitleTrail: "ready the moment you are",
    workflowPanels: [
      {
        step: "01",
        badgeLabel: "Templates",
        metaLabel: "Curated System",
        title: "Templates made for case studies",
        body: "Pick a Mobile, Website or combined layout, designed and versioned by the Casefolio team. Layout and spacing stay intact.",
        specs: [
          { label: "Formats", value: "App · Web" },
          { label: "Spacing", value: "Grid-locked" },
          { label: "Updates", value: "Versioned" },
        ],
        ctaLabel: "Browse templates",
        ctaHref: "/templates",
        imageUrl: "",
      },
      {
        step: "02",
        badgeLabel: "Editor",
        metaLabel: "Constrained Canvas",
        title: "Edit only what matters",
        body: "Drop screens into ratio-locked slots, change text, colors and fonts, then reorder or hide sections.",
        specs: [
          { label: "Frames", value: "Ratio-locked" },
          { label: "Tokens", value: "AA checked" },
          { label: "Sections", value: "Live reorder" },
        ],
        ctaLabel: "See how it works",
        ctaHref: "#details-showcase",
        imageUrl: "",
      },
    ],
    featureCards: [
      {
        title: V3_FEATURE_CARDS[0].title,
        body: V3_FEATURE_CARDS[0].body,
        iconName: "Globe",
        customIconUrl: "",
      },
      {
        title: V3_FEATURE_CARDS[1].title,
        body: V3_FEATURE_CARDS[1].body,
        iconName: "FileDown",
        customIconUrl: "",
      },
      {
        title: V3_FEATURE_CARDS[2].title,
        body: V3_FEATURE_CARDS[2].body,
        iconName: "Layers",
        customIconUrl: "",
      },
    ],
    showcaseEyebrow: "Design System Guardrails",
    showcaseTitleHighlight: "Details",
    showcaseTitleMiddle: "that keep every",
    showcaseTitleTrail: "case study consistent",
    showcaseTabs: V3_SHOWCASE_TABS.map((t) => ({ ...t })),
    faqEyebrow: "FAQ · Straight Answers",
    faqTitleLead: "Got questions? We have",
    faqTitleHighlight: "the answers.",
    faqCtaLabel: "Start free",
    faqCtaHref: "/sign-up",
    faqItems: V3_FAQ_ITEMS.map((item) => ({ ...item })),
    finalCtaEyebrow: "Ready to Ship",
    finalCtaTitleLead: "Your next case study is",
    finalCtaTitleHighlight: "one template away",
    finalCtaButtonLabel: "Make it happen",
    finalCtaButtonHref: "/sign-up",
  },
  team: {
    eyebrowStep: "01",
    eyebrowText: "Our Studio Team",
    heroTitleLead: "Two partners building the standard for",
    heroTitleHighlight: "portfolio craft",
    heroSubtitle:
      "Casefolio is independently founded and engineered by two partners uniting product vision, constrained editorial design, and full-stack software engineering.",
    badges: [
      "Product & System Architecture",
      "Full-Stack Engineering",
      "Constrained Studio Craft",
    ],
    rosterEyebrow: "Founding Partners",
    rosterHeading: "The two founders behind Casefolio",
    rosterDescription:
      "Built lean from day one—pairing product direction and business strategy directly with end-to-end engineering.",
    members: [
      {
        id: "01",
        initials: "AA",
        name: "Ahmed Al-Azaiza",
        role: "Founder & Product Architect",
        discipline: "Product & Business",
        location: "Co-Founder · Business Lead",
        bio: "Originator of Casefolio's system architecture and business model—defining the constrained editorial rules, curated template standards, and pricing strategy.",
        focus: ["Product Vision", "Business Strategy", "System Design", "Template Direction"],
        tone: "royal",
        avatarImageUrl: "",
        linkUrl: "",
      },
      {
        id: "02",
        initials: "MK",
        name: "Mohammed Kullab",
        role: "Co-Founder & Lead Full-Stack Engineer",
        discipline: "Frontend & Backend",
        location: "Co-Founder · Technical Lead",
        bio: "Technical co-founder leading Frontend, Backend, authentication, Paddle billing integrations, cloud asset storage, and the high-resolution export engine.",
        focus: ["Next.js & React", "Backend APIs", "Database & Auth", "Export Pipeline"],
        tone: "lime",
        avatarImageUrl: "",
        linkUrl: "",
      },
    ],
    principlesEyebrow: "How We Build",
    principlesHeading: "Small partner team, high craft bar",
    principles: [
      {
        title: "Product vision meets direct execution",
        body: "There are no layers between product strategy and shipped code—every template, quota rule, and editor improvement goes straight from design review to production.",
        iconName: "Palette",
        customIconUrl: "",
      },
      {
        title: "Deterministic rendering everywhere",
        body: "What you style inside the builder is rendered by the exact same component engine on your live URL and PNG/PDF exports.",
        iconName: "Cpu",
        customIconUrl: "",
      },
      {
        title: "Built alongside working designers",
        body: "Staying a lean, focused two-partner studio lets us iterate quickly, protect simplicity, and listen directly to designers shipping real portfolios.",
        iconName: "Compass",
        customIconUrl: "",
      },
    ],
    ctaEyebrow: "Work With Us",
    ctaTitleLead: "Have a template idea or",
    ctaTitleHighlight: "product feedback",
    ctaBody:
      "We read every support message and template request directly as founders—whether you are a solo product designer or scaling studio.",
    ctaButtonLabel: "Contact studio desk",
    ctaButtonHref: "/help/contact",
  },
  about: {
    eyebrowStep: "01",
    eyebrowText: "About Casefolio Studio",
    heroTitleLead: "The studio layer between",
    heroTitleHighlight: "finished work",
    heroTitleTrail: "and published proof",
    heroSubtitle:
      "Great product designers spend months shipping thoughtful software—then stall for weeks trying to package the story. We built Casefolio so your portfolio reflects the exact craft of the product itself.",
    metrics: [
      {
        value: "100%",
        label: "Ratio-locked slots",
        detail: "Every phone, tablet, and browser frame keeps exact hardware proportions.",
      },
      {
        value: "0px",
        label: "Layout drift",
        detail: "Curated spacing and tokenized type prevent broken grids across viewports.",
      },
      {
        value: "4x",
        label: "Delivery outputs",
        detail: "One document renders live web links, PNG slices, Behance boards, and A4 PDFs.",
      },
      {
        value: "Zero",
        label: "Third-party ad cookies",
        detail: "Salted daily engagement metrics and automatic EXIF metadata stripping.",
      },
    ],
    philosophyEyebrow: "Our Philosophy",
    philosophyTitleLead: "Why we chose",
    philosophyTitleHighlight: "curated structure",
    philosophyTitleTrail: "over another blank canvas",
    philosophySubtitle:
      "Every control in Casefolio is intentionally scoped so you spend your creative energy on narrative clarity and crisp screens—never debugging flexbox margins.",
    pillars: [
      {
        step: "01",
        title: "Constrained by design, never restrictive",
        body: "Open-ended website builders force designers to rebuild grids, padding, and responsive breakpoints from scratch at midnight before an interview. Casefolio locks structural rhythm while keeping palette, typography, section order, and narrative voice completely yours.",
        iconName: "Layers",
        customIconUrl: "",
        footerNote: "Engineered into every studio template",
      },
      {
        step: "02",
        title: "Built around real hiring & client review",
        body: "Design leaders scan a case study in under ninety seconds before reading deeper. Every Casefolio template structures context, problem framing, key visual flows, and measurable outcomes in an editorial hierarchy engineered for fast comprehension.",
        iconName: "Compass",
        customIconUrl: "",
        footerNote: "Engineered into every studio template",
      },
      {
        step: "03",
        title: "Write once, ship to every surface",
        body: "Your work shouldn't live trapped inside a single format. The exact same studio renderer powers your live shareable URL, password-protected NDA links, 2x retina PNG slices, Behance vertical presentations, and print-ready PDF decks.",
        iconName: "FileOutput",
        customIconUrl: "",
        footerNote: "Engineered into every studio template",
      },
    ],
    comparisonEyebrow: "Architecture Comparison",
    comparisonTitle: "How Casefolio differs from generic page builders",
    comparisonBadge: "100% Designer IP Ownership",
    comparisonRows: [
      {
        topic: "Starting point",
        generic: "Blank canvas or brittle generic blog themes",
        casefolio: "Hand-engineered UI/UX case study systems",
      },
      {
        topic: "Screen mockups",
        generic: "Manual exporting, cropping, and misaligned frames",
        casefolio: "Drag-and-drop ratio-locked browser & mobile slots",
      },
      {
        topic: "Typography & color",
        generic: "Ad-hoc overrides that break contrast & dark mode",
        casefolio: "Tokenized theme presets with WCAG AA guardrails",
      },
      {
        topic: "Multi-channel export",
        generic: "Rebuild separately in Figma for Behance & PDF",
        casefolio: "1-click Web, PNG, Behance 1400px, and A4 PDF",
      },
    ],
    ctaEyebrow: "Start Shipping",
    ctaTitleLead: "Ready to package your",
    ctaTitleHighlight: "strongest work",
    ctaBody:
      "Start free with a curated template, drop in your product screens, and publish a live case study link in minutes.",
  },
  pricing: {
    heroEyebrowStep: "01",
    heroEyebrowText: "Pricing & Plans",
    heroTitleLead: "Simple tiers for solo designers &",
    heroTitleHighlight: "scaling studios.",
    heroSubtitle: `Build and publish ${FREE_LIFETIME_PROJECT_LIMIT} complete Case Study free from A to Z — then upgrade to Pro for up to ${PRO_MAX_PROJECTS} rotatable Case Studies & custom URLs, or Teams (${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats) for unlimited studio collaboration. Get ${ANNUAL_FREE_MONTHS} months free on annual billing.`,
    popularTier: "pro",
    popularBadgeText: "Most popular",
    annualBadgeLabel: `${ANNUAL_FREE_MONTHS} months free`,
    annualPillText: `Teams: ${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats · Annual = ${ANNUAL_FREE_MONTHS} months free`,
    tiers: {
      free: {
        name: BILLING_PLAN_CATALOG.free.name,
        tagline: BILLING_PLAN_CATALOG.free.tagline,
        scopeSummary: BILLING_PLAN_CATALOG.free.scopeSummary,
        includesLabel: "",
        ctaLabel: "Start free",
        badgeLabel: "",
        monthlyPriceCents: BILLING_PLAN_CATALOG.free.monthlyPriceCents,
        yearlyTotalCents: BILLING_PLAN_CATALOG.free.yearlyTotalCents,
        yearlyMonthlyEquivalentCents: BILLING_PLAN_CATALOG.free.yearlyMonthlyEquivalentCents,
        yearlySavingsPercent: BILLING_PLAN_CATALOG.free.yearlySavingsPercent,
        maxCaseStudies: FREE_LIFETIME_PROJECT_LIMIT,
        minSeats: 1,
        maxSeats: 1,
        defaultSeats: 1,
        customSlugEnabled: false,
        watermarkEnabled: true,
        features: [...BILLING_PLAN_CATALOG.free.features],
      },
      pro: {
        name: BILLING_PLAN_CATALOG.pro.name,
        tagline: BILLING_PLAN_CATALOG.pro.tagline,
        scopeSummary: BILLING_PLAN_CATALOG.pro.scopeSummary,
        includesLabel: BILLING_PLAN_CATALOG.pro.includesLabel ?? "",
        ctaLabel: "Upgrade to Pro",
        badgeLabel: "Best for individuals",
        monthlyPriceCents: BILLING_PLAN_CATALOG.pro.monthlyPriceCents,
        yearlyTotalCents: BILLING_PLAN_CATALOG.pro.yearlyTotalCents,
        yearlyMonthlyEquivalentCents: BILLING_PLAN_CATALOG.pro.yearlyMonthlyEquivalentCents,
        yearlySavingsPercent: BILLING_PLAN_CATALOG.pro.yearlySavingsPercent,
        maxCaseStudies: PRO_MAX_PROJECTS,
        minSeats: 1,
        maxSeats: 1,
        defaultSeats: 1,
        customSlugEnabled: true,
        watermarkEnabled: false,
        features: [...BILLING_PLAN_CATALOG.pro.features],
      },
      team: {
        name: BILLING_PLAN_CATALOG.team.name,
        tagline: BILLING_PLAN_CATALOG.team.tagline,
        scopeSummary: BILLING_PLAN_CATALOG.team.scopeSummary,
        includesLabel: BILLING_PLAN_CATALOG.team.includesLabel ?? "",
        ctaLabel: "Start Teams plan",
        badgeLabel: "Multi-seat studio",
        monthlyPriceCents: BILLING_PLAN_CATALOG.team.monthlyPriceCents,
        yearlyTotalCents: BILLING_PLAN_CATALOG.team.yearlyTotalCents,
        yearlyMonthlyEquivalentCents: BILLING_PLAN_CATALOG.team.yearlyMonthlyEquivalentCents,
        yearlySavingsPercent: BILLING_PLAN_CATALOG.team.yearlySavingsPercent,
        maxCaseStudies: UNLIMITED_CASE_STUDIES,
        minSeats: TEAMS_MIN_SEATS,
        maxSeats: TEAMS_MAX_SELF_SERVE_SEATS,
        defaultSeats: TEAMS_CALCULATOR_DEFAULT_SEATS,
        customSlugEnabled: true,
        watermarkEnabled: false,
        features: [...BILLING_PLAN_CATALOG.team.features],
      },
    },
    paddlePriceOverrides: {
      pro_monthly: "",
      pro_yearly: "",
      team_monthly: "",
      team_yearly: "",
    },
    comparisonGroups: [
      {
        id: "workspace",
        title: "Workspace, Seats & Case Studies",
        description: "Compare seat allocations, active project allowances, and shared vs. personal workspaces.",
        iconName: "Layers",
        rows: [
          {
            feature: "Seats & workspace scope",
            free: "1 seat · Personal workspace",
            pro: "1 seat · Personal workspace",
            team: `${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats · Shared Team workspace`,
          },
          {
            feature: "Case Studies allowance",
            hint: "Free grants 1 one-time lifetime credit; Pro slots can be deleted or archived anytime to rotate work",
            free: `${FREE_LIFETIME_PROJECT_LIMIT} lifetime Case Study credit`,
            pro: `Up to ${PRO_MAX_PROJECTS} active (rotatable)`,
            team: "Unlimited shared",
          },
          {
            feature: "Team Dashboard (invite by email, invite status & roles)",
            hint: "Manage Owner, Admin & Member seats with instant prorated additions",
            free: false,
            pro: false,
            team: true,
          },
          {
            feature: "Shared Team Workspace & Brand Kit",
            hint: "Centralized studio logos, brand colors, reusable blocks, and collaborative spaces",
            free: false,
            pro: false,
            team: true,
          },
        ],
      },
      {
        id: "templates",
        title: "Templates & Styling Control",
        description: "Starter vs. Pro & Premium templates, custom typography, color palettes, and modular sections.",
        iconName: "Palette",
        rows: [
          { feature: "Starter case study templates", free: true, pro: true, team: true },
          { feature: "All Pro & Premium templates", free: false, pro: true, team: true },
          { feature: "Full A-to-Z styling (colors, typography & modular sections)", free: true, pro: true, team: true },
          { feature: "Pre-publish contrast & empty-slot checks", free: true, pro: true, team: true },
        ],
      },
      {
        id: "publishing",
        title: "Live Links & Custom URLs",
        description: "Shareable web URLs, custom /p/your-slug branding, and watermark removal.",
        iconName: "Globe",
        rows: [
          { feature: "Live Shareable Link", free: true, pro: true, team: true },
          {
            feature: "Custom Case Study URL (/p/your-slug)",
            hint: "Customize the /p/ slug on published portfolio links",
            free: "Auto-generated link",
            pro: true,
            team: true,
          },
          {
            feature: "Watermark-free exports & removable Casefolio footer",
            free: { included: false, detail: "Subtle watermark" },
            pro: true,
            team: true,
          },
        ],
      },
      {
        id: "exports",
        title: "PNG, Behance & A4 PDF Exports",
        description: "Pixel-accurate exports formatted for Behance showcases, client presentations, and hiring decks.",
        iconName: "FileDown",
        rows: [
          {
            feature: "PNG & PDF Case Study export",
            free: "1× with subtle watermark",
            pro: "High-res, no watermark",
            team: "High-res, no watermark",
          },
          { feature: "2× Retina PNG (2,880 px) & Behance 1,400 px slice pack", free: false, pro: true, team: true },
          {
            feature: "Monthly export allowance",
            free: `${FREE_MONTHLY_EXPORT_LIMIT}/mo`,
            pro: `${PRO_MONTHLY_EXPORT_LIMIT}/mo`,
            team: `${TEAMS_MONTHLY_EXPORT_LIMIT_PER_SEAT} × seats/mo`,
          },
        ],
      },
      {
        id: "storage-analytics",
        title: "Analytics, Storage & Recovery",
        description: "Live portfolio view insights, asset storage quotas, and member recovery protection.",
        iconName: "Sparkles",
        rows: [
          {
            feature: "View analytics on live links",
            free: { included: false, detail: "7-day summary" },
            pro: "90-day portfolio analytics",
            team: "365-day team analytics",
          },
          {
            feature: "Asset storage & max upload size",
            free: "250 MB · 10 MB/file",
            pro: "5 GB · 25 MB/file",
            team: "10 GB × seats · 25 MB/file",
          },
          {
            feature: `${PAID_GRACE_DURATION_DAYS}-day paid quota grace buffer & private member recovery`,
            free: false,
            pro: true,
            team: true,
          },
        ],
      },
      {
        id: "governance",
        title: "Privacy & Downgrade Protection",
        description: "Isolated personal member drafts and non-destructive downgrade safeguards.",
        iconName: "Users",
        rows: [
          {
            feature: "Non-destructive Free downgrade protection",
            hint: "Your Case Studies are never deleted — choose 1 active Case Study while extras remain safely stored",
            free: true,
            pro: true,
            team: true,
          },
          { feature: "Isolated private member drafts (hidden from Admins)", free: false, pro: false, team: true },
        ],
      },
    ],
    faqs: [
      {
        question: "How do Free, Pro, and Teams compare?",
        answer:
          "Free ($0) gives you 1 lifetime Case Study credit to build and publish from A to Z with an auto-generated link. Pro ($7.99/mo or $79.90/yr — 2 months free, $6.66/mo eq.) unlocks up to 10 active rotatable Case Studies, custom /p/your-slug URLs, Pro templates, and watermark-free exports. Teams ($5.99/seat/mo or $59.90/seat/yr — 2 months free, $4.99/seat/mo eq., 2–25 seats) unlocks unlimited shared Case Studies, a Team Dashboard, and pooled studio storage.",
      },
      {
        question: "How does the 1 lifetime Free Case Study credit work?",
        answer:
          "Every Free personal workspace includes 1 one-time lifetime Case Study credit. You can edit, archive, unarchive, export, and publish that project freely — deleting it on Free does not issue a new credit. Upgrade to Pro anytime to rotate up to 10 active projects.",
      },
      {
        question: "What happens if I downgrade to Free with multiple Case Studies?",
        answer:
          "Nothing is deleted. You pick which 1 Case Study stays active and live, while additional Case Studies remain safely stored and locked until you upgrade again.",
      },
    ],
  },
  legalAndHelp: {
    privacyEyebrow: "Privacy & Data Architecture",
    privacyTitleLead: "Privacy",
    privacyTitleHighlight: "policy",
    privacySubtitle:
      "How Casefolio protects your creative work, strips hidden image metadata, measures readership without ad cookies, and keeps you in control of your data.",
    privacyEffectiveLine: "Effective April 15, 2026 · Zero Ad Trackers · Never Sold for AI Training",
    privacyPillars: [
      {
        title: "Automatic EXIF & GPS Stripping",
        detail: "Every uploaded PNG, JPEG, or WebP has camera, device, and GPS metadata stripped before public delivery.",
        iconName: "ImageOff",
        customIconUrl: "",
      },
      {
        title: "Cookie-Free Reader Analytics",
        detail: "Published case studies use daily-rotating cryptographic salts—zero cross-site ad trackers or cookie banners.",
        iconName: "Cookie",
        customIconUrl: "",
      },
      {
        title: "PCI-Scoped Billing via Paddle",
        detail: "Payment cards are handled exclusively by Paddle; Casefolio servers never see or store card numbers.",
        iconName: "LockKeyhole",
        customIconUrl: "",
      },
    ],
    privacyClauses: [
      {
        id: "collection",
        step: "01",
        title: "Information We Collect & Data Controller",
        summary: "Minimal account and workspace metadata collected by LAYERAT to run Casefolio.",
        body: "Casefolio is owned and operated by LAYERAT (https://www.layerat.com). When you register for Casefolio, we collect your name, email address, authentication provider identifiers, onboarding preferences, and workspace settings. Inside the editor, we store the structured JSON documents, theme tokens, and visual assets you explicitly upload so we can autosave, preview, publish, and export your case studies reliably.",
      },
      {
        id: "image-sanitization",
        step: "02",
        title: "Automatic Image Sanitization & EXIF Stripping",
        summary: "Protecting hidden location and device metadata on every screenshot.",
        body: "Designers frequently upload screenshots and photos captured directly on personal devices or office networks. Our upload pipeline validates file signatures, normalizes color profiles, and strips embedded EXIF, GPS coordinates, and camera serial metadata automatically before writing derivatives to object storage.",
      },
      {
        id: "analytics",
        step: "03",
        title: "Cookie-Free Public Case Study Analytics",
        summary: "Understanding recruiter and client engagement without surveillance.",
        body: "When someone views your published case study at /u/handle/slug, we compute a non-reversible visitor hash using a daily-rotating server salt rather than persistent tracking cookies or third-party ad pixels. This gives you accurate view, referrer, and read-depth insights while respecting reader privacy out of the box.",
      },
      {
        id: "billing-processors",
        step: "04",
        title: "Billing & Infrastructure Subprocessors",
        summary: "Vetted infrastructure partners scoped strictly to service delivery.",
        body: "Paid subscriptions for Casefolio (a LAYERAT product, www.layerat.com) are processed by Paddle, our authorized Merchant of Record, which handles payment methods, tax calculation, and invoicing. Transactional emails (verification codes, password resets, export notifications) and cloud storage operate over TLS-encrypted connections with strict least-privilege credentials. We never sell, rent, or broker designer data or portfolio content to third parties or AI training brokers.",
      },
      {
        id: "security",
        step: "05",
        title: "Encryption, Passwords & Confidential Links",
        summary: "How we safeguard accounts and password-protected NDA case studies.",
        body: "Account passwords and published case-study share passwords are hashed using modern memory-hard cryptographic algorithms—never stored in plaintext. Session tokens are HTTP-only and scoped, and administrative actions are recorded in immutable audit logs.",
      },
      {
        id: "teams",
        step: "06",
        title: "Team Workspaces & Role Permissions",
        summary: "How shared workspaces manage member visibility.",
        body: "If you join or invite collaborators to a Team workspace, workspace owners and members can view and edit projects created inside that shared workspace according to their assigned role. Personal workspace projects remain private to your individual account unless explicitly transferred or published.",
      },
      {
        id: "rights",
        step: "07",
        title: "Data Portability, Export & Permanent Deletion",
        summary: "Full self-serve control over your Casefolio account and files.",
        body: "You may export your case studies or permanently delete individual projects or your entire Casefolio account at any time from Account Settings. Account deletion purges your projects, published routes, and associated media objects cleanly, subject only to statutory tax records maintained by Paddle.",
      },
    ],
    termsEyebrow: "Studio Legal Agreement",
    termsTitleLead: "Terms of",
    termsTitleHighlight: "use",
    termsSubtitle:
      "Clear, designer-friendly terms governing your Casefolio workspace, intellectual property rights, published links, and subscription billing.",
    termsEffectiveLine: "Effective April 15, 2026 · Version 2.0",
    termsHighlights: [
      {
        title: "100% Your Intellectual Property",
        detail: "You own every screen, narrative, logo, and exported case study you create in Casefolio.",
        iconName: "FileCheck2",
        customIconUrl: "",
      },
      {
        title: "Transparent Paddle Billing",
        detail: "Upgrade, switch intervals, or cancel anytime in one click—access continues until period end.",
        iconName: "CreditCard",
        customIconUrl: "",
      },
      {
        title: "Clear Acceptable Use",
        detail: "Publish work you have rights to share and respect NDA/confidentiality commitments.",
        iconName: "ShieldAlert",
        customIconUrl: "",
      },
    ],
    termsClauses: [
      {
        id: "eligibility",
        step: "01",
        title: "Operator, Workspace Eligibility & Account Security",
        summary: "Who operates Casefolio and who can use a workspace.",
        body: "Casefolio is owned and operated by LAYERAT (https://www.layerat.com). By creating a Casefolio account, you confirm that you are at least 16 years old (or the minimum legal age of digital consent in your jurisdiction) and authorized to agree to these Terms of Use on behalf of yourself or your studio. You are responsible for maintaining the confidentiality of your login credentials, passkeys, or OAuth sessions and for all activity conducted within your workspace.",
      },
      {
        id: "ownership",
        step: "02",
        title: "Your Work & Intellectual Property Ownership",
        summary: "You retain 100% ownership of everything you upload, write, and export.",
        body: "Casefolio claims zero ownership over your UI screenshots, product photography, copywriting, metrics, brand assets, or finished case studies. You grant Casefolio a limited, revocable, worldwide technical license solely to store, optimize, render, and serve your content when you choose to preview, publish a live link, or generate PNG, Behance, or PDF exports.",
      },
      {
        id: "template-license",
        step: "03",
        title: "Studio Template & Export License",
        summary: "How you may use Casefolio layouts, mockups, and generated exports.",
        body: "All Casefolio template architectures, Puck section schemas, hardware mockup frames, and source code remain the intellectual property of Casefolio Studio. Subject to your active plan tier, Casefolio grants you a non-exclusive license to publish live case studies and distribute exported PNG, Behance, and PDF presentations for personal portfolios, job applications, agency pitches, and client deliverables. Reselling or redistributing raw Casefolio templates as standalone templates is prohibited.",
      },
      {
        id: "acceptable-use",
        step: "04",
        title: "Published Links, Custom Slugs & Acceptable Use",
        summary: "Keeping public case study links safe, lawful, and respectful of rights.",
        body: "You agree to upload and publish only work that you created or have permission to showcase. You may not use Casefolio to host unlawful, defamatory, deceptive, or malicious content, impersonate third-party brands, scrape platform endpoints, or bypass plan entitlements and rate limits. Password-protected case study links are provided on eligible plans to help you share confidential work responsibly.",
      },
      {
        id: "billing",
        step: "05",
        title: "Subscriptions, Taxes & Merchant of Record",
        summary: "How Pro and Team plans are billed globally via Paddle on behalf of LAYERAT.",
        body: "Paid subscriptions for Casefolio (Pro and Team) are sold by LAYERAT (https://www.layerat.com) and processed through Paddle, our authorized Merchant of Record, which handles global payment methods, invoicing, and regional VAT/sales tax compliance. Subscriptions renew automatically on your selected monthly or annual billing cycle unless canceled prior to renewal.",
      },
      {
        id: "cancellation",
        step: "06",
        title: "Plan Changes, Cancellation & Workspace Retention",
        summary: "What happens when you downgrade or cancel a paid subscription.",
        body: "You can cancel or modify your subscription at any time from Account → Billing. When canceled, paid features remain active through the end of your current paid billing period. Afterward, your workspace transitions gracefully to Free tier limits without deleting your underlying draft content, so you never lose your writing or uploaded assets unexpectedly.",
      },
      {
        id: "refunds",
        step: "07",
        title: "Refund & Consumer Withdrawal Policy",
        summary: "14-day refund eligibility and how refunds are processed via Paddle.",
        body: "If you are unhappy with your initial Casefolio Pro or Teams purchase, you may request a full refund within fourteen (14) days of your initial transaction in accordance with consumer protection laws and Paddle's Merchant of Record refund policy. To request a refund, contact our billing team via /help/contact or reply directly to your Paddle receipt email. Approved refunds are issued by Paddle back to your original payment method.",
      },
      {
        id: "liability",
        step: "08",
        title: "Service Availability, Warranties & Contact",
        summary: "Platform reliability commitments, limitation of liability, and updates.",
        body: "We engineer Casefolio for high availability, automated backups, and deterministic exports, but the service is provided on an 'as is' and 'as available' basis to the maximum extent permitted by applicable law. Casefolio's aggregate liability for any claim relating to the service shall not exceed the fees paid by you in the twelve (12) months preceding the claim. If we make material updates to these Terms, we will notify workspace owners in advance.",
      },
    ],
    helpEyebrow: "Help Center",
    helpTitle: "How can we help you ship your case study?",
    helpSubtitle:
      "Search guides for templates, ratio-locked slots, custom /p/ URLs, PNG/PDF exports, Teams seats, and Paddle billing.",
    helpNoticeBanner: "",
  },
};

export type MergedBillingCatalog = Record<
  PlanTier,
  BillingPlanDefinition & {
    ctaLabel: string;
    badgeLabel: string;
  }
>;

export function mergeBillingCatalogWithCms(
  cmsPricing: SiteCmsContent["pricing"] = DEFAULT_SITE_CMS_CONTENT.pricing,
): MergedBillingCatalog {
  const mapTier = (
    tier: "free" | "pro" | "team",
  ): BillingPlanDefinition & { ctaLabel: string; badgeLabel: string } => {
    const base = BILLING_PLAN_CATALOG[tier];
    const over = cmsPricing.tiers[tier];
    return {
      ...base,
      name: over.name,
      tagline: over.tagline,
      scopeSummary: over.scopeSummary,
      includesLabel: over.includesLabel || undefined,
      monthlyPriceCents: over.monthlyPriceCents,
      yearlyTotalCents: over.yearlyTotalCents,
      yearlyMonthlyEquivalentCents: over.yearlyMonthlyEquivalentCents,
      yearlySavingsCents: Math.max(0, over.monthlyPriceCents * 12 - over.yearlyTotalCents),
      monthlyPriceUsd: Number((over.monthlyPriceCents / 100).toFixed(2)),
      yearlyTotalUsd: Number((over.yearlyTotalCents / 100).toFixed(2)),
      yearlyMonthlyEquivalentUsd: Number((over.yearlyMonthlyEquivalentCents / 100).toFixed(2)),
      yearlySavingsPercent: over.yearlySavingsPercent,
      defaultSeats: over.defaultSeats,
      minSeats: over.minSeats,
      maxSeats: over.maxSeats,
      maxCaseStudies: over.maxCaseStudies,
      customSlugEnabled: over.customSlugEnabled,
      watermarkEnabled: over.watermarkEnabled,
      highlighted: cmsPricing.popularTier === tier,
      features: over.features,
      ctaLabel: over.ctaLabel,
      badgeLabel: over.badgeLabel,
    };
  };

  const teamMapped = mapTier("team");
  return {
    free: mapTier("free"),
    pro: mapTier("pro"),
    team: teamMapped,
    plus: { ...teamMapped, tier: "plus" },
  };
}

export function computeTeamsPriceWithCms(
  seatsInput: number,
  interval: BillingInterval,
  teamTier: SiteCmsContent["pricing"]["tiers"]["team"] = DEFAULT_SITE_CMS_CONTENT.pricing.tiers.team,
): TeamsPriceResult {
  const minSeats = Math.max(1, teamTier.minSeats);
  const maxSeats = Math.max(minSeats, teamTier.maxSeats);
  const seats = Math.round(seatsInput || 0);

  if (!Number.isInteger(seatsInput) || seats < minSeats) {
    return {
      ok: false,
      code: "INVALID_SEATS",
      seats: seatsInput,
      maxSelfServeSeats: maxSeats,
      message: `Teams plan requires between ${minSeats} and ${maxSeats} seats.`,
    };
  }

  if (seats > maxSeats) {
    return {
      ok: false,
      code: "CAPACITY_REVIEW_REQUIRED",
      seats: seatsInput,
      maxSelfServeSeats: maxSeats,
      message: `Self-serve Teams supports ${minSeats}–${maxSeats} seats. Contact support for ${maxSeats + 1}+ enterprise seats.`,
    };
  }

  const perSeatMonthlyCents = teamTier.monthlyPriceCents;
  const perSeatYearlyTotalCents = teamTier.yearlyTotalCents;
  const perSeatYearlyMonthlyEqCents = teamTier.yearlyMonthlyEquivalentCents;
  const monthlyTotalCents = perSeatMonthlyCents * seats;
  const yearlyTotalCents = perSeatYearlyTotalCents * seats;
  const yearlyMonthlyEquivalentCents = perSeatYearlyMonthlyEqCents * seats;
  const annualSavingsCents = Math.max(0, monthlyTotalCents * 12 - yearlyTotalCents);
  const chargeCents = interval === "yearly" ? yearlyTotalCents : monthlyTotalCents;

  return {
    ok: true,
    seats,
    interval,
    monthlyTotalCents,
    monthlyTotalUsd: Number((monthlyTotalCents / 100).toFixed(2)),
    yearlyTotalCents,
    yearlyTotalUsd: Number((yearlyTotalCents / 100).toFixed(2)),
    yearlyMonthlyEquivalentCents,
    yearlyMonthlyEquivalentUsd: Number((yearlyMonthlyEquivalentCents / 100).toFixed(2)),
    annualSavingsCents,
    annualSavingsUsd: Number((annualSavingsCents / 100).toFixed(2)),
    chargeCents,
    chargeUsd: Number((chargeCents / 100).toFixed(2)),
  };
}

export function applyCmsPaddleOverrides<
  T extends {
    pro_monthly: string;
    pro_yearly: string;
    team_monthly: string;
    team_yearly: string;
  },
>(baseMap: T, cmsPricing: SiteCmsContent["pricing"]): T {
  const ov = cmsPricing.paddlePriceOverrides;
  return {
    ...baseMap,
    pro_monthly: ov.pro_monthly.trim() || baseMap.pro_monthly,
    pro_yearly: ov.pro_yearly.trim() || baseMap.pro_yearly,
    team_monthly: ov.team_monthly.trim() || baseMap.team_monthly,
    team_yearly: ov.team_yearly.trim() || baseMap.team_yearly,
  };
}
