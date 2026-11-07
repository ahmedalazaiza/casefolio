"use client";

import Image from "next/image";
import { useMemo } from "react";
import {
  createCasefolioImageLoader,
  isRealCloudflareImagesConfigured,
  resolveSlotSizesAttribute,
} from "@/lib/storage/cloudflare-images";
import {
  computeCssCropFramingStyle,
  isUrlServerPreCropped,
  parseNaturalDimensionsFromSrc,
} from "@/lib/storage/image-dimensions";
import type { CropRect } from "@/lib/template/schema";
import { cn } from "@/lib/utils";

export interface CdnResponsiveImageProps {
  src: string;
  alt: string;
  assetId?: string | null;
  crop?: CropRect | null;
  deviceChrome: "mobile" | "web" | "plain";
  fallbackAspectWidth: number;
  fallbackAspectHeight: number;
  className?: string;
}

export function CdnResponsiveImage({
  src,
  alt,
  assetId,
  crop,
  deviceChrome,
  fallbackAspectWidth,
  fallbackAspectHeight,
  className,
}: CdnResponsiveImageProps) {
  const naturalDims = useMemo(() => parseNaturalDimensionsFromSrc(src), [src]);
  const sizes = useMemo(() => resolveSlotSizesAttribute(deviceChrome), [deviceChrome]);

  const loader = useMemo(
    () =>
      createCasefolioImageLoader({
        assetId,
        crop,
        naturalDimensions: naturalDims,
      }),
    [assetId, crop, naturalDims],
  );

  // When Cloudflare Images server-trims (`trim=...`), the returned image is already cropped.
  // In local dev (`/cdn/images/...`), we pair CDN responsive srcset with sub-pixel CSS crop framing.
  const serverCropped = isRealCloudflareImagesConfigured() || isUrlServerPreCropped(src);
  const cropFramingStyle =
    !serverCropped && crop && naturalDims
      ? computeCssCropFramingStyle(naturalDims.width, naturalDims.height, crop)
      : null;

  const intrinsicWidth =
    naturalDims?.width ?? Math.max(360, Math.round(fallbackAspectWidth * 100));
  const intrinsicHeight =
    naturalDims?.height ?? Math.max(360, Math.round(fallbackAspectHeight * 100));

  if (
    src.startsWith("data:") ||
    src.startsWith("blob:") ||
    src.endsWith(".svg") ||
    src.includes(".svg?")
  ) {
    return (
      <img
        src={src}
        alt={alt}
        style={cropFramingStyle ?? undefined}
        className={cn(!cropFramingStyle && "size-full object-cover", className)}
      />
    );
  }

  return (
    <Image
      loader={loader}
      src={src}
      alt={alt}
      width={intrinsicWidth}
      height={intrinsicHeight}
      quality={85}
      sizes={sizes}
      style={cropFramingStyle ?? undefined}
      className={cn(!cropFramingStyle && "size-full object-cover", className)}
    />
  );
}

