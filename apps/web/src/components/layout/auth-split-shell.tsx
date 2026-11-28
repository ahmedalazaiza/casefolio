import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";

export function AuthSplitShell({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--cf-lp-cream)] text-[var(--cf-lp-ink)] lg:flex-row">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[0.3125rem] focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      {/* Left value-prop panel — Deep Charcoal Editorial Panel with 3 Principle Cards */}
      <aside
        aria-label="Casefolio overview"
        className="hidden p-4 lg:flex lg:w-[44%] xl:w-[41%]"
      >
        <div className="cf-auth-story-panel relative flex w-full flex-col justify-between overflow-hidden rounded-[0.875rem] border border-[var(--cf-lp-dark-rule)] p-9 xl:p-11">
          <BrandLogo href="/" inverted />

          <div className="flex flex-col gap-5 py-10">
            <span className="inline-flex w-fit items-center rounded-[0.25rem] bg-[var(--cf-lp-lime)] px-2.5 py-1.5 font-mono text-[0.625rem] font-medium tracking-[0.08em] text-[var(--cf-lp-on-lime)] uppercase">
              CASEFOLIO STUDIO / 01
            </span>
            <h2 className="font-editorial max-w-[30rem] text-[3rem] leading-[0.92] font-normal tracking-[-0.055em] text-[var(--cf-lp-dark-ink)] xl:text-[4.25rem]">
              Your work deserves a{" "}
              <span className="text-[var(--cf-lp-lime)] italic">great story.</span>
            </h2>
            <p className="max-w-[26rem] text-[0.875rem] leading-[1.7] text-[var(--cf-lp-dark-muted)]">
              A focused space to shape your process, frame every screen, and publish work that gets remembered.
            </p>
          </div>

          <div aria-hidden="true" className="grid grid-cols-3 items-stretch gap-2.5">
            <article className="flex h-[7.25rem] flex-col justify-between rounded-[0.5625rem] bg-[var(--cf-lp-card)] p-3.5 text-[var(--cf-lp-ink)]">
              <span className="font-mono text-[0.625rem] font-medium text-[var(--cf-lp-subtle)]">
                01
              </span>
              <div className="flex flex-col gap-1">
                <b className="font-editorial text-[1rem] leading-tight font-normal">
                  Structure
                </b>
                <small className="text-[0.6875rem] leading-tight text-[var(--cf-lp-kicker-muted)]">
                  Story-first flows
                </small>
              </div>
            </article>

            <article className="flex h-[7.25rem] flex-col justify-between rounded-[0.5625rem] bg-[var(--cf-lp-lime)] p-3.5 text-[var(--cf-lp-on-lime)]">
              <span className="font-mono text-[0.625rem] font-medium text-[var(--cf-lp-lime-caption)]">
                02
              </span>
              <div className="flex flex-col gap-1">
                <b className="font-editorial text-[1rem] leading-tight font-normal">
                  Discipline
                </b>
                <small className="text-[0.6875rem] leading-tight text-[var(--cf-lp-lime-copy)]">
                  Every case aligned
                </small>
              </div>
            </article>

            <article className="flex h-[7.25rem] flex-col justify-between rounded-[0.5625rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] p-3.5 text-[var(--cf-lp-dark-ink)]">
              <span className="font-mono text-[0.625rem] font-medium text-[var(--cf-lp-dark-muted)]">
                03
              </span>
              <div className="flex flex-col gap-1">
                <b className="font-editorial text-[1rem] leading-tight font-normal">
                  Reach
                </b>
                <small className="text-[0.6875rem] leading-tight text-[var(--cf-lp-dark-body)]">
                  Live links &amp; PDFs
                </small>
              </div>
            </article>
          </div>
        </div>
      </aside>

      {/* Right form column */}
      <div className="relative flex min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-4 py-4 sm:px-8 lg:justify-end lg:py-5">
          <BrandLogo href="/" className="lg:hidden" />
          <ThemeToggle />
        </div>

        <main
          id="main-content"
          className="mx-auto flex w-full max-w-[26.5rem] flex-1 flex-col justify-center px-4 py-6 sm:px-6 lg:py-10"
        >
          {children}
        </main>

        <footer className="px-4 py-5 text-center font-mono text-[0.6875rem] tracking-[0.04em] text-[var(--cf-lp-cream-subtle)]">
          © {new Date().getFullYear()} Casefolio ·{" "}
          <Link href="/privacy" className="underline-offset-4 hover:text-[var(--cf-lp-ink)] hover:underline">
            Privacy
          </Link>{" "}
          ·{" "}
          <Link href="/terms" className="underline-offset-4 hover:text-[var(--cf-lp-ink)] hover:underline">
            Terms
          </Link>
        </footer>
      </div>
    </div>
  );
}
