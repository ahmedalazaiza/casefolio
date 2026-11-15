import type { Metadata } from "next";
import { VerifyEmailForm } from "@/app/(auth)/verify/verify-email-form";

export const metadata: Metadata = {
  title: "Verify email — Casefolio",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string; sent?: string }>;
}) {
  const { email, name, sent } = await searchParams;
  return (
    <VerifyEmailForm
      initialEmail={email}
      initialName={name}
      initialSent={sent === "1"}
    />
  );
}

