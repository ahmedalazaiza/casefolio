/**
 * Same-origin redirect sanitiser shared by every place that consumes a `callbackUrl` / `redirect`
 * style parameter (client forms, server components, route handlers).
 *
 * The raw value is parsed with `new URL(raw, origin)` and only accepted when:
 *  - it is an absolute *path* (starts with a single `/`), never protocol-relative (`//host`),
 *  - it contains no backslashes, control characters or whitespace (browsers normalise `\` to `/`
 *    and strip tabs/newlines, which turns `/\evil.com` and `/\t/evil.com` into `//evil.com`),
 *  - the parsed result is still on the same origin and its (once-decoded) form is still a clean path.
 * Anything else falls back to `fallback`.
 */

const PARSE_ORIGIN = "https://casefolio.invalid";
const MAX_REDIRECT_LENGTH = 2048;

function hasForbiddenChar(value: string, allowSpace: boolean): boolean {
  for (let i = 0; i < value.length; i += 1) {
    const code = value.charCodeAt(i);
    const isSpace = code === 0x20;
    if (code < 0x20 || (code >= 0x7f && code <= 0x9f) || code === 0x2028 || code === 0x2029) {
      return true;
    }
    if (isSpace && !allowSpace) return true;
  }
  return false;
}

function isCleanPath(value: string, allowSpace = false): boolean {
  if (!value.startsWith("/") || value.startsWith("//")) return false;
  if (value.includes("\\")) return false;
  if (hasForbiddenChar(value, allowSpace)) return false;
  return true;
}

export function sanitizeRedirectPath(
  raw: string | null | undefined,
  fallback = "/dashboard",
  origin: string = PARSE_ORIGIN,
): string {
  if (typeof raw !== "string" || raw.length === 0 || raw.length > MAX_REDIRECT_LENGTH) {
    return fallback;
  }
  if (!isCleanPath(raw)) return fallback;

  let parsed: URL;
  let base: URL;
  try {
    base = new URL(origin);
    parsed = new URL(raw, base);
  } catch {
    return fallback;
  }
  if (parsed.origin !== base.origin) return fallback;

  const normalized = `${parsed.pathname}${parsed.search}${parsed.hash}`;
  if (!isCleanPath(normalized)) return fallback;

  // Defend against consumers that decode the value again: a decoded `//host` or `\` must not appear.
  let decoded: string;
  try {
    decoded = decodeURIComponent(normalized);
  } catch {
    return fallback;
  }
  if (!isCleanPath(decoded, true)) return fallback;

  return normalized;
}

/** Alias kept for readability at call sites that deal with `callbackUrl`. */
export const sanitizeCallbackUrl = sanitizeRedirectPath;
