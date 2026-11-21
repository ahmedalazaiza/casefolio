import Link from "next/link";
import type { ReactNode } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { cn } from "@/lib/utils";

export type AccountSettingsTab =
  | "profile"
  | "security"
  | "billing"
  | "invoices"
  | "team"
  | "recovery";

const ACCOUNT_TABS: ReadonlyArray<{
  key: AccountSettingsTab;
  label: string;
  href: string;
}> = [
  { key: "profile", label: "Profile", href: "/account" },
  { key: "security", label: "Security", href: "/account/security" },
  { key: "billing", label: "Billing & plan", href: "/account/billing" },
  { key: "invoices", label: "Invoices", href: "/account/invoices" },
  { key: "team", label: "Team & invites", href: "/account/team" },
  { key: "recovery", label: "Recovery portal", href: "/account/recovery" },
];

export interface AccountSettingsShellProps {
  activeTab: AccountSettingsTab;
  children: ReactNode;
}

export function AccountSettingsShell({ activeTab, children }: AccountSettingsShellProps) {
  return (
    <div
      data-testid="account-settings-shell"
      className="mx-auto flex w-full min-w-0 max-w-6xl flex-col gap-4 sm:gap-5"
    >
      <header className="relative overflow-hidden rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-5 py-4 sm:px-6">
        <div className="flex flex-col gap-1">
          <Eyebrow className="w-fit px-2.5 py-0.5 text-[0.6875rem]">
            Settings
          </Eyebrow>
          <h1 className="v3-dashboard-title text-[var(--cf-text-primary)]">
            Account settings
          </h1>
          <p className="max-w-xl text-xs text-[var(--cf-text-secondary)] sm:text-sm">
            Manage your profile, security credentials, subscription billing, invoices, and studio
            team seats.
          </p>
        </div>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-5 md:grid-cols-[215px_minmax(0,1fr)] md:gap-6">
        <nav
          aria-label="Account sections"
          className="flex min-w-0 flex-wrap gap-1 self-start rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-1.5 md:flex-col"
        >
          {ACCOUNT_TABS.map((tab, index) => {
            const isActive = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                data-testid={`account-tab-${tab.key}`}
                className={cn(
                  "inline-flex items-center justify-between gap-2 rounded-lg px-3 py-2 text-xs transition-all outline-none focus-visible:ring-2 focus-visible:ring-[var(--cf-royal)]/40",
                  isActive
                    ? "bg-[var(--cf-royal)] font-semibold text-[var(--cf-text-on-royal)]"
                    : "font-medium text-[var(--cf-text-secondary)] hover:bg-[var(--cf-bg-canvas)] hover:text-[var(--cf-text-primary)]",
                )}
              >
                <span>{tab.label}</span>
                <span
                  className={cn(
                    "rounded-md px-1.5 py-0.5 font-mono text-[0.6875rem] font-bold",
                    isActive
                      ? "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]"
                      : "bg-[var(--cf-bg-sunken)] text-[var(--cf-text-tertiary)]",
                  )}
                >
                  {String(index + 1).padStart(2, "0")}
                </span>
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
