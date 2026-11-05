"use client";

import { ArrowLeft, RefreshCw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { formatRelativeActivity, type AdminUserDetail } from "@/lib/admin/users-types";

export function AdminUserDetailPanel({
  detail: initialDetail,
  currentAdminId,
}: {
  detail: AdminUserDetail;
  currentAdminId: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [detail, setDetail] = useState<AdminUserDetail>(initialDetail);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isSelf = detail.id === currentAdminId;

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
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-foreground type-heading-l">{detail.name}</h1>
            <Badge tone={detail.suspended ? "danger" : "published"}>
              {detail.suspended ? "Suspended" : "Active"}
            </Badge>
          </div>
          <p className="text-muted-foreground type-body-s">
            {detail.email} · Joined {joinedLabel}
          </p>
        </div>

        {!isSelf && (
          <Button
            type="button"
            variant={detail.suspended ? "secondary" : "destructive"}
            disabled={isPending}
            onClick={handleToggleSuspend}
          >
            {detail.suspended ? "Reactivate user" : "Suspend user"}
          </Button>
        )}
      </header>

      {errorMessage && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-4 py-3"
        >
          {errorMessage}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="border-success/30 bg-success-soft text-foreground type-body-s rounded-lg border px-4 py-3"
        >
          {feedback}
        </div>
      )}

      {/* Two-column layout (Figma 34:8450) */}
      <div className="grid gap-6 lg:grid-cols-12">
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-8">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card variant="flat" className="min-w-0 justify-between gap-2 p-5">
              <span className="text-muted-foreground type-caption">Case studies</span>
              <span className="text-foreground type-heading-l">{detail.totalProjects}</span>
              <span className="text-muted-foreground type-caption">
                {detail.publishedProjects} published
              </span>
            </Card>

            <Card variant="flat" className="min-w-0 justify-between gap-2 p-5">
              <span className="text-muted-foreground type-caption">Views (30d)</span>
              <span className="text-foreground type-heading-l">
                {detail.views30d.toLocaleString("en-US")}
              </span>
              <span className="text-success type-caption">Public link traffic</span>
            </Card>

            <Card variant="flat" className="min-w-0 justify-between gap-2 p-5">
              <span className="text-muted-foreground type-caption">PDF / PNG exports</span>
              <span className="text-foreground type-heading-l">{detail.completedExports}</span>
              <span className="text-muted-foreground type-caption">
                {detail.lastExportAtIso
                  ? `Last ${formatRelativeActivity(detail.lastExportAtIso)}`
                  : "No exports yet"}
              </span>
            </Card>
          </div>

          <Card variant="flat" className="min-w-0 gap-4 p-6">
            <h2 className="text-foreground type-heading-s">User projects</h2>
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-120 border-collapse text-left">
                <thead>
                  <tr className="border-border border-b">
                    <th className="text-tertiary type-overline py-2.5 pr-4">Project</th>
                    <th className="text-tertiary type-overline px-4 py-2.5">Template</th>
                    <th className="text-tertiary type-overline px-4 py-2.5">Status</th>
                    <th className="text-tertiary type-overline py-2.5 pl-4 text-right">Updated</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {detail.projects.length === 0 ? (
                    <tr>
                      <td
                        colSpan={4}
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
                        <td className="text-tertiary type-caption py-3 pl-4 text-right">
                          {formatRelativeActivity(p.updatedAtIso)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right column: Profile + Subscription (Figma 34:8519) */}
        <div className="flex min-w-0 flex-col gap-6 lg:col-span-4">
          <Card variant="flat" className="min-w-0 gap-4 p-6">
            <div className="flex flex-col gap-0.5">
              <h2 className="text-foreground type-heading-s">{detail.name}</h2>
              <span className="text-muted-foreground type-caption">
                {detail.jobTitle ?? "Product designer"}
              </span>
            </div>

            <dl className="divide-border flex flex-col divide-y">
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
            </dl>
          </Card>

          <Card variant="flat" className="min-w-0 gap-4 p-6">
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
                    ? `${detail.subscription.interval === "yearly" ? "Yearly" : "Monthly"} · $${detail.subscription.amountUsd}`
                    : "Free"}
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
