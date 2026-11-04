import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";

export function AuthSplitShell({ children }: { children: ReactNode }) {
  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col lg:flex-row">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      {/* Left value-prop panel matching Figma 2:773 & 2:837 */}
      <aside
        aria-label="Casefolio overview"
        className="border-border bg-surface hidden flex-col justify-between border-r p-12 lg:flex lg:w-5/12 xl:w-120"
      >
        <BrandLogo href="/" />

        <div className="flex flex-col gap-4 py-12">
          <h2 className="type-display-l text-foreground">
            Your work
            <br />
            deserves
            <br />a better story.
          </h2>
          <p className="text-muted-foreground type-body-l max-w-sm">
            Turn finished projects into polished case studies — templates, live preview,
            publish or export.
          </p>
        </div>

        <div aria-hidden="true" className="grid grid-cols-3 gap-3.5">
          <div className="bg-primary h-40 rounded-lg" />
          <div className="bg-accent h-40 rounded-lg" />
          <div className="bg-sunken h-40 rounded-lg" />
        </div>
      </aside>

      {/* Right form column */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 lg:justify-end lg:py-6">
          <BrandLogo href="/" className="lg:hidden" />
          <ThemeToggle />
        </div>

        <main
          id="main-content"
          className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center px-4 py-8 sm:px-6 lg:py-12"
        >
          {children}
        </main>
      </div>
    </div>
  );
}

