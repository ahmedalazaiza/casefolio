"use client";

import {
  BarChart3,
  CreditCard,
  LayoutDashboard,
  LayoutTemplate,
  Menu,
  Search,
  Settings,
  ShieldAlert,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { Badge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { cn } from "@/lib/utils";

export interface AdminNavItem {
  label: string;
  href: string;
  exact?: boolean;
  icon: ComponentType<{ className?: string }>;
}

export const ADMIN_NAV_ITEMS: readonly AdminNavItem[] = [
  { label: "Overview", href: "/admin", exact: true, icon: LayoutDashboard },
  { label: "Templates", href: "/admin/templates", icon: LayoutTemplate },
  { label: "Categories & types", href: "/admin/categories", icon: Tags },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Subscriptions & plans", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Moderation", href: "/admin/moderation", icon: ShieldAlert },
  { label: "Analytics", href: "/admin/analytics", icon: BarChart3 },
  { label: "Settings & roles", href: "/admin/settings", icon: Settings },
] as const;

function isAdminItemActive(pathname: string, item: AdminNavItem): boolean {
  if (item.exact) {
    return pathname === item.href;
  }
  return pathname === item.href || pathname.startsWith(`${item.href}/`);
}

export function AdminShell({
  children,
  userInitials = "AA",
  userName,
  userEmail,
  userImage,
}: {
  children: ReactNode;
  userInitials?: string;
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background bg-wash-top text-foreground flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <header className="border-border/60 bg-background/80 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="flex h-17 items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open admin navigation"
                  className="border-border/80 bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 shadow-card inline-flex size-9 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 lg:hidden"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 rounded-r-3xl p-5">
                <SheetHeader className="px-2 pt-1 pb-2 text-left">
                  <div className="flex items-center gap-2">
                    <SheetTitle className="type-overline text-tertiary">
                      Admin panel
                    </SheetTitle>
                    <Badge tone="accent">Internal</Badge>
                  </div>
                  <SheetDescription>Platform administration and governance.</SheetDescription>
                </SheetHeader>
                <nav aria-label="Mobile admin navigation" className="flex flex-col gap-1">
                  {ADMIN_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = isAdminItemActive(pathname, item);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "focus-visible:ring-ring/40 flex items-center gap-3 rounded-full border px-3.5 py-2 transition-all outline-none focus-visible:ring-2",
                          active
                            ? "border-border/80 bg-elevated text-foreground shadow-card type-body-s-strong"
                            : "text-muted-foreground hover:bg-surface/80 hover:text-foreground type-body-s border-transparent",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active ? "text-primary" : "text-tertiary",
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <BrandLogo href="/admin" subtitle="CASE STUDY BUILDER" />
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              href="/admin/templates"
              aria-label="Search admin templates"
              className="border-border/80 bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 shadow-card inline-flex size-9 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2"
            >
              <Search className="size-4" />
            </Link>
            <ThemeToggle />
            <UserAccountMenu
              initials={userInitials}
              name={userName}
              email={userEmail}
              image={userImage}
            />
          </div>
        </div>
      </header>

      <div className="flex min-w-0 flex-1">
        <aside
          aria-label="Admin sidebar"
          className="border-border/60 bg-background/60 hidden w-64 shrink-0 flex-col gap-3 border-r p-4 backdrop-blur-md lg:flex"
        >
          <div className="flex items-center gap-2 px-3 pt-1">
            <span className="text-tertiary type-overline">Admin panel</span>
            <Badge tone="accent">Internal</Badge>
          </div>

          <nav aria-label="Admin navigation" className="flex flex-col gap-1">
            {ADMIN_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isAdminItemActive(pathname, item);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/40 flex items-center gap-3 rounded-full border px-3.5 py-2 transition-all outline-none focus-visible:ring-2",
                    active
                      ? "border-border/80 bg-elevated text-foreground shadow-card type-body-s-strong"
                      : "text-muted-foreground hover:bg-surface/80 hover:text-foreground type-body-s border-transparent",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active ? "text-primary" : "text-tertiary",
                    )}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>

        <main
          id="main-content"
          className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
