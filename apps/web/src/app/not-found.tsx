import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";

export default function NotFoundPage() {
  return (
    <div className="bg-background bg-wash-top text-foreground flex min-h-screen flex-col justify-between p-6 sm:p-10">
      <header className="flex items-center justify-between">
        <BrandLogo href="/" subtitle="CASE STUDY BUILDER" />
      </header>

      <main className="border-border/80 bg-elevated shadow-float mx-auto flex max-w-lg flex-col items-center gap-5 rounded-3xl border px-8 py-12 text-center sm:px-12">
        <Eyebrow className="w-fit font-mono">404</Eyebrow>
        <h1 className="text-foreground type-display-m">Page not found</h1>
        <p className="text-muted-foreground type-body-m">
          The page or case study you&apos;re looking for may have been moved, unpublished, or
          removed.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Go to dashboard</Link>
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

