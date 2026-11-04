import type { Metadata } from "next";
import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";

export const metadata: Metadata = {
  title: "Create account — Casefolio",
};

export default function SignUpPage() {
  return <SignUpForm />;
}
