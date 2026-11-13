import type { Metadata } from "next";
import { SignInForm } from "@/app/(auth)/sign-in/sign-in-form";

export const metadata: Metadata = {
  title: "Log in — Casefolio",
  description:
    "Log in to your Casefolio workspace to edit UI/UX case studies, update live portfolio links, and export high-resolution decks.",
};

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string }>;
}) {
  const { callbackUrl } = await searchParams;
  return <SignInForm callbackUrl={callbackUrl} />;
}

