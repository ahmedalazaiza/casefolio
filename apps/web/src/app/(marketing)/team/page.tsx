import {
  ArrowRight,
  Code2,
  Compass,
  Cpu,
  Layers,
  Mail,
  Palette,
  Sparkles,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import {
  HighlightUnfurl,
  Reveal,
  SectionStackSheet,
} from "@/components/marketing/motion";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Our Team — Casefolio",
  description:
    "Meet the product designers, design-systems architects, and rendering engineers building Casefolio Studio.",
};

interface TeamMember {
  id: string;
  initials: string;
  name: string;
  role: string;
  discipline: string;
  location: string;
  bio: string;
  focus: readonly string[];
  tone: "royal" | "ink" | "lime";
}

const TEAM_MEMBERS: readonly TeamMember[] = [
  {
    id: "01",
    initials: "AA",
    name: "Ahmed Al-Azaiza",
    role: "Founder & Product Direction",
    discipline: "Product & Architecture",
    location: "Studio Lead",
    bio: "Obsessed with eliminating portfolio friction for UI/UX designers through opinionated layout systems and crisp editorial craft.",
    focus: ["Product Strategy", "Design Direction", "Studio Quality"],
    tone: "royal",
  },
  {
    id: "02",
    initials: "LN",
    name: "Lina Nassar",
    role: "Principal Template Architect",
    discipline: "Editorial Systems",
    location: "Design Systems",
    bio: "Designs every curated Casefolio template from grid rhythm and Swiss typography scales to mobile and desktop mockup proportions.",
    focus: ["Grid Systems", "Art Direction", "WCAG Tokens"],
    tone: "lime",
  },
  {
    id: "03",
    initials: "KM",
    name: "Kareem Mansour",
    role: "Lead Editor & Rendering Engineer",
    discipline: "Canvas & Puck Engine",
    location: "Core Platform",
    bio: "Architects the constrained visual editor, instant undo/redo state graph, and zero-drift renderer shared across web and exports.",
    focus: ["Constrained Canvas", "State Engine", "60fps Motion"],
    tone: "ink",
  },
  {
    id: "04",
    initials: "SR",
    name: "Sara Haddad",
    role: "Design Systems & Accessibility",
    discipline: "UI Primitives",
    location: "Frontend Craft",
    bio: "Leads our flat studio token architecture, keyboard navigation flows, and contrast guardrails across light and dark workspaces.",
    focus: ["Design Tokens", "A11y Guardrails", "Micro-interactions"],
    tone: "royal",
  },
  {
    id: "05",
    initials: "OT",
    name: "Omar Tariq",
    role: "Export & Media Pipeline Lead",
    discipline: "Cloud & Chromium",
    location: "Infrastructure",
    bio: "Builds deterministic 2x PNG, Behance 1400px, and A4 PDF rendering workers alongside automatic EXIF-stripping upload pipelines.",
    focus: ["PDF & Behance", "Image Security", "Edge Delivery"],
    tone: "ink",
  },
  {
    id: "06",
    initials: "nh",
    name: "Noor Faris",
    role: "Designer Success & Curation",
    discipline: "Community & Reviews",
    location: "Studio Desk",
    bio: "Partners with senior hiring managers, design leads, and agencies to benchmark what makes a case study land interviews and clients.",
    focus: ["Portfolio Reviews", "Template QA", "Studio Support"],
    tone: "lime",
  },
];

const OPERATING_PRINCIPLES = [
  {
    icon: Palette,
    title: "Designers & engineers in one loop",
    body: "Every template and editor panel is built directly in code by people who ship both typography tokens and production TypeScript.",
  },
  {
    icon: Cpu,
    title: "Deterministic rendering everywhere",
    body: "We never approximate previews. What you edit on canvas is rendered by the exact same component tree on your live URL and PDF export.",
  },
  {
    icon: Compass,
    title: "Small senior team, fast iteration",
    body: "Staying focused lets us ship weekly template releases, listen directly to working designers, and keep the studio fast and uncluttered.",
  },
] as const;

function avatarBadgeClass(tone: TeamMember["tone"]) {
  if (tone === "royal") {
    return "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]";
  }
  if (tone === "lime") {
    return "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]";
  }
  return "bg-[var(--cf-ink)] text-[var(--cf-text-on-ink)]";
}

