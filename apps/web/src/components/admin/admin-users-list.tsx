"use client";

import { Download, Search } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import {
  ADMIN_USER_PLAN_FILTERS,
  filterAdminUsers,
  formatRelativeActivity,
  serializeAdminUsersCsv,
  type AdminUserListItem,
  type AdminUserPlanFilter,
} from "@/lib/admin/users-types";
import { cn } from "@/lib/utils";

function planBadgeTone(plan: "free" | "pro" | "team"): "neutral" | "pro" | "accent" {
  if (plan === "team") return "accent";
  if (plan === "pro") return "pro";
  return "neutral";
}

function formatPlanLabel(plan: "free" | "pro" | "team"): string {
  if (plan === "team") return "Team";
  if (plan === "pro") return "Pro";
  return "Free";
}

export function AdminUsersList({
  initialUsers,
  currentAdminId,
}: {
  initialUsers: AdminUserListItem[];
  currentAdminId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [users, setUsers] = useState<AdminUserListItem[]>(initialUsers);
  const [searchQuery, setSearchQuery] = useState("");
  const [filter, setFilter] = useState<AdminUserPlanFilter>("all");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const filtered = useMemo(
    () => filterAdminUsers(users, { searchQuery, filter }),
    [users, searchQuery, filter],
  );

  function handleExportCsv() {
    const csv = serializeAdminUsersCsv(filtered);
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "casefolio-users.csv";
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  function handleToggleSuspend(user: AdminUserListItem) {
    setErrorMessage(null);
    const nextSuspended = !user.suspended;

    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_suspension",
          userId: user.id,
          suspended: nextSuspended,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to update user status.");
        return;
      }

      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, suspended: nextSuspended } : u)),
      );
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      {/* Page header (Figma 32:9009) */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow className="w-fit">Directory</Eyebrow>
          <h1 className="text-foreground type-display-m">Users</h1>
          <p className="text-muted-foreground type-body-s">Everyone with a Casefolio account.</p>
        </div>

        <Button type="button" variant="secondary" onClick={handleExportCsv}>
          <Download className="size-4" />
          Export CSV
        </Button>
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-2xl border px-4 py-3"
        >
          {errorMessage}
        </div>
      )}

      {/* Filters (Figma 33:8513) */}
      <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
        <div className="relative w-full min-w-0 lg:max-w-sm">
          <Search className="text-tertiary pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2" />
          <Input
            aria-label="Search users"
            placeholder="Search name or email..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="rounded-full pl-9"
          />
        </div>

        <div
          role="group"
          aria-label="Filter users by plan or status"
          className="border-border/70 bg-sunken/80 inline-flex flex-wrap gap-1 rounded-full border p-1"
        >
          {ADMIN_USER_PLAN_FILTERS.map((f) => {
            const active = filter === f;
            const label = f === "all" ? "All" : f.charAt(0).toUpperCase() + f.slice(1);
            return (
              <button
                key={f}
                type="button"
                aria-pressed={active}
                onClick={() => setFilter(f)}
                className={cn(
                  "focus-visible:ring-ring/40 rounded-full px-3.5 py-1.5 transition-all outline-none focus-visible:ring-2",
                  active
                    ? "bg-elevated text-foreground shadow-card type-caption font-medium"
                    : "text-muted-foreground hover:text-foreground type-caption",
                )}
              >
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Users table (Figma 33:8536) */}
      <Card className="min-w-0 gap-0 overflow-hidden p-0">
        <div className="w-full max-w-full overflow-x-auto">
          <table className="w-full min-w-170 border-collapse text-left">
            <thead>
              <tr className="border-border/70 bg-surface/60 border-b">
                <th className="text-tertiary type-overline px-5 py-3.5">User</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Plan</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Billing</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Projects</th>
                <th className="text-tertiary type-overline px-4 py-3.5">Last active</th>
                <th className="text-tertiary type-overline px-5 py-3.5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-border/70 divide-y">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="text-muted-foreground type-body-s px-5 py-10 text-center">
                    No users match the active search or filter.
                  </td>
                </tr>
              ) : (
                filtered.map((user) => {
                  const isSelf = user.id === currentAdminId;
                  return (
                    <tr key={user.id} className="hover:bg-surface/60 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex flex-col gap-0.5">
                          <div className="flex flex-wrap items-center gap-2">
                            <Link
                              href={`/admin/users/${user.id}`}
                              className="text-foreground hover:text-primary type-body-s-strong transition-colors"
                            >
                              {user.name}
                            </Link>
                            {user.suspended && <Badge tone="danger">Suspended</Badge>}
                            {user.role !== "user" && <Badge tone="accent">{user.role}</Badge>}
                          </div>
                          <span className="text-muted-foreground type-caption">{user.email}</span>
                        </div>
                      </td>
                      <td className="px-4 py-4">
                        <Badge tone={planBadgeTone(user.plan)}>{formatPlanLabel(user.plan)}</Badge>
                      </td>
                      <td className="text-muted-foreground type-body-s px-4 py-4 capitalize">
                        {user.billingInterval ?? "—"}
                      </td>
                      <td className="text-foreground type-body-s px-4 py-4">{user.projectCount}</td>
                      <td className="text-tertiary type-caption px-4 py-4">
                        {formatRelativeActivity(user.lastActiveIso)}
                      </td>
                      <td className="px-5 py-4 text-right">
                        <div className="inline-flex items-center gap-2">
                          <Button asChild variant="secondary" size="sm">
                            <Link href={`/admin/users/${user.id}`}>View</Link>
                          </Button>
                          {!isSelf && (
                            <Button
                              type="button"
                              variant={user.suspended ? "secondary" : "destructive"}
                              size="sm"
                              disabled={isPending}
                              onClick={() => handleToggleSuspend(user)}
                            >
                              {user.suspended ? "Reactivate" : "Suspend"}
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </Card>

      <p className="text-tertiary type-caption">
        Showing {filtered.length} of {users.length} {users.length === 1 ? "user" : "users"}
      </p>
    </div>
  );
}
