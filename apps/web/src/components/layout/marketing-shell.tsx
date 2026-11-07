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

  const glass = cn(
    "border-border/60 bg-elevated/75 border backdrop-blur-xl transition-shadow duration-500",
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
          className="fixed inset-x-0 top-0 z-50 px-3 pt-3 sm:px-5 sm:pt-4"
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <div className={cn("rounded-full py-1.5 pr-4 pl-2", glass)}>
              <BrandLogo href="/" />
            </div>

            <nav
              aria-label="Marketing navigation"
              className={cn("hidden items-center gap-1 rounded-full p-1.5 lg:flex", glass)}
            >
              {MARKETING_NAV_ITEMS.map((item) => {
                const isActive = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    aria-current={isActive ? "page" : undefined}
                    className={cn(
                      "type-body-s focus-visible:ring-ring/40 rounded-full px-4 py-2 transition-all duration-300 outline-none focus-visible:ring-2",
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

            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "flex items-center gap-1 rounded-full p-1.5",
                  glass,
                )}
              >
                <div className="hidden lg:block">
                  <ThemeToggle />
                </div>

                <Button variant="ghost" asChild className="hidden lg:inline-flex">
                  <Link href="/sign-in">Log in</Link>
                </Button>

                <Button variant="default" asChild>
                  <Link href="/sign-up">
                    <span>Start free</span>
                    <ArrowRight className="size-3.5" />
                  </Link>
                </Button>
              </div>

              <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
                <SheetTrigger asChild>
                  <button
                    type="button"
                    aria-label="Open navigation menu"
                    className={cn(
                      "text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-10 items-center justify-center rounded-full outline-none focus-visible:ring-2 lg:hidden",
                      glass,
                    )}
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
        </header>

        <main
          id="main-content"
          className="relative w-full max-w-full min-w-0 flex-1 pt-24 lg:pt-28"
        >
          {children}
        </main>

        <footer className="px-3 pb-3 sm:px-5 sm:pb-5">
          <div className="bg-wash-footer relative overflow-hidden rounded-[2.5rem] px-6 pt-20 sm:px-10 lg:pt-28">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-10">
              <BrandLogo href="/" />
              <nav
                aria-label="Footer navigation"
                className="flex flex-wrap items-center justify-center gap-x-8 gap-y-3"
              >
                {FOOTER_LINKS.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="text-foreground/80 hover:text-foreground type-body-m focus-visible:ring-ring/40 rounded-full transition-colors outline-none focus-visible:ring-2"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <p className="text-muted-foreground type-caption">
                © 2026 Casefolio · Made for designers
              </p>
            </div>

            <div className="mt-16 lg:mt-24">
              <FooterWordmark />
            </div>
          </div>
        </footer>
      </div>
    </SmoothScrollProvider>
  );
}
