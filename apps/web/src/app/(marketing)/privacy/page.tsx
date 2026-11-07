import { Scale } from "lucide-react";
import type { Metadata } from "next";
import { MarketingPageHeader } from "@/components/ui/page-header";

export const metadata: Metadata = {
  title: "Privacy Policy — Casefolio",
  description: "How Casefolio collects, protects and processes your data.",
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
          Casefolio strips camera/GPS EXIF metadata from uploaded screenshots,
          hashes visitor identifiers with daily rotating salts for privacy-safe
          analytics, and never stores payment card numbers on Casefolio servers.
        </p>
        <p>
          You can export or permanently delete your projects and account at any
          time from Account Settings.
        </p>
      </div>
    </div>
  );
}

