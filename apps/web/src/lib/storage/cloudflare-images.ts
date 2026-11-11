import type { ImageLoaderProps } from "next/image";
import { parseNaturalDimensionsFromSrc } from "@/lib/storage/image-dimensions";
import type { CropRect } from "@/lib/template/schema";

export interface CloudflareImagesConfig {
  accountHash: string;
  deliveryOrigin: string;
  zoneOrigin?: string;
}

const PLACEHOLDER_CF_TOKENS = [
  "your-",
  "replace-",
  "test_",
  "test-",
  "dev_",
  "dev-",
  "local_",
  "local-",
  "mock_",
  "mock-",
  "placeholder",
  "example",
  "cf-hash",
];

function isPlaceholderToken(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return PLACEHOLDER_CF_TOKENS.some(
    (token) => normalized.startsWith(token) || normalized.includes(token),
  );
}

export function readCloudflareImagesConfig(
  envSource?: Record<string, string | undefined>,
): CloudflareImagesConfig {
  // When called with default runtime env (including inside `"use client"` components),
  // ONLY read `NEXT_PUBLIC_*` keys so SSR and CSR hydrate identically and never leak
  // server-only `CF_IMAGES_ACCOUNT_HASH` when Cloudflare Images client delivery isn't enabled.
  const accountHash = envSource
    ? (envSource.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH ?? envSource.CF_IMAGES_ACCOUNT_HASH ?? "")
    : (process.env.NEXT_PUBLIC_CF_IMAGES_ACCOUNT_HASH ?? "");
  const rawDeliveryOrigin = envSource
    ? envSource.NEXT_PUBLIC_CF_IMAGES_DELIVERY_ORIGIN
    : process.env.NEXT_PUBLIC_CF_IMAGES_DELIVERY_ORIGIN;
  const rawZoneOrigin = envSource
    ? envSource.NEXT_PUBLIC_CF_ZONE_ORIGIN
    : process.env.NEXT_PUBLIC_CF_ZONE_ORIGIN;

  return {
    accountHash,
    deliveryOrigin: (rawDeliveryOrigin || "https://imagedelivery.net").replace(/\/+$/, ""),
    zoneOrigin: rawZoneOrigin ? rawZoneOrigin.replace(/\/+$/, "") : undefined,
  };
}

export function isRealCloudflareImagesConfigured(
  config: CloudflareImagesConfig = readCloudflareImagesConfig(),
): boolean {
  if (typeof process !== "undefined" && process.env.CASEFOLIO_FORCE_LOCAL_STORAGE === "1") {
    return false;
  }
  const cleanHash = config.accountHash.trim();
  if (isPlaceholderToken(cleanHash)) {
    return false;
  }
  return /^[a-z0-9_-]{12,64}$/i.test(cleanHash);
}

export const RESPONSIVE_CDN_WIDTHS = [360, 640, 768, 1080, 1440, 1920] as const;

export function buildAssetCdnBaseUrl(
  assetId: string,
  width?: number,
  height?: number,
): string {
  if (width && width > 0 && height && height > 0) {
    return `/cdn/images/${assetId}?nw=${width}&nh=${height}`;
  }
  return `/cdn/images/${assetId}`;
}

export function extractCasefolioAssetIdFromUrl(src: string): string | null {
  if (!src) return null;
  const match = src.match(
    /\/(?:cdn\/images|api\/assets)\/([0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12})/i,
  );
  return match?.[1] ?? null;
}

export interface BuildCloudflareVariantUrlParams {
  src: string;
  assetId?: string | null;
  width: number;
  quality?: number;
  crop?: CropRect | null;
  naturalDimensions?: { width: number; height: number } | null;
  config?: CloudflareImagesConfig;
}

function clampWidth(width: number): number {
  if (!Number.isFinite(width) || width <= 0) return 1080;
  return Math.min(3840, Math.max(64, Math.round(width)));
}

function clampQuality(quality?: number): number {
  if (!quality || !Number.isFinite(quality)) return 85;
  return Math.min(100, Math.max(40, Math.round(quality)));
}

function computeCloudflareTrimDirective(
  crop: CropRect | null | undefined,
  naturalDimensions: { width: number; height: number } | null | undefined,
): string | null {
  if (!crop || !naturalDimensions) return null;
  const { width: nw, height: nh } = naturalDimensions;
  if (nw <= 0 || nh <= 0 || crop.width <= 0 || crop.height <= 0) return null;

  const top = Math.max(0, Math.round(crop.y));
  const left = Math.max(0, Math.round(crop.x));
  const right = Math.max(0, Math.round(nw - (crop.x + crop.width)));
  const bottom = Math.max(0, Math.round(nh - (crop.y + crop.height)));

  if (top === 0 && right === 0 && bottom === 0 && left === 0) {
    return null;
  }
  return `trim=${top};${right};${bottom};${left}`;
}

