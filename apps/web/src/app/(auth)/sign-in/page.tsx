import type { Metadata } from "next";
import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";

export const metadata: Metadata = {
  title: "Log in — Casefolio",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return <SignInForm callbackUrl={callbackUrl} />;
}

