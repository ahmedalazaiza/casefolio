import type { Metadata } from "next";
import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";

export const metadata: Metadata = {
  title: "Create Your Free Account — Casefolio",
  description:
    "Sign up for Casefolio free forever with 1 active case study, curated templates, and one-click public sharing. No credit card required.",
};

export default function SignUpPage() {
  return <SignUpForm />;
}

