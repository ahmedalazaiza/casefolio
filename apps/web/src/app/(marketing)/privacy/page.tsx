import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { MarketingPageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Privacy Policy — Casefolio",
  description:
    "Learn how Casefolio protects your uploads, processes privacy-first analytics without third-party trackers, and lets you export or delete your data anytime.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-14 px-4 py-10 sm:px-6 lg:py-16">
      <MarketingPageHeader
        eyebrow="Legal"
        icon={<Scale />}
        title="Privacy Policy"
        description="Effective April 15, 2026"
      />
      <div className="text-muted-foreground type-body-l flex flex-col gap-6">
        <p>
          Casefolio only collects the account details and project assets needed to
          host, render, and export your case studies. When you upload UI screens
          or supporting imagery, camera and GPS EXIF metadata is stripped
          automatically so hidden location or device data is never exposed on
          published pages.
        </p>
        <p>
          Public case study analytics use daily rotating salts to measure views
          and engagement without cross-site tracking cookies or third-party ad
          profiles. All subscription billing and card details are processed
          exclusively by Paddle, our Merchant of Record — Casefolio servers never
          receive or store payment card numbers.
        </p>
        <p>
          You remain in full control of your workspace data. You can download
          your work or permanently delete your projects and account at any time
          from Account Settings.
        </p>
      </div>
    </div>
  );
}

