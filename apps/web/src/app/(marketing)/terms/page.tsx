import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { MarketingPageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Terms of Service — Casefolio",
  description:
    "Read the Terms of Service governing your Casefolio workspace, case study content ownership, published links, and subscription billing.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-14 px-4 py-10 sm:px-6 lg:py-16">
      <MarketingPageHeader
        eyebrow="Legal"
        icon={<Scale />}
        title="Terms of Service"
        description="Effective April 15, 2026"
      />
      <div className="text-muted-foreground type-body-l flex flex-col gap-6">
        <p>
          Casefolio gives designers, studios, and teams a structured template
          builder to create, publish, and export UI/UX case studies. You retain
          100% intellectual property ownership of every screenshot, headline,
          metric, and brand asset you upload to your workspace, as well as the
          finished case studies you publish or export.
        </p>
        <p>
          You agree to publish only content you own or have permission to share
          and not to misuse Casefolio infrastructure, rate limits, or export
          pipelines. Templates, layout engines, and hardware mockups provided by
          Casefolio remain licensed solely for building and presenting your case
          studies on or exported from the platform.
        </p>
        <p>
          Paid plans are billed through Paddle (Merchant of Record) on a
          recurring monthly or annual cycle. You can upgrade, switch billing
          intervals, or cancel your subscription at any time from Billing
          settings, and your paid access continues through the end of the current
          billing period.
        </p>
      </div>
    </div>
  );
}

