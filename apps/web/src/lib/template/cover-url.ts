const LEGACY_PLACEHOLDER_HOSTS = new Set(["cdn.casefolio.app"]);

const LEGACY_SLUG_COVER_FALLBACKS: Record<string, string> = {
  cinema: "/templates/cinema/cover.svg",
  orbit: "/landing/orbit-home.svg",
  "meridian-pro": "/landing/meridian-dashboard.svg",
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
      if (trimmed.startsWith("/") && !trimmed.startsWith("//")) {
        return trimmed;
      }

      if (isLegacyPlaceholderCoverUrl(trimmed)) {
        return LEGACY_SLUG_COVER_FALLBACKS[cleanSlug] ?? null;
      }

      if (
        trimmed.startsWith("https://") ||
        trimmed.startsWith("http://") ||
        trimmed.startsWith("blob:") ||
        trimmed.startsWith("data:image/")
      ) {
        return trimmed;
      }
    }
  }

  if (cleanSlug && cleanSlug in LEGACY_SLUG_COVER_FALLBACKS) {
    return LEGACY_SLUG_COVER_FALLBACKS[cleanSlug] ?? null;
  }

  return null;
}

/**
 * Resolves the best card thumbnail for a user project:
 * uses the project's uploaded Hero mockup image when present, otherwise falls back
 * to the project's template cover thumbnail.
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
          if (
            (src.startsWith("/") && !src.startsWith("//")) ||
            src.startsWith("https://") ||
            src.startsWith("http://")
          ) {
            return src;
          }
        }
      }
    }
  }

  return resolveTemplateCoverUrl(templateCoverUrl, templateSlug);
}
