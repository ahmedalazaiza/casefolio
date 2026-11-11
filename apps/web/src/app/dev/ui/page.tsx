import { Globe, Layers, Plus, Smartphone } from "lucide-react";
import type { Metadata } from "next";
import { DevUiInteractive } from "@/app/dev/ui/dev-ui-interactive";
import { ThemeToggle } from "@/components/theme-toggle";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Badge, ProBadge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlanCard, ProjectCard, TemplateTypeCard } from "@/components/ui/domain-cards";
import { InputField } from "@/components/ui/input";
import { StepIndicator } from "@/components/ui/step-indicator";
import { Tag } from "@/components/ui/tag";
import { COLOR_TOKENS, RADIUS_TOKENS, TYPE_SCALE_TOKENS } from "@/lib/design-tokens";

export const metadata: Metadata = {
  title: "Design System — Casefolio /dev/ui",
  description: "Figma-synced design tokens and shadcn/ui component showcase for Casefolio.",
  robots: {
    index: false,
    follow: false,
  },
};

const PLAN_FEATURES = [
  "Unlimited projects",
  "All published templates",
  "Publish to Casefolio",
  "Export PNG & PDF",
] as const;

export default function DevUiPage() {
  return (
    <div className="bg-surface text-foreground min-h-screen">
      <header className="border-border bg-background/90 sticky top-0 z-30 border-b backdrop-blur-sm">
        <div className="mx-auto flex h-17 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
          <BrandLogo href="/dev/ui" subtitle="DESIGN SYSTEM" />
          <div className="flex items-center gap-2.5">
            <Badge tone="accent" className="hidden sm:inline-flex">
              Figma Synced
            </Badge>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <main className="mx-auto flex max-w-7xl flex-col gap-12 px-4 py-10 sm:px-6 lg:px-8">
        <section className="flex flex-col gap-3">
          <span className="text-primary type-overline">All in One · Design System</span>
          <h1 className="type-heading-l sm:type-display-m text-foreground">
            Casefolio UI Tokens & Components
          </h1>
          <p className="text-muted-foreground type-body-l max-w-3xl">
            Every color, radius, type scale style, and component variant mapped 1:1 from Figma into
            CSS custom properties and reusable primitives.
          </p>
        </section>

        {/* 1. Color Tokens */}
        <section aria-labelledby="section-colors" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">01 · Foundations</span>
            <h2 id="section-colors" className="type-heading-m text-foreground">
              Semantic Color Tokens ({COLOR_TOKENS.length})
            </h2>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {COLOR_TOKENS.map((token) => (
              <div
                key={token.figmaName}
                className="border-border bg-card flex items-center gap-3.5 rounded-lg border p-3.5"
              >
                <span
                  aria-hidden="true"
                  className="border-border size-11 shrink-0 rounded-md border"
                  style={{ backgroundColor: `var(${token.cssVar})` }}
                />
                <div className="min-w-0 flex-1">
                  <p className="text-foreground type-body-s-strong truncate">{token.figmaName}</p>
                  <p className="text-tertiary font-mono type-caption truncate">{token.cssVar}</p>
                  <p className="text-muted-foreground type-caption truncate">{token.role}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 2. Typography Scale */}
        <section aria-labelledby="section-type" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">02 · Typography</span>
            <h2 id="section-type" className="type-heading-m text-foreground">
              Type Scale ({TYPE_SCALE_TOKENS.length} styles · Geist + JetBrains Mono)
            </h2>
          </div>
          <Card variant="flat" className="divide-border divide-y overflow-hidden">
            {TYPE_SCALE_TOKENS.map((item) => (
              <div
                key={item.name}
                className="flex flex-col gap-2 p-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6"
              >
                <div className="w-44 shrink-0">
                  <p className="text-foreground type-body-s-strong">{item.name}</p>
                  <p className="text-tertiary font-mono type-caption">.{item.className}</p>
                </div>
                <p className={`${item.className} text-foreground min-w-0 flex-1 wrap-break-word`}>
                  {item.sample}
                </p>
              </div>
            ))}
            <div className="flex flex-col gap-2 p-5 sm:flex-row sm:items-baseline sm:justify-between sm:gap-6">
              <div className="w-44 shrink-0">
                <p className="text-foreground type-body-s-strong">Code / Mono</p>
                <p className="text-tertiary font-mono type-caption">.font-mono</p>
              </div>
              <p className="text-foreground font-mono type-body-s min-w-0 flex-1">
                casefolio.app/p/orbit-fintech · ratio=&quot;9:19.5&quot;
              </p>
            </div>
          </Card>
        </section>

        {/* 3. Radii */}
        <section aria-labelledby="section-radii" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">03 · Geometry</span>
            <h2 id="section-radii" className="type-heading-m text-foreground">
              Border Radius Scale
            </h2>
          </div>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {RADIUS_TOKENS.map((rad) => (
              <div
                key={rad.figmaName}
                className="border-border bg-card flex flex-col items-center gap-3 rounded-lg border p-4"
              >
                <div
                  aria-hidden="true"
                  className="border-primary bg-accent size-14 border-2"
                  style={{ borderRadius: `var(${rad.cssVar})` }}
                />
                <div className="text-center">
                  <p className="text-foreground type-body-s-strong">{rad.figmaName}</p>
                  <p className="text-tertiary font-mono type-caption">{rad.cssVar}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* 4. Buttons */}
        <section aria-labelledby="section-buttons" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">04 · Actions · Node 2:62</span>
            <h2 id="section-buttons" className="type-heading-m text-foreground">
              Buttons (5 Figma kinds × Sizes M & L)
            </h2>
          </div>
          <Card variant="flat" className="gap-6 p-6">
            <div className="flex flex-col gap-3">
              <span className="text-tertiary type-overline">Size M (Default)</span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default">
                  <Plus className="size-4" />
                  Primary action
                </Button>
                <Button variant="secondary">Secondary</Button>
                <Button variant="ghost">Ghost</Button>
                <Button variant="inverse">Inverse</Button>
                <Button variant="destructive">Danger</Button>
                <Button variant="default" disabled>
                  Disabled
                </Button>
              </div>
            </div>

            <div className="border-border flex flex-col gap-3 border-t pt-6">
              <span className="text-tertiary type-overline">Size L (Hero & Plan CTA)</span>
              <div className="flex flex-wrap items-center gap-3">
                <Button variant="default" size="lg">
                  Start free
                </Button>
                <Button variant="secondary" size="lg">
                  Browse templates
                </Button>
                <Button variant="ghost" size="lg">
                  Log in
                </Button>
                <Button variant="inverse" size="lg">
                  Upgrade to Pro
                </Button>
                <Button variant="destructive" size="lg">
                  Delete project
                </Button>
              </div>
            </div>
          </Card>
        </section>

        {/* 5. Badges, Tags & Avatars */}
        <section aria-labelledby="section-badges" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">05 · Status & Metadata · Node 2:81</span>
            <h2 id="section-badges" className="type-heading-m text-foreground">
              Badges, Pro Pill, Tags & Avatars
            </h2>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <Card variant="flat">
              <CardHeader>
                <CardTitle>Status Badges (6 Tones + ProBadge)</CardTitle>
                <CardDescription>
                  Pill status indicators with semantic leading dot.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center gap-2.5">
                <Badge tone="neutral">Neutral</Badge>
                <Badge tone="draft">Draft</Badge>
                <Badge tone="published">Published</Badge>
                <Badge tone="accent">Accent</Badge>
                <ProBadge />
                <Badge tone="danger">Danger</Badge>
              </CardContent>
            </Card>

            <Card variant="flat">
              <CardHeader>
                <CardTitle>Filter Tags & Avatar Badges</CardTitle>
                <CardDescription>
                  Category filter chips and user initials badges.
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-wrap items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-2">
                  <Tag selected>All templates</Tag>
                  <Tag>Fintech</Tag>
                  <Tag>Mobile app</Tag>
                  <Tag>SaaS</Tag>
                </div>
                <div className="flex items-center gap-2">
                  <AvatarBadge initials="AA" tone="inverse" />
                  <AvatarBadge initials="CF" tone="accent" />
                  <AvatarBadge initials="JD" tone="neutral" />
                </div>
              </CardContent>
            </Card>
          </div>
        </section>

        {/* 6. Inputs & Step Indicators */}
        <section aria-labelledby="section-inputs" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">
              06 · Form Controls & Steps · Nodes 2:102 & 2:157
            </span>
            <h2 id="section-inputs" className="type-heading-m text-foreground">
              Input States & Wizard Step Indicators
            </h2>
          </div>
          <Card variant="flat" className="gap-8 p-6">
            <div className="grid gap-5 sm:grid-cols-2">
              <InputField
                label="Case study title"
                placeholder="e.g. Orbit — Personal banking redesign"
                helperText="Shown on your public case study header."
              />
              <InputField
                label="Public slug"
                defaultValue="orbit-banking-redesign"
                helperText="casefolio.app/p/orbit-banking-redesign"
              />
              <InputField
                label="Custom domain"
                defaultValue="invalid domain"
                error="Enter a valid domain name such as work.alex.design."
              />
              <InputField
                label="Workspace ID"
                defaultValue="ws_casefolio_01"
                disabled
                helperText="Managed automatically by your organization."
              />
            </div>

            <div className="border-border flex flex-wrap items-center gap-6 border-t pt-6">
              <StepIndicator step={1} label="Choose type" state="done" />
              <StepIndicator step={2} label="Pick template" state="current" />
              <StepIndicator step={3} label="Name project" state="upcoming" />
            </div>
          </Card>
        </section>

        {/* 7. Interactive Primitives */}
        <section aria-labelledby="section-interactive" className="flex flex-col gap-5">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">07 · Interactive Primitives</span>
            <h2 id="section-interactive" className="type-heading-m text-foreground">
              Tabs, Dialog, Drawer, Dropdown & Toast
            </h2>
          </div>
          <DevUiInteractive />
        </section>

        {/* 8. Domain Cards */}
        <section aria-labelledby="section-cards" className="flex flex-col gap-8">
          <div className="flex flex-col gap-1">
            <span className="text-tertiary type-overline">
              08 · Domain Cards · Nodes 2:175, 2:243 & 2:336
            </span>
            <h2 id="section-cards" className="type-heading-m text-foreground">
              Project Cards, Template Type Cards & Plan Cards
            </h2>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            <ProjectCard
              title="Mosaed — Debt app"
              subtitle="Mobile app · Edited 2h ago"
              statusLabel="Draft"
              statusTone="draft"
            />
            <ProjectCard
              title="Orbit — Fintech wallet"
              subtitle="Mobile app · Published yesterday"
              statusLabel="Published"
              statusTone="published"
            />
            <ProjectCard skeleton />
          </div>

          <div className="grid gap-6 md:grid-cols-3">
            <TemplateTypeCard
              title="Web & SaaS"
              description="Responsive desktop and web app case studies with browser-framed slots."
              templateCount={3}
              state="default"
              icon={<Globe className="size-5" />}
            />
            <TemplateTypeCard
              title="Mobile app"
              description="Case study layouts for iOS & Android products with device-framed screen slots."
              templateCount={2}
              state="selected"
              icon={<Smartphone className="size-5" />}
            />
            <TemplateTypeCard
              title="Design system"
              description="Token, component library, and multi-brand architecture documentation layouts."
              templateCount={2}
              state="coming-soon"
              icon={<Layers className="size-5" />}
            />
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <PlanCard
              name="Free"
              price="$0"
              period="/mo"
              badgeLabel="Starter"
              description="Everything you need to build and publish your first case study."
              ctaLabel="Start free"
              features={[
                "1 active case study project",
                "Free community templates",
                "Public share link with Casefolio badge",
                "1 watermarked export per month",
              ]}
            />
            <PlanCard
              name="Pro"
              price="$12"
              period="/mo"
              badgeLabel="Popular"
              description="Unlimited projects, Pro templates, clean exports, and custom branding."
              ctaLabel="Choose Pro"
              highlighted
              features={PLAN_FEATURES}
            />
          </div>
        </section>
      </main>
    </div>
  );
}

