import {
  ArrowRight,
  CheckCircle2,
  CreditCard,
  FileCheck2,
  Scale,
  ShieldAlert,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { SectionStackSheet } from "@/components/marketing/motion";
import { Eyebrow } from "@/components/ui/eyebrow";

export const metadata: Metadata = {
  title: "Terms of Use — Casefolio",
  description:
    "Read the Terms of Use governing your Casefolio workspace, 100% designer content ownership, published links, exports, and Paddle subscription billing.",
};

const QUICK_HIGHLIGHTS = [
  {
    icon: FileCheck2,
    title: "100% Your Intellectual Property",
    detail:
      "You own every screen, narrative, logo, and exported case study you create in Casefolio.",
  },
  {
    icon: CreditCard,
    title: "Transparent Paddle Billing",
    detail:
      "Upgrade, switch intervals, or cancel anytime in one click—access continues until period end.",
  },
  {
    icon: ShieldAlert,
    title: "Clear Acceptable Use",
    detail:
      "Publish work you have rights to share and respect NDA/confidentiality commitments.",
  },
] as const;

const TERMS_CLAUSES = [
  {
    id: "eligibility",
    step: "01",
    title: "Workspace Eligibility & Account Security",
    summary: "Who can operate a Casefolio workspace and how credentials are protected.",
    body: "By creating a Casefolio account, you confirm that you are at least 16 years old (or the minimum legal age of digital consent in your jurisdiction) and authorized to agree to these Terms of Use on behalf of yourself or your studio. You are responsible for maintaining the confidentiality of your login credentials, passkeys, or OAuth sessions and for all activity conducted within your workspace.",
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
    summary: "How Pro and Team plans are billed globally via Paddle.",
    body: "Paid subscriptions (Pro and Team) are processed through Paddle, our authorized Merchant of Record, which handles global payment methods, invoicing, and regional VAT/sales tax compliance. Subscriptions renew automatically on your selected monthly or annual billing cycle unless canceled prior to renewal.",
  },
  {
    id: "cancellation",
    step: "06",
    title: "Plan Changes, Cancellation & Workspace Retention",
    summary: "What happens when you downgrade or cancel a paid subscription.",
    body: "You can cancel or modify your subscription at any time from Account → Billing. When canceled, paid features remain active through the end of your current paid billing period. Afterward, your workspace transitions gracefully to Free tier limits without deleting your underlying draft content, so you never lose your writing or uploaded assets unexpectedly.",
  },
  {
    id: "liability",
    step: "07",
    title: "Service Availability, Warranties & Contact",
    summary: "Platform reliability commitments, limitation of liability, and updates.",
    body: "We engineer Casefolio for high availability, automated backups, and deterministic exports, but the service is provided on an 'as is' and 'as available' basis to the maximum extent permitted by applicable law. Casefolio's aggregate liability for any claim relating to the service shall not exceed the fees paid by you in the twelve (12) months preceding the claim. If we make material updates to these Terms, we will notify workspace owners in advance.",
  },
] as const;

export default function TermsPage() {
  return (
    <div className="relative flex flex-col overflow-x-clip bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      {/* 1. Architectural Grid Hero */}
      <section className="v3-pattern-grid relative z-10 overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div className="v3-container flex flex-col gap-10">
          <div className="flex max-w-3xl flex-col items-start gap-4">
            <Eyebrow step="01" icon={<Scale />}>
              Studio Legal Agreement
            </Eyebrow>
            <h1 className="v3-display-xl text-balance text-[var(--cf-text-primary)]">
              Terms of <span className="v3-sticker-lime">use</span>
            </h1>
            <p className="v3-body-l text-[var(--cf-text-secondary)]">
              Clear, designer-friendly terms governing your Casefolio workspace,
              intellectual property rights, published links, and subscription
              billing.
            </p>
            <p className="font-mono text-xs font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
              Effective April 15, 2026 · Version 2.0
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {QUICK_HIGHLIGHTS.map((item) => {
              const Icon = item.icon;
              return (
                <div
                  key={item.title}
                  className="flex flex-col gap-2.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5"
                >
                  <div className="flex items-center gap-2.5">
                    <span className="inline-flex size-8 items-center justify-center rounded-md bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
                      <Icon className="size-4" />
                    </span>
                    <h2 className="text-sm font-bold text-[var(--cf-text-primary)]">
                      {item.title}
                    </h2>
                  </div>
                  <p className="text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
                    {item.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Overlapping Elevated Sheet — Sticky TOC + Clause Cards */}
      <SectionStackSheet
        overlapY={44}
        startScale={0.985}
        className="z-20 -mt-8 lg:-mt-12"
      >
        <section className="v3-sheet-elevated rounded-t-[2rem] border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] pt-12 pb-20 sm:rounded-t-[2.75rem] sm:pt-16 sm:pb-28 lg:rounded-t-[3.5rem]">
          <div className="v3-container grid grid-cols-1 items-start gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
            {/* Left Sticky Index */}
            <aside
              aria-label="Terms of use sections"
              className="flex flex-col gap-4 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5 lg:sticky lg:top-24"
            >
              <p className="v3-label text-[var(--cf-text-tertiary)] uppercase">
                Clauses (01–07)
              </p>
              <nav className="flex flex-col gap-1">
                {TERMS_CLAUSES.map((clause) => (
                  <a
                    key={clause.id}
                    href={`#${clause.id}`}
                    className="focus-visible:ring-ring/40 flex items-center gap-2.5 rounded-md px-2.5 py-2 text-xs font-semibold text-[var(--cf-text-secondary)] transition-colors outline-none hover:bg-[var(--cf-bg-surface)] hover:text-[var(--cf-royal-text)] focus-visible:ring-2"
                  >
                    <span className="font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)]">
                      {clause.step}
                    </span>
                    <span className="truncate">{clause.title}</span>
                  </a>
                ))}
              </nav>

              <div className="border-t border-[var(--cf-border-subtle)] pt-4">
                <Link
                  href="/privacy"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--cf-royal-text)] hover:underline"
                >
                  <span>Read Privacy Policy</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
            </aside>

            {/* Right Detailed Clauses */}
            <div className="flex flex-col gap-5">
              {TERMS_CLAUSES.map((clause) => (
                <article
                  key={clause.id}
                  id={clause.id}
                  className="scroll-mt-28 flex flex-col gap-3.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 transition-colors duration-200 hover:border-[var(--cf-royal)] sm:p-8"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cf-border-subtle)] pb-3">
                    <div className="flex items-center gap-3">
                      <span className="rounded-xs bg-[var(--cf-royal)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--cf-text-on-royal)]">
                        {clause.step}
                      </span>
                      <h2 className="v3-heading-s text-[var(--cf-text-primary)]">
                        {clause.title}
                      </h2>
                    </div>
                    <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cf-text-tertiary)]">
                      <CheckCircle2 className="size-3.5 text-[var(--cf-royal-text)]" />
                      <span>Binding clause</span>
                    </span>
                  </div>

                  <p className="text-xs font-semibold text-[var(--cf-royal-text)] sm:text-sm">
                    {clause.summary}
                  </p>

                  <p className="v3-body-m leading-relaxed text-[var(--cf-text-secondary)]">
                    {clause.body}
                  </p>
                </article>
              ))}

              {/* Legal Desk CTA Box */}
              <div className="flex flex-col justify-between gap-4 rounded-xl border border-[var(--cf-royal-border)] bg-[var(--cf-royal-soft)] p-6 sm:flex-row sm:items-center sm:p-8">
                <div className="flex flex-col gap-1">
                  <h3 className="v3-heading-s text-[var(--cf-text-primary)]">
                    Questions about agency licensing or custom terms?
                  </h3>
                  <p className="text-sm text-[var(--cf-text-secondary)]">
                    Reach out to our studio legal and support desk—we respond within
                    one business day.
                  </p>
                </div>
                <Link
                  href="/help/contact"
                  className="v3-btn-primary focus-visible:ring-ring/40 group shrink-0 outline-none focus-visible:ring-2"
                >
                  <span>Contact support</span>
                  <span
                    aria-hidden="true"
                    className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)] transition-transform duration-200 group-hover:translate-x-0.5"
                  >
                    <ArrowRight className="size-3.5 stroke-[2.5]" />
                  </span>
                </Link>
              </div>
            </div>
          </div>

          <div aria-hidden="true" className="mt-16 flex flex-col">
            <div className="h-1.5 w-full bg-[var(--cf-royal)]" />
            <div className="h-2 w-full bg-[var(--cf-bg-accent)]" />
          </div>
        </section>
      </SectionStackSheet>
    </div>
  );
}
