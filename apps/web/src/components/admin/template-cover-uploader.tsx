"use client";

import {
  AlertCircle,
  CheckCircle2,
  ImagePlus,
  Link2,
  Loader2,
  RefreshCw,
  Trash2,
} from "lucide-react";
import { useCallback, useId, useRef, useState } from "react";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isLegacyPlaceholderCoverUrl } from "@/lib/template/cover-url";
import { uploadTemplateCoverClient } from "@/lib/template/cover-upload";
import type { PutBinaryTransport } from "@/lib/storage/client-upload";
import { cn } from "@/lib/utils";

export const TEMPLATE_COVER_RATIO_OPTIONS = ["4:3", "16:10", "16:9", "3:2", "1:1"] as const;

export interface TemplateCoverUploaderProps {
  coverUrl: string;
  onCoverUrlChange: (nextUrl: string) => void;
  coverRatio?: string;
  onCoverRatioChange?: (nextRatio: string) => void;
  templateName?: string;
  templateSlug?: string;
  required?: boolean;
  compact?: boolean;
  putTransport?: PutBinaryTransport;
}

export function TemplateCoverUploader({
  coverUrl,
  onCoverUrlChange,
  coverRatio = "4:3",
  onCoverRatioChange,
  templateName = "Template",
  templateSlug,
  required = true,
  compact = false,
  putTransport,
}: TemplateCoverUploaderProps) {
  const fileInputId = useId();
  const urlInputId = useId();
  const ratioInputId = useId();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showUrlField, setShowUrlField] = useState(false);

  const trimmedUrl = coverUrl.trim();
  const isLegacySample = isLegacyPlaceholderCoverUrl(trimmedUrl);
  const hasRealCover = trimmedUrl.length > 0 && !isLegacySample;

  const handleSelectedFile = useCallback(
    async (file: File | undefined) => {
      if (!file) return;
      setUploadError(null);
      setIsUploading(true);
      setUploadProgress(5);

      try {
        const uploaded = await uploadTemplateCoverClient({
          file,
          putTransport,
          onProgress: (pct) => setUploadProgress(pct),
        });
        onCoverUrlChange(uploaded.coverUrl);
      } catch (err) {
        setUploadError(
          err instanceof Error ? err.message : "Failed to upload cover image. Please try again.",
        );
      } finally {
        setIsUploading(false);
      }
    },
    [onCoverUrlChange, putTransport],
  );

  return (
    <div
      data-testid="template-cover-uploader"
      className="border-border/80 bg-surface/60 flex flex-col gap-4 rounded-2xl border p-4 sm:p-5"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex flex-col gap-0.5">
          <div className="flex items-center gap-2">
            <span className="text-foreground type-body-s-strong">
              Cover / thumbnail image {required ? "*" : ""}
            </span>
            {hasRealCover ? (
              <Badge tone="published" withDot={false}>
                <CheckCircle2 className="mr-1 size-3" />
                Ready
              </Badge>
            ) : (
              <Badge tone="draft" withDot={false}>
                {required ? "Required" : "Optional"}
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground type-caption">
            Displayed everywhere this template appears — Landing page, Template Library, Create
            Project wizard, Dashboard, and Admin.
          </p>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowUrlField((prev) => !prev)}
          data-testid="toggle-cover-url-input"
        >
          <Link2 className="size-3.5" />
          <span>{showUrlField ? "Hide URL input" : "Use image URL"}</span>
        </Button>
      </div>

      {isLegacySample && (
        <div
          data-testid="cover-sample-placeholder-notice"
          className="border-warning/35 bg-warning-soft text-foreground flex items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5"
        >
          <span className="type-caption">
            Sample placeholder URL detected from JSON. Upload a real cover thumbnail for crisp cards
            across the website.
          </span>
        </div>
      )}

      {uploadError && (
        <div
          role="alert"
          data-testid="template-cover-upload-error"
          className="border-destructive/35 bg-destructive-soft text-destructive flex items-start gap-2 rounded-xl border p-3"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <span className="type-caption">{uploadError}</span>
        </div>
      )}

      <input
        ref={fileInputRef}
        id={fileInputId}
        data-testid="template-cover-file-input"
        type="file"
        accept="image/png,image/jpeg,image/webp,.png,.jpg,.jpeg,.webp"
        className="sr-only"
        onChange={(e) => {
          const file = e.target.files?.[0];
          void handleSelectedFile(file);
          e.currentTarget.value = "";
        }}
      />

      {trimmedUrl.length > 0 ? (
        <div
          className={cn(
            "grid items-center gap-4",
            compact ? "grid-cols-1" : "sm:grid-cols-[220px_1fr]",
          )}
        >
          <TemplateThumbnail
            testId="template-cover-live-preview"
            coverUrl={trimmedUrl}
            slug={templateSlug}
            name={templateName}
            className="border-border/80 aspect-[4/3] w-full rounded-xl border shadow-2xs"
          />

          <div className="flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">Current thumbnail</span>
              <span className="text-tertiary type-caption break-all font-mono">{trimmedUrl}</span>
            </div>

            {isUploading && (
              <div className="flex items-center gap-2">
                <Loader2 className="text-primary size-3.5 animate-spin" />
                <span className="text-muted-foreground type-caption">
                  Uploading cover... {uploadProgress}%
                </span>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={isUploading}
                data-testid="replace-template-cover-button"
                onClick={() => fileInputRef.current?.click()}
              >
                <RefreshCw className="size-3.5" />
                <span>Upload / Replace cover</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={isUploading}
                data-testid="remove-template-cover-button"
                onClick={() => {
                  setUploadError(null);
                  onCoverUrlChange("");
                }}
              >
                <Trash2 className="size-3.5" />
                <span>Remove</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={fileInputId}
          data-testid="template-cover-dropzone"
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={(e) => {
            e.preventDefault();
            setIsDragging(false);
            const dropped = e.dataTransfer.files?.[0];
            void handleSelectedFile(dropped);
          }}
          className={cn(
            "flex cursor-pointer flex-col items-center justify-center gap-2.5 rounded-2xl border-2 border-dashed px-6 py-8 text-center transition-colors",
            isDragging
              ? "border-primary bg-accent/40"
              : "border-border/80 bg-elevated/60 hover:border-border-strong hover:bg-elevated",
          )}
        >
          {isUploading ? (
            <>
              <Loader2 className="text-primary size-6 animate-spin" />
              <span className="text-foreground type-body-s-strong">
                Uploading cover thumbnail ({uploadProgress}%)...
              </span>
            </>
          ) : (
            <>
              <div className="border-border/70 bg-surface inline-flex size-11 items-center justify-center rounded-2xl border shadow-2xs">
                <ImagePlus className="text-primary size-5" />
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-foreground type-body-s-strong">
                  Drop cover image here, or click to upload
                </span>
                <span className="text-tertiary type-caption">
                  PNG, JPG, or WebP up to 10 MB · Recommended 1600×1200 (4:3)
                </span>
              </div>
            </>
          )}
        </label>
      )}

      {(showUrlField || onCoverRatioChange) && (
        <div className="grid gap-3 sm:grid-cols-[1fr_160px]">
          {showUrlField ? (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={urlInputId}>Cover image URL {required ? "*" : ""}</Label>
              <Input
                id={urlInputId}
                data-testid="template-cover-url-input"
                value={coverUrl}
                onChange={(e) => onCoverUrlChange(e.target.value)}
                placeholder="/cdn/covers/... or https://..."
              />
            </div>
          ) : (
            <div />
          )}

          {onCoverRatioChange && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor={ratioInputId}>Aspect ratio</Label>
              <select
                id={ratioInputId}
                aria-label="Cover aspect ratio"
                value={coverRatio}
                onChange={(e) => onCoverRatioChange(e.target.value)}
                className="border-input bg-elevated text-foreground focus-visible:border-ring focus-visible:ring-ring/30 h-10 w-full rounded-xl border px-3 text-sm outline-none focus-visible:ring-3"
              >
                {TEMPLATE_COVER_RATIO_OPTIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

