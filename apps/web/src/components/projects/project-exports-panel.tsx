"use client";

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Clock,
  Download,
  ExternalLink,
  FileImage,
  FileText,
  Globe,
  Layers,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { ExportCaseStudyDialog } from "@/components/projects/export-dialog";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { can } from "@/lib/entitlements";
import { runBrowserAssistedExport } from "@/lib/exports/client-renderer";
import {
  EXPORT_PRESETS,
  type EnqueueExportResult,
  type ExportFormatOption,
  type ExportHistoryItem,
  type ProjectExportsOverviewPayload,
} from "@/lib/exports/types";
import { cn } from "@/lib/utils";

export interface ProjectExportsPanelProps {
  initialOverview: ProjectExportsOverviewPayload;
  requestExport?: (input: {
    projectId: string;
    format: ExportFormatOption;
    scale?: 1 | 2;
  }) => Promise<EnqueueExportResult>;
  pollOverview?: (projectId: string) => Promise<ProjectExportsOverviewPayload | null>;
}

async function defaultRequestExport(input: {
  projectId: string;
  format: ExportFormatOption;
  scale?: 1 | 2;
}): Promise<EnqueueExportResult> {
  const response = await fetch("/api/exports", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  return (await response.json()) as EnqueueExportResult;
}

async function defaultPollOverview(
  projectId: string,
): Promise<ProjectExportsOverviewPayload | null> {
  const response = await fetch(`/api/exports?projectId=${encodeURIComponent(projectId)}`, {
    cache: "no-store",
  });
  if (!response.ok) return null;
  const payload = (await response.json()) as {
    ok: boolean;
    overview?: ProjectExportsOverviewPayload;
  };
  return payload.ok && payload.overview ? payload.overview : null;
}

function formatExportLabel(format: ExportFormatOption): string {
  const found = EXPORT_PRESETS.find((item) => item.format === format);
  return found ? found.label : format;
}

function PresetBadgeIcon({ format }: { format: ExportFormatOption }) {
  if (format === "pdf") {
    return <FileText className="text-primary size-4 shrink-0" />;
  }
  if (format === "behance") {
    return <Layers className="text-primary size-4 shrink-0" />;
  }
  return <FileImage className="text-primary size-4 shrink-0" />;
}

function StatusBadge({ status }: { status: ExportHistoryItem["status"] }) {
  if (status === "completed") {
    return <Badge tone="published">Ready</Badge>;
  }
  if (status === "failed") {
    return <Badge tone="danger">Failed</Badge>;
  }
  if (status === "processing") {
    return <Badge tone="accent">Rendering</Badge>;
  }
  return <Badge tone="draft">Queued</Badge>;
}

export function ProjectExportsPanel({
  initialOverview,
  requestExport = defaultRequestExport,
  pollOverview = defaultPollOverview,
}: ProjectExportsPanelProps) {
  const [overview, setOverview] = useState<ProjectExportsOverviewPayload>(initialOverview);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatOption>("png_long");
  const canUsePng2x = can(overview.ownerPlan, "export_png_2x");
  const [pngScale, setPngScale] = useState<1 | 2>(1);
  const [isStartingExport, setIsStartingExport] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const isFreePlan = !can(overview.ownerPlan, "remove_watermark");
  const selectedPreset =
    EXPORT_PRESETS.find((item) => item.format === selectedFormat) ?? EXPORT_PRESETS[0]!;
  const isSelectedLocked =
    selectedPreset.format === "pdf"
      ? !can(overview.ownerPlan, "export_pdf")
      : selectedPreset.format === "behance"
        ? !can(overview.ownerPlan, "export_behance")
        : false;

  const hasActiveJobs = useMemo(
    () => overview.exports.some((item) => item.status === "queued" || item.status === "processing"),
    [overview.exports],
  );

  useEffect(() => {
    if (!hasActiveJobs) return;

    const timer = setInterval(async () => {
      try {
        const next = await pollOverview(overview.projectId);
        if (next) {
          setOverview(next);
        }
      } catch {
        // Retry next interval
      }
    }, 900);

    return () => clearInterval(timer);
  }, [hasActiveJobs, overview.projectId, pollOverview]);

  const newestQueuedWithRenderUrl = useMemo(
    () =>
      overview.exports.find((item) => item.status === "queued" && Boolean(item.renderUrl)) ?? null,
    [overview.exports],
  );

  useEffect(() => {
    if (!newestQueuedWithRenderUrl) return;

    const fallbackTimer = setTimeout(async () => {
      const completed = await runBrowserAssistedExport(newestQueuedWithRenderUrl);
      if (completed) {
        setOverview((prev) => ({
          ...prev,
          exports: prev.exports.map((item) => (item.id === completed.id ? completed : item)),
        }));
      }
    }, 2200);

    return () => clearTimeout(fallbackTimer);
  }, [newestQueuedWithRenderUrl]);

  const handleQuickExport = useCallback(async () => {
    setErrorMessage(null);
    setIsStartingExport(true);

    try {
      const result = await requestExport({
        projectId: overview.projectId,
        format: selectedFormat,
        ...(selectedFormat === "png_long" && pngScale === 2 ? { scale: 2 as const } : {}),
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setOverview((prev) => ({
        ...prev,
        monthlyExportsUsed: result.monthlyExportsUsed,
        monthlyExportsLimit: result.monthlyExportsLimit,
        exports: [result.exportJob, ...prev.exports.filter((e) => e.id !== result.exportJob.id)],
      }));
      toast.success(
        result.reusedCachedArtifact
          ? "Ready immediately from cached revision export"
          : "Export job started",
      );
    } catch {
      setErrorMessage("Unable to queue export right now. Please try again.");
    } finally {
      setIsStartingExport(false);
    }
  }, [overview.projectId, pngScale, requestExport, selectedFormat]);

  const upsertExportItem = useCallback((job: ExportHistoryItem) => {
    setOverview((prev) => {
      const exists = prev.exports.some((item) => item.id === job.id);
      const nextExports = exists
        ? prev.exports.map((item) => (item.id === job.id ? job : item))
        : [job, ...prev.exports];
      return {
        ...prev,
        exports: nextExports,
      };
    });
  }, []);

  return (
    <div
      data-testid="project-exports-panel"
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-2 py-4 sm:px-6 sm:py-6 lg:px-8"
    >
      {/* Header & Sub-navigation */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <Link
              href={`/editor/${overview.projectId}`}
              aria-label="Back to case study editor"
              className="border-border/80 bg-elevated text-foreground hover:bg-surface shadow-xs mt-1 inline-flex size-10 shrink-0 items-center justify-center rounded-full border transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="flex flex-col gap-1.5">
              <Eyebrow className="w-fit">Exports</Eyebrow>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-foreground type-display-m">{overview.projectName}</h1>
                {overview.isPublished ? (
                  <Badge tone="published">Published</Badge>
                ) : (
                  <Badge tone="draft">Draft</Badge>
                )}
              </div>
              <p className="text-muted-foreground type-body-s">
                Template: {overview.templateName} · High-resolution Chromium exports · Retained 7
                days per export
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/editor/${overview.projectId}`}>Back to Editor</Link>
            </Button>

            {overview.isPublished && overview.slug && (
              <Button asChild variant="secondary" size="sm">
                <Link href={`/p/${overview.slug}`} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" />
                  <span>Live Page</span>
                </Link>
              </Button>
            )}

            <ExportCaseStudyDialog
              projectId={overview.projectId}
              projectName={overview.projectName}
              ownerPlan={overview.ownerPlan}
              onExportQueued={upsertExportItem}
              onExportCompleted={upsertExportItem}
            />
          </div>
        </div>

        <nav
          aria-label="Project publishing and exports"
          className="border-border/70 bg-sunken/80 inline-flex w-fit max-w-full flex-wrap items-center gap-1 rounded-full border p-1"
        >
          <Link
            href={`/projects/${overview.projectId}/share`}
            className="text-muted-foreground hover:text-foreground type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
          >
            <Globe className="size-3.5" />
            <span>Publish &amp; Share</span>
          </Link>
          <Link
            href={`/projects/${overview.projectId}/exports`}
            aria-current="page"
            className="bg-elevated text-foreground shadow-card type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-2"
          >
            <Download className="text-primary size-3.5" />
            <span>Exports (PNG / PDF / Behance)</span>
          </Link>
          <Link
            href={`/projects/${overview.projectId}/analytics`}
            className="text-muted-foreground hover:text-foreground type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-2 transition-colors"
          >
            <BarChart3 className="size-3.5" />
            <span>Analytics</span>
          </Link>
        </nav>
      </div>

      {errorMessage && (
        <div
          role="alert"
          data-testid="exports-error-alert"
          className="border-destructive/35 bg-destructive-soft text-destructive flex items-start gap-2.5 rounded-2xl border p-4"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="type-body-s">{errorMessage}</span>
        </div>
      )}

      {/* Preset Cards + Plan Quota Banner */}
      <section className="border-border/80 bg-elevated shadow-card flex flex-col gap-5 rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h2 className="text-foreground type-heading-m">Export Presets</h2>
            <p className="text-muted-foreground type-body-s">
              Generate pixel-accurate presentations matching your editor fonts and theme palette.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {typeof overview.monthlyExportsLimit === "number" &&
              (isFreePlan ? (
                <Badge data-testid="free-export-quota-badge" tone="neutral">
                  {overview.monthlyExportsUsed} of {overview.monthlyExportsLimit} Free exports this
                  month
                </Badge>
              ) : (
                <Badge data-testid="export-quota-badge" tone="neutral">
                  {overview.monthlyExportsUsed} of {overview.monthlyExportsLimit} exports this month
                </Badge>
              ))}
            {!isFreePlan && <ProBadge />}
          </div>
        </div>

        <div
          role="radiogroup"
          aria-label="Select export format"
          className="grid gap-4 md:grid-cols-3"
        >
          {EXPORT_PRESETS.map((preset) => {
            const locked = isFreePlan && preset.requiresPro;
            const isSelected = selectedFormat === preset.format;

            return (
              <button
                key={preset.format}
                type="button"
                role="radio"
                aria-checked={isSelected}
                data-testid={`export-preset-${preset.format}`}
                onClick={() => {
                  setSelectedFormat(preset.format);
                  setErrorMessage(null);
                }}
                className={cn(
                  "flex flex-col justify-between gap-4 rounded-2xl border p-5 text-left transition-all",
                  isSelected
                    ? "border-primary bg-accent/40 ring-primary/15 shadow-card -translate-y-0.5 ring-2"
                    : "border-border/80 bg-surface/60 hover:border-border-strong hover:bg-surface",
                )}
              >
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="bg-elevated border-border/70 inline-flex size-10 items-center justify-center rounded-xl border shadow-2xs">
                      <PresetBadgeIcon format={preset.format} />
                    </span>
                    <div className="flex items-center gap-1.5">
                      <Badge tone="neutral" withDot={false}>
                        {preset.badge}
                      </Badge>
                      {preset.requiresPro && <ProBadge />}
                    </div>
                  </div>

                  <div className="flex flex-col gap-1">
                    <span className="text-foreground type-heading-s">{preset.label}</span>
                    <p className="text-muted-foreground type-caption">{preset.description}</p>
                  </div>
                </div>

                {locked ? (
                  <span className="text-muted-foreground type-caption inline-flex items-center gap-1.5">
                    <Lock className="text-warning size-3.5" />
                    <span>Pro, Team, or Plus plan required</span>
                  </span>
                ) : (
                  <span className="text-tertiary type-caption font-mono">
                    .{preset.fileExtension.toUpperCase()} download
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* PNG Resolution Selector (`1x` 1,440 px vs `2x` 2,880 px — Spec §5.3) */}
        {selectedFormat === "png_long" && (
          <div className="border-border/70 bg-surface/60 flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-4">
            <div className="flex flex-col gap-0.5">
              <span className="text-foreground type-body-s-strong">PNG Output Resolution</span>
              <span className="text-muted-foreground type-caption">
                1× renders up to 1,440 px wide; 2× renders retina 2,880 px wide on Pro, Team &amp;
                Plus.
              </span>
            </div>

            <div
              role="group"
              aria-label="PNG output resolution"
              className="border-border/70 bg-sunken/80 inline-flex items-center gap-1 rounded-full border p-1"
            >
              <button
                type="button"
                data-testid="export-png-scale-1x"
                aria-pressed={pngScale === 1}
                onClick={() => setPngScale(1)}
                className={cn(
                  "type-caption rounded-full px-3 py-1 font-medium transition-all",
                  pngScale === 1
                    ? "bg-elevated text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                1× · 1,440 px
              </button>
              <button
                type="button"
                data-testid="export-png-scale-2x"
                aria-pressed={pngScale === 2}
                onClick={() => {
                  if (!canUsePng2x) {
                    setUpgradeOpen(true);
                    return;
                  }
                  setPngScale(2);
                }}
                className={cn(
                  "type-caption inline-flex items-center gap-1 rounded-full px-3 py-1 font-medium transition-all",
                  pngScale === 2
                    ? "bg-elevated text-foreground shadow-2xs"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {!canUsePng2x && <Lock className="size-3" />}
                <span>2× · 2,880 px</span>
              </button>
            </div>
          </div>
        )}

        <div className="border-border/70 flex flex-wrap items-center justify-between gap-4 border-t pt-5">
          <div className="flex items-center gap-2">
            <Sparkles className="text-primary size-4 shrink-0" />
            <span className="text-muted-foreground type-caption">
              {overview.hasWatermark
                ? "Free PNG & PDF exports include a subtle 'Made with Casefolio' watermark."
                : overview.ownerPlan === "plus"
                  ? "White-Label exports enabled (Casefolio Plus — zero branding in files or PDF metadata)."
                  : "Watermark-free high-res exports enabled."}
            </span>
          </div>

          {isSelectedLocked ? (
            <Button asChild data-testid="upgrade-export-cta">
              <Link
                href="/account"
                onClick={(event) => {
                  event.preventDefault();
                  setUpgradeOpen(true);
                }}
              >
                Upgrade to Pro for {selectedPreset.fileExtension.toUpperCase()}
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="start-export-button"
              disabled={isStartingExport}
              onClick={handleQuickExport}
            >
              {isStartingExport ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              <span>
                Export {selectedPreset.label}
                {selectedFormat === "png_long" && pngScale === 2 ? " (2×)" : ""}
              </span>
            </Button>
          )}
        </div>
      </section>

      {/* Download History */}
      <section
        aria-label="Export download history"
        className="border-border/80 bg-elevated shadow-card flex flex-col gap-5 rounded-3xl border p-6 sm:p-8"
      >
        <div className="flex items-center justify-between gap-2">
          <div className="flex flex-col gap-0.5">
            <h2 className="text-foreground type-heading-m">Export History</h2>
            <p className="text-muted-foreground type-body-s">
              Rendered export files are retained for 7 days and do not count against persistent
              workspace storage.
            </p>
          </div>
          <Badge tone="neutral" withDot={false}>
            {overview.exports.length} {overview.exports.length === 1 ? "export" : "exports"}
          </Badge>
        </div>

        {overview.exports.length === 0 ? (
          <div
            data-testid="exports-empty-state"
            className="border-border/80 bg-surface/60 flex flex-col items-center justify-center gap-2.5 rounded-2xl border border-dashed py-14 text-center"
          >
            <Clock className="text-tertiary size-6" />
            <p className="text-foreground type-body-s-strong">No exports generated yet</p>
            <p className="text-tertiary type-caption max-w-md">
              Select PNG Long, PDF, or Behance Image Pack above to render your first high-resolution
              export.
            </p>
          </div>
        ) : (
          <div data-testid="exports-history-list" className="divide-border/70 divide-y">
            {overview.exports.map((item) => (
              <div
                key={item.id}
                data-testid={`export-history-row-${item.id}`}
                data-export-format={item.format}
                data-export-status={item.status}
                className="flex flex-wrap items-center justify-between gap-4 py-4 first:pt-1 last:pb-1"
              >
                <div className="flex min-w-0 items-center gap-3.5">
                  <div className="border-border/80 bg-surface flex size-11 shrink-0 items-center justify-center rounded-2xl border">
                    <PresetBadgeIcon format={item.format} />
                  </div>

                  <div className="flex min-w-0 flex-col gap-0.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-foreground type-body-s-strong">
                        {formatExportLabel(item.format)}
                      </span>
                      {item.format === "png_long" && item.scale === 2 && (
                        <Badge tone="accent" withDot={false}>
                          2× Retina
                        </Badge>
                      )}
                      <StatusBadge status={item.status} />
                    </div>
                    <span className="text-tertiary type-caption">
                      {new Date(item.createdAtIso).toLocaleString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                      })}
                      {item.expiresAtIso
                        ? ` · Expires ${new Date(item.expiresAtIso).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                          })}`
                        : ""}
                      {item.error ? ` · ${item.error}` : ""}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {(item.status === "queued" || item.status === "processing") && (
                    <span className="text-tertiary type-caption inline-flex items-center gap-1.5">
                      <Loader2 className="text-primary size-3.5 animate-spin" />
                      <span>Rendering...</span>
                    </span>
                  )}

                  {item.status === "completed" && item.downloadUrl && (
                    <Button asChild variant="secondary" size="sm">
                      <a
                        href={item.downloadUrl}
                        download
                        data-testid={`download-export-${item.id}`}
                      >
                        <Download className="size-3.5" />
                        <span>Download</span>
                      </a>
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      <UpgradePromptDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureTitle={`Unlock ${selectedFormat === "png_long" ? "2× Retina PNG Exports" : selectedPreset.label}`}
        featureDescription="Upgrade to Casefolio Pro ($9.99/mo or $7.99/mo billed annually) for watermark-free PDF & 2× 2,880px PNG exports, Behance 1,400px image packs, and Unlimited Case Studies."
      />
    </div>
  );
}
