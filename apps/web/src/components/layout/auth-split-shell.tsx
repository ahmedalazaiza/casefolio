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

      {/* Left value-prop panel — Electric Royal Blue & Acid Lime studio showcase */}
      <aside
        aria-label="Casefolio overview"
        className="hidden p-3 lg:flex lg:w-5/12 xl:w-[34rem]"
      >
        <div className="v3-pattern-dots-dark v3-sheet-royal relative flex w-full flex-col justify-between overflow-hidden rounded-[2rem] border border-[var(--cf-border-on-royal)] p-10">
          <BrandLogo href="/" inverted subtitle="STUDIO" />

          <div className="flex flex-col gap-5 py-10">
            <span className="bg-brand-lime text-brand-on-lime type-overline inline-flex w-fit items-center rounded-md px-2.5 py-1">
              01 · Case Study System
            </span>
            <h2 className="type-section text-inherit text-balance">
              Your work deserves an unforgettable{" "}
              <span className="v3-sticker-lime">story.</span>
            </h2>
            <p className="type-lead max-w-sm text-inherit">
              Choose a curated case study template, frame your screens in ratio-locked mockups,
              and publish live or export for Behance and PDF in minutes.
            </p>
          </div>

          <div aria-hidden="true" className="grid grid-cols-3 items-stretch gap-3">
            <div className="bg-elevated text-foreground flex h-36 flex-col justify-between rounded-2xl border border-border p-3.5">
              <span className="text-primary font-mono text-xs font-bold">01</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-xs font-bold">Ratio-locked</span>
                <span className="text-muted-foreground text-[0.6875rem]">9:19.5 · 16:10</span>
              </div>
            </div>
            <div className="bg-brand-lime text-brand-on-lime flex h-36 flex-col justify-between rounded-2xl p-3.5">
              <span className="font-mono text-xs font-bold">02</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-xs font-bold">1-click themes</span>
                <span className="text-[0.6875rem] font-medium">AA contrast</span>
              </div>
            </div>
            <div className="bg-inverse text-inverse-foreground flex h-36 flex-col justify-between rounded-2xl p-3.5">
              <span className="font-mono text-xs font-bold text-[var(--cf-bg-accent)]">03</span>
              <div className="flex flex-col gap-0.5">
                <span className="font-display text-xs font-bold">Live &amp; PDF</span>
                <span className="text-[0.6875rem] font-medium">1440w Behance</span>
              </div>
            </div>
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

