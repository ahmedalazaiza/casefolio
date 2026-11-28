const LEGACY_PLACEHOLDER_HOSTS = new Set(["cdn.casefolio.app"]);

export const SEEDED_TEMPLATE_COVER_FALLBACKS: Record<string, string> = {
  cinema: "/templates/cinema/cover.svg",
  orbit: "/templates/orbit/cover.svg",
  "meridian-pro": "/templates/meridian-pro/cover.svg",
  atlas: "/templates/atlas/cover.svg",
  northwind: "/templates/northwind/cover.svg",
  pulse: "/templates/pulse/cover.svg",
  "crypto-wallet": "/templates/crypto-wallet/cover.svg",
};

const LEGACY_LANDING_COVER_REDIRECTS: Record<string, string> = {
  "/landing/orbit-home.svg": "/templates/orbit/cover.svg",
  "/landing/orbit-plan.svg": "/templates/atlas/cover.svg",
  "/landing/meridian-dashboard.svg": "/templates/meridian-pro/cover.svg",
};

/**
 * Detects legacy unhosted sample URLs (`https://cdn.casefolio.app/...`) from reference JSON fixtures.
 */
export function isLegacyPlaceholderCoverUrl(url: string | null | undefined): boolean {
  if (!url) return false;
  const trimmed = url.trim();
  if (!trimmed) return false;

  try {
    const parsed = new URL(trimmed);
    return LEGACY_PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase());
  } catch {
    return false;
  }
}

const SAFE_COVER_RASTER_DATA_URI_REGEX =
  /^data:image\/(?:png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i;

export function isSafeTemplateCoverUrl(rawUrl: string): boolean {
  const trimmed = rawUrl.trim();
  if (!trimmed || trimmed.length > 500_000) return false;
  if (/\p{Cc}/u.test(trimmed)) return false;

  if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
    return true;
  }
  if (trimmed.startsWith("blob:")) {
    return true;
  }
  if (trimmed.toLowerCase().startsWith("data:")) {
    return SAFE_COVER_RASTER_DATA_URI_REGEX.test(trimmed);
  }
  try {
    const parsed = new URL(trimmed);
    return parsed.protocol === "https:" || parsed.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Resolves a template's `coverUrl` into a renderable image source across all UI surfaces:
 * - Uploaded admin covers (`/cdn/covers/<uuid>.<ext>`) and local public assets (`/templates/...`, `/landing/...`)
 * - Valid external `https://...` / `http://...` URLs
 * - Graceful fallback for legacy `cdn.casefolio.app` sample placeholders on seeded templates
 */
export function resolveTemplateCoverUrl(
  coverUrl: string | null | undefined,
  slug?: string | null,
): string | null {
  const cleanSlug = slug?.trim().toLowerCase() ?? "";

  if (typeof coverUrl === "string") {
    const trimmed = coverUrl.trim();
    if (trimmed.length > 0) {
      if (trimmed in LEGACY_LANDING_COVER_REDIRECTS) {
        if (cleanSlug && cleanSlug in SEEDED_TEMPLATE_COVER_FALLBACKS) {
          return SEEDED_TEMPLATE_COVER_FALLBACKS[cleanSlug]!;
        }
        return LEGACY_LANDING_COVER_REDIRECTS[trimmed]!;
      }

      if (trimmed.startsWith("/") && !trimmed.startsWith("//") && !trimmed.startsWith("/\\")) {
        return trimmed;
      }

      if (isLegacyPlaceholderCoverUrl(trimmed)) {
        return SEEDED_TEMPLATE_COVER_FALLBACKS[cleanSlug] ?? null;
      }

      if (
        trimmed.startsWith("https://") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("blob:") ||
        SAFE_COVER_RASTER_DATA_URI_REGEX.test(trimmed)
      ) {
        return trimmed;
      }
    }
  }

  if (cleanSlug && cleanSlug in SEEDED_TEMPLATE_COVER_FALLBACKS) {
    return SEEDED_TEMPLATE_COVER_FALLBACKS[cleanSlug] ?? null;
  }

  return null;
}

function isUserUploadedProjectAssetUrl(rawSrc: string): boolean {
  const src = rawSrc.trim();
  if (!src) return false;
  if (src.startsWith("/cdn/images/") || src.startsWith("/api/assets/")) {
    return true;
  }
  if (src.startsWith("https://") || src.startsWith("http://")) {
    try {
      const parsed = new URL(src);
      if (LEGACY_PLACEHOLDER_HOSTS.has(parsed.hostname.toLowerCase())) {
        return false;
      }
      return (
        parsed.pathname.startsWith("/cdn/images/") || parsed.pathname.startsWith("/api/assets/")
      );
    } catch {
      return false;
    }
  }
  return false;
}

/**
 * Resolves the best card thumbnail for a user project:
 * uses the project's uploaded Hero mockup image ONLY when it is an actual user-uploaded
 * project asset (`/cdn/images/...` or `/api/assets/...`); otherwise ALWAYS returns the
 * resolved template cover thumbnail so default template hero placeholders never override it.
 */
export function resolveProjectOrTemplateThumbnailUrl(
  puckData: unknown,
  templateCoverUrl: string | null | undefined,
  templateSlug?: string | null,
): string | null {
  if (puckData && typeof puckData === "object" && "content" in puckData) {
    const content = (puckData as { content?: unknown }).content;
    if (Array.isArray(content)) {
      for (const block of content) {
        if (!block || typeof block !== "object") continue;
        const props = (block as { props?: Record<string, unknown> }).props;
        if (!props) continue;
        const mockup = props.mockup as { src?: unknown } | undefined;
        if (typeof mockup?.src === "string") {
          const src = mockup.src.trim();
          if (isUserUploadedProjectAssetUrl(src)) {
            return src;
          }
        }
      }
    }
  }

  return resolveTemplateCoverUrl(templateCoverUrl, templateSlug);
}

/**
 * Same decision as {@link resolveProjectOrTemplateThumbnailUrl}, but for callers that already
 * extracted the first `mockup.src` in SQL (so the full `puck_data` document never leaves Postgres).
 */
export function resolveThumbnailFromMockupSrc(
  mockupSrc: string | null | undefined,
  templateCoverUrl: string | null | undefined,
  templateSlug?: string | null,
): string | null {
  const src = typeof mockupSrc === "string" ? mockupSrc.trim() : "";
  if (src && isUserUploadedProjectAssetUrl(src)) {
    return src;
  }
  return resolveTemplateCoverUrl(templateCoverUrl, templateSlug);
}
