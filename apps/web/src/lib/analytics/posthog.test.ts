import { beforeEach, describe, expect, it, vi } from "vitest";
import { trackClientProductEvent } from "@/components/analytics/posthog-provider";
import {
  clearCapturedAnalyticsEventsForDev,
  getCapturedAnalyticsEventsForDev,
  isLivePostHogKey,
  PRODUCT_ANALYTICS_EVENTS,
  productAnalyticsEventNameSchema,
  sanitizeAnalyticsProps,
  sanitizeDistinctId,
  trackServerProductEvent,
} from "@/lib/analytics/posthog";

describe("PostHog product analytics & PII scrubber (C-801)", () => {
  beforeEach(() => {
    clearCapturedAnalyticsEventsForDev();
  });

  it("supports all 6 canonical product analytics events", () => {
    expect(PRODUCT_ANALYTICS_EVENTS).toEqual([
      "signup",
      "project_created",
      "template_selected",
      "published",
      "exported",
      "upgrade",
    ]);

    for (const eventName of PRODUCT_ANALYTICS_EVENTS) {
      expect(productAnalyticsEventNameSchema.safeParse(eventName).success).toBe(true);
    }
    expect(productAnalyticsEventNameSchema.safeParse("arbitrary_event").success).toBe(false);
  });

  it("distinguishes live PostHog keys from dev placeholder keys", () => {
    expect(isLivePostHogKey(undefined)).toBe(false);
    expect(isLivePostHogKey("")).toBe(false);
    expect(isLivePostHogKey("phc_dev_placeholder_key")).toBe(false);
    expect(isLivePostHogKey("phc_liveProjectKey123456")).toBe(true);
  });

  it("strips PII property keys and PII-looking string values (emails, IPs, JWTs)", () => {
    const cleaned = sanitizeAnalyticsProps({
      projectId: "686b58f2-7768-4f6a-9a3f-1f3738b0a111",
      templateSlug: "orbit",
      plan: "pro",
      isFirstPublish: true,
      email: "designer@example.com",
      user_email: "designer@example.com",
      name: "Ahmed Al-Azaiza",
      fullName: "Ahmed Al-Azaiza",
      ip: "203.0.113.42",
      ipAddress: "203.0.113.42",
      password: "super-secret-password",
      token: "tok_123",
      userAgent: "Mozilla/5.0",
      $ip: "198.51.100.8",
      sneakyEmailField: "contact me at hidden@company.io please",
      sneakyIpField: "client 192.168.1.25 connected",
      sneakyJwtField: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxMjM0NTYifQ.sig",
      sneakyBearerField: "Bearer secret_api_key_abc",
      nestedObjectIgnored: { foo: "bar" },
    });

    expect(cleaned).toEqual({
      projectId: "686b58f2-7768-4f6a-9a3f-1f3738b0a111",
      templateSlug: "orbit",
      plan: "pro",
      isFirstPublish: true,
    });
  });

  it("preserves opaque UUID distinctId while scrubbing email or IP distinctIds", () => {
    const uuid = "3f6d3f12-9b19-4a12-8b79-9db5cf85f0e2";
    expect(sanitizeDistinctId(uuid)).toBe(uuid);
    expect(sanitizeDistinctId("designer@example.com")).toBe("anonymous");
    expect(sanitizeDistinctId("203.0.113.99")).toBe("anonymous");
    expect(sanitizeDistinctId("")).toBe("anonymous");
    expect(sanitizeDistinctId(null)).toBe("anonymous");
  });

  it("dispatches sanitized payload to PostHog /capture/ endpoint with $ip: null and $process_person_profile: false", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ status: 1 })));

    await trackServerProductEvent({
      event: "upgrade",
      distinctId: "3f6d3f12-9b19-4a12-8b79-9db5cf85f0e2",
      apiKey: "phc_realTestKey999",
      host: "https://us.i.posthog.com/",
      fetchFn: fetchMock as unknown as typeof fetch,
      properties: {
        plan: "pro",
        interval: "yearly",
        email: "must-not-leak@example.com",
        name: "Leak Check",
      },
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://us.i.posthog.com/capture/");
    const body = JSON.parse(String(init.body)) as {
      api_key: string;
      event: string;
      distinct_id: string;
      properties: Record<string, unknown>;
    };

    expect(body.api_key).toBe("phc_realTestKey999");
    expect(body.event).toBe("upgrade");
    expect(body.distinct_id).toBe("3f6d3f12-9b19-4a12-8b79-9db5cf85f0e2");
    expect(body.properties).toEqual({
      plan: "pro",
      interval: "yearly",
      $ip: null,
      $process_person_profile: false,
    });
    expect(body.properties).not.toHaveProperty("email");
    expect(body.properties).not.toHaveProperty("name");
  });

  it("records both server and client events into dev buffer without throwing on network errors", async () => {
    const failingFetch = vi.fn().mockRejectedValue(new Error("network unreachable"));

    await expect(
      trackServerProductEvent({
        event: "published",
        distinctId: "7a1d2c3b-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
        apiKey: "phc_realTestKey999",
        fetchFn: failingFetch as unknown as typeof fetch,
        properties: {
          projectId: "9a1d2c3b-4e5f-4a6b-8c9d-0e1f2a3b4c5d",
          visibility: "public",
        },
      }),
    ).resolves.toMatchObject({
      event: "published",
      source: "server",
    });

    trackClientProductEvent(
      "template_selected",
      {
        templateSlug: "orbit",
        templateTier: "free",
        email: "blocked@example.com",
      },
      "blocked@example.com",
    );

    const events = getCapturedAnalyticsEventsForDev();
    expect(events).toHaveLength(2);
    expect(events[0]?.event).toBe("published");
    expect(events[1]).toMatchObject({
      event: "template_selected",
      distinctId: "anonymous",
      source: "client",
      properties: {
        templateSlug: "orbit",
        templateTier: "free",
      },
    });
  });
});
