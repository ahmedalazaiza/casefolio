"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { CasefolioLockup } from "@/components/ui/brand-logo";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { DEFAULT_SITE_CMS_CONTENT, type SiteCmsContent } from "@/lib/cms/schema";
import { cn } from "@/lib/utils";

export interface MarketingNavItem {
  label: string;
  href: string;
}

export const MARKETING_NAV_ITEMS: readonly MarketingNavItem[] = [
  { label: "Home", href: "/" },
  { label: "Templates", href: "/templates" },
  { label: "Showcase", href: "/showcase" },
  { label: "Pricing", href: "/pricing" },
];

const BUILTIN_SOCIAL_ICONS: Record<string, ReactNode> = {
  instagram: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" className="size-4" aria-hidden="true">
      <rect width="18" height="18" x="3" y="3" rx="5" />
      <circle cx="12" cy="12" r="4" />
      <circle cx="17.5" cy="6.5" r="1" fill="currentColor" stroke="none" />
    </svg>
  ),
  x: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  ),
  linkedin: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M19 3a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2zm-.5 15.5v-5.3a3.26 3.26 0 0 0-3.26-3.26c-.85 0-1.84.52-2.28 1.3v-1.11h-2.79v8.37h2.79v-4.93c0-.77.62-1.4 1.39-1.4a1.4 1.4 0 0 1 1.4 1.4v4.93zM6.88 8.56a1.68 1.68 0 0 0 1.68-1.68c0-.93-.75-1.69-1.68-1.69a1.69 1.69 0 0 0-1.69 1.69c0 .93.76 1.68 1.69 1.68m1.39 9.94v-8.37H5.5v8.37z" />
    </svg>
  ),
  dribbble: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="size-4" aria-hidden="true">
      <circle cx="12" cy="12" r="9" />
      <path d="M8.56 3.69c4.37 6.03 6.02 9.42 8.03 17.72M19.13 5.09C15.22 9.14 10 10.44 3.25 10.94M20.75 12.84c-6.62-1.41-12.14 1-16.38 6.32" />
    </svg>
  ),
  behance: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M7.5 11.2c1.1 0 1.8-.6 1.8-1.5 0-1-.7-1.4-1.8-1.4H4.8v2.9zm.3 4.5c1.2 0 2-.6 2-1.7 0-1.1-.8-1.6-2.1-1.6H4.8v3.3zM2.5 6.4h5.4c2.2 0 3.7 1 3.7 2.9 0 1.2-.6 2.1-1.6 2.5 1.3.4 2.1 1.4 2.1 2.9 0 2.2-1.7 3.3-4.1 3.3H2.5zm14.9 4c-1.1 0-1.9.8-2.1 2h4.1c-.1-1.2-.8-2-2-2m-4.3 2.9c0-2.8 1.8-4.7 4.4-4.7 2.7 0 4.2 2 4.2 4.9v.5h-6.4c.1 1.4 1 2.2 2.3 2.2.9 0 1.7-.4 2-1.1h2.1c-.5 1.8-2.1 2.9-4.2 2.9-2.7 0-4.4-1.8-4.4-4.7m2.4-6.4h3.9v1.2h-3.9z" />
    </svg>
  ),
  github: (
    <svg viewBox="0 0 24 24" fill="currentColor" className="size-4" aria-hidden="true">
      <path d="M12 2A10 10 0 0 0 2 12c0 4.42 2.87 8.17 6.84 9.5.5.08.66-.23.66-.5v-1.69c-2.77.6-3.36-1.34-3.36-1.34-.46-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.6.07-.6 1 .07 1.53 1.03 1.53 1.03.87 1.52 2.34 1.07 2.91.83.09-.65.35-1.09.63-1.34-2.22-.25-4.55-1.11-4.55-4.92 0-1.11.38-2 1.03-2.71-.1-.25-.45-1.29.1-2.64 0 0 .84-.27 2.75 1.02.79-.22 1.65-.33 2.5-.33s1.71.11 2.5.33c1.91-1.29 2.75-1.02 2.75-1.02.55 1.35.2 2.39.1 2.64.65.71 1.03 1.6 1.03 2.71 0 3.82-2.34 4.66-4.57 4.91.36.31.69.92.69 1.85V21c0 .27.16.59.67.5C19.14 20.16 22 16.42 22 12A10 10 0 0 0 12 2" />
    </svg>
  ),
};

