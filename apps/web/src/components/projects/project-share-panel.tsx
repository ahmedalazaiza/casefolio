"use client";

import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  Globe,
  Link2,
  Loader2,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { can } from "@/lib/entitlements";
import type {
  ProjectShareSettingsPayload,
  PublishProjectInput,
  PublishProjectResult,
  UnpublishProjectResult,
} from "@/lib/projects/publish";
import { buildTemplateThemeStyle } from "@/lib/template/theme-vars";
import { cn } from "@/lib/utils";

export interface ProjectSharePanelProps {
  initialSettings: ProjectShareSettingsPayload;
  onPublish: (input: PublishProjectInput) => Promise<PublishProjectResult>;
  onUnpublish: (projectId: string) => Promise<UnpublishProjectResult>;
  onCheckSlug: (
    slug: string,
    projectId: string,
  ) => Promise<{ available: boolean; normalizedSlug: string; reason?: string }>;
}

function normalizeClientSlugDraft(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "-")
    .replace(/-{2,}/g, "-");
}

export function ProjectSharePanel({
  initialSettings,
  onPublish,
  onUnpublish,
  onCheckSlug,
}: ProjectSharePanelProps) {
  const [isPublished, setIsPublished] = useState(initialSettings.isPublished);
  const [publishedSlug, setPublishedSlug] = useState<string | null>(initialSettings.slug);
  const [slugDraft, setSlugDraft] = useState(initialSettings.slug ?? initialSettings.suggestedSlug);
  const [visibility, setVisibility] = useState<"public" | "unlisted">(
    initialSettings.visibility === "unlisted" ? "unlisted" : "public",
  );
  const [publishedAtIso, setPublishedAtIso] = useState<string | null>(
    initialSettings.publishedAtIso,
  );
  const [slugCheckState, setSlugCheckState] = useState<{
    status: "idle" | "checking" | "available" | "unavailable";
    message?: string;
  }>({ status: "idle" });
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUnpublishing, setIsUnpublishing] = useState(false);
  const [copied, setCopied] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);

  const canRemoveWatermark = can(initialSettings.ownerPlan, "remove_watermark");

  const checkTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const cleanSlugPreview = slugDraft.replace(/^-+|-+$/g, "") || initialSettings.suggestedSlug;
  const activeSlug = isPublished && publishedSlug ? publishedSlug : cleanSlugPreview;
  const fullPublicUrl = `${initialSettings.appBaseUrl}/p/${activeSlug}`;

  useEffect(() => {
    const trimmed = slugDraft.trim().replace(/^-+|-+$/g, "");
    if (!trimmed) {
      setSlugCheckState({ status: "idle" });
      return;
    }

    if (trimmed === publishedSlug && isPublished) {
      setSlugCheckState({ status: "available", message: "Current live URL slug" });
      return;
    }

    if (checkTimerRef.current) {
      clearTimeout(checkTimerRef.current);
    }

    setSlugCheckState({ status: "checking" });
    checkTimerRef.current = setTimeout(async () => {
      try {
        const res = await onCheckSlug(trimmed, initialSettings.projectId);
        if (res.available) {
          setSlugCheckState({
            status: "available",
            message: `Available · /p/${res.normalizedSlug}`,
          });
        } else {
          setSlugCheckState({
            status: "unavailable",
            message: res.reason ?? "Slug is unavailable.",
          });
        }
      } catch {
        setSlugCheckState({ status: "idle" });
      }
    }, 280);

    return () => {
      if (checkTimerRef.current) {
        clearTimeout(checkTimerRef.current);
      }
    };
  }, [slugDraft, publishedSlug, isPublished, initialSettings.projectId, onCheckSlug]);

  const handlePublish = useCallback(async () => {
    setErrorMessage(null);
    setIsSubmitting(true);

    try {
      const result = await onPublish({
        projectId: initialSettings.projectId,
        slug: slugDraft,
        visibility,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setIsPublished(true);
      setPublishedSlug(result.slug);
      setSlugDraft(result.slug);
      setVisibility(result.visibility);
      setPublishedAtIso(result.publishedAtIso);
      toast.success(isPublished ? "Share settings updated" : "Case study published!");
    } catch {
      setErrorMessage("Unable to publish right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }, [initialSettings.projectId, slugDraft, visibility, isPublished, onPublish]);

  const handleUnpublish = useCallback(async () => {
    setErrorMessage(null);
    setIsUnpublishing(true);

    try {
      const result = await onUnpublish(initialSettings.projectId);
      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setIsPublished(false);
      setPublishedAtIso(null);
      toast.success("Case study unpublished and returned to private draft.");
    } catch {
      setErrorMessage("Unable to unpublish right now. Please try again.");
    } finally {
      setIsUnpublishing(false);
    }
  }, [initialSettings.projectId, onUnpublish]);

  const handleCopyUrl = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(fullPublicUrl);
      setCopied(true);
      toast.success("Public link copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Could not copy link automatically");
    }
  }, [fullPublicUrl]);

  return (
    <div
      data-testid="project-share-panel"
      className="mx-auto flex w-full max-w-6xl flex-col gap-8 px-4 py-8 sm:px-6 lg:px-8"
    >
      {/* Top header & project sub-navigation */}
      <div className="flex flex-col gap-5">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Link
              href={`/editor/${initialSettings.projectId}`}
              aria-label="Back to case study editor"
              className="border-border bg-elevated text-foreground hover:bg-surface inline-flex size-9 items-center justify-center rounded-full border transition-colors"
            >
              <ArrowLeft className="size-4" />
            </Link>

            <div className="flex flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-foreground type-heading-l">{initialSettings.projectName}</h1>
                {isPublished ? (
                  <Badge data-testid="share-status-badge" tone="published">
                    {visibility === "unlisted" ? "Published · Unlisted" : "Published · Public"}
                  </Badge>
                ) : (
                  <Badge data-testid="share-status-badge" tone="draft">
                    Draft · Private
                  </Badge>
                )}
              </div>
              <p className="text-tertiary type-caption">
                Template: {initialSettings.templateName}
                {publishedAtIso
                  ? ` · Live since ${new Date(publishedAtIso).toLocaleDateString("en-US", {
                      month: "short",
                      day: "numeric",
                      year: "numeric",
                    })}`
                  : " · Not published yet"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button asChild variant="secondary" size="sm">
              <Link href={`/editor/${initialSettings.projectId}`}>Back to Editor</Link>
            </Button>
            {isPublished && publishedSlug && (
              <Button asChild size="sm">
                <Link
                  href={`/p/${publishedSlug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  data-testid="open-public-link"
                >
                  <ExternalLink className="size-3.5" />
                  <span>View Live Page</span>
                </Link>
              </Button>
            )}
          </div>
        </div>

        {/* Sub-nav between Publish & Share and Exports */}
        <nav
          aria-label="Project publishing and exports"
          className="border-border flex items-center gap-2 border-b pb-3"
        >
          <Link
            href={`/projects/${initialSettings.projectId}/share`}
            aria-current="page"
            className="bg-inverse text-inverse-foreground type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-1.5"
          >
            <Globe className="size-3.5" />
            <span>Publish &amp; Share</span>
          </Link>
          <Link
            href={`/projects/${initialSettings.projectId}/exports`}
            className="text-muted-foreground hover:text-foreground hover:bg-sunken type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors"
          >
            <Download className="size-3.5" />
            <span>Exports (PNG / PDF / Behance)</span>
          </Link>
          <Link
            href={`/projects/${initialSettings.projectId}/analytics`}
            className="text-muted-foreground hover:text-foreground hover:bg-sunken type-body-s-strong inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-colors"
          >
            <BarChart3 className="size-3.5" />
            <span>Analytics</span>
          </Link>
        </nav>
      </div>

      {/* Main 2-column grid */}
      <div className="grid gap-6 lg:grid-cols-12">
        {/* Left Column: Slug + Visibility + Publish/Unpublish Controls */}
        <div className="flex flex-col gap-6 lg:col-span-7">
          {errorMessage && (
            <div
              role="alert"
              data-testid="publish-error-alert"
              className="border-destructive/35 bg-destructive-soft text-destructive flex items-start gap-2.5 rounded-xl border p-4"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <span className="type-body-s">{errorMessage}</span>
            </div>
          )}

          {/* Custom URL Slug Card */}
          <section className="border-border bg-elevated flex flex-col gap-4 rounded-2xl border p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-foreground type-heading-s">Public URL Slug</h2>
              <p className="text-muted-foreground type-body-s">
                Customize the shareable web address for your case study.
              </p>
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="publish-slug-input">Case study URL</Label>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="border-border bg-background focus-within:ring-ring/40 flex flex-1 items-center overflow-hidden rounded-xl border focus-within:ring-2">
                  <span className="bg-sunken text-tertiary border-border type-caption shrink-0 border-r px-3 py-2.5 select-none">
                    {initialSettings.appBaseUrl.replace(/^https?:\/\//, "")}/p/
                  </span>
                  <Input
                    id="publish-slug-input"
                    data-testid="publish-slug-input"
                    value={slugDraft}
                    onChange={(e) => setSlugDraft(normalizeClientSlugDraft(e.target.value))}
                    placeholder={initialSettings.suggestedSlug}
                    className="border-0 bg-transparent shadow-none focus-visible:ring-0"
                  />
                </div>

                <Button
                  type="button"
                  variant="secondary"
                  data-testid="copy-public-link-button"
                  onClick={handleCopyUrl}
                  className="shrink-0"
                >
                  {copied ? <Check className="text-success size-4" /> : <Copy className="size-4" />}
                  <span>{copied ? "Copied" : "Copy link"}</span>
                </Button>
              </div>

              {slugCheckState.status === "checking" && (
                <p className="text-tertiary type-caption inline-flex items-center gap-1.5">
                  <Loader2 className="size-3 animate-spin" />
                  <span>Checking availability...</span>
                </p>
              )}
              {slugCheckState.status === "available" && (
                <p
                  data-testid="slug-availability-status"
                  className="text-success type-caption inline-flex items-center gap-1.5"
                >
                  <Check className="size-3.5" />
                  <span>{slugCheckState.message}</span>
                </p>
              )}
              {slugCheckState.status === "unavailable" && (
                <p
                  data-testid="slug-availability-status"
                  className="text-destructive type-caption inline-flex items-center gap-1.5"
                >
                  <AlertCircle className="size-3.5" />
                  <span>{slugCheckState.message}</span>
                </p>
              )}
            </div>
          </section>

          {/* Visibility Options Card */}
          <section className="border-border bg-elevated flex flex-col gap-4 rounded-2xl border p-6">
            <div className="flex flex-col gap-1">
              <h2 className="text-foreground type-heading-s">Access &amp; Discovery</h2>
              <p className="text-muted-foreground type-body-s">
                Control whether search engines can index your published case study.
              </p>
            </div>

            <div
              role="radiogroup"
              aria-label="Case study visibility"
              className="grid gap-3 sm:grid-cols-2"
            >
              <button
                type="button"
                role="radio"
                aria-checked={visibility === "public"}
                data-testid="visibility-option-public"
                onClick={() => setVisibility("public")}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                  visibility === "public"
                    ? "border-primary bg-accent/40"
                    : "border-border bg-background hover:border-border-strong",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-foreground type-body-s-strong inline-flex items-center gap-2">
                    <Globe className="text-primary size-4" />
                    <span>Public</span>
                  </span>
                  {visibility === "public" && <Badge tone="accent">Selected</Badge>}
                </div>
                <p className="text-muted-foreground type-caption">
                  Anyone with the link can view, and search engines can index this page.
                </p>
              </button>

              <button
                type="button"
                role="radio"
                aria-checked={visibility === "unlisted"}
                data-testid="visibility-option-unlisted"
                onClick={() => setVisibility("unlisted")}
                className={cn(
                  "flex flex-col items-start gap-2 rounded-xl border p-4 text-left transition-colors",
                  visibility === "unlisted"
                    ? "border-primary bg-accent/40"
                    : "border-border bg-background hover:border-border-strong",
                )}
              >
                <div className="flex w-full items-center justify-between">
                  <span className="text-foreground type-body-s-strong inline-flex items-center gap-2">
                    <Link2 className="text-primary size-4" />
                    <span>Unlisted</span>
                  </span>
                  {visibility === "unlisted" && <Badge tone="accent">Selected</Badge>}
                </div>
                <p className="text-muted-foreground type-caption">
                  Only people with the direct link can view. Hidden from search engines (noindex).
                </p>
              </button>
            </div>

            <div className="border-border mt-2 flex flex-wrap items-center justify-between gap-3 border-t pt-4">
              {isPublished ? (
                <Button
                  type="button"
                  variant="destructive"
                  data-testid="unpublish-project-button"
                  disabled={isUnpublishing || isSubmitting}
                  onClick={handleUnpublish}
                >
                  {isUnpublishing ? (
                    <Loader2 className="size-4 animate-spin" />
                  ) : (
                    <EyeOff className="size-4" />
                  )}
                  <span>Unpublish</span>
                </Button>
              ) : (
                <span className="text-tertiary type-caption">
                  Uploaded assets stay private until you publish.
                </span>
              )}

              <Button
                type="button"
                data-testid="publish-project-button"
                disabled={isSubmitting || isUnpublishing || slugCheckState.status === "unavailable"}
                onClick={handlePublish}
              >
                {isSubmitting ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Globe className="size-4" />
                )}
                <span>{isPublished ? "Save Share Settings" : "Publish Case Study"}</span>
              </Button>
            </div>
          </section>
        </div>

        {/* Right Column: Social OG Preview + Plan Branding Card */}
        <div className="flex flex-col gap-6 lg:col-span-5">
          <section className="border-border bg-elevated flex flex-col gap-4 rounded-2xl border p-6">
            <div className="flex items-center justify-between gap-2">
              <div className="flex flex-col gap-0.5">
                <h2 className="text-foreground type-heading-s">Social Share Preview</h2>
                <p className="text-tertiary type-caption">
                  Auto-generated 1200×630 OpenGraph card via Satori
                </p>
              </div>
              <Badge tone="neutral" withDot={false}>
                OG Card
              </Badge>
            </div>

            <div
              data-testid="og-card-preview"
              style={buildTemplateThemeStyle(initialSettings.theme)}
              className="border-border overflow-hidden rounded-xl border"
            >
              <div
                style={{
                  backgroundColor: "var(--tpl-color-background, var(--background))",
                  color: "var(--tpl-color-text, var(--foreground))",
                }}
                className="flex aspect-[1200/630] flex-col justify-between p-6"
              >
                <div className="flex items-center justify-between gap-2">
                  <span
                    style={{
                      backgroundColor: "var(--tpl-color-surface, var(--surface))",
                      color: "var(--tpl-color-text, var(--foreground))",
                    }}
                    className="type-caption inline-flex rounded-full px-3 py-1 font-semibold"
                  >
                    {initialSettings.preview.eyebrow}
                  </span>
                  <span
                    style={{
                      color: "var(--tpl-color-textMuted, var(--muted-foreground))",
                    }}
                    className="type-caption"
                  >
                    Casefolio
                  </span>
                </div>

                <div className="flex flex-col gap-1.5">
                  <p className="type-heading-m line-clamp-2 font-bold">
                    {initialSettings.preview.title}
                  </p>
                  <p
                    style={{
                      color: "var(--tpl-color-textMuted, var(--muted-foreground))",
                    }}
                    className="type-caption line-clamp-2"
                  >
                    {initialSettings.preview.subtitle}
                  </p>
                </div>

                <div className="border-border/30 flex items-center justify-between border-t pt-3">
                  <span className="type-caption truncate opacity-75">/p/{activeSlug}</span>
                </div>
              </div>
            </div>
          </section>

          <section className="border-border bg-elevated flex flex-col gap-3 rounded-2xl border p-6">
            <div className="flex items-center justify-between gap-2">
              <span className="text-foreground type-body-s-strong inline-flex items-center gap-2">
                <Sparkles className="text-primary size-4" />
                <span>Public Page Branding</span>
              </span>
              {!canRemoveWatermark ? <Badge tone="neutral">Free Plan</Badge> : <ProBadge />}
            </div>

            {!canRemoveWatermark ? (
              <>
                <p className="text-muted-foreground type-body-s">
                  Free plan public pages and PNG exports include a subtle &ldquo;Made with
                  Casefolio&rdquo; badge. Upgrade to Pro to remove all watermarks and unlock PDF
                  &amp; Behance exports.
                </p>
                <div>
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => setUpgradeOpen(true)}
                  >
                    Upgrade to Pro
                  </Button>
                </div>
              </>
            ) : (
              <p className="text-muted-foreground type-body-s">
                Your {initialSettings.ownerPlan.toUpperCase()} plan removes the Casefolio badge on
                all public pages and exported case studies.
              </p>
            )}
          </section>
        </div>
      </div>

      <UpgradePromptDialog
        open={upgradeOpen}
        onOpenChange={setUpgradeOpen}
        featureTitle="Remove Casefolio watermarks"
        featureDescription="Upgrade to Casefolio Pro to publish clean, unbranded case study URLs and export watermark-free PDFs and Behance slices."
      />
    </div>
  );
}
