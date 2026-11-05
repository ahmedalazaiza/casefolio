// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ProjectAnalyticsPanel } from "@/components/analytics/project-analytics-panel";
import {
  computePrivacySafeVisitorHash,
  isBotUserAgent,
  isPrefetchRequest,
  normalizeReferrerSource,
  type ProjectAnalyticsPayload,
} from "@/lib/analytics/page-views-utils";

const pushMock = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({
    push: pushMock,
    refresh: vi.fn(),
  }),
}));

describe("Case-study view analytics & bot filtering (C-802)", () => {
  afterEach(() => {
    cleanup();
    pushMock.mockReset();
  });

  it("filters crawlers, link-preview bots, and CLI scrapers while allowing real browsers", () => {
    expect(isBotUserAgent("")).toBe(true);
    expect(isBotUserAgent(null)).toBe(true);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toBe(true);
    expect(isBotUserAgent("Twitterbot/1.0")).toBe(true);
    expect(isBotUserAgent("Slackbot-LinkExpanding 1.0 (+https://api.slack.com/robots)")).toBe(
      true,
    );
    expect(isBotUserAgent("Mozilla/5.0 (compatible; AhrefsBot/7.0; +http://ahrefs.com/robot/)")).toBe(
      true,
    );
    expect(isBotUserAgent("GPTBot/1.0")).toBe(true);
    expect(isBotUserAgent("curl/8.7.1")).toBe(true);
    expect(isBotUserAgent("python-requests/2.31.0")).toBe(true);
    expect(isBotUserAgent("Chrome-Lighthouse")).toBe(true);

    // Real desktop/mobile browsers & Playwright Chromium
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 18_1 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/18.1 Mobile/15E148 Safari/604.1",
      ),
    ).toBe(false);
    expect(
      isBotUserAgent(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) HeadlessChrome/131.0.0.0 Safari/537.36",
      ),
    ).toBe(false);
  });

  it("ignores Next.js and browser prefetch headers", () => {
    expect(isPrefetchRequest(new Headers({ purpose: "prefetch" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "sec-purpose": "prefetch;prerender" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "next-router-prefetch": "1" }))).toBe(true);
    expect(isPrefetchRequest(new Headers({ "user-agent": "Mozilla/5.0" }))).toBe(false);
  });

  it("hashes visitor identity privacy-safely with daily rotation and zero raw IP exposure", () => {
    const day1 = new Date("2026-11-05T12:00:00Z");
    const day2 = new Date("2026-11-06T12:00:00Z");
    const projectId = "11111111-2222-4333-8444-555555555555";

    const hashA = computePrivacySafeVisitorHash({
      projectId,
      clientIp: "203.0.113.42",
      userAgent: "Mozilla/5.0 Chrome/131",
      now: day1,
    });
    const hashASameDay = computePrivacySafeVisitorHash({
      projectId,
      clientIp: "203.0.113.42",
      userAgent: "Mozilla/5.0 Chrome/131",
      now: new Date("2026-11-05T23:59:59Z"),
    });
    const hashNextDay = computePrivacySafeVisitorHash({
      projectId,
      clientIp: "203.0.113.42",
      userAgent: "Mozilla/5.0 Chrome/131",
      now: day2,
    });

    expect(hashA).toHaveLength(32);
    expect(hashA).toBe(hashASameDay);
    expect(hashA).not.toBe(hashNextDay);
    expect(hashA).not.toContain("203.0.113.42");
  });

  it("normalizes referrer URLs into canonical traffic source buckets", () => {
    expect(normalizeReferrerSource(null, "casefolio.design")).toBe("Direct / link");
    expect(normalizeReferrerSource("https://casefolio.design/templates", "casefolio.design")).toBe(
      "Direct / link",
    );
    expect(normalizeReferrerSource("http://localhost:3000/published", "localhost:3000")).toBe(
      "Direct / link",
    );
    expect(normalizeReferrerSource("https://www.linkedin.com/feed/update/123")).toBe("LinkedIn");
    expect(normalizeReferrerSource("https://lnkd.in/d9x2")).toBe("LinkedIn");
    expect(normalizeReferrerSource("https://dribbble.com/shots/29100")).toBe("Dribbble");
    expect(normalizeReferrerSource("https://www.behance.net/gallery/100")).toBe("Behance");
    expect(normalizeReferrerSource("https://www.google.co.uk/search?q=ux")).toBe("Google");
    expect(normalizeReferrerSource("https://t.co/xyz987")).toBe("X / Twitter");
    expect(normalizeReferrerSource("https://news.ycombinator.com/item?id=1")).toBe("Other");
  });

  it("renders unpublished empty state matching Figma 2:8745 when private with 0 views", () => {
    const unpublishedPayload: ProjectAnalyticsPayload = {
      projectId: "11111111-2222-4333-8444-555555555555",
      projectName: "Ghaith donation platform",
      templateName: "Orbit",
      slug: null,
      visibility: "private",
      isPublished: false,
      publishedAtIso: null,
      ownerPlan: "free",
      hasFullAnalyticsEntitlement: false,
      range: "30d",
      kpis: {
        views: 0,
        viewsDeltaPercent: null,
        uniqueVisitors: 0,
        visitorsDeltaPercent: null,
        viewsPerVisitor: "0.0",
        topCountry: null,
        completedExports: 0,
        allTimeViews: 0,
      },
      chartBuckets: [],
      topSources: [],
    };

    render(<ProjectAnalyticsPanel analytics={unpublishedPayload} />);
    expect(screen.getByTestId("analytics-unpublished-empty")).toBeInTheDocument();
    expect(screen.getByText("No data yet")).toBeInTheDocument();
    expect(
      screen.getByText("Analytics start once this case study is published."),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Publish case study" })).toHaveAttribute(
      "href",
      "/projects/11111111-2222-4333-8444-555555555555/share",
    );
  });

  it("renders Views over time chart + Top sources for owner and gates 90d/All on Free plan", async () => {
    const user = userEvent.setup();
    const publishedPayload: ProjectAnalyticsPayload = {
      projectId: "22222222-3333-4444-8555-666666666666",
      projectName: "Mosaed — Smart debt management",
      templateName: "Orbit",
      slug: "mosaed-smart-debt",
      visibility: "public",
      isPublished: true,
      publishedAtIso: "2026-11-05T10:00:00.000Z",
      ownerPlan: "free",
      hasFullAnalyticsEntitlement: false,
      range: "30d",
      kpis: {
        views: 3,
        viewsDeltaPercent: 100,
        uniqueVisitors: 1,
        visitorsDeltaPercent: 100,
        viewsPerVisitor: "3.0",
        topCountry: "US",
        completedExports: 2,
        allTimeViews: 3,
      },
      chartBuckets: [
        { dateKey: "2026-11-03", label: "Nov 3", views: 0, uniqueVisitors: 0 },
        { dateKey: "2026-11-05", label: "Nov 5", views: 3, uniqueVisitors: 1 },
      ],
      topSources: [
        { source: "Direct / link", views: 2, percentage: 67 },
        { source: "LinkedIn", views: 1, percentage: 33 },
      ],
    };

    render(<ProjectAnalyticsPanel analytics={publishedPayload} />);

    expect(screen.getByTestId("analytics-total-views-value")).toHaveTextContent("3");
    expect(screen.getByTestId("analytics-unique-visitors-value")).toHaveTextContent("1");
    expect(screen.getByTestId("analytics-views-svg")).toBeInTheDocument();
    expect(screen.getAllByTestId("analytics-chart-bar")).toHaveLength(2);
    expect(screen.getByText("LinkedIn")).toBeInTheDocument();
    expect(screen.getByText("67%")).toBeInTheDocument();

    // Clicking 7d navigates cleanly
    await user.click(screen.getByTestId("analytics-range-7d"));
    expect(pushMock).toHaveBeenCalledWith(
      "/projects/22222222-3333-4444-8555-666666666666/analytics?range=7d",
    );

    // Clicking 90d on Free plan opens UpgradePromptDialog via can() entitlement
    await user.click(screen.getByTestId("analytics-range-90d"));
    expect(
      await screen.findByText("Unlock 90-day & all-time analytics"),
    ).toBeInTheDocument();
  });
});
