import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export type AccountSettingsTab = "profile" | "security" | "billing" | "invoices" | "team";

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
];

export interface AccountSettingsShellProps {
  activeTab: AccountSettingsTab;
  children: ReactNode;
}

export function AccountSettingsShell({ activeTab, children }: AccountSettingsShellProps) {
  return (
    <div
      data-testid="account-settings-shell"
      className="mx-auto flex w-full max-w-5xl flex-col gap-8"
    >
      <header className="flex flex-col gap-1.5">
        <span className="text-tertiary type-overline">SETTINGS</span>
        <h1 className="text-foreground type-display-m">Account settings</h1>
      </header>

      <div className="grid gap-6 md:grid-cols-[200px_minmax(0,1fr)] md:gap-12">
        <nav
          aria-label="Account sections"
          className="flex flex-wrap gap-1.5 md:flex-col md:gap-1"
        >
          {ACCOUNT_TABS.map((tab) => {
            const isActive = tab.key === activeTab;
            return (
              <Link
                key={tab.key}
                href={tab.href}
                aria-current={isActive ? "page" : undefined}
                data-testid={`account-tab-${tab.key}`}
                className={cn(
                  "focus-visible:ring-ring/40 inline-flex items-center rounded-lg border px-3 py-2 transition-colors outline-none focus-visible:ring-2",
                  isActive
                    ? "border-border bg-elevated text-foreground shadow-card type-body-s-strong"
                    : "text-muted-foreground hover:bg-elevated/60 hover:text-foreground type-body-s border-transparent",
                )}
              >
                {tab.label}
              </Link>
            );
          })}
        </nav>

        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
