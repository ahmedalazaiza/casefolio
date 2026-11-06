import {
  CheckCircle2,
  Eye,
  History,
  Image as ImageIcon,
  Layers,
  Monitor,
  Palette,
  Presentation,
  Smartphone,
  TabletSmartphone,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import type { ReactNode } from "react";
import { LandingFaqAccordion } from "@/components/marketing/landing-faq-accordion";
import { LandingHeroMotion } from "@/components/marketing/landing-hero-motion";
import { LandingHeroVisual } from "@/components/marketing/landing-hero-visual";
import { LandingPricingSection } from "@/components/marketing/landing-pricing-section";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { TemplateTypeCard } from "@/components/ui/domain-cards";

export const metadata: Metadata = {
  title: "Casefolio — Turn Finished Projects Into Publishable Case Studies",
  description:
    "Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a public page or export PNG & PDF in minutes, not weeks.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Casefolio — Turn Finished Projects Into Publishable Case Studies",
    description:
      "Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a public page or export PNG & PDF in minutes.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Casefolio — Turn Finished Projects Into Publishable Case Studies",
    description:
      "Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a public page or export PNG & PDF in minutes.",
  },
};

const STUDIO_LOGOS = [
  "Linear Studio",
  "Northstar",
  "Atelier UI",
  "Kinetix",
  "Monolith",
  "Vesper Labs",
] as const;

const PROBLEM_CARDS = [
  {
    metric: "2–4 wks",
    title: "Building layouts from zero",
    description:
      "Every case study starts with an empty artboard, grids and mockups.",
  },
  {
    metric: "10+",
    title: "Screens to frame by hand",
    description:
      "Placing phone and browser mockups one by one, then re-exporting.",
  },
  {
    metric: "0",
    title: "Consistency between projects",
    description:
      "Each case study looks different, so the portfolio feels unfinished.",
  },
] as const;

const HOW_IT_WORKS_STEPS = [
  {
    step: "1",
    title: "Pick a type",
    description: "Mobile app, Website, or both in one case study.",
  },
  {
    step: "2",
    title: "Pick a template",
    description:
      "Layouts designed by the Casefolio team, versioned and ready.",
  },
  {
    step: "3",
    title: "Customize",
    description:
      "Replace screens in slots, edit text, colors and fonts, reorder sections.",
  },
  {
    step: "4",
    title: "Publish or export",
    description: "A public page on casefolio.app, or PNG & PDF files.",
  },
] as const;

const EDITOR_FEATURES = [
  {
    icon: ImageIcon,
    title: "Swap screens in slots",
    description:
      "Drop PNG/JPG into phone or browser slots — crop and replace anytime.",
  },
  {
    icon: Palette,
    title: "Your colors & fonts",
    description:
      "Edit template tokens: primary, secondary, background, text, heading & body fonts.",
  },
  {
    icon: Layers,
    title: "Sections your way",
    description:
      "Reorder, hide optional sections, or add testimonial, before/after and more.",
  },
  {
    icon: Eye,
    title: "Live preview",
    description:
      "Desktop & mobile preview rendered exactly like publish and export.",
  },
  {
    icon: History,
    title: "Autosave & versions",
    description:
      "Every change is saved, with version history to roll back.",
  },
  {
    icon: CheckCircle2,
    title: "Pre-publish check",
    description:
      "Warns you about empty required slots before going live.",
  },
] as const;

const ANALYTICS_METRICS = [
  { value: "2,840", label: "Page views" },
  { value: "1,910", label: "Unique visitors" },
  { value: "2:45", label: "Avg. time on page" },
  { value: "42%", label: "Visitors from LinkedIn" },
] as const;

const TESTIMONIALS = [
  {
    quote:
      "“I published my first case study the same afternoon I finished the project.”",
    author: "Nadia Al-Mansoor",
    role: "Senior Product Designer · Mosaed",
    initials: "NA",
  },
  {
    quote: "“Slots for screens saved me hours of placing mockups by hand.”",
    author: "Lucas Lindqvist",
    role: "Staff Designer · Northstar",
    initials: "LL",
  },
  {
    quote:
      "“My portfolio finally looks consistent across every project.”",
    author: "Priya Ramanathan",
    role: "Lead UI Designer · Atelier UI",
    initials: "PR",
  },
] as const;

