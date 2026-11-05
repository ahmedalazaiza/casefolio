import { z } from "zod";

export const PRODUCT_ANALYTICS_EVENTS = [
  "signup",
  "project_created",
  "template_selected",
  "published",
  "exported",
  "upgrade",
] as const;

export type ProductAnalyticsEventName = (typeof PRODUCT_ANALYTICS_EVENTS)[number];

export const productAnalyticsEventNameSchema = z.enum(PRODUCT_ANALYTICS_EVENTS);

export type SafeAnalyticsPrimitive = string | number | boolean | null;
export type SafeAnalyticsProps = Record<string, SafeAnalyticsPrimitive>;

export interface CapturedProductAnalyticsEvent {
  event: ProductAnalyticsEventName;
  distinctId: string;
  properties: SafeAnalyticsProps;
  source: "server" | "client";
  timestamp: string;
}

const FORBIDDEN_PII_KEY_REGEX =
  /^(?:\$)?(?:e[-_]?mail|user[-_]?email|recipient[-_]?email|inviter[-_]?email|name|full[-_]?name|first[-_]?name|last[-_]?name|display[-_]?name|user[-_]?name|inviter[-_]?name|author[-_]?name|client[-_]?name|phone|phone[-_]?number|mobile|ip|ip[-_]?address|client[-_]?ip|remote[-_]?addr|password|passphrase|secret|token|access[-_]?token|refresh[-_]?token|session[-_]?token|otp|api[-_]?key|authorization|cookie|user[-_]?agent|address|street|postal[-_]?code|zip[-_]?code|ssn)$/i;

const EMAIL_VALUE_REGEX = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
const IPV4_VALUE_REGEX = /\b(?:\d{1,3}\.){3}\d{1,3}\b/;
const BEARER_OR_JWT_REGEX = /^(?:Bearer\s+\S+|eyJ[a-zA-Z0-9_-]+\.[a-zA-Z0-9_-]+\.)/i;

const MAX_DEV_BUFFER_EVENTS = 250;
const MAX_PROP_STRING_LENGTH = 120;

const globalAnalyticsStore = globalThis as unknown as {
  __casefolioPostHogEvents?: CapturedProductAnalyticsEvent[];
};

function getDevEventBuffer(): CapturedProductAnalyticsEvent[] {
  if (!globalAnalyticsStore.__casefolioPostHogEvents) {
    globalAnalyticsStore.__casefolioPostHogEvents = [];
  }
  return globalAnalyticsStore.__casefolioPostHogEvents;
}

export function isLivePostHogKey(key: string | undefined | null): key is string {
  if (!key) return false;
  const trimmed = key.trim();
  return trimmed.startsWith("phc_") && !trimmed.startsWith("phc_dev_");
}

export function containsPiiString(value: string): boolean {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (EMAIL_VALUE_REGEX.test(trimmed)) return true;
  if (IPV4_VALUE_REGEX.test(trimmed)) return true;
  if (BEARER_OR_JWT_REGEX.test(trimmed)) return true;
  return false;
}

export function sanitizeDistinctId(distinctId: string | null | undefined): string {
  if (!distinctId) return "anonymous";
  const trimmed = distinctId.trim();
  if (!trimmed || trimmed.length > 100 || containsPiiString(trimmed)) {
    return "anonymous";
  }
  return trimmed;
}

export function sanitizeAnalyticsProps(
  rawProps?: Record<string, unknown> | null,
): SafeAnalyticsProps {
  if (!rawProps || typeof rawProps !== "object") {
    return {};
  }

  const sanitized: SafeAnalyticsProps = {};

  for (const [rawKey, rawValue] of Object.entries(rawProps)) {
    const key = rawKey.trim();
    if (!key || key.length > 64) continue;
    if (FORBIDDEN_PII_KEY_REGEX.test(key)) continue;

    if (rawValue === null) {
      sanitized[key] = null;
      continue;
    }

    if (typeof rawValue === "boolean") {
      sanitized[key] = rawValue;
      continue;
    }

    if (typeof rawValue === "number") {
      if (Number.isFinite(rawValue)) {
        sanitized[key] = rawValue;
      }
      continue;
    }

    if (typeof rawValue === "string") {
      if (containsPiiString(rawValue)) {
        continue;
      }
      sanitized[key] =
        rawValue.length > MAX_PROP_STRING_LENGTH
          ? rawValue.slice(0, MAX_PROP_STRING_LENGTH)
          : rawValue;
    }
  }

  return sanitized;
}

export function appendDevAnalyticsEvent(entry: CapturedProductAnalyticsEvent): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  const buffer = getDevEventBuffer();
  buffer.push(entry);
  if (buffer.length > MAX_DEV_BUFFER_EVENTS) {
    buffer.splice(0, buffer.length - MAX_DEV_BUFFER_EVENTS);
  }
}

export function getCapturedAnalyticsEventsForDev(): CapturedProductAnalyticsEvent[] {
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  return [...getDevEventBuffer()];
}

export function clearCapturedAnalyticsEventsForDev(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  globalAnalyticsStore.__casefolioPostHogEvents = [];
}

export interface TrackServerProductEventInput {
  event: ProductAnalyticsEventName;
  distinctId?: string | null;
  properties?: Record<string, unknown> | null;
  apiKey?: string;
  host?: string;
  fetchFn?: typeof fetch;
  forceNetworkCapture?: boolean;
}

export async function trackServerProductEvent(
  input: TrackServerProductEventInput,
): Promise<CapturedProductAnalyticsEvent> {
  const safeDistinctId = sanitizeDistinctId(input.distinctId);
  const safeProps = sanitizeAnalyticsProps(input.properties);
  const timestamp = new Date().toISOString();

  const captured: CapturedProductAnalyticsEvent = {
    event: input.event,
    distinctId: safeDistinctId,
    properties: safeProps,
    source: "server",
    timestamp,
  };

  appendDevAnalyticsEvent(captured);

  const resolvedKey = input.apiKey ?? process.env.NEXT_PUBLIC_POSTHOG_KEY ?? "";
  const resolvedHost = (
    input.host ??
    process.env.NEXT_PUBLIC_POSTHOG_HOST ??
    "https://us.i.posthog.com"
  ).replace(/\/+$/, "");

  if (input.forceNetworkCapture || isLivePostHogKey(resolvedKey)) {
    const fetchImpl = input.fetchFn ?? fetch;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 2_500);
      await fetchImpl(`${resolvedHost}/capture/`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          api_key: resolvedKey,
          event: input.event,
          distinct_id: safeDistinctId,
          timestamp,
          properties: {
            ...safeProps,
            $ip: null,
            $process_person_profile: false,
          },
        }),
        signal: controller.signal,
      }).finally(() => clearTimeout(timeout));
    } catch {
      // Telemetry failures must never fail user-facing mutations
    }
  }

  return captured;
}
