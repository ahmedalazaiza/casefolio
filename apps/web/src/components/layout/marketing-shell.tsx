"use client";

import { ArrowRight, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { ScrollProgressBar } from "@/components/marketing/motion";
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
  { label: "Pricing", href: "/pricing" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "FAQ", href: "/#faq" },
];

const BUILTIN_SOCIAL_ICONS: Record<string, ReactNode> = {
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
  onClick,
}: {
  href?: string;
  siteName?: string;
  logoImageUrl?: string;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className="focus-visible:ring-ring/40 group inline-flex items-center gap-2.5 rounded-md outline-none focus-visible:ring-2"
    >
      {logoImageUrl ? (
        <img
          src={logoImageUrl}
          alt={siteName}
          className="size-7 shrink-0 rounded-lg object-contain transition-transform duration-200 group-hover:scale-105"
        />
      ) : (
        <span
          aria-hidden="true"
          className="relative inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-[var(--cf-royal)] transition-transform duration-200 group-hover:scale-105"
        >
          <svg viewBox="0 0 20 20" fill="none" className="size-4">
            <path
              d="M4.5 14.5L7.8 5.5L10 10.6L12.2 5.5L15.5 14.5H12.7L10 9.6L7.3 14.5H4.5Z"
              fill="var(--cf-text-on-royal)"
            />
            <circle cx="14.5" cy="5.5" r="2.1" fill="var(--cf-bg-accent)" />
          </svg>
        </span>
      )}
      <span className="v3-heading-s text-[var(--cf-text-primary)]">
        {siteName}
      </span>
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
    <div className="v3-root relative flex min-h-screen flex-col overflow-x-clip">
      <a
        href="#main-content"
        className="v3-body-s-strong focus-visible:ring-ring/40 sr-only bg-[var(--cf-bg-action)] text-[var(--cf-text-on-action)] focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[60] focus:rounded-lg focus:px-4 focus:py-2 focus:outline-none focus-visible:ring-2"
      >
        Skip to main content
      </a>

      {/* Top Electric Royal Blue + Acid Lime Announcement Bar */}
      {(brand.announcementText || brand.announcementCtaLabel) && (
        <div className="flex min-h-11 items-center justify-center bg-[var(--cf-royal)] px-4 py-2 text-center text-[var(--cf-text-on-royal)]">
          <p className="flex flex-wrap items-center justify-center gap-x-2.5 gap-y-1 text-xs leading-5 sm:text-sm">
            {brand.announcementTag && (
              <span className="rounded-full bg-[var(--cf-bg-accent)] px-2 py-0.5 text-[0.6875rem] leading-none font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
                {brand.announcementTag}
              </span>
            )}
            {brand.announcementText && (
              <span className="font-medium">{brand.announcementText}</span>
            )}
            {brand.announcementCtaLabel && (
              <Link
                href={brand.announcementCtaHref || "/templates"}
                className="focus-visible:ring-ring/40 rounded-xs font-semibold text-[var(--cf-bg-accent)] underline decoration-[var(--cf-bg-accent)]/70 underline-offset-4 transition-opacity outline-none hover:opacity-85 focus-visible:ring-2"
              >
                {brand.announcementCtaLabel}
              </Link>
            )}
          </p>
        </div>
      )}

      {/* Main Sticky Navbar + Scroll Progress Ribbon */}
      <header className="sticky top-0 z-50 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]/92 backdrop-blur-md">
        <div className="v3-container flex items-center justify-between gap-4 py-3.5">
          <V3Wordmark
            href="/"
            siteName={brand.siteName}
            logoImageUrl={brand.logoImageUrl}
          />

          <nav
            aria-label="Main navigation"
            className="hidden items-center gap-8 md:flex"
          >
            {brand.navLinks.map((item) => {
              const isActive = resolvedActiveHref === item.href;
              return (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  aria-current={isActive ? "page" : undefined}
                  className={cn(
                    "v3-body-m-strong focus-visible:ring-ring/40 rounded-md py-1 text-[var(--cf-text-primary)] transition-colors outline-none hover:text-[var(--cf-royal-text)] focus-visible:ring-2",
                    isActive &&
                      "underline decoration-[var(--cf-bg-accent)] decoration-2 underline-offset-4",
                  )}
                >
                  {item.label}
                </Link>
              );
            })}
          </nav>

          <div className="hidden items-center gap-3 md:flex">
            <Link
              href="/sign-in"
              className="v3-btn-secondary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
            >
              Log in
            </Link>
            <Link
              href="/sign-up"
              className="v3-btn-primary focus-visible:ring-ring/40 group outline-none focus-visible:ring-2"
            >
              <span>Start free</span>
              <span
                aria-hidden="true"
                className="inline-flex size-5 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)] transition-transform duration-200 group-hover:translate-x-0.5"
              >
                <ArrowRight className="size-3 stroke-[2.5]" />
              </span>
            </Link>
          </div>

          <div className="flex items-center gap-3 md:hidden">
            <Link
              href="/sign-up"
              className="v3-btn-primary focus-visible:ring-ring/40 outline-none focus-visible:ring-2"
            >
              Start free
            </Link>
            <button
              type="button"
              aria-label="Open navigation menu"
              aria-expanded={mobileMenuOpen}
              onClick={() => setMobileMenuOpen(true)}
              className="focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-md text-[var(--cf-text-primary)] transition-colors outline-none hover:bg-[var(--cf-bg-surface)] focus-visible:ring-2"
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
        <ScrollProgressBar />
      </header>

      {mobileMenuOpen ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Casefolio menu"
          className="fixed inset-0 z-50 flex flex-col justify-between bg-[var(--cf-bg-canvas)] p-5 md:hidden"
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
                className="focus-visible:ring-ring/40 inline-flex size-10 items-center justify-center rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)] outline-none focus-visible:ring-2"
              >
                <X className="size-4" />
              </button>
            </div>

            <nav
              aria-label="Mobile marketing navigation"
              className="flex flex-col divide-y divide-[var(--cf-border-subtle)] border-y border-[var(--cf-border-subtle)]"
            >
              {brand.navLinks.map((item) => (
                <Link
                  key={`${item.href}-${item.label}`}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="v3-heading-s flex min-h-14 items-center justify-between text-[var(--cf-text-primary)] transition-opacity hover:opacity-75"
                >
                  <span>{item.label}</span>
                  <ArrowRight className="size-4 text-[var(--cf-text-tertiary)]" />
                </Link>
              ))}
            </nav>
          </div>

          <div className="flex flex-col gap-3 pt-6">
            <Link
              href="/sign-up"
              onClick={() => setMobileMenuOpen(false)}
              className="v3-btn-primary w-full py-3.5"
            >
              <span>Start free</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/sign-in"
              onClick={() => setMobileMenuOpen(false)}
              className="v3-btn-secondary w-full py-3.5"
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

      {/* Footer */}
      <footer className="border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
        <div className="v3-container flex flex-col justify-between gap-10 py-12 lg:flex-row lg:items-start lg:py-16">
          <div className="flex max-w-sm flex-col items-start gap-4">
            <V3Wordmark
              href="/"
              siteName={brand.siteName}
              logoImageUrl={brand.logoImageUrl}
            />
            <p className="v3-body-s text-[var(--cf-text-secondary)]">
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
                    className="focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-secondary)] transition-colors outline-none hover:border-[var(--cf-royal)] hover:text-[var(--cf-royal-text)] focus-visible:ring-2"
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
            <div className="flex items-center gap-3 pt-1">
              <p className="v3-body-s text-[var(--cf-text-tertiary)]">
                {brand.copyrightText}
              </p>
              <ThemeToggle />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 sm:gap-12 lg:w-[40rem]">
            {brand.footerColumns.map((column) => (
              <div key={column.heading} className="flex flex-col gap-3">
                <p className="v3-body-m-strong text-[var(--cf-text-primary)]">
                  {column.heading}
                </p>
                <ul className="flex flex-col gap-2.5">
                  {column.links.map((link) => (
                    <li key={`${link.label}-${link.href}`}>
                      <Link
                        href={link.href}
                        className="v3-body-s focus-visible:ring-ring/40 rounded-xs text-[var(--cf-text-secondary)] transition-colors outline-none hover:text-[var(--cf-royal-text)] focus-visible:ring-2"
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
      </footer>
    </div>
  );
}
