import type { Metadata } from "next";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { getLandingPlatformSnapshot } from "@/lib/marketing/landing-stats";

export const revalidate = 60;

export const metadata: Metadata = {
  title: "Casefolio — Turn Finished Projects Into Publishable Case Studies",
  description:
    "Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a page or export PNG & PDF.",
  alternates: {
    canonical: "/",
  },
  openGraph: {
    title: "Casefolio — Turn Finished Projects Into Publishable Case Studies",
    description:
      "Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a page or export PNG & PDF.",
    type: "website",
    url: "/",
  },
  twitter: {
    card: "summary_large_image",
    title: "Casefolio — Turn Finished Projects Into Publishable Case Studies",
    description:
      "Pick a template made by the Casefolio team, drop in your screens, tweak colors and text — then publish a page or export PNG & PDF.",
  },
};

export default async function HomePage() {
  const snapshot = await getLandingPlatformSnapshot();
  return <LandingExperience snapshot={snapshot} />;
}
