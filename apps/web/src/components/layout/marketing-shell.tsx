"use client";

import { Menu, Sparkles } from "lucide-react";
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

const FOOTER_GROUPS = [
  {
    title: "Product",
    links: [
      { label: "Templates", href: "/templates" },
      { label: "Editor", href: "/#product" },
      { label: "Publish & export", href: "/#publish-export" },
      { label: "Pricing", href: "/pricing" },
    ],
  },
  {
    title: "Resources",
    links: [
      { label: "Help center", href: "/help" },
      { label: "Contact support", href: "/help#contact" },
      { label: "FAQ", href: "/#faq" },
    ],
  },
  {
    title: "Company",
    links: [
      { label: "How it works", href: "/#how-it-works" },
      { label: "Terms", href: "/terms" },
      { label: "Privacy", href: "/privacy" },
    ],
  },
] as const;

export function MarketingShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [isScrolled, setIsScrolled] = useState(false);
  const [scrollProgress, setScrollProgress] = useState(0);

  useEffect(() => {
    const updateScrollState = () => {
      const y = window.scrollY || 0;
      setIsScrolled(y > 12);

      const docHeight =
        document.documentElement.scrollHeight - window.innerHeight;
      if (docHeight > 0) {
        setScrollProgress(Math.min(100, Math.max(0, (y / docHeight) * 100)));
      } else {
        setScrollProgress(0);
      }
    };

    updateScrollState();
    window.addEventListener("scroll", updateScrollState, { passive: true });
    window.addEventListener("resize", updateScrollState, { passive: true });
    return () => {
      window.removeEventListener("scroll", updateScrollState);
      window.removeEventListener("resize", updateScrollState);
    };
  }, [pathname]);

  return (
    <SmoothScrollProvider>
      <div className="bg-background text-foreground flex min-h-screen flex-col">
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
            "fixed inset-x-0 top-0 z-50 border-b transition-all duration-300",
            isScrolled
              ? "border-border bg-background/92 shadow-card backdrop-blur-xl"
              : "border-border/60 bg-background/80 backdrop-blur-md",
          )}
        >
          <div className="mx-auto flex h-18 max-w-7xl items-center justify-between gap-4 px-4 sm:px-6 lg:h-20 lg:px-8">
            <BrandLogo href="/" />

            <nav
              aria-label="Marketing navigation"
              className="border-border/70 bg-surface/75 hidden items-center gap-1 rounded-full border px-2 py-1 lg:flex"
            >
              {MARKETING_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "type-body-s focus-visible:ring-ring/40 rounded-full px-3.5 py-1.5 transition-all outline-none focus-visible:ring-2",
                      isActive
                        ? "bg-elevated text-foreground type-body-s-strong shadow-xs"
                        : "text-muted-foreground hover:bg-elevated/70 hover:text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                );
              })}
            </nav>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <ThemeToggle />

              <Button variant="ghost" asChild className="hidden lg:inline-flex">
                <Link href="/sign-in">Log in</Link>
              </Button>

              <Button variant="default" asChild>
                <Link href="/sign-up">
                  <Sparkles className="size-3.5" />
                  <span>Start free</span>
                </Link>
              </Button>

              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open navigation menu"
                    className="border-border bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-10 items-center justify-center rounded-md border transition-colors outline-none focus-visible:ring-2 lg:hidden"
                  >
                    <Menu className="size-4" />
                  </button>
                </SheetTrigger>
                <SheetContent side="right" className="w-80 p-6">
                  <SheetHeader className="p-0 text-left">
                    <SheetTitle>Casefolio menu</SheetTitle>
                    <SheetDescription>
                      Explore templates, pricing, and account access.
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
                            "focus-visible:ring-ring/40 rounded-md px-3 py-2.5 transition-colors outline-none focus-visible:ring-2",
                            isActive
                              ? "bg-elevated text-foreground type-body-m-strong"
                              : "text-muted-foreground hover:bg-surface hover:text-foreground type-body-m",
                          )}
                        >
                          {item.label}
                        </Link>
                      );
                    })}
                  </nav>
                  <div className="border-border mt-auto flex flex-col gap-2.5 border-t pt-5">
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

          {/* Smooth reading progress hairline along bottom of fixed navbar */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 bottom-0 h-0.5 overflow-hidden"
          >
            <div
              style={{ transform: `scaleX(${scrollProgress / 100})` }}
              className="bg-primary h-full w-full origin-left transition-transform duration-150 ease-out"
            />
          </div>
        </header>

        <main
          id="main-content"
          className="w-full max-w-full min-w-0 flex-1 pt-18 lg:pt-20"
        >
          {children}
        </main>

        <footer className="border-border bg-surface border-t">
          <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-16">
            <div className="hidden gap-12 md:grid md:grid-cols-12">
              <div className="flex flex-col gap-3 md:col-span-5">
                <BrandLogo href="/" />
                <p className="text-muted-foreground type-body-s max-w-xs">
                  Turn finished projects into publishable case studies.
                </p>
              </div>

              <div className="grid grid-cols-3 gap-8 md:col-span-7">
                {FOOTER_GROUPS.map((group) => (
                  <div key={group.title} className="flex flex-col gap-3">
                    <h2 className="text-foreground type-body-s-strong">
                      {group.title}
                    </h2>
                    <ul className="flex flex-col gap-2.5">
                      {group.links.map((link) => (
                        <li key={link.label}>
                          <Link
                            href={link.href}
                            className="text-muted-foreground hover:text-foreground type-body-s focus-visible:ring-ring/40 rounded-xs transition-colors outline-none focus-visible:ring-2"
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

            <div className="border-border mt-12 hidden items-center justify-between border-t pt-8 md:flex">
              <p className="text-muted-foreground type-caption">
                © 2026 Casefolio
              </p>
              <p className="text-muted-foreground type-caption">
                Made for designers
              </p>
            </div>

            <div className="flex flex-col gap-4 md:hidden">
              <BrandLogo href="/" />
              <div className="text-muted-foreground type-body-s flex flex-wrap items-center gap-x-2 gap-y-1">
                <Link href="/templates" className="hover:text-foreground">
                  Templates
                </Link>
                <span aria-hidden="true">·</span>
                <Link href="/pricing" className="hover:text-foreground">
                  Pricing
                </Link>
                <span aria-hidden="true">·</span>
                <Link href="/help" className="hover:text-foreground">
                  Help
                </Link>
                <span aria-hidden="true">·</span>
                <Link href="/terms" className="hover:text-foreground">
                  Terms
                </Link>
                <span aria-hidden="true">·</span>
                <Link href="/privacy" className="hover:text-foreground">
                  Privacy
                </Link>
              </div>
              <p className="text-muted-foreground type-caption">
                © 2026 Casefolio
              </p>
            </div>
          </div>
        </footer>
      </div>
    </SmoothScrollProvider>
  );
}