/**
 * Builds a responsive CDN image URL:
 * - Production Cloudflare Images (`imagedelivery.net/<accountHash>/<imageId>/w=...,q=...,f=auto,trim=...`)
 *   or Cloudflare zone `/cdn-cgi/image/...` for external URLs.
 * - Local/dev CDN route (`/cdn/images/<assetId>?w=...&q=...&f=auto&cx=...`) preserving private-until-published authz.
 */
export function buildCloudflareImageVariantUrl({
  src,
  assetId,
  width,
  quality,
  crop,
  naturalDimensions,
  config = readCloudflareImagesConfig(),
}: BuildCloudflareVariantUrlParams): string {
  if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
    return src;
  }

  const w = clampWidth(width);
  const q = clampQuality(quality);
  const resolvedAssetId = assetId || extractCasefolioAssetIdFromUrl(src);
  const resolvedDims = naturalDimensions ?? parseNaturalDimensionsFromSrc(src);

  if (isRealCloudflareImagesConfigured(config)) {
    const directives = [`w=${w}`, `q=${q}`, "f=auto", "fit=scale-down"];
    const trimDirective = computeCloudflareTrimDirective(crop, resolvedDims);
    if (trimDirective) {
      directives.push(trimDirective);
    }

    if (resolvedAssetId) {
      return `${config.deliveryOrigin}/${config.accountHash.trim()}/${resolvedAssetId}/${directives.join(",")}`;
    }

    if (config.zoneOrigin && /^https?:\/\//i.test(src)) {
      return `${config.zoneOrigin}/cdn-cgi/image/${directives.join(",")}/${src}`;
    }
  }

  if (resolvedAssetId) {
    const query = new URLSearchParams();
    query.set("w", String(w));
    query.set("q", String(q));
    query.set("f", "auto");
    if (resolvedDims) {
      query.set("nw", String(resolvedDims.width));
      query.set("nh", String(resolvedDims.height));
    }
    if (crop) {
      query.set("cx", String(Math.max(0, Math.round(crop.x))));
      query.set("cy", String(Math.max(0, Math.round(crop.y))));
      query.set("cw", String(Math.max(1, Math.round(crop.width))));
      query.set("ch", String(Math.max(1, Math.round(crop.height))));
    }
    return `/cdn/images/${resolvedAssetId}?${query.toString()}`;
  }

  try {
    const externalUrl = new URL(src);
    externalUrl.searchParams.set("w", String(w));
    externalUrl.searchParams.set("q", String(q));
    return externalUrl.toString();
  } catch {
    return src;
  }
}

export interface CasefolioLoaderContext {
  assetId?: string | null;
  crop?: CropRect | null;
  naturalDimensions?: { width: number; height: number } | null;
  config?: CloudflareImagesConfig;
}

/**
 * Creates a `next/image`-compatible `ImageLoader` bound to a slot's `crop` and `assetId`.
 */
export function createCasefolioImageLoader(context: CasefolioLoaderContext = {}) {
  return function casefolioSlotLoader({ src, width, quality }: ImageLoaderProps): string {
    return buildCloudflareImageVariantUrl({
      src,
      assetId: context.assetId,
      width,
      quality,
      crop: context.crop,
      naturalDimensions: context.naturalDimensions,
      config: context.config,
    });
  };
}

export function casefolioImageLoader(props: ImageLoaderProps): string {
  return buildCloudflareImageVariantUrl({
    src: props.src,
    width: props.width,
    quality: props.quality,
  });
}

export function buildResponsiveImageSrcSet(params: {
  src: string;
  assetId?: string | null;
  quality?: number;
  crop?: CropRect | null;
  naturalDimensions?: { width: number; height: number } | null;
  widths?: readonly number[];
  config?: CloudflareImagesConfig;
}): string {
  const widths = params.widths ?? RESPONSIVE_CDN_WIDTHS;
  return widths
    .map((w) => {
      const variantUrl = buildCloudflareImageVariantUrl({
        src: params.src,
        assetId: params.assetId,
        width: w,
        quality: params.quality,
        crop: params.crop,
        naturalDimensions: params.naturalDimensions,
        config: params.config,
      });
      return `${variantUrl} ${w}w`;
    })
    .join(", ");
}

export function resolveSlotSizesAttribute(deviceChrome: "mobile" | "web" | "plain"): string {
  if (deviceChrome === "mobile") {
    return "(max-width: 640px) 85vw, 320px";
  }
  return "(max-width: 768px) 95vw, (max-width: 1280px) 80vw, 1120px";
}

