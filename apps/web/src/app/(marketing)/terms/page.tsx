import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — Casefolio",
  description: "Terms of Service governing your use of Casefolio.",
};

export default function TermsPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-14 sm:px-6 lg:py-20">
      <header className="flex flex-col gap-2">
        <p className="text-accent-foreground type-overline">Legal</p>
        <h1 className="text-foreground type-display-m">Terms of Service</h1>
        <p className="text-muted-foreground type-caption">
          Effective April 15, 2026
        </p>
      </header>
      <div className="text-muted-foreground type-body-m flex flex-col gap-4">
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

