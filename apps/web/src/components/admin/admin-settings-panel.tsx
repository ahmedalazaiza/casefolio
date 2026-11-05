"use client";

import { Check, Download, Minus, Plus, Search } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import {
  AUDIT_ACTION_CATEGORIES,
  filterAuditLogs,
  formatAuditLogSummary,
  PERMISSION_MATRIX_ROWS,
  serializeAuditLogsCsv,
  type AdminSettingsOverview,
  type AdminSettingsTab,
  type AuditActionCategory,
  type PlatformSettings,
} from "@/lib/admin/settings-types";
import { formatRelativeActivity } from "@/lib/admin/users-types";
import { cn } from "@/lib/utils";

function initialsFromName(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  return name.slice(0, 2).toUpperCase() || "CF";
}

function PlatformSwitch({
  id,
  checked,
  disabled,
  label,
  onToggle,
}: {
  id: string;
  checked: boolean;
  disabled?: boolean;
  label: string;
  onToggle: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <label htmlFor={id} className="text-foreground cursor-pointer type-body-s">
        {label}
      </label>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={onToggle}
        className={cn(
          "focus-visible:ring-ring/40 relative inline-flex h-6 w-10 shrink-0 cursor-pointer items-center rounded-full border transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50",
          checked ? "border-primary bg-primary" : "border-border bg-sunken",
        )}
      >
        <span
          aria-hidden="true"
          className={cn(
            "bg-background inline-block size-4 rounded-full shadow-xs transition-transform",
            checked ? "translate-x-5" : "translate-x-0.5",
          )}
        />
      </button>
    </div>
  );
}

