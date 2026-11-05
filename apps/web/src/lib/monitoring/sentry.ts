import { redactSensitiveText, sanitizeErrorForLogging } from "@/lib/security/redact";

export interface ParsedSentryDsn {
  protocol: string;
  publicKey: string;
  host: string;
  projectId: string;
  envelopeUrl: string;
}

export interface SentryCaptureContext {
  route?: string;
  method?: string;
  routeType?: string;
  tags?: Record<string, string>;
  extra?: Record<string, unknown>;
}

const PLACEHOLDER_SENTRY_HOSTS = new Set(["example.ingest.sentry.io", "localhost", "127.0.0.1"]);

export function parseSentryDsn(rawDsn: string | undefined): ParsedSentryDsn | null {
  if (!rawDsn || !rawDsn.trim()) {
    return null;
  }

  try {
    const parsed = new URL(rawDsn.trim());
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return null;
    }

    const publicKey = parsed.username.trim();
    const host = parsed.host.trim();
    const pathSegments = parsed.pathname.split("/").filter(Boolean);
    const projectId = pathSegments[pathSegments.length - 1]?.trim() ?? "";

    if (!publicKey || !host || !projectId) {
      return null;
    }

    if (PLACEHOLDER_SENTRY_HOSTS.has(parsed.hostname.toLowerCase())) {
      return null;
    }

    const basePath = pathSegments.length > 1 ? `/${pathSegments.slice(0, -1).join("/")}` : "";
    const envelopeUrl = `${parsed.protocol}//${host}${basePath}/api/${encodeURIComponent(
      projectId,
    )}/envelope/?sentry_version=7&sentry_key=${encodeURIComponent(publicKey)}`;

    return {
      protocol: parsed.protocol,
      publicKey,
      host,
      projectId,
      envelopeUrl,
    };
  } catch {
    return null;
  }
}

function sanitizeExtraRecord(
  extra: Record<string, unknown> | undefined,
): Record<string, string> | undefined {
  if (!extra) return undefined;
  const out: Record<string, string> = {};
  for (const [key, value] of Object.entries(extra)) {
    const raw =
      typeof value === "string" ? value : value === undefined ? "undefined" : JSON.stringify(value);
    out[key] = redactSensitiveText(raw).slice(0, 512);
  }
  return out;
}

export function buildSentryEventEnvelope(
  error: unknown,
  context?: SentryCaptureContext,
  options?: {
    dsn?: string;
    environment?: string;
    eventId?: string;
    timestampIso?: string;
  },
): { eventId: string; body: string } {
  const safeError = sanitizeErrorForLogging(error);
  const safeStack =
    error instanceof Error && error.stack
      ? redactSensitiveText(error.stack).slice(0, 2000)
      : undefined;
  const eventId = (options?.eventId ?? crypto.randomUUID()).replace(/-/g, "");
  const sentAt = options?.timestampIso ?? new Date().toISOString();
  const environment =
    options?.environment ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? "development";

  const envelopeHeader = JSON.stringify({
    event_id: eventId,
    sent_at: sentAt,
    ...(options?.dsn ? { dsn: options.dsn } : {}),
  });

  const eventPayload = JSON.stringify({
    event_id: eventId,
    timestamp: sentAt,
    platform: "javascript",
    level: "error",
    server_name: "casefolio-web",
    environment,
    exception: {
      values: [
        {
          type: safeError.name,
          value: safeError.message,
          ...(safeStack ? { stacktrace: { raw: safeStack } } : {}),
        },
      ],
    },
    tags: {
      service: "casefolio-web",
      ...(context?.route ? { route: redactSensitiveText(context.route) } : {}),
      ...(context?.method ? { method: context.method } : {}),
      ...(context?.routeType ? { route_type: context.routeType } : {}),
      ...(context?.tags ?? {}),
    },
    extra: sanitizeExtraRecord(context?.extra),
  });

  const itemHeader = JSON.stringify({
    type: "event",
    content_type: "application/json",
    length: new TextEncoder().encode(eventPayload).byteLength,
  });

  return {
    eventId,
    body: `${envelopeHeader}\n${itemHeader}\n${eventPayload}`,
  };
}

export async function captureServerException(
  error: unknown,
  context?: SentryCaptureContext,
  options?: {
    dsn?: string;
    fetchImpl?: typeof fetch;
  },
): Promise<{ sent: boolean; eventId: string | null }> {
  const rawDsn = options?.dsn ?? process.env.SENTRY_DSN;
  const parsed = parseSentryDsn(rawDsn);
  if (!parsed) {
    return { sent: false, eventId: null };
  }

  const envelope = buildSentryEventEnvelope(error, context, { dsn: rawDsn });
  const fetchFn = options?.fetchImpl ?? fetch;

  try {
    const response = await fetchFn(parsed.envelopeUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-sentry-envelope",
      },
      body: envelope.body,
      signal: AbortSignal.timeout(3_000),
    });

    return {
      sent: response.ok,
      eventId: envelope.eventId,
    };
  } catch {
    return {
      sent: false,
      eventId: envelope.eventId,
    };
  }
}
