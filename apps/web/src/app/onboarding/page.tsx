import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { OnboardingWizard } from "@/app/onboarding/onboarding-wizard";
import { requireSession } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Welcome to Casefolio — Onboarding",
};

export default async function OnboardingPage() {
  const { user } = await requireSession("/onboarding");

  if (user.onboardingCompletedAt) {
    redirect("/dashboard");
  }

  return (
    <OnboardingWizard
      initialName={user.name}
      initialEmail={user.email}
      initialJobTitle={user.jobTitle}
      initialDesignFocus={user.designFocus}
      initialImage={user.image}
    />
  );
}