export function V3Wordmark({
  href = "/",
  siteName = "Casefolio",
  logoImageUrl = "",
  inverted = false,
  onClick,
}: {
  href?: string;
  siteName?: string;
  logoImageUrl?: string;
  inverted?: boolean;
  monochrome?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="focus-visible:ring-ring/40 group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2"
    >
      {logoImageUrl ? (
        <>
          <img
            src={logoImageUrl}
            alt={siteName}
            className="size-[1.625rem] shrink-0 rounded-md object-contain transition-transform duration-200 group-hover:scale-105"
          />
          <span
            className={cn(
              "font-display text-base font-bold tracking-[-0.04em] lowercase",
              inverted ? "text-[var(--cf-lp-dark-ink)]" : "text-[var(--cf-lp-ink)]",
            )}
          >
            {siteName}
          </span>
        </>
      ) : (
        <>
          <CasefolioLockup
            inverted={inverted}
            className="h-[1.6875rem] w-auto transition-transform duration-200 group-hover:scale-[1.02]"
          />
          <span className="sr-only">{siteName}</span>
        </>
      )}
    </Link>
  );
}

export interface MarketingShellProps {
  children: ReactNode;
  activeNavHref?: string;
  mainClassName?: string;
  brand?: SiteCmsContent["brand"];
}

