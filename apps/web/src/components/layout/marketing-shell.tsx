"use client";

import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { FooterWordmark } from "@/components/marketing/footer-wordmark";
import { SmoothScrollProvider } from "@/components/marketing/smooth-scroll-provider";
import { ThemeToggle } from "@/components/theme-toggle";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface MarketingNavItem {
  label: string;
  href: string;
}

export const MARKETING_NAV_ITEMS: readonly MarketingNavItem[] = [
  { label: "Product", href: "/#product" },
  { label: "Templates", href: "/templates" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Pricing", href: "/pricing" },
  { label: "FAQ", href: "/#faq" },
] as const;

const FOOTER_LINKS: readonly MarketingNavItem[] = [
  { label: "Templates", href: "/templates" },
  { label: "How it works", href: "/#how-it-works" },
  { label: "Publish & export", href: "/#publish-export" },
  { label: "Pricing", href: "/pricing" },
  { label: "Help center", href: "/help" },
  { label: "FAQ", href: "/#faq" },
  { label: "Terms", href: "/terms" },
  { label: "Privacy", href: "/privacy" },
] as const;

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const updateScrollState = () => {
      setIsScrolled((window.scrollY || 0) > 12);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollState);
    };
  }, [pathname]);

  const navBarChrome = cn(
    "border-border/80 bg-elevated/98 border backdrop-blur-xl transition-all duration-300",
    isScrolled ? "shadow-float" : "shadow-xs",
  );

  return (
    <SmoothScrollProvider>
      <div className="bg-background text-foreground relative flex min-h-screen flex-col">
        <div
          aria-hidden="true"
          className="bg-wash-top pointer-events-none absolute inset-x-0 top-0 h-[48rem]"
        />

        <a
          href="#main-content"
          className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-60 focus:rounded-full focus:px-4 focus:py-2"
        >
          Skip to main content
        </a>

        <header
          data-slot="marketing-navbar"
          data-scrolled={isScrolled ? "true" : "false"}
          className={cn(
            "fixed inset-x-0 top-0 z-50 px-3 pt-2.5 sm:px-5 sm:pt-3.5",
            isScrolled &&
              "before:from-background before:via-background/90 before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:-z-10 before:h-20 before:bg-gradient-to-b before:from-55% before:to-transparent",
          )}
        >
          <div
            className={cn(
              "mx-auto flex max-w-6xl items-center justify-between gap-2 rounded-full px-3 py-1.5 sm:px-4",
              navBarChrome,
            )}
          >
            <BrandLogo href="/" className="shrink-0 pl-1" />

            <nav
              aria-label="Marketing navigation"
              className="hidden items-center gap-0.5 lg:flex"
            >
              {MARKETING_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "type-body-s focus-visible:ring-ring/40 rounded-full px-3.5 py-2 transition-all duration-200 outline-none focus-visible:ring-2",
                      isActive
                        ? "bg-surface text-foreground type-body-s-strong"
                        : "text-muted-foreground hover:bg-surface hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex shrink-0 items-center gap-1.5">
              <div className="hidden lg:block">
                <ThemeToggle />
              </div>

              <Button
                variant="ghost"
                size="sm"
                asChild
                className="hidden lg:inline-flex"
              >
                <Link href="/sign-in">Log in</Link>
              </Button>

              <Button
                variant="default"
                size="sm"
                asChild
                className="sm:h-10 sm:px-4"
              >
                <Link href="/sign-up">
                  <span>Start free</span>
                  <ArrowRight className="size-3.5" />
                </Link>
              </Button>

              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open navigation menu"
                    className="text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-full transition-colors outline-none focus-visible:ring-2 lg:hidden"
                  >
                    <Menu className="size-4" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-[min(20rem,88vw)] p-6">
                  <SheetHeader className="p-0 text-left">
                    <SheetTitle>Casefolio menu</SheetTitle>
                    <SheetDescription>
                      Browse templates, compare plans, or sign in to your workspace.
                    </SheetDescription>
                  </SheetHeader>
                  <nav
                    aria-label="Mobile marketing navigation"
                    className="mt-4 flex flex-col gap-1"
                  >
                    {MARKETING_NAV_ITEMS.map((item) => {
                      const isActive = pathname === item.href;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          aria-current={isActive ? "page" : undefined}
                          onClick={() => setMobileOpen(false)}
                          className={cn(
                            "focus-visible:ring-ring/40 rounded-full px-4 py-3 transition-colors outline-none focus-visible:ring-2",
                            isActive
                              ? "bg-surface text-foreground type-body-m-strong"
                              : "text-muted-foreground hover:bg-surface hover:text-foreground type-body-m",
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="border-border mt-auto flex flex-col gap-3 border-t pt-5">
                    <div className="flex items-center justify-between px-1">
                      <span className="text-muted-foreground type-body-s">
                        Appearance
                      </span>
                      <ThemeToggle />
                    </div>
                    <Button
                      variant="secondary"
                      asChild
                      onClick={() => setMobileOpen(false)}
                    >
                      <Link href="/sign-in">Log in</Link>
                    </Button>
                    <Button
                      variant="default"
                      asChild
                      onClick={() => setMobileOpen(false)}
                    >
                      <Link href="/sign-up">Start free</Link>
                    </Button>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        <main
          id="main-content"
          className="relative w-full max-w-full min-w-0 flex-1 pt-20 sm:pt-24 lg:pt-28"
        >
          {children}
        </main>

        <footer className="px-3 pb-3 sm:px-5 sm:pb-5">
          <div className="bg-wash-footer relative overflow-hidden rounded-3xl px-5 pt-14 sm:rounded-[2.5rem] sm:px-10 sm:pt-20 lg:pt-28">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-8 sm:gap-10">
              <BrandLogo href="/" />
              <nav
                aria-label="Footer navigation"
                className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2.5 sm:gap-x-8 sm:gap-y-3"
              >
                {FOOTER_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-foreground/80 hover:text-foreground type-body-s sm:type-body-m focus-visible:ring-ring/40 rounded-full transition-colors outline-none focus-visible:ring-2"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <p className="text-muted-foreground type-caption text-center">
                © 2026 Casefolio · Built for UI/UX &amp; product designers
              </p>
            </div>

            <div className="mt-12 sm:mt-16 lg:mt-24">
              <FooterWordmark />
            </div>
          </div>
        </footer>
      </div>
    </SmoothScrollProvider>
  );
}
