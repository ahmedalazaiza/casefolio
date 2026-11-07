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
      className="mx-auto flex w-full min-w-0 max-w-5xl flex-col gap-6 sm:gap-8"
    >
      <header className="flex flex-col gap-2">
        <Eyebrow className="w-fit">Settings</Eyebrow>
        <h1 className="text-foreground type-heading-l sm:type-display-m">
          Account settings
        </h1>
      </header>

      <div className="grid min-w-0 grid-cols-1 gap-6 md:grid-cols-[210px_minmax(0,1fr)] md:gap-10">
        <nav
          aria-label="Account sections"
          className="flex min-w-0 flex-wrap gap-1.5 self-start md:flex-col md:gap-1"
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
                  "focus-visible:ring-ring/40 inline-flex items-center rounded-full border px-4 py-2 transition-all outline-none focus-visible:ring-2",
                  isActive
                    ? "border-border/80 bg-elevated text-foreground shadow-card type-body-s-strong"
                    : "text-muted-foreground hover:bg-elevated/70 hover:text-foreground type-body-s border-transparent",
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