export function AdminSettingsPanel({
  initialOverview,
  initialTab = "team",
  currentAdminId,
  currentAdminRole,
}: {
  initialOverview: AdminSettingsOverview;
  initialTab?: AdminSettingsTab;
  currentAdminId: string;
  currentAdminRole: "admin" | "superadmin";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [overview, setOverview] = useState<AdminSettingsOverview>(initialOverview);
  const [activeTab, setActiveTab] = useState<AdminSettingsTab>(initialTab);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Add Admin Dialog state
  const [addOpen, setAddOpen] = useState(false);
  const [promoteEmail, setPromoteEmail] = useState("");
  const [promoteRole, setPromoteRole] = useState<"admin" | "superadmin">("admin");

  // Audit Log filter state
  const [auditCategory, setAuditCategory] = useState<AuditActionCategory>("all");
  const [auditSearch, setAuditSearch] = useState("");

  const filteredAuditLogs = useMemo(
    () =>
      filterAuditLogs(overview.auditLogs, {
        category: auditCategory,
        searchQuery: auditSearch,
      }),
    [overview.auditLogs, auditCategory, auditSearch],
  );

  function handleRoleChange(userId: string, nextRole: "user" | "admin" | "superadmin") {
    setErrorMessage(null);
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_role",
          userId,
          role: nextRole,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminSettingsOverview;
      };
      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to update role.");
        return;
      }

      setOverview(payload.overview);
      setFeedback(
        nextRole === "user"
          ? "Removed admin access and recorded in audit log."
          : `Updated member role to ${nextRole}.`,
      );
      router.refresh();
    });
  }

  function handlePromoteByEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "promote_by_email",
          email: promoteEmail.trim(),
          role: promoteRole,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminSettingsOverview;
      };
      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to promote user.");
        return;
      }

      setOverview(payload.overview);
      setPromoteEmail("");
      setAddOpen(false);
      setFeedback("Admin role granted and logged.");
      router.refresh();
    });
  }

  function handleTogglePlatformFlag(key: keyof PlatformSettings) {
    setErrorMessage(null);
    setFeedback(null);

    const nextSettings: PlatformSettings = {
      ...overview.platform,
      [key]: !overview.platform[key],
    };

    startTransition(async () => {
      const response = await fetch("/api/admin/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "update_platform",
          settings: nextSettings,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminSettingsOverview;
      };
      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to update platform settings.");
        return;
      }

      setOverview(payload.overview);
      setFeedback("Platform setting updated and recorded in audit log.");
      router.refresh();
    });
  }

  function handleExportAuditCsv() {
    const csv = serializeAuditLogsCsv(filteredAuditLogs);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "casefolio-audit-log.csv";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  const tabs: Array<{ key: AdminSettingsTab; label: string }> = [
    { key: "team", label: "Admin team" },
    { key: "permissions", label: "Permissions" },
    { key: "platform", label: "Platform" },
    { key: "audit", label: `Audit log (${overview.auditLogs.length})` },
  ];

  const showTeamSection = activeTab === "team";
  const showPermissionsSection = activeTab === "team" || activeTab === "permissions";
  const showPlatformSection = activeTab === "team" || activeTab === "platform";
  const showAuditSection = activeTab === "audit";

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      {/* Page header (Figma 32:10249) */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <h1 className="text-foreground type-heading-l">Settings &amp; roles</h1>
          <p className="text-muted-foreground type-body-s">
            Admin team, permissions and platform settings.
          </p>
        </div>

        <Button
          type="button"
          onClick={() => {
            setErrorMessage(null);
            setAddOpen(true);
          }}
        >
          <Plus className="size-4" />
          Add admin
        </Button>
      </header>

      {/* Segmented tabs (Figma 35:8744) */}
      <div
        role="tablist"
        aria-label="Settings sections"
        className="bg-sunken inline-flex max-w-full items-center gap-1 self-start overflow-x-auto rounded-full p-1 whitespace-nowrap"
      >
        {tabs.map((tab) => {
          const active = activeTab === tab.key;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => {
                setActiveTab(tab.key);
                setErrorMessage(null);
                setFeedback(null);
              }}
              className={cn(
                "rounded-full px-3.5 py-1.5 transition-colors outline-none type-caption",
                active
                  ? "bg-background text-foreground shadow-xs font-medium"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="bg-destructive-soft text-destructive rounded-xl px-4 py-3 type-body-s"
        >
          {errorMessage}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="bg-success-soft text-success rounded-xl px-4 py-3 type-body-s"
        >
          {feedback}
        </div>
      )}

      {/* Admin team table (Figma 35:8753) */}
      {showTeamSection && (
        <Card variant="flat" className="min-w-0 gap-0 overflow-hidden p-0">
          <div className="w-full max-w-full overflow-x-auto">
            <table className="w-full min-w-[700px] border-collapse text-left">
              <thead>
                <tr className="border-border bg-surface text-muted-foreground border-b type-caption">
                  <th className="px-6 py-3 font-medium">MEMBER</th>
                  <th className="px-4 py-3 font-medium">ROLE</th>
                  <th className="px-4 py-3 font-medium">LAST ACTIVE</th>
                  <th className="px-4 py-3 font-medium">VERIFICATION</th>
                  <th className="px-6 py-3 text-right font-medium">ACTIONS</th>
                </tr>
              </thead>
              <tbody className="divide-border divide-y">
                {overview.team.map((member) => {
                  const isSelf = member.id === currentAdminId;
                  const canModify =
                    !isSelf &&
                    (currentAdminRole === "superadmin" || member.role !== "superadmin");

                  return (
                    <tr key={member.id} data-testid="admin-team-row">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <AvatarBadge
                            initials={initialsFromName(member.name)}
                            tone="neutral"
                            size="sm"
                          />
                          <div className="flex min-w-0 flex-col">
                            <span className="text-foreground truncate type-body-s-strong">
                              {member.name}
                            </span>
                            <span className="text-muted-foreground truncate type-caption">
                              {member.email}
                            </span>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge
                          tone={member.role === "superadmin" ? "accent" : "pro"}
                          withDot={false}
                        >
                          {member.role === "superadmin" ? "Superadmin" : "Admin"}
                        </Badge>
                      </td>
                      <td className="text-muted-foreground px-4 py-4 type-body-s">
                        {formatRelativeActivity(member.lastActiveIso)}
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={member.emailVerified ? "published" : "neutral"}>
                          {member.emailVerified ? "Email OTP" : "Pending"}
                        </Badge>
                      </td>
                      <td className="px-6 py-4 text-right">
                        {!canModify ? (
                          <span className="text-muted-foreground type-caption">
                            {isSelf ? "You" : "—"}
                          </span>
                        ) : (
                          <div className="inline-flex items-center justify-end gap-2">
                            {currentAdminRole === "superadmin" && (
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={isPending}
                                onClick={() =>
                                  handleRoleChange(
                                    member.id,
                                    member.role === "superadmin" ? "admin" : "superadmin",
                                  )
                                }
                              >
                                {member.role === "superadmin" ? "Make admin" : "Make superadmin"}
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleRoleChange(member.id, "user")}
                            >
                              Remove
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Lower Permissions + Platform grid (Figma 35:8836) */}
      {(showPermissionsSection || showPlatformSection) && (
        <div
          className={cn(
            "grid gap-6",
            showPermissionsSection && showPlatformSection ? "lg:grid-cols-12" : "grid-cols-1",
          )}
        >
          {showPermissionsSection && (
            <Card
              variant="flat"
              className={cn(
                "min-w-0 gap-0 overflow-hidden p-0",
                showPlatformSection ? "lg:col-span-8" : "",
              )}
            >
              <div className="w-full max-w-full overflow-x-auto">
                <table className="w-full min-w-[540px] border-collapse text-left">
                  <thead>
                    <tr className="border-border bg-surface text-muted-foreground border-b type-caption">
                      <th className="px-6 py-3 font-medium">PERMISSION</th>
                      <th className="px-4 py-3 text-center font-medium">SUPERADMIN</th>
                      <th className="px-4 py-3 text-center font-medium">ADMIN</th>
                      <th className="px-6 py-3 text-center font-medium">USER</th>
                    </tr>
                  </thead>
                  <tbody className="divide-border divide-y">
                    {PERMISSION_MATRIX_ROWS.map((row) => (
                      <tr key={row.permission}>
                        <td className="text-foreground px-6 py-3.5 type-body-s">
                          {row.permission}
                        </td>
                        {([row.superadmin, row.admin, row.user] as const).map((allowed, idx) => (
                          <td key={idx} className="px-4 py-3.5 text-center">
                            {allowed ? (
                              <span
                                aria-label="Allowed"
                                className="bg-primary text-primary-foreground inline-flex size-5 items-center justify-center rounded-md"
                              >
                                <Check className="size-3.5" />
                              </span>
                            ) : (
                              <span
                                aria-label="Not allowed"
                                className="border-border text-muted-foreground inline-flex size-5 items-center justify-center rounded-md border"
                              >
                                <Minus className="size-3" />
                              </span>
                            )}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

          {showPlatformSection && (
            <Card
              variant="flat"
              data-testid="platform-settings-card"
              className={cn(
                "min-w-0 justify-between gap-4 p-6",
                showPermissionsSection ? "lg:col-span-4" : "max-w-lg",
              )}
            >
              <div className="flex flex-col gap-1">
                <h2 className="text-foreground type-heading-s">Platform</h2>
                <p className="text-muted-foreground type-caption">
                  Live feature flags enforced across auth &amp; sign-up.
                </p>
              </div>

              <div className="divide-border flex flex-col divide-y">
                <PlatformSwitch
                  id="flag-new-signups"
                  label="New sign-ups open"
                  checked={overview.platform.newSignupsOpen}
                  disabled={isPending}
                  onToggle={() => handleTogglePlatformFlag("newSignupsOpen")}
                />
                <PlatformSwitch
                  id="flag-email-verify"
                  label="Require email verification"
                  checked={overview.platform.requireEmailVerification}
                  disabled={isPending}
                  onToggle={() => handleTogglePlatformFlag("requireEmailVerification")}
                />
                <PlatformSwitch
                  id="flag-maintenance"
                  label="Maintenance mode"
                  checked={overview.platform.maintenanceMode}
                  disabled={isPending || currentAdminRole !== "superadmin"}
                  onToggle={() => handleTogglePlatformFlag("maintenanceMode")}
                />
              </div>
            </Card>
          )}
        </div>
      )}

      {/* Audit log explorer (C-906 acceptance criteria: every admin mutation logged) */}
      {showAuditSection && (
        <div data-testid="admin-audit-log-panel" className="flex min-w-0 flex-col gap-4">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="relative w-full sm:max-w-xs">
              <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
              <Input
                type="search"
                aria-label="Search audit log"
                placeholder="Search action, actor, or resource..."
                value={auditSearch}
                onChange={(e) => setAuditSearch(e.target.value)}
                className="pl-9"
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="bg-sunken inline-flex max-w-full flex-wrap items-center gap-1 rounded-full p-1">
                {AUDIT_ACTION_CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setAuditCategory(cat)}
                    className={cn(
                      "rounded-full px-3 py-1 capitalize transition-colors outline-none type-caption",
                      auditCategory === cat
                        ? "bg-background text-foreground shadow-xs font-medium"
                        : "text-muted-foreground hover:text-foreground",
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>

              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={handleExportAuditCsv}
              >
                <Download className="size-3.5" />
                Export CSV
              </Button>
            </div>
          </div>

          <Card variant="flat" className="min-w-0 gap-0 overflow-hidden p-0">
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-border bg-surface text-muted-foreground border-b type-caption">
                    <th className="px-6 py-3 font-medium">TIME</th>
                    <th className="px-4 py-3 font-medium">ACTOR</th>
                    <th className="px-4 py-3 font-medium">ACTION</th>
                    <th className="px-6 py-3 font-medium">DETAILS</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filteredAuditLogs.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
                        className="text-muted-foreground px-6 py-12 text-center type-body-s"
                      >
                        No audit log entries match your filter.
                      </td>
                    </tr>
                  ) : (
                    filteredAuditLogs.map((log) => (
                      <tr key={log.id} data-testid="audit-log-row" data-audit-action={log.action}>
                        <td className="text-muted-foreground px-6 py-3.5 whitespace-nowrap type-caption">
                          {new Date(log.atIso).toLocaleString("en-US", {
                            month: "short",
                            day: "numeric",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </td>
                        <td className="text-foreground px-4 py-3.5 type-body-s-strong">
                          {log.actorName}
                        </td>
                        <td className="px-4 py-3.5">
                          <code className="bg-sunken text-foreground rounded-md px-2 py-0.5 font-mono type-caption">
                            {log.action}
                          </code>
                        </td>
                        <td className="text-muted-foreground px-6 py-3.5 type-body-s">
                          {formatAuditLogSummary(log.action, log.meta)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Add Admin Modal */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Add admin member</DialogTitle>
            <DialogDescription>
              Grant administrative access to an existing Casefolio user account.
            </DialogDescription>
          </DialogHeader>

          <form onSubmit={handlePromoteByEmail} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="promote-admin-email" className="text-foreground type-body-s-strong">
                Account email
              </label>
              <Input
                id="promote-admin-email"
                type="email"
                required
                placeholder="teammate@casefolio.app"
                value={promoteEmail}
                onChange={(e) => setPromoteEmail(e.target.value)}
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="promote-admin-role" className="text-foreground type-body-s-strong">
                Role
              </label>
              <select
                id="promote-admin-role"
                value={promoteRole}
                onChange={(e) => setPromoteRole(e.target.value as "admin" | "superadmin")}
                className="border-border bg-background text-foreground focus-visible:ring-ring/40 h-10 rounded-xl border px-3 outline-none type-body-s focus-visible:ring-2"
              >
                <option value="admin">Admin</option>
                {currentAdminRole === "superadmin" && (
                  <option value="superadmin">Superadmin</option>
                )}
              </select>
            </div>

            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setAddOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Granting..." : "Grant access"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