export function MarketingShell({
  children,
  activeNavHref,
  mainClassName,
  brand = DEFAULT_SITE_CMS_CONTENT.brand,
}: MarketingShellProps) {
  const pathname = usePathname();
  const resolvedActiveHref = activeNavHref ?? pathname;
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setMobileMenuOpen(false);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <div className="v3-root cf-landing relative flex min-h-screen flex-col overflow-x-clip bg-[var(--cf-lp-canvas)]">
      <a
        href="#main-content"
        className="v3-body-s-strong focus-visible:ring-ring/40 sr-only bg-[var(--cf-lp-action)] text-[var(--cf-lp-on-action)] focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-full focus:px-4 focus:py-2 focus:outline-none focus-visible:ring-2"
      >
        Skip to main content
      </a>

      {/* Unified Editorial Warm Cream Navbar */}
      <header className="sticky top-0 z-50 border-b border-[var(--cf-lp-border)] bg-[var(--cf-lp-cream)]/95 backdrop-blur-md">
        <div className="v3-container grid grid-cols-2 items-center gap-4 py-4 md:grid-cols-[1fr_auto_1fr] md:py-4.5">
          <div className="justify-self-start">
            <V3Wordmark
              href="/"
              siteName={brand.siteName}
              logoImageUrl={brand.logoImageUrl}
            />
          </div>

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-7 justify-self-center md:flex lg:gap-9"
          >
            {brand.navLinks.map((item) => {
              const isActive = resolvedActiveHref === item.href;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/40 rounded-md py-1 text-xs font-medium transition-colors outline-none hover:text-[var(--cf-lp-ink)] focus-visible:ring-2 sm:text-[0.8125rem]",
                    isActive
                      ? "font-semibold text-[var(--cf-lp-ink)]"
                      : "text-[var(--cf-lp-cream-muted)]",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-5 justify-self-end md:flex">
            <Link
              href="/sign-in"
              className="focus-visible:ring-ring/40 rounded-md px-2 py-1.5 text-[0.8125rem] font-medium text-[var(--cf-lp-cream-muted)] transition-colors outline-none hover:text-[var(--cf-lp-ink)] focus-visible:ring-2"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="focus-visible:ring-ring/40 inline-flex h-[2.625rem] items-center justify-center rounded-[0.3125rem] bg-[var(--cf-lp-dark)] px-4 text-[0.8125rem] font-semibold text-white transition-all duration-150 outline-none hover:-translate-y-0.5 hover:bg-[var(--cf-royal-deep)] focus-visible:ring-2"
            >
              Start creating
            </Link>
          </div>

          <div className="flex items-center gap-2.5 justify-self-end md:hidden">
            <Link
              href="/sign-up"
              className="focus-visible:ring-ring/40 inline-flex h-9 items-center justify-center rounded-[0.3125rem] bg-[var(--cf-lp-dark)] px-3.5 text-xs font-semibold text-white outline-none focus-visible:ring-2"
            >
              Start creating
            </Link>
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
              className="focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-[0.3125rem] text-[var(--cf-lp-ink)] transition-colors outline-none hover:bg-[var(--cf-lp-surface)] focus-visible:ring-2"
            >
              <svg
                aria-hidden="true"
                viewBox="0 0 22 22"
                fill="none"
                className="size-[1.375rem]"
              >
                <path
                  d="M3.5 7.5H18.5M3.5 14.5H18.5"
                  stroke="currentColor"
                  strokeWidth="1.75"
                  strokeLinecap="round"
                />
              </svg>
            </button>
          </div>
        </div>
      </header>

      {mobileMenuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Casefolio menu"
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[var(--cf-lp-canvas)] p-5 md:hidden"
        >
          <div className="flex flex-col gap-6">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <V3Wordmark
                  href="/"
                  siteName={brand.siteName}
                  logoImageUrl={brand.logoImageUrl}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
                  Casefolio menu
                </span>
              </div>
              <button
                type="button"
                aria-label="Close navigation menu"
                onClick={() => setMobileMenuOpen(false)}
                className="focus-visible:ring-ring/40 inline-flex size-10 items-center justify-center rounded-full border border-[var(--cf-lp-border-strong)] bg-[var(--cf-lp-elevated)] text-[var(--cf-lp-ink)] outline-none focus-visible:ring-2"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav
              aria-label="Mobile marketing navigation"
              className="flex flex-col divide-y divide-[var(--cf-lp-border)] border-y border-[var(--cf-lp-border)]"
            >
              {brand.navLinks.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="v3-heading-s flex min-h-14 items-center justify-between text-[var(--cf-lp-ink)] transition-opacity hover:opacity-75"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-4 text-[var(--cf-lp-muted)]" />
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3 pt-6">
            <Link
              href="/sign-up"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex w-full items-center justify-center gap-2 rounded-[0.3125rem] bg-[var(--cf-lp-dark)] py-3.5 text-sm font-semibold text-white"
            >
              <span>Start creating</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/sign-in"
              onClick={() => setMobileMenuOpen(false)}
              className="inline-flex w-full items-center justify-center rounded-[0.3125rem] border border-[var(--cf-lp-border-strong)] bg-[var(--cf-lp-elevated)] py-3.5 text-sm font-medium text-[var(--cf-lp-ink)]"
            >
              Log in
            </Link>
          </div>
        </div>
      ) : null}

      <main
        id="main-content"
        className={cn("flex-1 outline-none", mainClassName)}
      >
        {children}
      </main>

      {/* Deep Charcoal Neo-Editorial Footer */}
      <footer className="bg-[var(--cf-lp-dark)] text-[var(--cf-lp-dark-ink)]">
        <div className="v3-container flex flex-col justify-between gap-10 py-14 lg:flex-row lg:items-start lg:py-16">
          <div className="flex max-w-sm flex-col items-start gap-5">
            <V3Wordmark
              href="/"
              siteName={brand.siteName}
              logoImageUrl={brand.logoImageUrl}
              inverted
            />
            <p className="font-editorial text-2xl leading-snug font-normal text-[var(--cf-lp-dark-tagline)] sm:text-[1.75rem]">
              {brand.footerTagline}
            </p>
            <ul
              aria-label="Casefolio social media links"
              className="flex flex-wrap items-center gap-2"
            >
              {brand.socialLinks.map((social) => (
                <li key={`${social.label}-${social.href}`}>
                  <a
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={social.label}
                    className="focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-full border border-[var(--cf-lp-dark-rule)] bg-transparent text-[var(--cf-lp-dark-ink)] transition-colors outline-none hover:border-[var(--cf-lp-lime)] hover:text-[var(--cf-lp-lime)] focus-visible:ring-2"
                  >
                    {social.customIconUrl ? (
                      <img
                        src={social.customIconUrl}
                        alt=""
                        className="size-4 object-contain"
                      />
                    ) : (
                      BUILTIN_SOCIAL_ICONS[social.platform] ?? BUILTIN_SOCIAL_ICONS.x
                    )}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12 lg:w-[40rem]">
            {brand.footerColumns.map((column) => (
              <div key={column.heading} className="flex flex-col gap-3">
                <p className="cf-lp-kicker text-[var(--cf-lp-dark-tagline)]">
                  {column.heading}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={`${link.label}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="v3-body-s focus-visible:ring-ring/40 rounded-xs text-[var(--cf-lp-dark-ink)] transition-colors outline-none hover:text-[var(--cf-lp-lime)] focus-visible:ring-2"
                      >
                        {link.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="border-t border-[var(--cf-lp-dark-footer-rule)]">
          <div className="v3-container flex flex-wrap items-center justify-between gap-4 py-5">
            <p className="font-mono text-xs text-[var(--cf-lp-dark-tagline)]">
              {brand.copyrightText}
            </p>
            <div className="flex items-center gap-4">
              <a
                href="https://www.layerat.com"
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-xs text-[var(--cf-lp-dark-tagline)] underline-offset-4 transition-colors hover:text-[var(--cf-lp-lime)] hover:underline"
              >
                www.layerat.com
              </a>
              <ThemeToggle className="border-[var(--cf-lp-dark-rule)] bg-transparent text-[var(--cf-lp-dark-ink)] hover:border-[var(--cf-lp-lime)] hover:text-[var(--cf-lp-lime)]" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