export default function TeamPage() {
  return (
    <div className="relative flex flex-col overflow-x-clip bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      {/* 1. Architectural Grid Hero */}
      <section className="v3-pattern-grid relative z-10 overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div className="v3-container flex flex-col items-center text-center">
          <Eyebrow step="01">Our Studio Team</Eyebrow>

          <h1 className="v3-display-xl mt-5 max-w-4xl text-balance text-[var(--cf-text-primary)]">
            Designers and engineers obsessed with{" "}
            <span className="v3-sticker-lime">portfolio craft</span>
          </h1>

          <p className="v3-body-l mt-5 max-w-2xl text-pretty text-[var(--cf-text-secondary)]">
            We are a multidisciplinary studio team uniting Swiss editorial design,
            design-systems rigor, and high-precision browser rendering.
          </p>

          <div className="mt-7 flex flex-wrap items-center justify-center gap-2.5">
            <span className="inline-flex items-center gap-2 rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cf-text-primary)]">
              <Layers className="size-3.5 text-[var(--cf-royal-text)]" />
              <span>Design Systems</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cf-text-primary)]">
              <Code2 className="size-3.5 text-[var(--cf-royal-text)]" />
              <span>Layout & Export Engine</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3.5 py-1.5 text-xs font-semibold text-[var(--cf-text-primary)]">
              <Sparkles className="size-3.5 text-[var(--cf-royal-text)]" />
              <span>Curated Editorial Direction</span>
            </span>
          </div>
        </div>
      </section>

      {/* 2. Overlapping Elevated Sheet — 3-Per-Row Studio Roster */}
      <SectionStackSheet
        overlapY={44}
        startScale={0.982}
        recedeOnExit
        className="z-20 -mt-8 lg:-mt-12"
      >
        <section className="v3-sheet-elevated rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pt-14 pb-20 sm:rounded-t-[2.75rem] sm:pt-20 sm:pb-28 lg:rounded-t-[3.5rem]">
          <div className="v3-container flex flex-col gap-12">
            <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
              <div>
                <Eyebrow>Core Roster</Eyebrow>
                <h2 className="v3-display-l mt-3 text-[var(--cf-text-primary)]">
                  The people behind the studio
                </h2>
              </div>
              <p className="v3-body-s max-w-md text-[var(--cf-text-secondary)]">
                Every layout, token preset, and export slice is crafted in-house
                by our core product and editorial team.
              </p>
            </div>

            <Reveal
              stagger
              className="grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3"
            >
              {TEAM_MEMBERS.map((member) => (
                <article
                  key={member.id}
                  className="group flex flex-col justify-between gap-5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 transition-all duration-200 hover:-translate-y-1 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]"
                >
                  <div className="flex flex-col gap-4">
                    {/* Top Spec Strip */}
                    <div className="flex items-center justify-between gap-3 border-b border-[var(--cf-border-subtle)] pb-3.5">
                      <span className="rounded-xs border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2 py-0.5 font-mono text-xs font-semibold text-[var(--cf-text-secondary)]">
                        {member.id} · {member.discipline}
                      </span>
                      <span className="text-xs font-medium text-[var(--cf-text-tertiary)]">
                        {member.location}
                      </span>
                    </div>

                    {/* Geometric Monogram + Identity */}
                    <div className="flex items-center gap-3.5">
                      <span
                        aria-hidden="true"
                        className={`inline-flex size-12 shrink-0 items-center justify-center rounded-xl font-mono text-sm font-bold uppercase ${avatarBadgeClass(member.tone)}`}
                      >
                        {member.initials}
                      </span>
                      <div className="min-w-0">
                        <h3 className="truncate text-lg font-bold tracking-tight text-[var(--cf-text-primary)] transition-colors group-hover:text-[var(--cf-royal-text)]">
                          {member.name}
                        </h3>
                        <p className="truncate text-xs font-semibold text-[var(--cf-royal-text)]">
                          {member.role}
                        </p>
                      </div>
                    </div>

                    <p className="v3-body-s leading-relaxed text-[var(--cf-text-secondary)]">
                      {member.bio}
                    </p>
                  </div>

                  {/* Craft Specialty Pills */}
                  <div className="flex flex-wrap gap-1.5 border-t border-[var(--cf-border-subtle)] pt-3.5">
                    {member.focus.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-xs border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2 py-0.5 text-[0.6875rem] font-semibold text-[var(--cf-text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                </article>
              ))}
            </Reveal>

            {/* How We Operate Strip */}
            <div className="mt-4 flex flex-col gap-8 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] p-6 sm:p-8 lg:p-10">
              <HighlightUnfurl className="flex flex-col gap-2">
                <span className="v3-label text-[var(--cf-royal-text)] uppercase">
                  Studio Culture
                </span>
                <h3 className="v3-heading-l text-[var(--cf-text-primary)]">
                  How we build{" "}
                  <span className="v3-highlight">Casefolio</span> every week
                </h3>
              </HighlightUnfurl>

              <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
                {OPERATING_PRINCIPLES.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.title}
                      className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5"
                    >
                      <span className="inline-flex size-9 items-center justify-center rounded-md bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
                        <Icon className="size-4" />
                      </span>
                      <h4 className="text-base font-bold text-[var(--cf-text-primary)]">
                        {item.title}
                      </h4>
                      <p className="text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
                        {item.body}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </section>
      </SectionStackSheet>

      {/* 3. Overlapping Royal Blue Contact / Collaborate Sheet */}
      <SectionStackSheet
        overlapY={40}
        startScale={0.985}
        className="z-30 -mt-8 lg:-mt-12"
      >
        <section className="v3-pattern-dots-dark v3-sheet-royal overflow-hidden rounded-t-[2rem] pt-14 sm:rounded-t-[2.75rem] lg:rounded-t-[3.5rem] lg:pt-20">
          <div className="v3-container flex flex-col items-center pb-16 text-center lg:pb-20">
            <span className="v3-label mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-on-royal)] bg-[var(--cf-bg-inverse-elevated)] px-3.5 py-1 text-[var(--cf-bg-accent)] uppercase">
              <Mail className="size-3.5" />
              <span>Connect With Us</span>
            </span>
            <h2 className="v3-display-l max-w-2xl text-[var(--cf-text-inverse)]">
              Want to collaborate or{" "}
              <span className="v3-sticker-lime">suggest a layout</span>?
            </h2>
            <p className="v3-body-l mt-4 max-w-xl text-[var(--cf-text-inverse-muted)]">
              Whether you run a design boot camp, lead a product team, or have an
              idea for our next template release, our team reads every note.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link
                href="/help/contact"
                className="v3-btn-lime focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                <span>Message our team</span>
                <ArrowRight className="size-4 stroke-[2.5]" />
              </Link>
              <Link
                href="/about"
                className="v3-btn-secondary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
              >
                <span>Read our story</span>
              </Link>
            </div>
          </div>

          <div aria-hidden="true" className="flex flex-col">
            <div className="h-1.5 w-full bg-[var(--cf-royal)]" />
            <div className="h-2 w-full bg-[var(--cf-bg-accent)]" />
          </div>
        </section>
      </SectionStackSheet>
    </div>
  );
}
