import type { Metadata } from "next";
import { SignUpForm } from "@/app/(auth)/sign-up/sign-up-form";
import { sanitizeCallbackUrl } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Create Your Free Account — Casefolio",
  description:
    "Sign up for Casefolio free with 1 lifetime Case Study credit, curated templates, and one-click public sharing. No credit card required.",
};

export default async function SignUpPage({
  searchParams,
}: {
  searchParams?: Promise<{ callbackUrl?: string; template?: string }>;
}) {
  const resolved = searchParams ? await searchParams : {};
  const rawCallback =
    resolved.callbackUrl ??
    (resolved.template ? `/new?template=${encodeURIComponent(resolved.template)}` : undefined);

  return (
    <SignUpForm
      callbackUrl={rawCallback ? sanitizeCallbackUrl(rawCallback) : undefined}
    />
  );
}
