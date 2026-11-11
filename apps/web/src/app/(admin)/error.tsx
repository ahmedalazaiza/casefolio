"use client";

import Link from "next/link";
import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export default function AdminErrorBoundary({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[AdminErrorBoundary]", error);
  }, [error]);

  return (
    <div className="flex min-h-[60vh] items-center justify-center p-6">
      <div className="border-border/80 bg-elevated shadow-float flex max-w-lg flex-col items-center gap-4 rounded-3xl border px-8 py-10 text-center sm:px-12">
        <Eyebrow className="w-fit font-mono">ADMIN</Eyebrow>
        <h2 className="text-foreground type-heading-l">Admin panel error</h2>
        <p className="text-muted-foreground type-body-m">
          We couldn&apos;t finish loading this admin section. Retry the request or return to the
          admin overview.
        </p>
        {error.digest ? (
          <p className="text-tertiary type-caption font-mono">Ref: {error.digest}</p>
        ) : null}

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button type="button" onClick={() => reset()}>
            Retry
          </Button>
          <Button asChild variant="secondary">
            <Link href="/admin">Admin overview</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}

