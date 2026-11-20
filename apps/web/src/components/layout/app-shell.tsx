"use client";

import type { PlanTier } from "@casefolio/db";
import {
  AlertTriangle,
  BarChart3,
  Bell,
  Building2,
  Check,
  ChevronDown,
  CreditCard,
  Download,
  FolderKanban,
  Globe,
  HelpCircle,
  LayoutTemplate,
  Loader2,
  Menu,
  MessageSquareHeart,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState, type ComponentType, type ReactNode } from "react";
import { toast } from "sonner";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import {
  dispatchOpenFeedbackSurvey,
  QuickFeedbackSurvey,
} from "@/components/feedback/quick-feedback-survey";
import { UserAccountMenu } from "@/components/layout/user-account-menu";
import { NotificationsBell } from "@/components/notifications/notifications-bell";
import { ThemeToggle } from "@/components/theme-toggle";
import { ProBadge, TeamsBadge } from "@/components/ui/badge";
import { BrandLogo } from "@/components/ui/brand-logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { isUnlimitedProjectsLimit, type PaidPlanTier } from "@/lib/billing/plans";
import type { NotificationItem } from "@/lib/notifications/types";
import { cn } from "@/lib/utils";

const SIDEBAR_COLLAPSED_STORAGE_KEY = "cf-sidebar-collapsed";

function formatBytesCompact(bytes: number): string {
  const gb = 1024 * 1024 * 1024;
  const mb = 1024 * 1024;
  if (bytes >= gb) {
    return `${(bytes / gb).toFixed(bytes % gb === 0 ? 0 : 1)} GB`;
  }
  if (bytes >= mb) {
    return `${Math.round(bytes / mb)} MB`;
  }
  return `${Math.max(0, Math.round(bytes / 1024))} KB`;
}

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
  { label: "Team", href: "/account/team", icon: Users },
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/account", icon: Settings },
  { label: "Help", href: "/help", icon: HelpCircle },
] as const;

export interface AppShellWorkspaceOption {
  workspaceId: string;
  kind: "personal" | "team";
  name: string;
  organizationId: string | null;
  plan: PlanTier;
  paidSeats: number;
  role?: string | null;
}

export interface AppShellActiveWorkspaceOverview {
  kind: "personal" | "team";
  role: string | null;
  paidSeats: number;
  usage: {
    activeProjects: number;
    publishedProjects: number;
    storageBytes: number;
    monthlyExportsUsed: number;
  };
  quotas: {
    activeProjectsLimit: number;
    publishedProjectsLimit: number;
    storageBytesLimit: number;
    monthlyExportsLimit: number;
  };
}

export interface AppShellProps {
  children: ReactNode;
  userInitials?: string;
  userName?: string;
  userEmail?: string;
  userImage?: string | null;
  showProBadge?: boolean;
  headerPlanTier?: "free" | "pro" | "team";
  planTier?: "free" | "pro" | "team";
  planStatus?: string;
  planLabel?: string;
  projectsUsed?: number;
  projectsLimit?: number | null;
  quotaSummaryLabel?: string;
  renewsLabel?: string;
  failedPaymentPauseDateLabel?: string | null;
  renewalGraceBanner?: {
    kind: "past_due" | "ending_soon";
    daysRemaining: number;
    deadlineLabel: string;
    isTeam: boolean;
    isTeamOwner: boolean;
  } | null;
  activeOrganizationId?: string | null;
  activeWorkspaceName?: string;
  activeWorkspaceOverview?: AppShellActiveWorkspaceOverview | null;
  workspaces?: AppShellWorkspaceOption[];
  initialUnreadNotifications?: number;
  initialNotifications?: NotificationItem[];
}

