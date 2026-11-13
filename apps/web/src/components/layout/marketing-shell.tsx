"use client";

import { ArrowRight, Menu } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
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
      setIsScrolled((window.scrollY || 0) > 8);
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollState);
    };
  }, [pathname]);

  return (
    <SmoothScrollProvider>
      <div className="bg-background text-foreground relative flex min-h-screen flex-col">
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
            "border-border bg-background/95 fixed inset-x-0 top-0 z-50 border-b backdrop-blur-md transition-shadow duration-200",
            isScrolled && "shadow-xs",
          )}
        >
          <div className="container-page flex h-16 items-center justify-between gap-4">
            <div className="flex items-center gap-8">
              <BrandLogo href="/" className="shrink-0" />

              <nav
                aria-label="Marketing navigation"
                className="hidden items-center gap-1 lg:flex"
              >
                {MARKETING_NAV_ITEMS.map((item) => {
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={isActive ? "page" : undefined}
                      className={cn(
                        "type-body-s focus-visible:ring-ring/40 rounded-lg px-3 py-1.5 transition-colors outline-none focus-visible:ring-2",
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
            </div>

            <div className="flex shrink-0 items-center gap-2">
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

              <Button variant="default" size="sm" asChild>
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
                    className="text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-lg transition-colors outline-none focus-visible:ring-2 lg:hidden"
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
                            "focus-visible:ring-ring/40 rounded-lg px-3.5 py-2.5 transition-colors outline-none focus-visible:ring-2",
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
          className="relative w-full max-w-full min-w-0 flex-1 pt-16"
        >
          {children}
        </main>

        <footer className="border-border bg-surface border-t">
          <div className="container-page py-12 sm:py-16">
            <div className="flex flex-col justify-between gap-8 md:flex-row md:items-start">
              <div className="flex max-w-xs flex-col gap-3">
                <BrandLogo href="/" />
                <p className="text-muted-foreground type-body-s">
                  Structured UI/UX portfolio case studies built directly from your finished product screens.
                </p>
              </div>

              <nav
                aria-label="Footer navigation"
                className="flex flex-wrap items-center gap-x-6 gap-y-2.5 sm:gap-x-8"
              >
                {FOOTER_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-muted-foreground hover:text-foreground type-body-s focus-visible:ring-ring/40 rounded-md transition-colors outline-none focus-visible:ring-2"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
            </div>

            <div className="border-border mt-10 flex flex-col justify-between gap-2 border-t pt-6 sm:flex-row sm:items-center">
              <p className="text-muted-foreground type-caption">
                © 2026 Casefolio · Built for UI/UX &amp; product designers
              </p>
              <p className="text-muted-foreground type-caption">
                1 free case study forever · Privacy-first analytics
              </p>
            </div>
          </div>
        </footer>
      </div>
    </SmoothScrollProvider>
  );
}
