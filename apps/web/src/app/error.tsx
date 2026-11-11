"use client";

import Link from "next/link";
import { useEffect } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export default function RootErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[RootErrorBoundary]", error);
  }, [error]);

  return (
    <div className="bg-background bg-wash-top text-foreground flex min-h-screen flex-col justify-between p-6 sm:p-10">
      <header className="flex items-center justify-between">
        <BrandLogo href="/" subtitle="CASE STUDY BUILDER" />
      </header>

      <main className="border-border/80 bg-elevated shadow-float mx-auto flex max-w-lg flex-col items-center gap-5 rounded-3xl border px-8 py-12 text-center sm:px-12">
        <Eyebrow className="w-fit font-mono">ERROR</Eyebrow>
        <h1 className="text-foreground type-display-m">Something went wrong</h1>
        <p className="text-muted-foreground type-body-m">
          An unexpected error interrupted this page. Your saved work is safe — try reloading this
          view or return home.
        </p>
        {error.digest ? (
          <p className="text-tertiary type-caption font-mono">Ref: {error.digest}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" size="lg" onClick={() => reset()}>
            Try again
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/">Back to home</Link>
          </Button>
        </div>
      </main>

      <footer className="text-tertiary type-caption text-center">
        © Casefolio · casefolio.app
      </footer>
    </div>
  );
}