function SectionHeader({
  overline,
  title,
  description,
}: {
  overline: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="mx-auto flex max-w-3xl flex-col items-center gap-3 text-center">
      <p className="text-accent-foreground type-overline">{overline}</p>
      <h2 className="text-foreground type-display-m sm:type-heading-l">{title}</h2>
      {description && (
        <p className="text-muted-foreground type-body-l max-w-2xl">
          {description}
        </p>
      )}
    </div>
  );
}

function StatusPill({
  tone,
  children,
}: {
  tone: "success" | "accent" | "warning" | "neutral";
  children: ReactNode;
}) {
  const styles = {
    success: {
      pill: "bg-success-soft text-foreground",
      dot: "bg-success",
    },
    accent: {
      pill: "bg-accent text-accent-foreground",
      dot: "bg-accent-foreground",
    },
    warning: {
      pill: "bg-warning-soft text-foreground",
      dot: "bg-warning",
    },
    neutral: {
      pill: "bg-sunken text-muted-foreground",
      dot: "bg-muted-foreground",
    },
  }[tone];

  return (
    <span
      className={`type-caption inline-flex shrink-0 items-center gap-1.5 rounded-full px-2.5 py-0.5 ${styles.pill}`}
    >
      <span aria-hidden="true" className={`size-1.5 rounded-full ${styles.dot}`} />
      {children}
    </span>
  );
}

