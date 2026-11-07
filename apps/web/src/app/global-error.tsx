"use client";

import { AlertTriangle } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import "@/styles/globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body className="bg-background bg-wash-top text-foreground flex min-h-screen items-center justify-center p-6 antialiased">
        <main className="border-border/80 bg-elevated shadow-card flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border p-8 text-center">
          <span className="bg-destructive-soft text-destructive inline-flex size-12 items-center justify-center rounded-2xl">
            <AlertTriangle className="size-5" aria-hidden="true" />
          </span>

          <div className="flex flex-col gap-2">
            <h1 className="text-foreground type-display-s">Something went wrong</h1>
            <p className="text-muted-foreground type-body-s">
              An unexpected error occurred while rendering this page. Your saved project changes
              remain safe.
            </p>
            {error.digest && (
              <p className="text-tertiary font-mono type-caption">Reference ID: {error.digest}</p>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
            <Button type="button" onClick={() => reset()}>
              Try again
            </Button>
            <Button variant="secondary" asChild>
              <Link href="/">Back to home</Link>
            </Button>
          </div>
        </main>
      </body>
    </html>
  );
}
