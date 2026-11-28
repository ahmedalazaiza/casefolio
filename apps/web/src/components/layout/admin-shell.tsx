"use client";

import {
  BarChart3,
  CreditCard,
  FolderKanban,
  LayoutDashboard,
  LayoutTemplate,
  Mail,
  Menu,
  MessageSquareHeart,
  PanelTop,
  Search,
  Settings,
  ShieldAlert,
  Tags,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
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
  { label: "Site CMS", href: "/admin/cms", icon: PanelTop },
  { label: "Projects", href: "/admin/projects", icon: FolderKanban },
  { label: "Templates", href: "/admin/templates", icon: LayoutTemplate },
  { label: "Categories & types", href: "/admin/categories", icon: Tags },
  { label: "Users", href: "/admin/users", icon: Users },
  { label: "Subscriptions & plans", href: "/admin/subscriptions", icon: CreditCard },
  { label: "Moderation", href: "/admin/moderation", icon: ShieldAlert },
  { label: "Feedback", href: "/admin/feedback", icon: MessageSquareHeart },
  { label: "Email studio", href: "/admin/emails", icon: Mail },
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
    <div className="flex min-h-screen flex-col bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[0.3125rem] focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <header className="fixed inset-x-0 top-0 z-30 h-16 border-b border-[var(--cf-lp-cream-divider)] bg-[var(--cf-bg-canvas)]/95 backdrop-blur-xl lg:left-60">
        <div className="flex h-full items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open admin navigation"
                  className="focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-[0.3125rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] text-[var(--cf-text-primary)] transition-colors outline-none hover:border-[var(--cf-lp-ink)] focus-visible:ring-2 lg:hidden"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-68 overflow-y-auto rounded-r-[0.75rem] border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark)] p-5 text-[var(--cf-lp-dark-ink)]"
              >
                <SheetHeader className="px-2 pt-1 pb-2 text-left">
                  <div className="flex items-center gap-2">
                    <SheetTitle className="type-overline text-[var(--cf-lp-lime)]">
                      Admin panel
                    </SheetTitle>
                    <Badge tone="accent">Internal</Badge>
                  </div>
                  <SheetDescription className="text-[var(--cf-lp-dark-muted)]">
                    Platform administration and governance.
                  </SheetDescription>
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
                          "focus-visible:ring-ring/40 flex items-center gap-3 rounded-[0.375rem] px-3 py-2.5 text-[0.8125rem] transition-colors outline-none focus-visible:ring-2",
                          active
                            ? "bg-[var(--cf-lp-sidebar-active)] font-semibold text-white shadow-[inset_3px_0_0_var(--cf-lp-lime)]"
                            : "font-medium text-[var(--cf-lp-sidebar-muted)] hover:bg-[var(--cf-lp-sidebar-active)]/60 hover:text-[var(--cf-lp-dark-ink)]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active
                              ? "text-[var(--cf-lp-lime)]"
                              : "text-[var(--cf-lp-sidebar-muted)]",
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
              </SheetContent>
            </Sheet>

            <BrandLogo href="/admin" className="lg:hidden" />
          </div>

          <div className="flex items-center gap-2 sm:gap-2.5">
            <Link
              href="/admin/templates"
              aria-label="Search admin templates"
              className="focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-[0.3125rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] text-[var(--cf-text-primary)] transition-colors outline-none hover:border-[var(--cf-lp-ink)] focus-visible:ring-2"
            >
              <Search className="size-4" />
            </Link>
            <UserAccountMenu
              initials={userInitials}
              name={userName}
              email={userEmail}
              image={userImage}
            />
          </div>
        </div>
      </header>

      <aside
        aria-label="Admin sidebar"
        className="hidden border-r border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark)] text-[var(--cf-lp-dark-ink)] lg:fixed lg:inset-y-0 lg:left-0 lg:z-40 lg:flex lg:w-60 lg:flex-col lg:gap-5 lg:overflow-y-auto lg:px-4 lg:py-5"
      >
        <div className="px-1">
          <BrandLogo href="/admin" inverted />
        </div>

        <div className="flex items-center justify-between gap-2 rounded-[0.375rem] border border-[var(--cf-lp-dark-rule)] bg-[var(--cf-lp-dark-elevated)] px-3 py-2">
          <span className="font-mono text-[0.625rem] font-medium tracking-[0.1em] text-[var(--cf-lp-dark-muted)] uppercase">
            Admin panel
          </span>
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
                  "focus-visible:ring-ring/40 flex items-center gap-3 rounded-[0.375rem] px-3 py-2.5 text-[0.8125rem] transition-colors outline-none focus-visible:ring-2",
                  active
                    ? "bg-[var(--cf-lp-sidebar-active)] font-semibold text-white shadow-[inset_3px_0_0_var(--cf-lp-lime)]"
                    : "font-medium text-[var(--cf-lp-sidebar-muted)] hover:bg-[var(--cf-lp-sidebar-active)]/60 hover:text-[var(--cf-lp-dark-ink)]",
                )}
              >
                <Icon
                  className={cn(
                    "size-4 shrink-0",
                    active
                      ? "text-[var(--cf-lp-lime)]"
                      : "text-[var(--cf-lp-sidebar-muted)]",
                  )}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>
      </aside>

      <div className="flex min-h-screen min-w-0 flex-1 flex-col pt-16 lg:pl-60">
        <main
          id="main-content"
          className="min-w-0 flex-1 px-4 py-6 sm:px-6 sm:py-8 lg:px-8 lg:py-10 xl:px-10"
        >
          {children}
        </main>
      </div>
    </div>
  );
}
