import { ArrowRight, MessageCircleQuestion } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { LandingFaqAccordion } from "@/components/marketing/landing-faq-accordion";
import { TestCanvasCtaSection } from "@/components/marketing/test-canvas-cta";
import { Eyebrow } from "@/components/ui/eyebrow";
import { getSiteCmsContent } from "@/lib/cms/service";

export const metadata: Metadata = {
  title: "FAQ — Casefolio",
  description:
    "Frequently asked questions about Casefolio templates, interactive editor, exports, plans, seats, and billing.",
  alternates: {
    canonical: "/faq",
  },
};

export default async function FaqPage() {
  const cms = await getSiteCmsContent();
  const faqEyebrow = cms.landing.faqEyebrow.replace(/^\d{1,2}\s+/, "").trim() || "Questions";

  return (
    <div className="relative flex flex-col overflow-x-clip bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      {/* Editorial Hero */}
      <section className="border-b border-[var(--cf-lp-cream-divider)] pt-12 pb-12 sm:pt-16 sm:pb-16 lg:pt-20">
        <div className="v3-container mx-auto flex max-w-4xl flex-col items-center text-center">
          <Eyebrow icon={<MessageCircleQuestion className="size-3.5" />}>
            {faqEyebrow}
          </Eyebrow>
          <h1 className="v3-display-xl mt-5 text-balance text-[var(--cf-text-primary)]">
            Answers on craft, templates &amp;{" "}
            <span className="v3-sticker-lime">plans</span>
          </h1>
          <p className="v3-body-l mt-4 max-w-2xl text-pretty text-[var(--cf-text-secondary)]">
            Everything you need to know about building, publishing, and exporting case studies
            with Casefolio, plus how Free, Pro, and Teams plans work.
          </p>
        </div>
      </section>

      {/* Product & Workflow FAQs */}
      <section
        aria-labelledby="product-faq-heading"
        className="border-b border-[var(--cf-lp-cream-divider)] bg-[var(--cf-lp-cream)] py-14 text-[var(--cf-lp-ink)] sm:py-20"
      >
        <div className="v3-container grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:gap-14">
          <div className="flex flex-col items-start gap-3">
            <Eyebrow>Product &amp; Workflow</Eyebrow>
            <h2
              id="product-faq-heading"
              className="cf-lp-section-title font-normal text-[var(--cf-lp-ink)]"
            >
              {cms.landing.faqTitleLead}{" "}
              <span className="italic">{cms.landing.faqTitleHighlight}</span>
            </h2>
            <p className="v3-body-s max-w-sm text-[var(--cf-lp-subtle)]">
              How ratio-locked templates, custom links, and exports behave for solo designers and
              teams.
            </p>
          </div>

          <div>
            <LandingFaqAccordion items={cms.landing.faqItems} />
          </div>
        </div>
      </section>

      {/* Billing & Plans FAQs */}
      <section
        aria-labelledby="billing-faq-heading"
        className="border-b border-[var(--cf-lp-cream-divider)] py-14 sm:py-20"
      >
        <div className="v3-container flex flex-col gap-8">
          <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-end">
            <div className="flex flex-col items-start gap-2.5">
              <Eyebrow icon={<MessageCircleQuestion className="size-3.5" />}>
                Billing FAQ
              </Eyebrow>
              <h2
                id="billing-faq-heading"
                className="v3-display-l text-balance text-[var(--cf-text-primary)]"
              >
                Plans, seats &amp; <span className="v3-sticker-lime">downgrades</span>
              </h2>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <Link href="/pricing" className="v3-btn-secondary py-2.5 px-4 text-xs">
                <span>View pricing</span>
                <ArrowRight className="size-3.5" />
              </Link>
              <Link href="/help/billing-and-plans" className="v3-btn-secondary py-2.5 px-4 text-xs">
                <span>Billing guide</span>
                <ArrowRight className="size-3.5" />
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
            {cms.pricing.faqs.map((item) => (
              <article
                key={item.question}
                className="flex flex-col gap-3 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-6 sm:p-7"
              >
                <h3 className="v3-heading-s text-[var(--cf-text-primary)]">{item.question}</h3>
                <p className="v3-body-s leading-relaxed text-[var(--cf-text-secondary)]">
                  {item.answer}
                </p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <TestCanvasCtaSection />
    </div>
  );
}
