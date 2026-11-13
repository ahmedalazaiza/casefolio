"use client";

import type { PlanTier } from "@casefolio/db";
import {
  AlertCircle,
  CheckCircle2,
  Download,
  FileImage,
  FileText,
  Layers,
  Loader2,
  Lock,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { can } from "@/lib/entitlements";
import { runBrowserAssistedExport } from "@/lib/exports/client-renderer";
import {
  EXPORT_PRESETS,
  type EnqueueExportResult,
  type ExportFormatOption,
  type ExportHistoryItem,
} from "@/lib/exports/types";
import { cn } from "@/lib/utils";

export interface ExportCaseStudyDialogProps {
  projectId: string;
  projectName: string;
  ownerPlan: PlanTier;
  trigger?: ReactNode;
  onExportQueued?: (job: ExportHistoryItem) => void;
  onExportCompleted?: (job: ExportHistoryItem) => void;
}

function PresetIcon({ format }: { format: ExportFormatOption }) {
  if (format === "pdf") {
    return <FileText className="text-primary size-4" />;
  }
  if (format === "behance") {
    return <Layers className="text-primary size-4" />;
  }
  return <FileImage className="text-primary size-4" />;
}

export function ExportCaseStudyDialog({
  projectId,
  projectName,
  ownerPlan,
  trigger,
  onExportQueued,
  onExportCompleted,
}: ExportCaseStudyDialogProps) {
  const [open, setOpen] = useState(false);
  const [selectedFormat, setSelectedFormat] = useState<ExportFormatOption>("png_long");
  const [activeJob, setActiveJob] = useState<ExportHistoryItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const isFreePlan = !can(ownerPlan, "remove_watermark");
  const selectedPreset = EXPORT_PRESETS.find((p) => p.format === selectedFormat) ?? EXPORT_PRESETS[0]!;
  const isSelectedLocked =
    selectedPreset.format === "pdf"
      ? !can(ownerPlan, "export_pdf")
      : selectedPreset.format === "behance"
        ? !can(ownerPlan, "export_behance")
        : false;

  useEffect(() => {
    if (!activeJob) return;
    if (activeJob.status !== "queued" && activeJob.status !== "processing") {
      return;
    }

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/exports/${activeJob.id}`, {
          cache: "no-store",
        });
        if (!res.ok) return;
        const json = (await res.json()) as {
          ok: boolean;
          exportJob?: ExportHistoryItem;
        };
        if (json.ok && json.exportJob) {
          setActiveJob(json.exportJob);
          if (json.exportJob.status === "completed") {
            onExportCompleted?.(json.exportJob);
          }
        }
      } catch {
        // Retry on next tick
      }
    }, 800);

    return () => clearInterval(interval);
  }, [activeJob, onExportCompleted]);

  useEffect(() => {
    if (!activeJob || activeJob.status !== "queued" || !activeJob.renderUrl) {
      return;
    }

    const fallbackTimer = setTimeout(async () => {
      const completed = await runBrowserAssistedExport(activeJob);
      if (completed) {
        setActiveJob(completed);
        if (completed.status === "completed") {
          onExportCompleted?.(completed);
        }
      }
    }, 2200);

    return () => clearTimeout(fallbackTimer);
  }, [activeJob, onExportCompleted]);

  const handleStartExport = useCallback(async () => {
    setErrorMessage(null);
    setIsSubmitting(true);
    setActiveJob(null);

    try {
      const response = await fetch("/api/exports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId,
          format: selectedFormat,
        }),
      });

      const payload = (await response.json()) as EnqueueExportResult;
      if (!payload.ok) {
        setErrorMessage(payload.error);
        return;
      }

      setActiveJob(payload.exportJob);
      onExportQueued?.(payload.exportJob);
    } catch {
      setErrorMessage("Could not start export job. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [projectId, selectedFormat, onExportQueued]);

  return (
    <Dialog
      open={open}
      onOpenChange={(nextOpen) => {
        setOpen(nextOpen);
        if (!nextOpen) {
          setErrorMessage(null);
        }
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <Button type="button" data-testid="open-export-dialog-button">
            <Download className="size-4" />
            <span>New Export</span>
          </Button>
        )}
      </DialogTrigger>

      <DialogContent data-testid="export-dialog" className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>Export &ldquo;{projectName}&rdquo;</DialogTitle>
          <DialogDescription>
            Choose an export preset. Chromium renders your live typography, theme tokens, and
            cropped slot images at full resolution.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-3 py-2">
          {errorMessage && (
            <div
              role="alert"
              data-testid="export-dialog-error"
              className="border-destructive/35 bg-destructive-soft text-destructive flex items-start gap-2.5 rounded-xl border p-3.5"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="type-body-s">{errorMessage}</span>
            </div>
          )}

          <div role="radiogroup" aria-label="Export format preset" className="flex flex-col gap-2.5">
            {EXPORT_PRESETS.map((preset) => {
              const locked = isFreePlan && preset.requiresPro;
              const isSelected = selectedFormat === preset.format;

              return (
                <button
                  key={preset.format}
                  type="button"
                  role="radio"
                  aria-checked={isSelected}
                  data-testid={`dialog-preset-${preset.format}`}
                  onClick={() => {
                    setSelectedFormat(preset.format);
                    setErrorMessage(null);
                  }}
                  className={cn(
                    "flex flex-col gap-1.5 rounded-2xl border p-4 text-left transition-all",
                    isSelected
                      ? "border-primary/50 bg-accent/30 shadow-xs"
                      : "border-border/80 bg-surface/50 hover:border-border-strong",
                  )}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-foreground type-body-s-strong inline-flex items-center gap-2">
                      <PresetIcon format={preset.format} />
                      <span>{preset.label}</span>
                    </span>

                    <div className="flex items-center gap-1.5">
                      <Badge tone="neutral" withDot={false}>
                        {preset.badge}
                      </Badge>
                      {preset.requiresPro && <ProBadge />}
                    </div>
                  </div>

                  <p className="text-muted-foreground type-caption">{preset.description}</p>

                  {locked && (
                    <span className="text-warning type-caption inline-flex items-center gap-1.5 pt-0.5">
                      <Lock className="size-3" />
                      <span>Requires Pro, Team, or Plus plan</span>
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {isFreePlan && (
            <div className="border-border bg-sunken flex items-center justify-between gap-3 rounded-xl border px-4 py-3">
              <span className="text-muted-foreground type-caption inline-flex items-center gap-2">
                <Sparkles className="text-primary size-3.5 shrink-0" />
                <span>
                  Free PNG &amp; PDF exports include a subtle &ldquo;Made with Casefolio&rdquo;
                  watermark.
                </span>
              </span>
              <Link href="/account/billing" className="text-primary type-caption shrink-0 hover:underline">
                Upgrade
              </Link>
            </div>
          )}

          {ownerPlan === "plus" && (
            <div className="border-border bg-sunken flex items-center gap-2 rounded-xl border px-4 py-3">
              <Sparkles className="text-primary size-3.5 shrink-0" />
              <span className="text-muted-foreground type-caption">
                White-Label exports active (Casefolio Plus) — zero Casefolio branding in rendered
                files or PDF metadata.
              </span>
            </div>
          )}

          {activeJob && (
            <div
              data-testid="export-dialog-live-status"
              data-status={activeJob.status}
              className="border-border bg-surface flex items-center justify-between gap-3 rounded-xl border p-4"
            >
              <div className="flex items-center gap-2.5">
                {(activeJob.status === "queued" || activeJob.status === "processing") && (
                  <>
                    <Loader2 className="text-primary size-4 shrink-0 animate-spin" />
                    <div className="flex flex-col">
                      <span className="text-foreground type-body-s-strong">
                        {activeJob.status === "queued"
                          ? "Queued in export worker..."
                          : "Rendering case study via Chromium..."}
                      </span>
                      <span className="text-tertiary type-caption">
                        Loading Google Fonts and high-DPI assets
                      </span>
                    </div>
                  </>
                )}
                {activeJob.status === "completed" && (
                  <>
                    <CheckCircle2 className="text-success size-4 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-foreground type-body-s-strong">Export ready!</span>
                      <span className="text-tertiary type-caption">
                        Saved to your project export history
                      </span>
                    </div>
                  </>
                )}
                {activeJob.status === "failed" && (
                  <>
                    <AlertCircle className="text-destructive size-4 shrink-0" />
                    <div className="flex flex-col">
                      <span className="text-destructive type-body-s-strong">Export failed</span>
                      <span className="text-tertiary type-caption">
                        {activeJob.error ?? "Renderer encountered an unexpected error."}
                      </span>
                    </div>
                  </>
                )}
              </div>

              {activeJob.status === "completed" && activeJob.downloadUrl && (
                <Button asChild size="sm">
                  <a href={activeJob.downloadUrl} download data-testid="dialog-download-ready">
                    <Download className="size-3.5" />
                    <span>Download</span>
                  </a>
                </Button>
              )}
            </div>
          )}
        </div>

        <DialogFooter>
          {isSelectedLocked ? (
            <Button asChild>
              <Link
                href="/account"
                data-testid="dialog-upgrade-pro-cta"
                onClick={(event) => {
                  event.preventDefault();
                  setOpen(false);
                  setUpgradeOpen(true);
                }}
              >
                Upgrade to Pro to Unlock {selectedPreset.fileExtension.toUpperCase()}
              </Link>
            </Button>
          ) : (
            <Button
              type="button"
              data-testid="dialog-confirm-export-button"
              disabled={
                isSubmitting ||
                activeJob?.status === "queued" ||
                activeJob?.status === "processing"
              }
              onClick={handleStartExport}
            >
              {isSubmitting ? (
                <Loader2 className="size-4 animate-spin" />
              ) : (
                <Download className="size-4" />
              )}
              <span>Generate {selectedPreset.fileExtension.toUpperCase()} Export</span>
            </Button>
          )}
        </DialogFooter>
      </DialogContent>

      <UpgradePromptDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureTitle={`Unlock ${selectedPreset.label}`}
        featureDescription="Upgrade to Casefolio Pro for high-resolution PDF case studies, Behance 1400px slices, and watermark-free exports."
      />
    </Dialog>
  );
}

