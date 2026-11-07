import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { MarketingPageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Terms of Service — Casefolio",
  description: "Terms of Service governing your use of Casefolio.",
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
          Casefolio provides a curated template-based builder for creating,
          publishing and exporting design case studies. You retain full
          intellectual property ownership of all screenshots, copy and brand
          assets uploaded to your workspace.
        </p>
        <p>
          Paid subscriptions are billed via Paddle (Merchant of Record) on a
          recurring monthly or yearly basis and may be cancelled at any time
          from Billing settings.
        </p>
      </div>
    </div>
  );
}

