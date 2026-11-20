"use client";

import { ImagePlus, Link2, Loader2, Trash2, Upload } from "lucide-react";
import { useId, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { uploadCmsMediaClient } from "@/lib/cms/media-upload";
import { cn } from "@/lib/utils";

export function CmsAssetUploader({
  label,
  hint,
  value,
  onChange,
  testId,
  compact = false,
}: {
  label: string;
  hint?: string;
  value: string;
  onChange: (nextUrl: string) => void;
  testId?: string;
  compact?: boolean;
}) {
  const inputId = useId();
  const fileRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [showUrl, setShowUrl] = useState(false);

  async function handleFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    setUploading(true);
    setProgress(5);
    try {
      const res = await uploadCmsMediaClient({
        file,
        onProgress: (pct) => setProgress(pct),
      });
      onChange(res.assetUrl);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div
      data-testid={testId}
      className="flex flex-col gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold text-[var(--cf-text-primary)]">{label}</p>
          {hint && <p className="text-[0.6875rem] text-[var(--cf-text-tertiary)]">{hint}</p>}
        </div>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={() => setShowUrl((prev) => !prev)}
        >
          <Link2 className="size-3.5" />
          <span>{showUrl ? "Hide URL" : "Paste URL"}</span>
        </Button>
      </div>

      <input
        ref={fileRef}
        id={inputId}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/svg+xml,.png,.jpg,.jpeg,.webp,.svg"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          void handleFile(f);
          e.currentTarget.value = "";
        }}
      />

      {error && (
        <p role="alert" className="text-destructive text-xs font-medium">
          {error}
        </p>
      )}

      {value ? (
        <div className="flex flex-wrap items-center gap-3">
          <div
            className={cn(
              "flex shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-1",
              compact ? "size-12" : "h-16 w-24",
            )}
          >
            <img src={value} alt={label} className="size-full object-contain" />
          </div>
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <span className="truncate font-mono text-[0.6875rem] text-[var(--cf-text-secondary)]">
              {value}
            </span>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                type="button"
                variant="secondary"
                size="sm"
                disabled={uploading}
                onClick={() => fileRef.current?.click()}
              >
                {uploading ? (
                  <Loader2 className="size-3.5 animate-spin" />
                ) : (
                  <Upload className="size-3.5" />
                )}
                <span>{uploading ? `${progress}%` : "Replace"}</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploading}
                onClick={() => onChange("")}
              >
                <Trash2 className="size-3.5" />
                <span>Remove</span>
              </Button>
            </div>
          </div>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className="hover:border-primary/60 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3 py-3 text-xs font-medium text-[var(--cf-text-secondary)] transition-colors"
        >
          {uploading ? (
            <>
              <Loader2 className="text-primary size-4 animate-spin" />
              <span>Uploading {progress}%...</span>
            </>
          ) : (
            <>
              <ImagePlus className="size-4 text-[var(--cf-royal-text)]" />
              <span>Upload PNG, JPG, WebP, or SVG icon</span>
            </>
          )}
        </label>
      )}

      {showUrl && (
        <Input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="/cdn/cms/... or https://..."
          className="font-mono text-xs"
        />
      )}
    </div>
  );
}
