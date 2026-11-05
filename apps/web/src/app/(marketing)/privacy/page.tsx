import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — Casefolio",
  description: "How Casefolio collects, protects and processes your data.",
};

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-6 px-4 py-14 sm:px-6 lg:py-20">
      <header className="flex flex-col gap-2">
        <p className="text-accent-foreground type-overline">Legal</p>
        <h1 className="text-foreground type-display-m">Privacy Policy</h1>
        <p className="text-muted-foreground type-caption">
          Effective April 15, 2026
        </p>
      </header>
      <div className="text-muted-foreground type-body-m flex flex-col gap-4">
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
