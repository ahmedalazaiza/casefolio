"use client";

import { CheckCircle2, ExternalLink, RotateCcw } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
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
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import {
  filterModerationItems,
  type AdminModerationOverview,
  type ModerationQueueFilter,
} from "@/lib/admin/moderation-types";
import { formatRelativeActivity } from "@/lib/admin/users-types";
import { cn } from "@/lib/utils";

function reasonBadgeTone(reason: string): "danger" | "draft" | "neutral" {
  const lower = reason.toLowerCase();
  if (lower.includes("scam") || lower.includes("phishing") || lower.includes("malware")) {
    return "danger";
  }
  if (lower.includes("plagiarism") || lower.includes("copyright") || lower.includes("harassment")) {
    return "draft";
  }
  return "neutral";
}

export function AdminModerationPanel({
  initialOverview,
  currentAdminRole = "admin",
}: {
  initialOverview: AdminModerationOverview;
  currentAdminRole?: "admin" | "superadmin";
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [overview, setOverview] = useState<AdminModerationOverview>(initialOverview);
  const [filter, setFilter] = useState<ModerationQueueFilter>("open");
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOverview.items.find((i) => i.queueBucket === "open")?.id ??
      initialOverview.items[0]?.id ??
      null,
  );
  const [feedback, setFeedback] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const [bulkDismissOpen, setBulkDismissOpen] = useState(false);
  const [bulkDismissReason, setBulkDismissReason] = useState("");

  const filtered = useMemo(
    () => filterModerationItems(overview.items, filter),
    [overview.items, filter],
  );

  const activeCase = useMemo(
    () => filtered.find((item) => item.id === selectedId) ?? filtered[0] ?? null,
    [filtered, selectedId],
  );

  function handleSelectFilter(nextFilter: ModerationQueueFilter) {
    setFilter(nextFilter);
    setFeedback(null);
    setErrorMessage(null);
    const firstInBucket = overview.items.find((i) => i.queueBucket === nextFilter);
    setSelectedId(firstInBucket?.id ?? null);
  }

  function handleResolve(projectId: string, action: "dismiss" | "takedown" | "restore") {
    setErrorMessage(null);
    setFeedback(null);

    startTransition(async () => {
      const response = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action, projectId }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminModerationOverview;
      };

      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to update moderation status.");
        return;
      }

      setOverview(payload.overview);
      const nextFirst = payload.overview.items.find((i) => i.queueBucket === filter);
      setSelectedId(nextFirst?.id ?? null);
      setFeedback(
        action === "takedown"
          ? "Case study unpublished (public URL now returns 404) and owner notified."
          : action === "restore"
            ? "Moderation takedown lifted. The owner can now re-publish from their editor."
            : "Report dismissed.",
      );
      router.refresh();
    });
  }

  function handleDismissAllOpen(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setFeedback(null);

    const trimmedReason = bulkDismissReason.trim();
    if (trimmedReason.length < 5) {
      setErrorMessage("Enter an audit reason (at least 5 characters) before dismissing all reports.");
      return;
    }

    startTransition(async () => {
      const response = await fetch("/api/admin/moderation", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "dismiss_all_open",
          confirmed: true,
          reason: trimmedReason,
        }),
      });

      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
        overview?: AdminModerationOverview;
      };

      if (!response.ok || !payload.overview) {
        setErrorMessage(payload.error ?? "Failed to dismiss open reports.");
        return;
      }

      setOverview(payload.overview);
      setSelectedId(null);
      setBulkDismissOpen(false);
      setBulkDismissReason("");
      setFeedback("All open reports marked as dismissed and recorded in audit log.");
      router.refresh();
    });
  }

  const segments: Array<{ key: ModerationQueueFilter; label: string }> = [
    { key: "open", label: `Open (${overview.openCount})` },
    { key: "dismissed", label: `Reviewed (${overview.dismissedCount})` },
    { key: "takedown", label: `Taken down (${overview.takedownCount})` },
  ];

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      {/* Page header (Figma 32:9753 / 32:10497) */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex min-w-0 flex-col gap-2">
          <Eyebrow className="w-fit">Trust &amp; Safety</Eyebrow>
          <h1 className="text-foreground type-display-m">Moderation</h1>
          <p className="text-muted-foreground type-body-s">
            Published case studies flagged or awaiting review.
          </p>
        </div>

        <Button asChild variant="secondary">
          <Link href="/admin/settings?tab=audit">Audit log</Link>
        </Button>
      </header>

      {/* Filter segments (Figma 34:8759) */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div
          role="tablist"
          aria-label="Moderation status filter"
          className="border-border/70 bg-sunken/80 inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-xl border p-1 whitespace-nowrap"
        >
          {segments.map((seg) => {
            const active = filter === seg.key;
            return (
              <button
                key={seg.key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => handleSelectFilter(seg.key)}
                className={cn(
                  "rounded-lg px-3.5 py-1.5 transition-all outline-none type-caption",
                  active
                    ? "border-border bg-elevated text-foreground border font-medium"
                    : "text-muted-foreground hover:text-foreground border border-transparent",
                )}
              >
                {seg.label}
              </button>
            );
          })}
        </div>

        {filter === "open" && overview.openCount > 0 && currentAdminRole === "superadmin" && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            onClick={() => {
              setErrorMessage(null);
              setBulkDismissOpen(true);
            }}
          >
            Dismiss all
          </Button>
        )}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive rounded-xl border px-4 py-3 type-body-s"
        >
          {errorMessage}
        </div>
      )}

      {feedback && (
        <div
          role="status"
          className="border-success/30 bg-success-soft text-success rounded-xl border px-4 py-3 type-body-s"
        >
          {feedback}
        </div>
      )}

      {/* Empty state (Figma 32:10481 — "Nothing to review") */}
      {filtered.length === 0 ? (
        <Card
          data-testid="moderation-empty-state"
          className="items-center justify-center gap-3 px-6 py-16 text-center"
        >
          <span className="bg-success-soft text-success inline-flex size-12 items-center justify-center rounded-xl">
            <CheckCircle2 className="size-5" />
          </span>
          <h2 className="text-foreground type-heading-m">Nothing to review</h2>
          <p className="text-muted-foreground max-w-md type-body-s">
            No published case study has been reported in this view. New reports show up here and
            your moderation actions are recorded in the audit log.
          </p>
          <div className="pt-2">
            <Button asChild variant="secondary">
              <Link href="/admin/analytics">Browse published pages</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <>
          {/* Queue table (Figma 34:8771) */}
          <Card className="min-w-0 gap-0 overflow-hidden p-0">
            <div className="w-full max-w-full overflow-x-auto">
              <table className="w-full min-w-[760px] border-collapse text-left">
                <thead>
                  <tr className="border-border/70 bg-surface/60 text-muted-foreground border-b type-caption">
                    <th className="px-6 py-3 font-medium">CASE STUDY</th>
                    <th className="px-4 py-3 font-medium">AUTHOR</th>
                    <th className="px-4 py-3 font-medium">REASON</th>
                    <th className="px-4 py-3 font-medium">REPORTS</th>
                    <th className="px-4 py-3 font-medium">PUBLISHED</th>
                    <th className="px-6 py-3 text-right font-medium">ACTIONS</th>
                  </tr>
                </thead>
                <tbody className="divide-border divide-y">
                  {filtered.map((item) => {
                    const isSelected = activeCase?.id === item.id;
                    return (
                      <tr
                        key={item.id}
                        data-testid="moderation-queue-row"
                        onClick={() => setSelectedId(item.id)}
                        className={cn(
                          "cursor-pointer transition-colors",
                          isSelected ? "bg-surface" : "hover:bg-surface/60",
                        )}
                      >
                        <td className="px-6 py-4">
                          <div className="flex flex-col gap-0.5">
                            <span className="text-foreground type-body-s-strong">
                              {item.projectName}
                            </span>
                            <span className="text-muted-foreground type-caption">
                              {item.projectSlug
                                ? `casefolio.app/p/${item.projectSlug}`
                                : "Unpublished"}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <Link
                            href={`/admin/users/${item.authorId}`}
                            onClick={(e) => e.stopPropagation()}
                            className="text-foreground hover:underline type-body-s"
                          >
                            {item.authorName}
                          </Link>
                        </td>
                        <td className="px-4 py-4">
                          <Badge tone={reasonBadgeTone(item.primaryReason)} withDot={false}>
                            {item.primaryReason}
                          </Badge>
                        </td>
                        <td className="text-foreground px-4 py-4 type-body-s">
                          {item.reportCount}
                        </td>
                        <td className="text-muted-foreground px-4 py-4 type-body-s">
                          {item.publishedAtIso
                            ? formatRelativeActivity(item.publishedAtIso)
                            : "—"}
                        </td>
                        <td
                          className="px-6 py-4 text-right"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {item.queueBucket === "open" ? (
                            <div className="inline-flex items-center justify-end gap-2">
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleResolve(item.projectId, "dismiss")}
                              >
                                Dismiss
                              </Button>
                              <Button
                                type="button"
                                variant="destructive"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleResolve(item.projectId, "takedown")}
                              >
                                Take down
                              </Button>
                            </div>
                          ) : item.queueBucket === "takedown" ? (
                            <div className="inline-flex items-center justify-end gap-2">
                              <Badge tone="danger">Taken down</Badge>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={isPending}
                                onClick={() => handleResolve(item.projectId, "restore")}
                              >
                                <RotateCcw className="size-3.5" />
                                Lift takedown
                              </Button>
                            </div>
                          ) : (
                            <Badge tone="neutral">Dismissed</Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>

          {/* Review panel (Figma 34:8881) */}
          {activeCase && (
            <Card
              data-testid="moderation-review-panel"
              className="min-w-0 gap-4 p-6"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-foreground type-heading-s">
                    Reviewing · {activeCase.projectName}
                  </h2>
                  <Badge tone="draft" withDot={false}>
                    {activeCase.reportCount}{" "}
                    {activeCase.reportCount === 1 ? "report" : "reports"}
                  </Badge>
                </div>
                <span className="text-muted-foreground type-caption">
                  Author: {activeCase.authorName} ({activeCase.authorEmail})
                </span>
              </div>

              <div className="flex flex-col gap-2">
                {activeCase.reportNotes.map((note, idx) => (
                  <p key={idx} className="text-foreground type-body-s">
                    &ldquo;{note}&rdquo;
                  </p>
                ))}
                <p className="text-muted-foreground type-body-s">
                  Unpublishing hides the public link; the owner keeps the draft and gets an email.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {activeCase.projectSlug && activeCase.projectVisibility !== "private" && (
                  <Button asChild variant="secondary" size="sm">
                    <Link href={`/p/${activeCase.projectSlug}`} target="_blank">
                      Open live page
                      <ExternalLink className="size-3.5" />
                    </Link>
                  </Button>
                )}

                {activeCase.queueBucket === "open" && (
                  <>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleResolve(activeCase.projectId, "dismiss")}
                    >
                      Dismiss report
                    </Button>
                    <Button
                      type="button"
                      variant="destructive"
                      size="sm"
                      disabled={isPending}
                      onClick={() => handleResolve(activeCase.projectId, "takedown")}
                    >
                      Take down
                    </Button>
                  </>
                )}

                {activeCase.queueBucket === "takedown" && (
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    disabled={isPending}
                    onClick={() => handleResolve(activeCase.projectId, "restore")}
                  >
                    <RotateCcw className="size-3.5" />
                    Lift takedown hold
                  </Button>
                )}
              </div>
            </Card>
          )}
        </>
      )}

      <Dialog open={bulkDismissOpen} onOpenChange={setBulkDismissOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Dismiss all open reports</DialogTitle>
            <DialogDescription>
              This marks all {overview.openCount} currently open moderation reports as dismissed.
              Provide an audit reason for the permanent log.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleDismissAllOpen} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="bulk-dismiss-reason" className="text-foreground type-body-s-strong">
                Audit reason
              </label>
              <Input
                id="bulk-dismiss-reason"
                required
                minLength={5}
                maxLength={300}
                placeholder="e.g. Cleared automated spam wave after review"
                value={bulkDismissReason}
                onChange={(e) => setBulkDismissReason(e.target.value)}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="ghost" onClick={() => setBulkDismissOpen(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? "Dismissing..." : "Confirm bulk dismiss"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
