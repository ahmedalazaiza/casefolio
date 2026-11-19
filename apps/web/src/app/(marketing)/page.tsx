import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { LandingExperience } from "@/components/marketing/landing-experience";
import { getServerSession } from "@/lib/auth/session";
import { getLandingPlatformSnapshot } from "@/lib/marketing/landing-stats";
import { hasSessionCookieHeader } from "@/lib/security/edge-guard";

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
  const cookieStore = await cookies();
  const cookieHeader = cookieStore
    .getAll()
    .map((entry) => `${entry.name}=${entry.value}`)
    .join("; ");

  if (hasSessionCookieHeader(cookieHeader || null)) {
    const session = await getServerSession();
    if (session?.user) {
      redirect("/dashboard");
    }
  }

  const snapshot = await getLandingPlatformSnapshot();
  return <LandingExperience snapshot={snapshot} />;
}
