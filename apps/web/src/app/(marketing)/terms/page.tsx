import { ArrowRight, CheckCircle2, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CmsIcon } from "@/components/cms/cms-icon";
import { SectionStackSheet } from "@/components/marketing/motion";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getSiteCmsContent } from "@/lib/cms/service";

export const metadata: Metadata = {
  title: "Terms of Use — Casefolio",
  description:
    "Read the Terms of Use governing your Casefolio workspace, 100% designer content ownership, published links, exports, and Paddle subscription billing.",
};

export default async function TermsPage() {
  const { legalAndHelp } = await getSiteCmsContent();

  return (
    <div className="relative flex flex-col overflow-x-clip bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      {/* 1. Architectural Grid Hero */}
      <section className="v3-pattern-grid relative z-10 overflow-hidden pt-12 pb-20 sm:pt-16 sm:pb-24 lg:pt-20 lg:pb-28">
        <div className="v3-container flex flex-col gap-10">
          <div className="flex max-w-3xl flex-col items-start gap-4">
            <Eyebrow step="01" icon={<Scale />}>
              {legalAndHelp.termsEyebrow}
            </Eyebrow>
            <h1 className="v3-display-xl text-balance text-[var(--cf-text-primary)]">
              {legalAndHelp.termsTitleLead}{" "}
              <span className="v3-sticker-lime">{legalAndHelp.termsTitleHighlight}</span>
            </h1>
            <p className="v3-body-l text-[var(--cf-text-secondary)]">
              {legalAndHelp.termsSubtitle}
            </p>
            <p className="font-mono text-xs font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
              {legalAndHelp.termsEffectiveLine} · Operated by{" "}
              <a
                href="https://www.layerat.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--cf-text-secondary)] underline underline-offset-4 hover:text-[var(--cf-royal-text)]"
              >
                LAYERAT
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {legalAndHelp.termsHighlights.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-8 items-center justify-center rounded-md bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]">
                    <CmsIcon
                      iconName={item.iconName}
                      customIconUrl={item.customIconUrl}
                      className="size-4"
                    />
                  </span>
                  <h2 className="text-sm font-bold text-[var(--cf-text-primary)]">
                    {item.title}
                  </h2>
                </div>
                <p className="text-xs leading-relaxed text-[var(--cf-text-secondary)] sm:text-sm">
                  {item.detail}
                </p>
              </div>
            ))}
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
                Clauses (01–{String(legalAndHelp.termsClauses.length).padStart(2, "0")})
              </p>
              <nav className="flex flex-col gap-1">
                {legalAndHelp.termsClauses.map((clause) => (
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
              {legalAndHelp.termsClauses.map((clause) => (
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
