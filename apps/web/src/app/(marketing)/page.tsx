import type { Metadata } from "next";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { getLandingPlatformSnapshot } from "@/lib/marketing/landing-stats";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Casefolio — Turn Finished UI Designs Into Published Case Studies",
  description:
    "Create structured UI/UX portfolio case studies without starting from scratch. Pick a proven template, frame screens in device mockups, publish a live link, or export Behance 1400px, PNG, and A4 PDF.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Casefolio — Turn Finished UI Designs Into Published Case Studies",
    description:
      "Create structured UI/UX portfolio case studies without starting from scratch. Pick a proven template, frame screens in device mockups, publish a live link, or export Behance 1400px, PNG, and A4 PDF.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Casefolio — Turn Finished UI Designs Into Published Case Studies",
    description:
      "Create structured UI/UX portfolio case studies without starting from scratch. Pick a proven template, frame screens in device mockups, publish a live link, or export Behance 1400px, PNG, and A4 PDF.",
  },
};

export default async function HomePage() {
  const snapshot = await getLandingPlatformSnapshot();
  return <LandingExperience snapshot={snapshot} />;
}
