import type { Metadata } from "next";
import { VerifyEmailForm } from "@/app/(auth)/verify/verify-email-form";
import { sanitizeCallbackUrl } from "@/lib/auth/safe-redirect";

export const metadata: Metadata = {
  title: "Verify email — Casefolio",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{
    email?: string;
    name?: string;
    sent?: string;
    callbackUrl?: string;
  }>;
}) {
  const { email, name, sent, callbackUrl } = await searchParams;
  return (
    <VerifyEmailForm
      initialEmail={email}
      initialName={name}
      initialSent={sent === "1"}
      callbackUrl={callbackUrl ? sanitizeCallbackUrl(callbackUrl) : undefined}
    />
  );
}
