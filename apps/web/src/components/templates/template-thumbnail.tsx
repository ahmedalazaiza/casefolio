"use client";

import { useEffect, useState } from "react";
import { resolveTemplateCoverUrl } from "@/lib/template/cover-url";
import { cn } from "@/lib/utils";

export interface TemplateThumbnailProps {
  coverUrl?: string | null;
  slug?: string | null;
  name: string;
  alt?: string;
  loading?: "lazy" | "eager";
  theme?: {
    bg?: string;
    fg?: string;
    accent?: string;
  } | null;
  className?: string;
  imageClassName?: string;
  hideFallbackLabel?: boolean;
  testId?: string;
}

export function TemplateThumbnail({
  coverUrl,
  slug,
  name,
  alt,
  loading = "lazy",
  theme,
  className,
  imageClassName,
  hideFallbackLabel = false,
  testId,
}: TemplateThumbnailProps) {
  const resolvedUrl = resolveTemplateCoverUrl(coverUrl, slug);
  const [failedUrl, setFailedUrl] = useState<string | null>(null);

  useEffect(() => {
    setFailedUrl(null);
  }, [resolvedUrl]);

  const showImage = Boolean(resolvedUrl) && failedUrl !== resolvedUrl;

  if (showImage && resolvedUrl) {
    return (
      <div
        data-testid={testId}
        data-has-cover="true"
        className={cn("bg-sunken relative overflow-hidden", className)}
        style={theme?.bg ? { backgroundColor: theme.bg } : undefined}
      >
        <img
          src={resolvedUrl}
          alt={alt ?? `${name} cover thumbnail`}
          loading={loading}
          decoding="async"
          onError={() => setFailedUrl(resolvedUrl)}
          className={cn(
            "size-full object-cover object-center transition-transform duration-500",
            imageClassName,
          )}
        />
      </div>
    );
  }

  return (
    <div
      data-testid={testId}
      data-has-cover="false"
      className={cn(
        "bg-sunken relative flex flex-col justify-between overflow-hidden p-5",
        className,
      )}
      style={
        theme?.bg || theme?.fg || theme?.accent
          ? {
              backgroundColor: theme.bg ?? undefined,
              color: theme.fg ?? undefined,
              backgroundImage: theme.accent
                ? `radial-gradient(circle at 22% 20%, color-mix(in oklab, ${theme.accent} 42%, transparent) 0%, transparent 62%), linear-gradient(135deg, color-mix(in oklab, ${theme.accent} 22%, ${theme.bg ?? "var(--sunken)"}) 0%, ${theme.bg ?? "var(--sunken)"} 100%)`
                : undefined,
            }
          : undefined
      }
    >
      <span
        aria-hidden
        className="pointer-events-none absolute -top-2 right-3 font-serif text-5xl opacity-15 select-none"
      >
        Aa
      </span>
      <div className="relative z-10 mt-auto flex flex-col gap-1.5">
        <span
          className="bg-primary/60 h-1.5 w-10 rounded-full opacity-90"
          style={theme?.accent ? { backgroundColor: theme.accent } : undefined}
        />
        {!hideFallbackLabel && (
          <span className="type-heading-s line-clamp-1 tracking-tight">{name}</span>
        )}
      </div>
    </div>
  );
}
