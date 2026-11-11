import { createHash } from "node:crypto";
import type { PlanTier } from "@casefolio/db";
import { z } from "zod";

export const ANALYTICS_RANGE_KEYS = ["7d", "30d", "90d", "all"] as const;
export type AnalyticsRangeKey = (typeof ANALYTICS_RANGE_KEYS)[number];

export const analyticsRangeSchema = z.enum(ANALYTICS_RANGE_KEYS);

export const trackPageViewInputSchema = z.object({
  projectId: z.string().uuid("Invalid project ID."),
  referrer: z.string().max(1024).nullish(),
});

export interface AnalyticsDailyBucket {
  dateKey: string;
  label: string;
  views: number;
  uniqueVisitors: number;
}

export interface AnalyticsSourceItem {
  source: string;
  views: number;
  percentage: number;
}

export interface ProjectAnalyticsPayload {
  projectId: string;
  projectName: string;
  templateName: string;
  slug: string | null;
  visibility: "private" | "unlisted" | "public";
  isPublished: boolean;
  publishedAtIso: string | null;
  ownerPlan: PlanTier;
  hasFullAnalyticsEntitlement: boolean;
  range: AnalyticsRangeKey;
  kpis: {
    views: number;
    viewsDeltaPercent: number | null;
    uniqueVisitors: number;
    visitorsDeltaPercent: number | null;
    viewsPerVisitor: string;
    topCountry: string | null;
    completedExports: number;
    allTimeViews: number;
  };
  chartBuckets: AnalyticsDailyBucket[];
  topSources: AnalyticsSourceItem[];
}

const BOT_USER_AGENT_REGEX =
  /(?:googlebot|bingbot|bingpreview|yandexbot|baiduspider|duckduckbot|slurp|sogou|exabot|facebot|facebookexternalhit|ia_archiver|twitterbot|linkedinbot|slackbot|discordbot|telegrambot|whatsapp|pinterest|embedly|quora link preview|applebot|semrushbot|ahrefsbot|mj12bot|dotbot|petalbot|bytespider|gptbot|chatgpt-user|claudebot|anthropic-ai|ccbot|perplexitybot|amazonbot|uptimerobot|pingdom|statuscake|datadog|lighthouse|pagespeed|gtmetrix|phantomjs|scrapy|curl\/|wget\/|python-requests|python-httpx|aiohttp|go-http-client|java\/|apache-httpclient|okhttp|libwww-perl|\b(?:bot|crawler|spider)\b)/i;

export function isBotUserAgent(userAgent: string | null | undefined): boolean {
  if (!userAgent) return true;
  const trimmed = userAgent.trim();
  if (trimmed.length < 8) return true;
  return BOT_USER_AGENT_REGEX.test(trimmed);
}

export function isPrefetchRequest(headers: Headers): boolean {
  const purpose = headers.get("purpose")?.toLowerCase() ?? "";
  const secPurpose = headers.get("sec-purpose")?.toLowerCase() ?? "";
  const nextPrefetch = headers.get("next-router-prefetch");
  const middlewarePrefetch = headers.get("x-middleware-prefetch");

  return (
    purpose.includes("prefetch") ||
    secPurpose.includes("prefetch") ||
    nextPrefetch === "1" ||
    middlewarePrefetch === "1"
  );
}

export function extractClientIpFromHeaders(headers: Headers): string {
  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;
  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const hops = forwarded
      .split(",")
      .map((part) => part.trim())
      .filter(Boolean);
    if (hops.length > 0) {
      return hops[hops.length - 1]!;
    }
  }
  return "127.0.0.1";
}

export function extractCountryFromHeaders(headers: Headers): string | null {
  const raw =
    headers.get("x-vercel-ip-country")?.trim() ??
    headers.get("cf-ipcountry")?.trim() ??
    null;
  if (!raw) return null;
  const upper = raw.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper) || upper === "XX" || upper === "T1") {
    return null;
  }
  return upper;
}

export function computePrivacySafeVisitorHash(args: {
  projectId: string;
  clientIp: string;
  userAgent: string;
  now?: Date;
}): string {
  const dayKey = (args.now ?? new Date()).toISOString().slice(0, 10);
  const secretSalt = (process.env.BETTER_AUTH_SECRET ?? "casefolio-daily-salt").slice(0, 16);
  return createHash("sha256")
    .update(
      `${dayKey}|${secretSalt}|${args.projectId}|${args.clientIp.trim()}|${args.userAgent.trim()}`,
    )
    .digest("hex")
    .slice(0, 32);
}

export function normalizeReferrerSource(
  rawReferrer: string | null | undefined,
  appHost?: string | null,
): string {
  if (!rawReferrer) return "Direct / link";
  const trimmed = rawReferrer.trim();
  if (!trimmed) return "Direct / link";

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    return "Direct / link";
  }

  const host = parsedUrl.hostname.toLowerCase().replace(/^www\./, "");
  if (!host) return "Direct / link";

  const cleanAppHost = (appHost ?? "")
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .split("/")[0]
    ?.split(":")[0]
    ?.replace(/^www\./, "");

  if (
    host === "localhost" ||
    host === "127.0.0.1" ||
    (cleanAppHost && host === cleanAppHost)
  ) {
    return "Direct / link";
  }

  if (host.includes("linkedin.com") || host === "lnkd.in") {
    return "LinkedIn";
  }
  if (host.includes("dribbble.com")) {
    return "Dribbble";
  }
  if (host.includes("behance.net")) {
    return "Behance";
  }
  if (host.startsWith("google.") || host.includes(".google.")) {
    return "Google";
  }
  if (host === "t.co" || host.includes("twitter.com") || host.includes("x.com")) {
    return "X / Twitter";
  }

  return "Other";
}
