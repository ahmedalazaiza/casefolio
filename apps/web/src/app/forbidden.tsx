import Link from "next/link";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";

export default function ForbiddenPage() {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col justify-between p-6 sm:p-10">
      <header className="flex items-center justify-between">
        <BrandLogo href="/dashboard" subtitle="CASE STUDY BUILDER" />
      </header>

      <main className="mx-auto flex max-w-md flex-col items-center gap-4 text-center">
        <p className="text-primary type-display-l font-mono">403</p>
        <h1 className="text-foreground type-h1">Access restricted</h1>
        <p className="text-muted-foreground type-body-m">
          Your account doesn&apos;t have administrator permissions to view this area. Switch to an
          authorized admin account or return to your workspace.
        </p>

        <div className="mt-2 flex flex-wrap items-center justify-center gap-3">
          <Button asChild size="lg">
            <Link href="/dashboard">Go to dashboard</Link>
          </Button>
          <Button asChild variant="secondary" size="lg">
            <Link href="/help">Help center</Link>
          </Button>
        </div>
      </main>

      <footer className="text-tertiary type-caption text-center">
        © Casefolio · casefolio.app
      </footer>
    </div>
  );
}
