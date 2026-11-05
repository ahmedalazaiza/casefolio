"use client";

import posthog from "posthog-js";
import { useEffect, type ReactNode } from "react";
import {
  appendDevAnalyticsEvent,
  isLivePostHogKey,
  sanitizeAnalyticsProps,
  sanitizeDistinctId,
  type CapturedProductAnalyticsEvent,
  type ProductAnalyticsEventName,
} from "@/lib/analytics/posthog";

let clientInitialized = false;

export function ensurePostHogClientInitialized(): boolean {
  if (typeof window === "undefined") {
    return false;
  }
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST ?? "https://us.i.posthog.com";

  if (!isLivePostHogKey(key)) {
    return false;
  }

  if (!clientInitialized) {
    posthog.init(key, {
      api_host: host,
      person_profiles: "identified_only",
      autocapture: false,
      capture_pageview: false,
      capture_pageleave: false,
      disable_session_recording: true,
      ip: false,
      persistence: "memory",
    });
    clientInitialized = true;
  }

  return true;
}

export function trackClientProductEvent(
  event: ProductAnalyticsEventName,
  properties?: Record<string, unknown> | null,
  distinctId?: string | null,
): CapturedProductAnalyticsEvent {
  const safeDistinctId = sanitizeDistinctId(distinctId);
  const safeProps = sanitizeAnalyticsProps(properties);
  const captured: CapturedProductAnalyticsEvent = {
    event,
    distinctId: safeDistinctId,
    properties: safeProps,
    source: "client",
    timestamp: new Date().toISOString(),
  };

  appendDevAnalyticsEvent(captured);

  if (ensurePostHogClientInitialized()) {
    try {
      posthog.capture(event, {
        ...safeProps,
        $ip: null,
      });
    } catch {
      // Ignore client telemetry dispatch errors
    }
  }

  if (
    typeof window !== "undefined" &&
    process.env.NODE_ENV !== "production" &&
    !process.env.VITEST
  ) {
    try {
      void fetch("/api/dev/analytics-events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          event,
          distinctId: safeDistinctId,
          properties: safeProps,
        }),
        keepalive: true,
      }).catch(() => undefined);
    } catch {
      // Ignore dev mirror errors
    }
  }

  return captured;
}

export function PostHogProvider({ children }: { children: ReactNode }) {
  useEffect(() => {
    ensurePostHogClientInitialized();
  }, []);

  return <>{children}</>;
}
