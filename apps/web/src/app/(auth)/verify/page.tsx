import type { Metadata } from "next";
import { VerifyEmailForm } from "@/app/(auth)/verify/verify-email-form";

export const metadata: Metadata = {
  title: "Verify email — Casefolio",
};

export default async function VerifyEmailPage({
  searchParams,
}: {
  searchParams: Promise<{ email?: string; name?: string }>;
}) {
  const { email, name } = await searchParams;
  return <VerifyEmailForm initialEmail={email} initialName={name} />;
}
