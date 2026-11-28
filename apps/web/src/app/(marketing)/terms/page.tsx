import { ArrowRight, CheckCircle2, Scale } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CmsIcon } from "@/components/cms/cms-icon";
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
      {/* 1. Editorial Serif Hero */}
      <section className="relative z-10 overflow-hidden pt-12 pb-14 sm:pt-16 sm:pb-18 lg:pt-20">
        <div className="v3-container flex flex-col gap-10">
          <div className="flex max-w-3xl flex-col items-start gap-4">
            <Eyebrow icon={<Scale />}>
              {legalAndHelp.termsEyebrow}
            </Eyebrow>
            <h1 className="v3-display-xl text-balance text-[var(--cf-text-primary)]">
              {legalAndHelp.termsTitleLead}{" "}
              <span className="v3-sticker-lime">{legalAndHelp.termsTitleHighlight}</span>
            </h1>
            <p className="v3-body-l text-[var(--cf-text-secondary)]">
              {legalAndHelp.termsSubtitle}
            </p>
            <p className="font-mono text-xs font-medium tracking-wider text-[var(--cf-text-tertiary)] uppercase">
              {legalAndHelp.termsEffectiveLine} · Operated by{" "}
              <a
                href="https://www.layerat.com"
                target="_blank"
                rel="noopener noreferrer"
                className="text-[var(--cf-text-primary)] underline underline-offset-4"
              >
                LAYERAT
              </a>
            </p>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {legalAndHelp.termsHighlights.map((item) => (
              <div
                key={item.title}
                className="flex flex-col gap-2.5 rounded-3xl bg-[var(--cf-bg-surface)] p-6"
              >
                <div className="flex items-center gap-2.5">
                  <span className="inline-flex size-8 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)]">
                    <CmsIcon
                      iconName={item.iconName}
                      customIconUrl={item.customIconUrl}
                      className="size-4"
                    />
                  </span>
                  <h2 className="text-sm font-semibold text-[var(--cf-text-primary)]">
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

      {/* 2. Sticky TOC + Clause Cards */}
      <section className="py-12 pb-24 sm:py-16 sm:pb-28">
        <div className="v3-container grid grid-cols-1 items-start gap-8 lg:grid-cols-[17rem_minmax(0,1fr)] lg:gap-12">
          <aside
            aria-label="Terms of use sections"
            className="flex flex-col gap-4 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] p-5 lg:sticky lg:top-24"
          >
            <p className="v3-label text-[var(--cf-text-tertiary)] uppercase">
              Clauses (01–{String(legalAndHelp.termsClauses.length).padStart(2, "0")})
            </p>
            <nav className="flex flex-col gap-1">
              {legalAndHelp.termsClauses.map((clause) => (
                <a
                  key={clause.id}
                  href={`#${clause.id}`}
                  className="focus-visible:ring-ring/40 flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-xs font-medium text-[var(--cf-text-secondary)] transition-colors outline-none hover:bg-[var(--cf-bg-elevated)] hover:text-[var(--cf-text-primary)] focus-visible:ring-2"
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
                className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--cf-text-primary)] hover:underline"
              >
                <span>Read Privacy Policy</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </aside>

          <div className="flex flex-col gap-5">
            {legalAndHelp.termsClauses.map((clause) => (
              <article
                key={clause.id}
                id={clause.id}
                className="scroll-mt-28 flex flex-col gap-3.5 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-8"
              >
                <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[var(--cf-border-subtle)] pb-3">
                  <div className="flex items-center gap-3">
                    <span className="rounded-full bg-[var(--cf-lp-action)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--cf-lp-on-action)]">
                      {clause.step}
                    </span>
                    <h2 className="v3-heading-s text-[var(--cf-text-primary)]">
                      {clause.title}
                    </h2>
                  </div>
                  <span className="inline-flex items-center gap-1 text-xs font-medium text-[var(--cf-text-tertiary)]">
                    <CheckCircle2 className="size-3.5 text-[var(--cf-text-secondary)]" />
                    <span>Binding clause</span>
                  </span>
                </div>

                <p className="text-xs font-medium text-[var(--cf-text-primary)] sm:text-sm">
                  {clause.summary}
                </p>

                <p className="v3-body-m leading-relaxed text-[var(--cf-text-secondary)]">
                  {clause.body}
                </p>
              </article>
            ))}

            <div className="flex flex-col justify-between gap-4 rounded-3xl bg-[var(--cf-bg-surface)] p-6 sm:flex-row sm:items-center sm:p-8">
              <div className="flex flex-col gap-1">
                <h3 className="v3-heading-s text-[var(--cf-text-primary)]">
                  Questions about agency licensing or custom terms?
                </h3>
                <p className="text-sm text-[var(--cf-text-secondary)]">
                  Reach out to our studio legal and support desk — we respond within one business day.
                </p>
              </div>
              <Link
                href="/help/contact"
                className="v3-btn-primary focus-visible:ring-ring/40 shrink-0 outline-none focus-visible:ring-2"
              >
                <span>Contact support</span>
                <ArrowRight className="size-4" />
              </Link>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
