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

      {/* Left value-prop panel — brand wash with floating UI cards */}
      <aside
        aria-label="Casefolio overview"
        className="hidden p-3 lg:flex lg:w-5/12 xl:w-[34rem]"
      >
        <div className="bg-wash-panel relative flex w-full flex-col justify-between overflow-hidden rounded-[2rem] p-10">
          <BrandLogo href="/" />

          <div className="flex flex-col gap-5 py-12">
            <h2 className="type-section text-foreground text-balance">
              Your work deserves a better story.
            </h2>
            <p className="text-muted-foreground type-lead max-w-sm">
              Turn finished projects into polished case studies — templates, live preview,
              publish or export.
            </p>
          </div>

          <div aria-hidden="true" className="grid grid-cols-3 items-end gap-3.5">
            <div className="bg-primary shadow-float h-40 -rotate-3 rounded-2xl" />
            <div className="bg-elevated shadow-float h-32 rotate-2 rounded-2xl" />
            <div className="bg-inverse shadow-float h-44 rotate-3 rounded-2xl" />
          </div>
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

