import { NextResponse } from "next/server";
import { z } from "zod";
import {
  appendDevAnalyticsEvent,
  clearCapturedAnalyticsEventsForDev,
  getCapturedAnalyticsEventsForDev,
  productAnalyticsEventNameSchema,
  sanitizeAnalyticsProps,
  sanitizeDistinctId,
} from "@/lib/analytics/posthog";
import {
  clearNotificationEmailAuditsForDev,
  getNotificationEmailAuditsForDev,
} from "@/lib/notifications/service";

const mirrorClientEventSchema = z.object({
  event: productAnalyticsEventNameSchema,
  distinctId: z.string().max(120).optional(),
  properties: z.record(z.unknown()).optional(),
});

export async function GET() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    events: getCapturedAnalyticsEventsForDev(),
    emailAudits: getNotificationEmailAuditsForDev(),
  });
}

export async function POST(request: Request) {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = mirrorClientEventSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload" }, { status: 400 });
  }

  const entry = {
    event: parsed.data.event,
    distinctId: sanitizeDistinctId(parsed.data.distinctId),
    properties: sanitizeAnalyticsProps(parsed.data.properties),
    source: "client" as const,
    timestamp: new Date().toISOString(),
  };

  appendDevAnalyticsEvent(entry);

  return NextResponse.json({ ok: true, event: entry });
}

export async function DELETE() {
  if (process.env.NODE_ENV === "production") {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  clearCapturedAnalyticsEventsForDev();
  clearNotificationEmailAuditsForDev();
  return NextResponse.json({ ok: true });
}
