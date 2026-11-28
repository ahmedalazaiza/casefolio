"use client";

import {
  ArrowLeft,
  CheckCircle2,
  EyeOff,
  KeyRound,
  Mail,
  RefreshCw,
  Send,
  Star,
  Trash2,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { formatRelativeActivity, type AdminUserDetail } from "@/lib/admin/users-types";
import { cn } from "@/lib/utils";

export function AdminUserDetailPanel({
  detail: initialDetail,
  currentAdminId,
  currentAdminRole,
}: {
  detail: AdminUserDetail;
  currentAdminId: string;
  currentAdminRole: "admin" | "superadmin";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [detail, setDetail] = useState<AdminUserDetail>(initialDetail);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showEmailComposer, setShowEmailComposer] = useState(false);
  const [noticeSubject, setNoticeSubject] = useState("");
  const [noticeHeading, setNoticeHeading] = useState("");
  const [noticeMessage, setNoticeMessage] = useState("");
  const [overridePlan, setOverridePlan] = useState<"free" | "pro" | "team">(
    initialDetail.plan === "plus" ? "team" : initialDetail.plan,
  );
  const [confirmPermanentDelete, setConfirmPermanentDelete] = useState(false);

  const isSelf = detail.id === currentAdminId;
  const isSuperadmin = currentAdminRole === "superadmin";
  // Mirrors the server rules: only a superadmin may email users or suspend another admin.
  const canSuspend = !isSelf && (isSuperadmin || detail.role === "user");
  const canPermanentDelete = isSuperadmin && !isSelf && detail.role !== "superadmin";

  function handlePlanOverride() {
    setErrorMessage(null);
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_plan_override",
          userId: detail.id,
          plan: overridePlan,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to override plan.");
        return;
      }
      setDetail((prev) => ({
        ...prev,
        plan: overridePlan,
        subscription: { ...prev.subscription, plan: overridePlan },
      }));
      setFeedback(`Workspace plan updated to ${overridePlan.toUpperCase()}.`);
      router.refresh();
    });
  }

  function handleVerifyEmail() {
    setErrorMessage(null);
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "verify_email", userId: detail.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to verify email.");
        return;
      }
      setDetail((prev) => ({ ...prev, emailVerified: true }));
      setFeedback("Email marked as verified.");
      router.refresh();
    });
  }

  function handleRevokeSessions() {
    setErrorMessage(null);
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "revoke_sessions", userId: detail.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to revoke sessions.");
        return;
      }
      setDetail((prev) => ({ ...prev, activeSessionsCount: 0 }));
      setFeedback("All active sessions revoked.");
      router.refresh();
    });
  }

  function handlePermanentDelete() {
    setErrorMessage(null);
    setFeedback(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: detail.id }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to permanently delete user.");
        return;
      }
      router.push("/admin/users");
      router.refresh();
    });
  }

  function handleUserProjectAction(projectId: string, action: "unpublish" | "delete") {
    setErrorMessage(null);
    setFeedback(null);
    startTransition(async () => {
      const response =
        action === "delete"
          ? await fetch("/api/admin/projects", {
              method: "DELETE",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ projectId }),
            })
          : await fetch("/api/admin/projects", {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action, projectId }),
            });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Project action failed.");
        return;
      }
      setDetail((prev) => ({
        ...prev,
        projects:
          action === "delete"
            ? prev.projects.filter((p) => p.id !== projectId)
            : prev.projects.map((p) =>
                p.id === projectId ? { ...p, visibility: "private" } : p,
              ),
      }));
      setFeedback(
        action === "delete" ? "Project deleted permanently." : "Project unpublished to draft.",
      );
      router.refresh();
    });
  }

  function handleSendAdminNotice(event: React.FormEvent) {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_admin_notice",
          targetUserId: detail.id,
          subject: noticeSubject,
          heading: noticeHeading,
          message: noticeMessage,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        from?: string;
        error?: string;
      };
      if (!response.ok || !payload.ok) {
        setErrorMessage(payload.error ?? "Failed to send official admin email.");
        return;
      }
      setShowEmailComposer(false);
      setNoticeSubject("");
      setNoticeHeading("");
      setNoticeMessage("");
      setFeedback(
        payload.delivered
          ? `Official email dispatched from ${payload.from} to ${detail.email}.`
          : `Official email prepared from ${payload.from} for ${detail.email} (dev preview mode).`,
      );
    });
  }

  function handleToggleSuspend() {
    setErrorMessage(null);
    setFeedback(null);
    const nextSuspended = !detail.suspended;

    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "set_suspension",
          userId: detail.id,
          suspended: nextSuspended,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as { error?: string };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to update suspension status.");
        return;
      }
      setDetail((prev) => ({ ...prev, suspended: nextSuspended }));
      setFeedback(
        nextSuspended
          ? "Account suspended and all active sessions revoked."
          : "Account reactivated.",
      );
      router.refresh();
    });
  }

  function handleSyncPaddle() {
    setErrorMessage(null);
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "sync_subscription",
          userId: detail.id,
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        source?: string;
        status?: string;
      };
      if (!response.ok) {
        setErrorMessage(payload.error ?? "Failed to sync subscription.");
        return;
      }
      setDetail((prev) => ({
        ...prev,
        subscription: {
          ...prev.subscription,
          status: payload.status ?? prev.subscription.status,
        },
      }));
      setFeedback(
        payload.source === "paddle_api"
          ? `Subscription synced live from Paddle (${payload.status}).`
          : `Subscription verified from billing mirror (${payload.status}).`,
      );
      router.refresh();
    });
  }

  const joinedLabel = new Date(detail.joinedAtIso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      <div>
        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/users">
            <ArrowLeft className="size-4" />
            All users
          </Link>
        </Button>
      </div>

      {/* Page header (Figma 32:9257) */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow className="w-fit">User Account</Eyebrow>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-foreground type-display-m">{detail.name}</h1>
            <Badge tone={detail.suspended ? "danger" : "published"}>
              {detail.suspended ? "Suspended" : "Active"}
            </Badge>
          </div>
          <p className="text-muted-foreground type-body-s">
            {detail.email} · Joined {joinedLabel}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {isSuperadmin && (
            <Button
              type="button"
              variant="secondary"
              disabled={isPending}
              onClick={() => setShowEmailComposer((prev) => !prev)}
            >
              <Mail className="size-4" />
              Email from Admin
            </Button>
          )}
          {canSuspend && (
            <Button
              type="button"
              variant={detail.suspended ? "secondary" : "destructive"}
              disabled={isPending}
              onClick={handleToggleSuspend}
            >
              {detail.suspended ? "Reactivate user" : "Suspend user"}
            </Button>
          )}
        </div>
      </header>

      {isSuperadmin && showEmailComposer && (
        <Card className="gap-4 p-5">
          <div className="flex flex-col gap-0.5">
            <span className="v3-label text-[var(--cf-royal-text)] uppercase">
              Direct Administration Notice
            </span>
            <h2 className="text-foreground type-heading-s">
              Send official email to {detail.email}
            </h2>
            <p className="text-muted-foreground type-caption">
              Dispatched from Casefolio Admin (admin@casefolio.com) and logged in Audit Trail.
            </p>
          </div>
          <form onSubmit={handleSendAdminNotice} className="grid gap-3 sm:grid-cols-2">
            <Input
              required
              value={noticeSubject}
              onChange={(e) => setNoticeSubject(e.target.value)}
              placeholder="Email subject line"
            />
            <Input
              required
              value={noticeHeading}
              onChange={(e) => setNoticeHeading(e.target.value)}
              placeholder="Editorial display heading"
            />
            <div className="sm:col-span-2">
              <Textarea
                required
                rows={4}
                value={noticeMessage}
                onChange={(e) => setNoticeMessage(e.target.value)}
                placeholder="Write official message to user..."
              />
            </div>
            <div className="flex justify-end gap-2 sm:col-span-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowEmailComposer(false)}
              >
                Cancel
              </Button>
              <Button type="submit" size="sm" disabled={isPending}>
                <Send className="size-3.5" />
                Send official email
              </Button>
            </div>
          </form>
        </Card>
      )}

      {errorMessage && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-xl border px-4 py-3"
        >
          {errorMessage}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="border-success/30 bg-success-soft text-foreground type-body-s rounded-xl border px-4 py-3"
        >
          {feedback}
        </div>
      )}

      {/* Two-column layout (Figma 34:8450) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card className="min-w-0 justify-between gap-2 p-5">
              <span className="text-muted-foreground type-caption">Case studies</span>
              <span className="text-foreground type-display-s">{detail.totalProjects}</span>
              <span className="text-muted-foreground type-caption">
                {detail.publishedProjects} published
              </span>
            </Card>

            <Card className="min-w-0 justify-between gap-2 p-5">
              <span className="text-muted-foreground type-caption">Views (30d)</span>
              <span className="text-foreground type-display-s">
                {detail.views30d.toLocaleString("en-US")}
              </span>
              <span className="text-success type-caption">Public link traffic</span>
            </Card>

            <Card className="min-w-0 justify-between gap-2 p-5">
              <span className="text-muted-foreground type-caption">PDF / PNG exports</span>
              <span className="text-foreground type-display-s">{detail.completedExports}</span>
              <span className="text-muted-foreground type-caption">
                {detail.lastExportAtIso
                  ? `Last ${formatRelativeActivity(detail.lastExportAtIso)}`
                  : "No exports yet"}
              </span>
            </Card>
          </div>

          <Card className="min-w-0 gap-4 p-6">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-foreground type-heading-s">User projects</h2>
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/projects">View all platform projects</Link>
              </Button>
            </div>
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-120 border-collapse text-left">
                <thead>
                  <tr className="border-border/70 border-b">
                    <th className="text-tertiary type-overline py-2.5 pr-4">Project</th>
                    <th className="text-tertiary type-overline px-4 py-2.5">Template</th>
                    <th className="text-tertiary type-overline px-4 py-2.5">Status</th>
                    <th className="text-tertiary type-overline px-4 py-2.5 text-right">Updated</th>
                    <th className="text-tertiary type-overline py-2.5 pl-4 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {detail.projects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="text-muted-foreground type-body-s py-8 text-center"
                      >
                        No projects created yet.
                      </td>
                    </tr>
                  ) : (
                    detail.projects.map((p) => (
                      <tr key={p.id}>
                        <td className="py-3 pr-4">
                          {p.visibility === "public" && p.slug ? (
                            <Link
                              href={`/p/${p.slug}`}
                              className="text-foreground hover:text-primary type-body-s-strong"
                            >
                              {p.name}
                            </Link>
                          ) : (
                            <span className="text-foreground type-body-s-strong">{p.name}</span>
                          )}
                        </td>
                        <td className="text-muted-foreground type-body-s px-4 py-3">
                          {p.templateName}
                        </td>
                        <td className="px-4 py-3">
                          <Badge tone={p.visibility === "public" ? "published" : "neutral"}>
                            {p.visibility === "public"
                              ? "Published"
                              : p.visibility === "unlisted"
                                ? "Unlisted"
                                : "Draft"}
                          </Badge>
                        </td>
                        <td className="text-tertiary type-caption px-4 py-3 text-right">
                          {formatRelativeActivity(p.updatedAtIso)}
                        </td>
                        <td className="py-3 pl-4 text-right">
                          <div className="flex justify-end gap-1">
                            {p.visibility !== "private" && (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                title="Unpublish"
                                disabled={isPending}
                                onClick={() => handleUserProjectAction(p.id, "unpublish")}
                              >
                                <EyeOff className="size-3.5" />
                              </Button>
                            )}
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              title="Delete project"
                              disabled={isPending}
                              className="text-destructive"
                              onClick={() => handleUserProjectAction(p.id, "delete")}
                            >
                              <Trash2 className="size-3.5" />
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>

          {detail.recentFeedback && detail.recentFeedback.length > 0 && (
            <Card className="min-w-0 gap-3 p-6">
              <div className="flex items-center justify-between gap-2">
                <h2 className="text-foreground type-heading-s">Submitted Product Feedback</h2>
                <Button asChild variant="ghost" size="sm">
                  <Link href="/admin/feedback">All feedback</Link>
                </Button>
              </div>
              <div className="flex flex-col gap-3">
                {detail.recentFeedback.map((fb) => (
                  <div
                    key={fb.id}
                    className="rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="inline-flex items-center gap-1 font-semibold text-xs text-[var(--cf-text-primary)]">
                        <Star className="size-3.5 fill-amber-400 text-amber-400" />
                        <span>{fb.rating ?? "—"} / 5</span>
                        {fb.primaryUseCase ? ` · ${fb.primaryUseCase}` : ""}
                      </span>
                      <span className="text-muted-foreground type-caption">
                        {formatRelativeActivity(fb.createdAtIso)}
                      </span>
                    </div>
                    {fb.topFeatureRequest && (
                      <p className="text-xs font-medium text-[var(--cf-royal-text)] mt-1">
                        Requested: {fb.topFeatureRequest}
                      </p>
                    )}
                    {fb.comment && (
                      <p className="text-muted-foreground type-body-s mt-1">{fb.comment}</p>
                    )}
                  </div>
                ))}
              </div>
            </Card>
          )}
        </div>

        {/* Right column: Profile + Subscription (Figma 34:8519) */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <Card className="min-w-0 gap-4 p-6">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-foreground type-heading-s">{detail.name}</h2>
              <span className="text-muted-foreground type-caption">
                {detail.jobTitle ?? "Product designer"}
              </span>
            </div>

            <dl className="divide-border/70 flex flex-col divide-y">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Status</dt>
                <dd>
                  <Badge tone={detail.suspended ? "danger" : "published"}>
                    {detail.suspended ? "Suspended" : "Active"}
                  </Badge>
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Role</dt>
                <dd className="text-foreground type-body-s-strong capitalize">{detail.role}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Workspace</dt>
                <dd className="text-foreground type-body-s">{detail.workspaceName ?? "Personal"}</dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Sign-in</dt>
                <dd className="text-foreground type-body-s">{detail.signInProvider}</dd>
              </div>
              {detail.emailVerified !== undefined && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted-foreground type-body-s">Email verified</dt>
                  <dd className="text-foreground type-body-s">
                    {detail.emailVerified ? "Verified" : "Unverified"}
                  </dd>
                </div>
              )}
              {detail.activeSessionsCount !== undefined && (
                <div className="flex items-center justify-between py-2.5">
                  <dt className="text-muted-foreground type-body-s">Active sessions</dt>
                  <dd className="text-foreground type-body-s font-mono">
                    {detail.activeSessionsCount}
                  </dd>
                </div>
              )}
            </dl>

            <div className="flex flex-wrap gap-2 border-t border-[var(--cf-border-subtle)] pt-3">
              {detail.emailVerified === false && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={handleVerifyEmail}
                >
                  <CheckCircle2 className="size-3.5" />
                  Verify email
                </Button>
              )}
              {!isSelf && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  disabled={isPending}
                  onClick={handleRevokeSessions}
                >
                  <KeyRound className="size-3.5" />
                  Revoke sessions
                </Button>
              )}
            </div>
          </Card>

          <Card className="min-w-0 gap-4 p-6">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-foreground type-heading-s">Admin Controls &amp; Plan Override</h2>
              <span className="text-muted-foreground type-caption">
                Grant/revoke workspace tier or execute permanent cleanup.
              </span>
            </div>

            <div className="flex items-center gap-2">
              <Select
                aria-label="Override user plan"
                value={overridePlan}
                onChange={(e) => setOverridePlan(e.target.value as "free" | "pro" | "team")}
                className="flex-1"
              >
                <option value="free">Free (1 credit)</option>
                <option value="pro">Pro (10 projects + custom URL)</option>
                <option value="team">Team (Unlimited shared)</option>
              </Select>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isPending}
                data-testid="admin-apply-plan-override"
                onClick={handlePlanOverride}
              >
                Apply plan
              </Button>
            </div>

            {canPermanentDelete && (
              <div className="border-destructive/30 bg-destructive-soft/40 flex flex-col gap-2 rounded-xl border p-3">
                {!confirmPermanentDelete ? (
                  <Button
                    type="button"
                    variant="destructive"
                    size="sm"
                    disabled={isPending}
                    onClick={() => setConfirmPermanentDelete(true)}
                  >
                    <Trash2 className="size-3.5" />
                    Permanently delete user
                  </Button>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-destructive type-caption font-semibold">
                      Erase account, all projects &amp; R2 files permanently?
                    </p>
                    <div className="flex gap-2">
                      <Button
                        type="button"
                        variant="destructive"
                        size="sm"
                        disabled={isPending}
                        onClick={handlePermanentDelete}
                      >
                        Confirm erase
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmPermanentDelete(false)}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </Card>

          <Card
            className={cn(
              "min-w-0 gap-4 p-6",
              detail.subscription.plan !== "free" && "bg-wash-panel border-primary/25",
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-foreground type-heading-s">Subscription</h2>
                <span className="text-muted-foreground type-caption">
                  {detail.subscription.source === "paddle_api"
                    ? "Live via Paddle API"
                    : "Paddle Billing mirror"}
                </span>
              </div>
              <Badge tone={detail.subscription.plan === "free" ? "neutral" : "pro"}>
                {detail.subscription.plan.toUpperCase()}
              </Badge>
            </div>

            <dl className="divide-border flex flex-col divide-y">
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Status</dt>
                <dd className="text-foreground type-body-s-strong capitalize">
                  {detail.subscription.status}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Billing</dt>
                <dd className="text-foreground type-body-s">
                  {detail.subscription.interval
                    ? `${detail.subscription.interval === "yearly" ? "Annual" : "Monthly"} · $${detail.subscription.amountUsd.toFixed(2)}`
                    : "Free ($0 / forever)"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Renews</dt>
                <dd className="text-foreground type-body-s">
                  {detail.subscription.renewsAtIso
                    ? new Date(detail.subscription.renewsAtIso).toLocaleDateString("en-US", {
                        day: "numeric",
                        month: "short",
                        year: "numeric",
                      })
                    : "—"}
                </dd>
              </div>
              <div className="flex items-center justify-between py-2.5">
                <dt className="text-muted-foreground type-body-s">Payment</dt>
                <dd className="text-foreground type-body-s">
                  {detail.subscription.paymentSummary}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2 pt-1">
              {detail.subscription.paddleSubscriptionId && (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  disabled={isPending}
                  onClick={handleSyncPaddle}
                >
                  <RefreshCw className="size-3.5" />
                  Sync Paddle
                </Button>
              )}
              <Button asChild variant="ghost" size="sm">
                <Link href="/admin/subscriptions">All subscriptions</Link>
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
