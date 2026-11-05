// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { AdminAnalyticsPanel } from "@/components/admin/admin-analytics-panel";
import { AdminOverviewPanel } from "@/components/admin/admin-overview-panel";
import type { AdminOverviewMetrics, AdminPlatformAnalytics } from "@/lib/admin/overview-types";

afterEach(() => {
  cleanup();
});

const sampleOverview: AdminOverviewMetrics = {
  range: "30d",
  rangeDays: 30,
  totalUsers: 1248,
  newUsersInRange: 140,
  newUsersPrevRange: 120,
  activeSubscriptions: 186,
  mrrUsd: 2420,
  publishedCaseStudies: 642,
  publishesInRange: 88,
  publishesPrevRange: 72,
  completedExports: 3140,
  exportsInRange: 410,
  exportsPrevRange: 375,
  publishedTemplates: 4,
  draftTemplates: 2,
  archivedTemplates: 1,
  buckets: Array.from({ length: 12 }, (_, index) => ({
    index,
    label: `Oct ${index + 1}`,
    startIso: "2026-10-01T00:00:00.000Z",
    endIso: "2026-10-03T00:00:00.000Z",
    signups: index + 2,
    publishes: index % 3,
  })),
  needsAttention: [
    {
      id: "reported_case_studies",
      count: 3,
      label: "3 case studies reported",
      badgeLabel: "Review",
      tone: "danger",
      href: "/admin/moderation",
    },
    {
      id: "draft_templates",
      count: 2,
      label: "2 templates in draft",
      badgeLabel: "Draft",
      tone: "draft",
      href: "/admin/templates",
    },
  ],
  topTemplates: [
    {
      id: "tpl-orbit",
      slug: "orbit-mobile-fintech",
      name: "Orbit",
      type: "mobile",
      status: "published",
      version: "1.0.0",
      projectCount: 128,
    },
    {
      id: "tpl-pocket",
      slug: "pocket-draft",
      name: "Pocket",
      type: "mobile",
      status: "draft",
      version: "0.3.0",
      projectCount: 0,
    },
  ],
};

const sampleAnalytics: AdminPlatformAnalytics = {
  range: "30d",
  publishedCaseStudies: 612,
  publishesPrevPeriod: 536,
  publicViews: 84200,
  viewsPrevPeriod: 69000,
  completedExports: 3140,
  exportsPrevPeriod: 2880,
  totalUsers: 2500,
  paidUsers: 120,
  freeToProRatePercent: 4.8,
  weeklyPublishes: Array.from({ length: 12 }, (_, index) => ({
    index,
    label: `W${index + 1}`,
    publishes: index * 4 + 3,
  })),
  templateUsage: [
    { id: "tpl-orbit", name: "Orbit", status: "published", projectCount: 41, sharePercent: 58 },
    { id: "tpl-frame", name: "Frame", status: "published", projectCount: 30, sharePercent: 42 },
  ],
  topCaseStudies: [
    {
      id: "cs-1",
      name: "Ghaith — sponsorship app",
      slug: "ghaith-sponsorship",
      authorName: "Lina Haddad",
      templateName: "Frame",
      views: 4812,
      exports: 63,
    },
  ],
};

describe("AdminOverviewPanel & AdminAnalyticsPanel UI (C-901)", () => {
  it("renders Admin Overview KPIs, alerts, and top templates matching Figma 31:6666", () => {
    render(<AdminOverviewPanel metrics={sampleOverview} />);

    expect(screen.getByRole("heading", { name: "Overview" })).toBeDefined();
    expect(screen.getByTestId("kpi-total-users-value").textContent).toBe("1,248");
    expect(screen.getByTestId("kpi-mrr-value").textContent).toBe("$2,420");
    expect(screen.getByText("186 active subs")).toBeDefined();
    expect(screen.getByTestId("kpi-published-projects-value").textContent).toBe("642");
    expect(screen.getByTestId("kpi-completed-exports-value").textContent).toBe("3,140");
    expect(screen.getByText("4 published · 2 drafts")).toBeDefined();

    expect(screen.getByText("3 case studies reported")).toBeDefined();
    expect(screen.getByText("Orbit")).toBeDefined();
    expect(screen.getByText("128")).toBeDefined();
  });

  it("renders Admin Platform Analytics KPIs, template shares, and top case studies matching Figma 32:9985", () => {
    render(<AdminAnalyticsPanel analytics={sampleAnalytics} />);

    expect(screen.getByRole("heading", { name: "Analytics" })).toBeDefined();
    expect(screen.getByText("84.2k")).toBeDefined();
    expect(screen.getByText("4.8%")).toBeDefined();
    expect(screen.getByText("Ghaith — sponsorship app")).toBeDefined();
    expect(screen.getByRole("button", { name: /Export CSV/i })).toBeDefined();
  });
});