function isNavItemActive(pathname: string, href: string): boolean {
  if (
    href === "/account" &&
    (pathname === "/account/team" || pathname.startsWith("/account/team/"))
  ) {
    return false;
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

function formatWorkspaceBadgeText(ws: AppShellWorkspaceOption): string {
  if (ws.kind === "personal") {
    return ws.plan === "pro" ? "PRO" : "FREE";
  }
  if (ws.plan === "team" || ws.plan === "plus") {
    return `TEAMS · ${ws.paidSeats}`;
  }
  return "UNFUNDED";
}

function PlanUsageCard({
  planTier,
  planStatus,
  planLabel,
  projectsUsed,
  projectsLimit,
  quotaSummaryLabel,
  renewsLabel,
  activeOrganizationId,
  onOpenCheckout,
}: {
  planTier: "free" | "pro" | "team";
  planStatus: string;
  planLabel: string;
  projectsUsed: number;
  projectsLimit: number | null;
  quotaSummaryLabel?: string;
  renewsLabel: string;
  activeOrganizationId: string | null;
  onOpenCheckout: (plan: PaidPlanTier) => void;
}) {
  const finiteLimit = projectsLimit !== null && projectsLimit >= 0 ? projectsLimit : 10;
  const effectiveMax = Math.max(1, finiteLimit);
  const ratio = Math.min(
    100,
    Math.max(0, Math.round((projectsUsed / effectiveMax) * 100)),
  );

  const defaultSummary =
    planTier === "team"
      ? `${projectsUsed} of ${effectiveMax} Seats occupied · Unlimited Case Studies`
      : planTier === "pro"
        ? `${projectsUsed} of ${effectiveMax} Case Studies`
        : `${projectsUsed} of 1 Lifetime Case Study credit used`;

  const resolvedSummary = quotaSummaryLabel ?? defaultSummary;
  const isPastDue = planStatus === "past_due";
  const isUnfundedTeam = planTier === "free" && Boolean(activeOrganizationId);

  return (
    <div
      data-slot="plan-usage-card"
      className="v3-pattern-dots-dark flex flex-col gap-3 rounded-xl border border-[var(--cf-border-on-royal)] p-4 text-[var(--cf-text-on-royal)]"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="inline-flex items-center rounded-md bg-[var(--cf-bg-accent)] px-2 py-0.5 text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
          {planLabel}
        </span>
      </div>
      <p className="type-caption text-[var(--cf-text-on-royal-muted)]">{renewsLabel}</p>
      <div
        role="progressbar"
        aria-label="Project quota usage"
        aria-valuenow={projectsUsed}
        aria-valuemin={0}
        aria-valuemax={effectiveMax}
        className="h-2 w-full overflow-hidden rounded-full bg-[var(--cf-bg-elevated)]/20"
      >
        <div
          className="h-full rounded-full bg-[var(--cf-bg-accent)] transition-all"
          style={{ width: `${ratio}%` }}
        />
      </div>
      <p className="type-caption font-medium text-[var(--cf-text-on-royal)]">
        {resolvedSummary}
      </p>

      {planTier === "free" && !isUnfundedTeam && (
        <button
          type="button"
          data-testid="sidebar-upgrade-pro-btn"
          onClick={() => onOpenCheckout("pro")}
          className="focus-visible:ring-ring/40 mt-0.5 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--cf-bg-accent)] px-3 py-2 text-xs font-bold text-[var(--cf-text-on-accent)] transition-opacity outline-none hover:opacity-95 focus-visible:ring-2"
        >
          <Sparkles className="size-3.5 shrink-0" />
          <span>Upgrade to Pro — $7.99/mo</span>
        </button>
      )}

      {isUnfundedTeam && (
        <div className="mt-0.5 flex flex-col gap-1.5">
          <button
            type="button"
            data-testid="sidebar-upgrade-teams-btn"
            onClick={() => onOpenCheckout("team")}
            className="focus-visible:ring-ring/40 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--cf-bg-accent)] px-3 py-2 text-xs font-bold text-[var(--cf-text-on-accent)] transition-opacity outline-none hover:opacity-95 focus-visible:ring-2"
          >
            <Users className="size-3.5 shrink-0" />
            <span>Activate Teams — $5.99/seat/mo</span>
          </button>
          <Link
            href="/account/team"
            className="text-center text-xs font-semibold text-[var(--cf-text-on-royal-muted)] underline-offset-4 hover:text-[var(--cf-text-on-royal)] hover:underline"
          >
            Manage Team workspace
          </Link>
        </div>
      )}

      {planTier === "pro" && (
        <div data-testid="sidebar-pro-actions" className="mt-0.5 flex flex-col gap-2">
          <button
            type="button"
            data-testid="sidebar-upgrade-teams-btn"
            onClick={() => onOpenCheckout("team")}
            className="focus-visible:ring-ring/40 inline-flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--cf-bg-accent)] px-3 py-2 text-xs font-bold whitespace-nowrap text-[var(--cf-text-on-accent)] transition-opacity outline-none hover:opacity-95 focus-visible:ring-2"
          >
            <Users className="size-3.5 shrink-0" />
            <span>Upgrade to Teams</span>
          </button>
          <Link
            href="/account/billing"
            data-testid="sidebar-billing-link"
            className="focus-visible:ring-ring/40 inline-flex w-full items-center justify-center gap-1.5 rounded-lg border border-[var(--cf-border-on-royal)] px-3 py-2 text-xs font-semibold whitespace-nowrap text-[var(--cf-text-on-royal)] transition-colors outline-none hover:bg-[var(--cf-bg-elevated)]/15 focus-visible:ring-2"
          >
            <CreditCard className="size-3.5 shrink-0" />
            <span>{isPastDue ? "Update payment" : "Billing"}</span>
          </Link>
        </div>
      )}

      {planTier === "team" && (
        <div className="mt-0.5 flex flex-col gap-1.5">
          <Link
            href="/account/team"
            data-testid="sidebar-manage-team-link"
            className="focus-visible:ring-ring/40 inline-flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--cf-bg-accent)] px-3 py-2 text-xs font-bold text-[var(--cf-text-on-accent)] transition-opacity outline-none hover:opacity-95 focus-visible:ring-2"
          >
            <Users className="size-3.5 shrink-0" />
            <span>Manage Team &amp; Seats</span>
          </Link>
          {isPastDue && (
            <Link
              href="/account/billing"
              className="text-center text-xs font-semibold text-[var(--cf-bg-accent)] underline underline-offset-4"
            >
              Update payment
            </Link>
          )}
        </div>
      )}
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
  headerPlanTier,
  planTier,
  planStatus = "active",
  planLabel = "PRO · ACTIVE",
  projectsUsed = 6,
  projectsLimit = 10,
  quotaSummaryLabel,
  renewsLabel = "Renews Nov 30, 2026",
  failedPaymentPauseDateLabel = null,
  renewalGraceBanner = null,
  activeOrganizationId = null,
  activeWorkspaceName,
  activeWorkspaceOverview = null,
  workspaces = [],
  initialUnreadNotifications = 0,
  initialNotifications = [],
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [switchingWorkspace, setSwitchingWorkspace] = useState(false);
  const [checkoutPlan, setCheckoutPlan] = useState<PaidPlanTier | null>(null);

  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(SIDEBAR_COLLAPSED_STORAGE_KEY);
      if (saved === "1") {
        setSidebarCollapsed(true);
      }
    } catch {
      // Ignore storage errors in restricted privacy contexts
    }
  }, []);

  function toggleSidebarCollapsed() {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        window.localStorage.setItem(SIDEBAR_COLLAPSED_STORAGE_KEY, next ? "1" : "0");
      } catch {
        // Ignore storage errors
      }
      return next;
    });
  }

  async function handleSwitchWorkspace(targetOrgId: string | null) {
    if (targetOrgId === activeOrganizationId) return;
    setSwitchingWorkspace(true);
    try {
      const res = await fetch("/api/workspaces", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ organizationId: targetOrgId }),
      });
      const json = (await res.json()) as { ok?: boolean; error?: string };
      if (!res.ok || !json.ok) {
        toast.error(json.error ?? "Could not switch workspace.");
        return;
      }
      router.refresh();
    } catch {
      toast.error("Network error while switching workspace.");
    } finally {
      setSwitchingWorkspace(false);
    }
  }

  const resolvedPlanTier: "free" | "pro" | "team" =
    planTier ?? (showProBadge ? "pro" : "free");
  const resolvedHeaderBadge: "free" | "pro" | "team" =
    headerPlanTier ?? resolvedPlanTier;

  const activeWsOption =
    workspaces.find((ws) => (ws.organizationId ?? null) === (activeOrganizationId ?? null)) ??
    workspaces[0] ??
    null;

  return (
    <div className="bg-wash-top text-foreground flex min-h-screen flex-col">
      <a
        href="#main-content"
        className="focus:bg-primary focus:text-primary-foreground sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-xl focus:px-4 focus:py-2"
      >
        Skip to main content
      </a>

      <header className="fixed inset-x-0 top-0 z-40 h-17 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]/95 backdrop-blur-xl">
        <div className="flex h-full items-center justify-between gap-2 px-4 sm:gap-3 sm:px-6">
          <div className="flex min-w-0 items-center gap-2.5 sm:gap-3">
            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <button
                  type="button"
                  aria-label="Open workspace navigation"
                  className="focus-visible:ring-ring/40 inline-flex size-9 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)] transition-colors outline-none hover:border-[var(--cf-royal)] hover:bg-[var(--cf-royal-soft)] focus-visible:ring-2 lg:hidden"
                >
                  <Menu className="size-4" />
                </button>
              </SheetTrigger>
              <SheetContent
                side="left"
                className="w-72 overflow-y-auto rounded-r-2xl border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4"
              >
                <SheetHeader className="px-2 pt-1 pb-2 text-left">
                  <SheetTitle>Workspace</SheetTitle>
                  <SheetDescription>Navigate your Casefolio workspace.</SheetDescription>
                </SheetHeader>
                <nav
                  aria-label="Mobile workspace navigation"
                  className="flex flex-1 flex-col gap-1.5"
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
                          "focus-visible:ring-ring/40 flex items-center gap-3 rounded-xl border px-3.5 py-2.5 transition-colors outline-none focus-visible:ring-2",
                          active
                            ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] font-semibold text-[var(--cf-text-on-royal)]"
                            : "type-body-s border-transparent text-[var(--cf-text-secondary)] hover:border-[var(--cf-border-subtle)] hover:bg-[var(--cf-bg-canvas)] hover:text-[var(--cf-text-primary)]",
                        )}
                      >
                        <Icon
                          className={cn(
                            "size-4 shrink-0",
                            active
                              ? "text-[var(--cf-text-on-royal)]"
                              : "text-[var(--cf-text-tertiary)]",
                          )}
                        />
                        <span>{item.label}</span>
                      </Link>
                    );
                  })}
                </nav>
                <PlanUsageCard
                  planTier={resolvedPlanTier}
                  planStatus={planStatus}
                  planLabel={planLabel}
                  projectsUsed={projectsUsed}
                  projectsLimit={projectsLimit}
                  quotaSummaryLabel={quotaSummaryLabel}
                  renewsLabel={renewsLabel}
                  activeOrganizationId={activeOrganizationId}
                  onOpenCheckout={(targetPlan) => {
                    setMobileOpen(false);
                    setCheckoutPlan(targetPlan);
                  }}
                />
              </SheetContent>
            </Sheet>

            <BrandLogo href="/dashboard" subtitle="CASE STUDY BUILDER" />

            {activeWsOption && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    disabled={switchingWorkspace}
                    data-testid="shell-workspace-switcher"
                    aria-label="Switch active workspace"
                    className="focus-visible:ring-ring/40 inline-flex max-w-52 items-center gap-2 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-2.5 py-1.5 text-xs font-semibold text-[var(--cf-text-primary)] transition-colors outline-none hover:border-[var(--cf-border-strong)] hover:bg-[var(--cf-bg-surface)] focus-visible:ring-2 disabled:opacity-60 sm:max-w-72"
                  >
                    {switchingWorkspace ? (
                      <Loader2 className="size-3.5 shrink-0 animate-spin text-[var(--cf-text-secondary)]" />
                    ) : activeWsOption.kind === "team" ? (
                      <Users className="size-3.5 shrink-0 text-[var(--cf-text-secondary)]" />
                    ) : (
                      <Building2 className="size-3.5 shrink-0 text-[var(--cf-text-secondary)]" />
                    )}
                    <span className="truncate">
                      {activeWorkspaceName ??
                        (activeWsOption.kind === "personal"
                          ? "Personal Workspace"
                          : activeWsOption.name)}
                    </span>
                    <span className="hidden rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-[var(--cf-text-secondary)] sm:inline-flex">
                      {formatWorkspaceBadgeText(activeWsOption)}
                    </span>
                    <ChevronDown className="size-3.5 shrink-0 text-[var(--cf-text-tertiary)]" />
                  </button>
                </DropdownMenuTrigger>
                <DropdownMenuContent
                  align="start"
                  className="w-80 p-2"
                  data-testid="shell-workspace-dropdown-content"
                >
                  {/* Active Workspace Summary + Quotas */}
                  <div className="mb-1.5 flex flex-col gap-2.5 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-2.5">
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-xs font-bold text-[var(--cf-text-primary)]">
                          {activeWorkspaceName ??
                            (activeWsOption.kind === "personal"
                              ? "Personal Workspace"
                              : activeWsOption.name)}
                        </span>
                        <span className="text-[0.6875rem] text-[var(--cf-text-secondary)]">
                          {activeWsOption.kind === "personal"
                            ? `Personal Workspace · ${activeWsOption.plan.toUpperCase()}`
                            : activeWsOption.plan === "team" || activeWsOption.plan === "plus"
                              ? `Teams · ${activeWsOption.paidSeats} ${activeWsOption.paidSeats === 1 ? "seat" : "seats"}`
                              : "Team (Unfunded)"}
                        </span>
                      </div>
                      {(activeWorkspaceOverview?.role ?? activeWsOption.role) && (
                        <span className="shrink-0 rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2 py-0.5 text-[0.625rem] font-semibold tracking-wider text-[var(--cf-text-secondary)] uppercase">
                          {activeWorkspaceOverview?.role ?? activeWsOption.role}
                        </span>
                      )}
                    </div>

                    {activeWorkspaceOverview && (
                      <div
                        data-testid="shell-workspace-quotas"
                        className="grid grid-cols-2 gap-1.5 text-[0.6875rem]"
                      >
                        <div className="flex items-center justify-between gap-1 rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2 py-1">
                          <span className="text-[var(--cf-text-tertiary)]">Active</span>
                          <span className="font-mono font-semibold text-[var(--cf-text-primary)]">
                            {activeWorkspaceOverview.usage.activeProjects}/
                            {isUnlimitedProjectsLimit(
                              activeWorkspaceOverview.quotas.activeProjectsLimit,
                            )
                              ? "Unlimited"
                              : activeWorkspaceOverview.quotas.activeProjectsLimit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2 py-1">
                          <span className="text-[var(--cf-text-tertiary)]">Published</span>
                          <span className="font-mono font-semibold text-[var(--cf-text-primary)]">
                            {activeWorkspaceOverview.usage.publishedProjects}/
                            {isUnlimitedProjectsLimit(
                              activeWorkspaceOverview.quotas.publishedProjectsLimit,
                            )
                              ? "Unlimited"
                              : activeWorkspaceOverview.quotas.publishedProjectsLimit}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2 py-1">
                          <span className="text-[var(--cf-text-tertiary)]">Storage</span>
                          <span className="font-mono font-semibold text-[var(--cf-text-primary)]">
                            {formatBytesCompact(activeWorkspaceOverview.usage.storageBytes)}/
                            {formatBytesCompact(
                              activeWorkspaceOverview.quotas.storageBytesLimit,
                            )}
                          </span>
                        </div>
                        <div className="flex items-center justify-between gap-1 rounded border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2 py-1">
                          <span className="text-[var(--cf-text-tertiary)]">Exports</span>
                          <span className="font-mono font-semibold text-[var(--cf-text-primary)]">
                            {activeWorkspaceOverview.usage.monthlyExportsUsed}/
                            {activeWorkspaceOverview.quotas.monthlyExportsLimit}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="px-2 py-1 text-[0.65rem] font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
                    Switch workspace
                  </div>
                  {workspaces.map((ws) => {
                    const isSelected =
                      (ws.organizationId ?? null) === (activeOrganizationId ?? null);
                    const displayTitle =
                      ws.kind === "personal" ? "Personal Workspace" : ws.name;
                    return (
                      <DropdownMenuItem
                        key={ws.workspaceId}
                        onSelect={() => void handleSwitchWorkspace(ws.organizationId)}
                        className="flex items-center justify-between gap-2 rounded-lg"
                      >
                        <div className="flex min-w-0 items-center gap-2">
                          {ws.kind === "team" ? (
                            <Users className="size-3.5 shrink-0 text-[var(--cf-text-tertiary)]" />
                          ) : (
                            <Building2 className="size-3.5 shrink-0 text-[var(--cf-text-tertiary)]" />
                          )}
                          <span className="truncate text-xs font-medium">{displayTitle}</span>
                        </div>
                        <div className="flex shrink-0 items-center gap-1.5">
                          <span className="rounded bg-[var(--cf-bg-surface)] px-1.5 py-0.5 font-mono text-[0.625rem] font-semibold text-[var(--cf-text-secondary)]">
                            {formatWorkspaceBadgeText(ws)}
                          </span>
                          {isSelected && <Check className="text-primary size-3.5" />}
                        </div>
                      </DropdownMenuItem>
                    );
                  })}
                  <DropdownMenuSeparator />
                  <DropdownMenuItem asChild className="rounded-lg">
                    <Link href="/account/team" className="flex items-center gap-2 text-xs">
                      <Users className="size-3.5" />
                      <span>Manage team &amp; seats</span>
                    </Link>
                  </DropdownMenuItem>
                  <DropdownMenuItem asChild className="rounded-lg">
                    <Link href="/account/billing" className="flex items-center gap-2 text-xs">
                      <CreditCard className="size-3.5" />
                      <span>Billing &amp; plan</span>
                    </Link>
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>

          <div className="flex shrink-0 items-center gap-1.5 sm:gap-2.5">
            {resolvedHeaderBadge === "team" ? (
              <TeamsBadge className="hidden sm:inline-flex" />
            ) : resolvedHeaderBadge === "pro" ? (
              <ProBadge className="hidden sm:inline-flex" />
            ) : null}
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
      </header>

      <aside
        aria-label="Workspace sidebar"
        data-collapsed={sidebarCollapsed ? "true" : "false"}
        className={cn(
          "hidden border-r border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] transition-[width,padding] duration-200 ease-out lg:fixed lg:top-17 lg:bottom-0 lg:left-0 lg:z-30 lg:flex lg:flex-col lg:justify-between lg:overflow-y-auto",
          sidebarCollapsed ? "lg:w-18 lg:px-2.5 lg:py-4" : "lg:w-64 lg:p-4",
        )}
      >
        <div className="flex flex-col gap-3">
          <div
            className={cn(
              "flex items-center pt-0.5",
              sidebarCollapsed ? "justify-center" : "justify-between gap-2 px-2",
            )}
          >
            {!sidebarCollapsed && (
              <div className="flex items-center gap-2">
                <span
                  aria-hidden="true"
                  className="size-2 rounded-full bg-[var(--cf-royal)]"
                />
                <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
                  Studio Navigation
                </span>
              </div>
            )}
            <button
              type="button"
              onClick={toggleSidebarCollapsed}
              aria-label={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              title={sidebarCollapsed ? "Expand sidebar" : "Collapse sidebar"}
              data-testid="sidebar-collapse-toggle"
              className="focus-visible:ring-ring/40 inline-flex size-8 cursor-pointer items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] transition-colors outline-none hover:border-[var(--cf-royal)] hover:bg-[var(--cf-bg-surface)] hover:text-[var(--cf-text-primary)] focus-visible:ring-2"
            >
              {sidebarCollapsed ? (
                <PanelLeftOpen className="size-4" />
              ) : (
                <PanelLeftClose className="size-4" />
              )}
            </button>
          </div>

          <nav aria-label="Workspace navigation" className="flex flex-col gap-1">
            {APP_NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active = isNavItemActive(pathname, item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={sidebarCollapsed ? item.label : undefined}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "focus-visible:ring-ring/40 flex items-center rounded-lg border text-[0.8125rem] transition-colors outline-none focus-visible:ring-2",
                    sidebarCollapsed ? "justify-center p-2" : "gap-2.5 px-3 py-2",
                    active
                      ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] font-semibold text-[var(--cf-text-on-royal)]"
                      : "border-transparent font-medium text-[var(--cf-text-secondary)] hover:border-[var(--cf-border-subtle)] hover:bg-[var(--cf-bg-canvas)] hover:text-[var(--cf-text-primary)]",
                  )}
                >
                  <Icon
                    className={cn(
                      "size-4 shrink-0",
                      active
                        ? "text-[var(--cf-text-on-royal)]"
                        : "text-[var(--cf-text-tertiary)]",
                    )}
                  />
                  <span className={cn(sidebarCollapsed && "sr-only")}>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {sidebarCollapsed ? (
          <div className="flex flex-col items-center pt-2">
            {resolvedPlanTier === "team" ? (
              <Link
                href="/account/team"
                title={`${planLabel} · Manage Team & Seats`}
                aria-label="Manage Team and Seats"
                data-testid="sidebar-collapsed-plan-action"
                className="focus-visible:ring-ring/40 inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-bg-accent)] transition-opacity outline-none hover:opacity-90 focus-visible:ring-2"
              >
                <Users className="size-4" />
              </Link>
            ) : (
              <button
                type="button"
                title={
                  resolvedPlanTier === "pro"
                    ? `${planLabel} · Upgrade to Teams`
                    : `${planLabel} · Upgrade to Pro ($7.99/mo)`
                }
                aria-label={
                  resolvedPlanTier === "pro"
                    ? "Upgrade to Teams"
                    : "Upgrade to Pro"
                }
                data-testid="sidebar-collapsed-plan-action"
                onClick={() =>
                  setCheckoutPlan(
                    resolvedPlanTier === "pro" || Boolean(activeOrganizationId)
                      ? "team"
                      : "pro",
                  )
                }
                className="focus-visible:ring-ring/40 inline-flex size-10 cursor-pointer items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-bg-accent)] transition-opacity outline-none hover:opacity-90 focus-visible:ring-2"
              >
                <Sparkles className="size-4" />
              </button>
            )}
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            <PlanUsageCard
              planTier={resolvedPlanTier}
              planStatus={planStatus}
              planLabel={planLabel}
              projectsUsed={projectsUsed}
              projectsLimit={projectsLimit}
              quotaSummaryLabel={quotaSummaryLabel}
              renewsLabel={renewsLabel}
              activeOrganizationId={activeOrganizationId}
              onOpenCheckout={(targetPlan) => setCheckoutPlan(targetPlan)}
            />
            <button
              type="button"
              data-testid="sidebar-feedback-trigger"
              onClick={() => dispatchOpenFeedbackSurvey("manual")}
              className="focus-visible:ring-ring/40 flex items-center justify-center gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3 py-2 text-xs font-semibold text-[var(--cf-text-secondary)] transition-colors outline-none hover:border-[var(--cf-royal)] hover:text-[var(--cf-royal-text)] focus-visible:ring-2"
            >
              <MessageSquareHeart className="size-3.5 text-[var(--cf-royal-text)]" />
              <span>Share quick feedback</span>
            </button>
          </div>
        )}
      </aside>

      <div
        className={cn(
          "flex min-h-screen min-w-0 flex-1 flex-col pt-17 transition-[padding] duration-200 ease-out",
          sidebarCollapsed ? "lg:pl-18" : "lg:pl-64",
        )}
      >
        {(renewalGraceBanner || failedPaymentPauseDateLabel) && (
          <div
            role="alert"
            data-testid="app-failed-payment-banner"
            className={cn(
              "flex flex-wrap items-center justify-center gap-2 border-b px-4 py-2 text-center",
              renewalGraceBanner?.kind === "ending_soon"
                ? "border-warning/30 bg-warning-soft text-foreground"
                : "border-destructive/30 bg-destructive-soft text-destructive",
            )}
          >
            <AlertTriangle className="size-4 shrink-0" />
            <span className="type-body-s">
              {renewalGraceBanner
                ? renewalGraceBanner.kind === "past_due"
                  ? renewalGraceBanner.isTeam
                    ? `Team renewal failed — ${renewalGraceBanner.daysRemaining} ${renewalGraceBanner.daysRemaining === 1 ? "day" : "days"} left (until ${renewalGraceBanner.deadlineLabel}) before all Team projects lock.`
                    : `Renewal payment failed — you have ${renewalGraceBanner.daysRemaining} ${renewalGraceBanner.daysRemaining === 1 ? "day" : "days"} (until ${renewalGraceBanner.deadlineLabel}) before reverting to Free and locking extra Case Studies.`
                  : renewalGraceBanner.isTeam
                    ? `Team subscription ends in ${renewalGraceBanner.daysRemaining} ${renewalGraceBanner.daysRemaining === 1 ? "day" : "days"} (${renewalGraceBanner.deadlineLabel}) — renew before Team projects lock.`
                    : `Your Pro plan ends in ${renewalGraceBanner.daysRemaining} ${renewalGraceBanner.daysRemaining === 1 ? "day" : "days"} (${renewalGraceBanner.deadlineLabel}) — renew to keep all Case Studies unlocked.`
                : `Your last payment failed — ${resolvedPlanTier === "team" ? "Teams" : "Pro"} features pause on ${failedPaymentPauseDateLabel}.`}
            </span>
            {(!renewalGraceBanner || !renewalGraceBanner.isTeam || renewalGraceBanner.isTeamOwner) && (
              <Link
                href="/account/billing"
                className={cn(
                  "type-body-s-strong underline underline-offset-4",
                  renewalGraceBanner?.kind === "ending_soon"
                    ? "text-foreground"
                    : "text-destructive",
                )}
              >
                {renewalGraceBanner?.kind === "ending_soon"
                  ? "Renew subscription"
                  : "Update payment"}{" "}
                &rarr;
              </Link>
            )}
          </div>
        )}

        <main id="main-content" className="min-w-0 flex-1 p-4 sm:p-5 lg:p-6 xl:p-8">
          {children}
        </main>
      </div>

      {checkoutPlan !== null && (
        <PaddleCheckoutModal
          open={checkoutPlan !== null}
          onOpenChange={(nextOpen) => {
            if (!nextOpen) setCheckoutPlan(null);
          }}
          initialPlan={checkoutPlan}
          orgId={checkoutPlan === "team" ? activeOrganizationId : null}
        />
      )}
      <QuickFeedbackSurvey />
    </div>
  );
}
