"use client";

import {
  AlertTriangle,
  BarChart3,
  Bell,
  Download,
  FolderKanban,
  Globe,
  HelpCircle,
  LayoutTemplate,
  Menu,
  Search,
  Settings,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState, type ComponentType, type ReactNode } from "react";
import { ThemeToggle } from "@/components/theme-toggle";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { ProBadge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import type { NotificationItem } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

export interface WorkspaceNavItem {
  label: string;
  href: string;
  icon: ComponentType<{ className?: string }>;
}

export const APP_NAV_ITEMS: readonly WorkspaceNavItem[] = [
  { label: "Projects", href: "/dashboard", icon: FolderKanban },
  { label: "Templates", href: "/templates", icon: LayoutTemplate },
  { label: "Published", href: "/published", icon: Globe },
  { label: "Exports", href: "/exports", icon: Download },
  { label: "Analytics", href: "/analytics", icon: BarChart3 },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/account", icon: Settings },
  { label: "Help", href: "/help", icon: HelpCircle },
] as const;

export interface AppShellProps {
  children: ReactNode;
  userInitials?: string;
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
  showProBadge?: boolean;
  planLabel?: string;
  projectsUsed?: number;
  projectsLimit?: number | null;
  renewsLabel?: string;
  failedPaymentPauseDateLabel?: string | null;
  initialUnreadNotifications?: number;
  initialNotifications?: NotificationItem[];
}

function isNavItemActive(pathname: string, href: string): boolean {
  return pathname === href || pathname.startsWith(`${href}/`);
}

function PlanUsageCard({
  planLabel,
  projectsUsed,
  projectsLimit,
  renewsLabel,
}: {
  planLabel: string;
  projectsUsed: number;
  projectsLimit: number | null;
  renewsLabel: string;
}) {
  const finiteLimit =
    projectsLimit !== null && projectsLimit >= 0 ? projectsLimit : null;
  const effectiveMax = finiteLimit ?? Math.max(10, projectsUsed + 2);
  const ratio = Math.min(100, Math.max(0, Math.round((projectsUsed / Math.max(1, effectiveMax)) * 100)));

  return (
    <div
      data-slot="plan-usage-card"
      className="border-border/70 bg-wash-panel flex flex-col gap-2.5 rounded-2xl border p-4 shadow-2xs"
    >
      <span className="text-accent-foreground type-overline">{planLabel}</span>
      <p className="text-foreground type-caption">{renewsLabel}</p>
      <div
        role="progressbar"
        aria-label="Project quota usage"
        aria-valuenow={projectsUsed}
        aria-valuemin={0}
        aria-valuemax={effectiveMax}
        className="bg-background/80 h-1.5 w-full overflow-hidden rounded-full"
      >
        <div
          className="bg-primary h-full rounded-full transition-all"
          style={{ width: `${ratio}%` }}
        />
      </div>
      <p className="text-muted-foreground type-caption">
        {finiteLimit !== null
          ? `${projectsUsed} of ${finiteLimit} ${finiteLimit === 1 ? "Case Study" : "projects"} used`
          : `${projectsUsed} Case ${projectsUsed === 1 ? "Study" : "Studies"} · Unlimited`}
      </p>
    </div>
  );
}

export function AppShell({
  children,
  userInitials = "AA",
  userName,
  userEmail,
  userImage,
  showProBadge = true,
  planLabel = "Pro · Active",
  projectsUsed = 6,
  projectsLimit = 10,
  renewsLabel = "Renews Nov 30, 2026",
  failedPaymentPauseDateLabel = null,
  initialUnreadNotifications = 0,
  initialNotifications = [],
}: AppShellProps) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-wash-top bg-surface text-foreground flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <header className="border-border/70 bg-elevated/88 sticky top-0 z-40 border-b backdrop-blur-xl">
        <div className="flex h-17 items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open workspace navigation"
                  className="border-border/80 bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2 lg:hidden"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 rounded-r-3xl p-4">
                <SheetHeader className="px-2 pt-1 pb-2 text-left">
                  <SheetTitle>Workspace</SheetTitle>
                  <SheetDescription>Navigate your Casefolio workspace.</SheetDescription>
                </SheetHeader>
                <nav
                  aria-label="Mobile workspace navigation"
                  className="flex flex-1 flex-col gap-1"
                >
                  {APP_NAV_ITEMS.map((item) => {
                    const Icon = item.icon;
                    const active = isNavItemActive(pathname, item.href);
                    return (
                      <Link
                        key={item.href}
                        href={item.href}
                        aria-current={active ? "page" : undefined}
                        onClick={() => setMobileOpen(false)}
                        className={cn(
                          "focus-visible:ring-ring/40 flex items-center gap-3 rounded-full border px-3.5 py-2.5 transition-all outline-none focus-visible:ring-2",
                          active
                            ? "border-border/80 bg-elevated text-foreground type-body-s-strong shadow-xs"
                            : "text-muted-foreground hover:bg-surface hover:text-foreground type-body-s border-transparent",
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
                <PlanUsageCard
                  planLabel={planLabel}
                  projectsUsed={projectsUsed}
                  projectsLimit={projectsLimit}
                  renewsLabel={renewsLabel}
                />
              </SheetContent>
            </Sheet>

            <BrandLogo href="/dashboard" subtitle="CASE STUDY BUILDER" />
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {showProBadge && <ProBadge className="hidden sm:inline-flex" />}
            <button
              type="button"
              aria-label="Search workspace"
              className="border-border/80 bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-full border shadow-2xs transition-colors outline-none focus-visible:ring-2"
            >
              <Search className="size-4" />
            </button>
            <NotificationsBell
              initialUnreadCount={initialUnreadNotifications}
              initialNotifications={initialNotifications}
            />
            <ThemeToggle />
            <UserAccountMenu
              initials={userInitials}
              name={userName}
              email={userEmail}
              image={userImage}
            />
          </div>
        </div>

        {failedPaymentPauseDateLabel && (
          <div
            role="alert"
            data-testid="app-failed-payment-banner"
            className="border-destructive/30 bg-destructive-soft text-destructive flex flex-wrap items-center justify-center gap-2 border-t px-4 py-2 text-center"
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span className="type-body-s">
              Your last payment failed — Pro features pause on {failedPaymentPauseDateLabel}.
            </span>
            <Link
              href="/account/billing"
              className="text-destructive type-body-s-strong underline underline-offset-4"
            >
              Update payment &rarr;
            </Link>
          </div>
        )}
      </header>

      <div className="flex min-w-0 flex-1">
        <aside
          aria-label="Workspace sidebar"
          className="border-border/70 bg-elevated/70 hidden w-66 shrink-0 flex-col justify-between border-r p-4 backdrop-blur-md lg:flex"
        >
          <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
            {APP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/40 flex items-center gap-3 rounded-full border px-3.5 py-2.5 transition-all outline-none focus-visible:ring-2",
                    active
                      ? "border-border/80 bg-elevated text-foreground type-body-s-strong shadow-xs"
                      : "text-muted-foreground hover:bg-surface hover:text-foreground type-body-s border-transparent",
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

          <PlanUsageCard
            planLabel={planLabel}
            projectsUsed={projectsUsed}
            projectsLimit={projectsLimit}
            renewsLabel={renewsLabel}
          />
        </aside>

        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-6 lg:p-10">
          {children}
        </main>
      </div>
    </div>
  );
}