export default function HomePage() {
  return (
    <div className="flex flex-col">
      {/* 1. Hero section (Figma 27:6694) */}
      <section className="bg-background px-4 pt-14 pb-16 sm:px-6 lg:px-8 lg:pt-20 lg:pb-24">
        <LandingHeroMotion visual={<LandingHeroVisual />}>
          <Badge tone="accent">New · Mobile &amp; Website templates</Badge>

          <h1 className="text-foreground type-display-l sm:type-display-xl text-balance">
            Turn finished projects into publishable case studies
          </h1>

          <p className="text-muted-foreground type-body-l max-w-2xl text-pretty">
            Pick a template made by the Casefolio team, drop in your screens,
            tweak colors and text — then publish a public page or export PNG
            &amp; PDF in minutes, not weeks.
          </p>

          <div className="flex w-full flex-col items-stretch justify-center gap-3 pt-1 sm:w-auto sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">Start free</Link>
            </Button>
            <Button variant="secondary" size="lg" asChild>
              <Link href="/templates">Browse templates</Link>
            </Button>
          </div>

          <p className="text-muted-foreground type-caption">
            Start free · No credit card required
          </p>
        </LandingHeroMotion>
      </section>

      {/* 2. Social proof strip (Figma 27:6713) */}
      <section
        id="about"
        aria-label="Trusted by designers"
        className="border-border bg-background border-t px-4 py-12 sm:px-6 lg:px-8 lg:py-14"
      >
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-6">
          <p className="text-muted-foreground type-overline text-center">
            Trusted by designers from
          </p>
          <div className="grid w-full max-w-5xl grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {STUDIO_LOGOS.map((studio) => (
              <div
                key={studio}
                className="bg-surface border-border text-muted-foreground type-body-s-strong flex h-12 items-center justify-center rounded-md border px-4"
              >
                {studio}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 3. Problem section (Figma 27:6728) */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="The problem"
            title="Case studies take longer than the project"
            description="Designers finish the UI, then lose weeks laying out a portfolio case study from scratch. So most great work never gets shown."
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {PROBLEM_CARDS.map((card) => (
              <article
                key={card.title}
                className="border-border bg-card flex flex-col gap-3 rounded-xl border p-7 sm:p-8"
              >
                <p className="text-destructive type-display-m">{card.metric}</p>
                <h3 className="text-foreground type-heading-s">{card.title}</h3>
                <p className="text-muted-foreground type-body-s">
                  {card.description}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 4. How it works section (Figma 28:6665) */}
      <section
        id="how-it-works"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="How it works"
            title="From finished UI to case study in four steps"
            description="No blank canvas. Every step is guided, and you can change anything later."
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {HOW_IT_WORKS_STEPS.map((item) => (
              <article
                key={item.step}
                className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6"
              >
                <span className="bg-accent text-accent-foreground type-body-s-strong inline-flex size-10 items-center justify-center rounded-full">
                  {item.step}
                </span>
                <div className="flex flex-col gap-1.5">
                  <h3 className="text-foreground type-heading-s">
                    {item.title}
                  </h3>
                  <p className="text-muted-foreground type-body-s">
                    {item.description}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 5. Template types section (Figma 28:6691) */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Template types"
            title="Templates for what you actually design"
            description="Choose a type first — we only show layouts built for it."
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            <TemplateTypeCard
              title="Mobile app"
              description="iOS & Android flows with phone screen slots and vertical user journeys."
              templateCount={2}
              icon={<Smartphone className="size-5" />}
            />
            <TemplateTypeCard
              title="Website"
              description="Marketing sites, SaaS products and responsive web apps in browser frames."
              templateCount={2}
              icon={<Monitor className="size-5" />}
            />
            <TemplateTypeCard
              title="Mobile + Web"
              description="Cross-platform ecosystems combining mobile screens and desktop views."
              templateCount={1}
              icon={<TabletSmartphone className="size-5" />}
            />
            <TemplateTypeCard
              title="Brand & Deck"
              description="Visual identity systems, design language guides and pitch narratives."
              footerLabel="Coming soon"
              state="coming-soon"
              icon={<Presentation className="size-5" />}
            />
          </div>
        </div>
      </section>

      {/* 6. Template gallery section (Figma 28:6761) */}
      <section className="bg-background px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col items-center gap-12 lg:gap-14">
          <SectionHeader
            overline="Template gallery"
            title="Start from a layout that already works"
            description="Designed, versioned and maintained by the Casefolio team."
          />

          <div className="grid w-full grid-cols-1 gap-6 md:grid-cols-3">
            {/* Orbit card */}
            <Link
              href="/templates"
              className="border-border bg-card hover:border-border-strong focus-visible:ring-ring/40 group flex flex-col gap-4 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-2"
            >
              <div
                aria-hidden="true"
                className="bg-[var(--tmpl-bg)] text-[var(--tmpl-text)] flex h-64 flex-col justify-between overflow-hidden rounded-lg p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="type-caption">Mosaed</span>
                  <span className="text-[var(--tmpl-primary)] type-overline">
                    2026
                  </span>
                </div>
                <div>
                  <p className="type-heading-m">Debt, finally under control</p>
                  <p className="text-[var(--tmpl-muted)] type-caption mt-1">
                    Calm personal debt planner
                  </p>
                </div>
                <div className="grid grid-cols-3 gap-2 pt-2">
                  <span className="h-16 rounded-t-md bg-gradient-to-b from-[var(--tmpl-primary)]/90 to-[var(--tmpl-primary)]/40 transition-transform group-hover:-translate-y-0.5" />
                  <span className="from-primary/90 to-primary/45 h-16 rounded-t-md bg-gradient-to-b transition-transform group-hover:-translate-y-1" />
                  <span className="bg-[var(--tmpl-surface)] border-[var(--tmpl-line)] h-16 rounded-t-md border transition-transform group-hover:-translate-y-0.5" />
                </div>
              </div>
              <div className="flex flex-col gap-1 px-1 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-foreground type-heading-s">Orbit</h3>
                  <StatusPill tone="success">Free</StatusPill>
                </div>
                <p className="text-muted-foreground type-body-s">
                  Mobile app · Hero · flows · screens grid
                </p>
              </div>
            </Link>

            {/* Frame card */}
            <Link
              href="/templates"
              className="border-border bg-card hover:border-border-strong focus-visible:ring-ring/40 group flex flex-col gap-4 rounded-xl border p-4 transition-colors outline-none focus-visible:ring-2"
            >
              <div
                aria-hidden="true"
                className="border-border bg-surface text-foreground flex h-64 flex-col justify-between overflow-hidden rounded-lg border p-5"
              >
                <div className="flex items-center justify-between">
                  <span className="type-caption">Vesper Credit</span>
                  <span className="text-muted-foreground type-overline">
                    Web · SaaS
                  </span>
                </div>
                <div>
                  <p className="type-heading-m">Giving credit human eyes</p>
                  <p className="text-muted-foreground type-caption mt-1">
                    Underwriting workspace redesign
                  </p>
                </div>
                <div className="from-primary/85 to-accent-foreground/55 h-20 w-full rounded-t-md bg-gradient-to-r transition-transform group-hover:-translate-y-0.5" />
              </div>
              <div className="flex flex-col gap-1 px-1 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-foreground type-heading-s">Frame</h3>
                  <StatusPill tone="success">Free</StatusPill>
                </div>
                <p className="text-muted-foreground type-body-s">
                  Website · Challenge · approach · key pages
                </p>
              </div>
            </Link>

            {/* Pocket card */}
            <div className="border-border bg-card flex flex-col gap-4 rounded-xl border p-4">
              <div
                aria-hidden="true"
                className="bg-sunken text-muted-foreground flex h-64 items-center justify-center rounded-lg p-5 text-center"
              >
                <span className="type-body-s">Preview coming soon</span>
              </div>
              <div className="flex flex-col gap-1 px-1 pb-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-foreground type-heading-s">Pocket</h3>
                  <StatusPill tone="neutral">Soon</StatusPill>
                </div>
                <p className="text-muted-foreground type-body-s">
                  Mobile app · Story-led · big mockups
                </p>
              </div>
            </div>
          </div>

          <Button variant="secondary" size="lg" asChild>
            <Link href="/templates">Browse all templates</Link>
          </Button>
        </div>
      </section>

      {/* 7. Editor features section (Figma 28:6796) */}
      <section
        id="product"
        className="bg-surface scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="The editor"
            title="A full editor, without the busywork"
            description="Everything a template defines is editable — nothing you need to rebuild."
          />

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {EDITOR_FEATURES.map((feature) => {
              const Icon = feature.icon;
              return (
                <article
                  key={feature.title}
                  className="border-border bg-card flex flex-col gap-4 rounded-xl border p-6 sm:p-7"
                >
                  <span
                    aria-hidden="true"
                    className="bg-accent text-accent-foreground inline-flex size-10 items-center justify-center rounded-md"
                  >
                    <Icon className="size-5" />
                  </span>
                  <div className="flex flex-col gap-1.5">
                    <h3 className="text-foreground type-heading-s">
                      {feature.title}
                    </h3>
                    <p className="text-muted-foreground type-body-s">
                      {feature.description}
                    </p>
                  </div>
                </article>
              );
            })}
          </div>
        </div>
      </section>

      {/* 8. Publish & export section (Figma 29:6726) */}
      <section
        id="publish-export"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Publish, share & export"
            title="One case study, everywhere you need it"
            description="Publish a public page with your own link, or export files for Behance, Dribbble and PDF portfolios."
          />

          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {/* Publish card */}
            <article className="border-border bg-card flex flex-col justify-between gap-6 rounded-xl border p-7 sm:p-8">
              <div className="flex flex-col gap-3">
                <div>
                  <StatusPill tone="success">Published</StatusPill>
                </div>
                <h3 className="text-foreground type-heading-m">
                  A public page on casefolio.app
                </h3>
                <p className="text-muted-foreground type-body-m">
                  Public or unlisted, editable slug, SEO &amp; social preview,
                  update when you are ready.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <span className="text-foreground font-mono type-body-s truncate">
                    casefolio.app/p/mosaed-smart-debt
                  </span>
                  <StatusPill tone="success">Live</StatusPill>
                </div>
                <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <span className="text-foreground type-body-s">
                    SEO &amp; social preview
                  </span>
                  <StatusPill tone="success">Ready</StatusPill>
                </div>
              </div>
            </article>

            {/* Export card */}
            <article className="border-border bg-card flex flex-col justify-between gap-6 rounded-xl border p-7 sm:p-8">
              <div className="flex flex-col gap-3">
                <div>
                  <StatusPill tone="accent">Export</StatusPill>
                </div>
                <h3 className="text-foreground type-heading-m">
                  PNG &amp; PDF that match the preview
                </h3>
                <p className="text-muted-foreground type-body-m">
                  Exports use the same renderer as the editor, so files look
                  exactly like what you designed.
                </p>
              </div>

              <div className="flex flex-col gap-2.5">
                <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <span className="text-foreground type-body-s">
                    PNG · Long image, high-res
                  </span>
                  <StatusPill tone="success">Free</StatusPill>
                </div>
                <div className="border-border bg-surface flex items-center justify-between gap-3 rounded-lg border px-4 py-3">
                  <span className="text-foreground type-body-s">
                    PDF · Paged document
                  </span>
                  <StatusPill tone="warning">Pro plan</StatusPill>
                </div>
              </div>
            </article>
          </div>
        </div>
      </section>

      {/* 9. Analytics section (Figma 29:6764) */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Analytics"
            title="Know who is reading your work"
            description="See views, visitors and where they came from for every published case study."
          />

          <div className="grid grid-cols-2 gap-4 sm:gap-6 lg:grid-cols-4">
            {ANALYTICS_METRICS.map((metric) => (
              <div
                key={metric.label}
                className="border-border bg-card flex flex-col gap-2 rounded-xl border p-6 sm:p-7"
              >
                <p className="text-foreground type-display-m">{metric.value}</p>
                <p className="text-muted-foreground type-body-s">
                  {metric.label}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 10. Pricing section (Figma 29:6782) */}
      <section
        id="pricing"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Pricing"
            title="Simple plans for every designer"
            description="Start free with two projects — upgrade anytime for unlimited case studies, unwatermarked PNG & PDF exports, and full analytics."
          />

          <LandingPricingSection />
        </div>
      </section>

      {/* 11. Testimonials section (Figma 29:6886) */}
      <section className="bg-surface px-4 py-20 sm:px-6 lg:px-8 lg:py-28">
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="Designer stories"
            title="Designers ship case studies faster"
            description="Built for product designers, design leads and independent studios."
          />

          <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((item) => (
              <blockquote
                key={item.author}
                className="border-border bg-card flex flex-col justify-between gap-6 rounded-xl border p-6 sm:p-7"
              >
                <p className="text-foreground type-body-m">{item.quote}</p>
                <footer className="flex items-center gap-3">
                  <AvatarBadge initials={item.initials} tone="inverse" />
                  <div>
                    <p className="text-foreground type-body-s-strong">
                      {item.author}
                    </p>
                    <p className="text-muted-foreground type-caption">
                      {item.role}
                    </p>
                  </div>
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      {/* 12. FAQ section (Figma 29:6916) */}
      <section
        id="faq"
        className="bg-background scroll-mt-24 px-4 py-20 sm:px-6 lg:px-8 lg:py-28"
      >
        <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:gap-14">
          <SectionHeader
            overline="FAQ"
            title="Questions, answered"
            description="Everything you need to know about templates, exports and plans."
          />

          <LandingFaqAccordion />
        </div>
      </section>

      {/* 13. Final CTA box (Figma 29:6943) */}
      <section className="bg-background px-4 pt-4 pb-20 sm:px-6 lg:px-8 lg:pb-28">
        <div className="bg-inverse text-inverse-foreground mx-auto flex max-w-7xl flex-col items-center gap-6 rounded-xl px-6 py-16 text-center sm:px-12 lg:py-24">
          <h2 className="type-display-m sm:type-display-l max-w-2xl text-balance">
            Your next case study is one template away
          </h2>
          <p className="text-inverse-foreground/80 type-body-l max-w-xl">
            Start free — publish your first case study today.
          </p>
          <div className="flex w-full flex-col items-stretch justify-center gap-3 pt-2 sm:w-auto sm:flex-row sm:items-center">
            <Button size="lg" asChild>
              <Link href="/sign-up">Start free</Link>
            </Button>
            <Button
              variant="secondary"
              size="lg"
              className="bg-inverse-foreground/12 text-inverse-foreground hover:bg-inverse-foreground/20 border-0"
              asChild
            >
              <Link href="/templates">Browse templates</Link>
            </Button>
          </div>
        </div>
      </section>
    </div>
  );
}
