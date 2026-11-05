// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { buildWorkerHealthHttpResponse, getWorkerHealth } from "@casefolio/worker";
import { describe, expect, it, vi } from "vitest";
import { GET as getHealthRoute } from "@/app/api/health/route";
import { checkWebHealth } from "@/lib/monitoring/health";
import {
  buildSentryEventEnvelope,
  captureServerException,
  parseSentryDsn,
} from "@/lib/monitoring/sentry";

function resolveRepoRoot(): string {
  const cwd = process.cwd();
  return cwd.endsWith("apps/web") ? resolve(cwd, "../..") : cwd;
}

describe("Production Health Checks, Monitoring & Deployment Readiness (C-1104)", () => {
  it("1. returns HTTP 200 healthy status from GET /api/health against live PostgreSQL and no-store cache header", async () => {
    const response = await getHealthRoute();
    expect(response.status).toBe(200);
    expect(response.headers.get("Cache-Control")).toContain("no-store");

    const payload = (await response.json()) as Awaited<ReturnType<typeof checkWebHealth>>;
    expect(payload.ok).toBe(true);
    expect(payload.status).toBe("healthy");
    expect(payload.service).toBe("casefolio-web");
    expect(payload.environment.paddleEnv).toBe("sandbox");
    expect(payload.checks.database.status).toBe("up");
    expect(payload.checks.database.latencyMs).toBeGreaterThanOrEqual(0);
    expect(payload.checks.templates.publishedCount).toBeGreaterThanOrEqual(1);
  });

  it("2. returns unhealthy status (503) when database probe fails without leaking connection secrets", async () => {
    const report = await checkWebHealth({
      probeDatabase: async () => {
        throw new Error(
          "Connection failed to postgresql://admin:supersecret@db.internal:5432/prod",
        );
      },
      envSource: {
        NODE_ENV: "production",
        PADDLE_ENV: "sandbox",
        SENTRY_DSN: "https://pub123@o456.ingest.us.sentry.io/789",
      },
    });

    expect(report.ok).toBe(false);
    expect(report.status).toBe("unhealthy");
    expect(report.environment.sentryConfigured).toBe(true);
    expect(report.checks.database.status).toBe("down");
    expect(JSON.stringify(report)).not.toContain("supersecret");
  });

  it("3. reports ready health payload for export worker", () => {
    expect(getWorkerHealth()).toEqual({
      service: "casefolio-export-worker",
      status: "ready",
    });

    const httpPayload = buildWorkerHealthHttpResponse();
    expect(httpPayload.ok).toBe(true);
    expect(httpPayload.service).toBe("casefolio-export-worker");
    expect(httpPayload.status).toBe("ready");
    expect(typeof httpPayload.uptimeSeconds).toBe("number");
    expect(typeof httpPayload.timestamp).toBe("string");
  });

  it("4. parses real Sentry DSNs, skips CI/example placeholders, and redacts PII & secrets from envelopes", async () => {
    expect(parseSentryDsn(undefined)).toBeNull();
    expect(parseSentryDsn("https://public@example.ingest.sentry.io/1")).toBeNull();

    const parsed = parseSentryDsn("https://abc123key@o999.ingest.us.sentry.io/4242");
    expect(parsed).toEqual({
      protocol: "https:",
      publicKey: "abc123key",
      host: "o999.ingest.us.sentry.io",
      projectId: "4242",
      envelopeUrl:
        "https://o999.ingest.us.sentry.io/api/4242/envelope/?sentry_version=7&sentry_key=abc123key",
    });

    const sensitiveError = new Error(
      "Webhook failed for designer@studio.io with Bearer sk_live_987654 and pdl_sdbx_apikey_secret999",
    );
    const { body } = buildSentryEventEnvelope(sensitiveError, {
      route: "/api/export/123?token=eyJhbGciOiJIUzI1NiJ9.secret",
      method: "POST",
      extra: {
        customerEmail: "designer@studio.io",
      },
    });

    expect(body).not.toContain("designer@studio.io");
    expect(body).not.toContain("sk_live_987654");
    expect(body).not.toContain("pdl_sdbx_apikey_secret999");
    expect(body).not.toContain("eyJhbGciOiJIUzI1NiJ9.secret");
    expect(body).toContain("[REDACTED_EMAIL]");

    const fetchMock = vi.fn(async () => new Response("{}", { status: 200 }));
    const sentResult = await captureServerException(
      sensitiveError,
      { route: "/api/paddle/webhook", method: "POST" },
      {
        dsn: "https://abc123key@o999.ingest.us.sentry.io/4242",
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );
    expect(sentResult.sent).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);

    const skippedResult = await captureServerException(
      sensitiveError,
      { route: "/api/paddle/webhook" },
      {
        dsn: "https://public@example.ingest.sentry.io/1",
        fetchImpl: fetchMock as unknown as typeof fetch,
      },
    );
    expect(skippedResult.sent).toBe(false);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("5. includes worker Dockerfile, fly.toml, and DEPLOYMENT.md rollback runbook while keeping PADDLE_ENV=sandbox", () => {
    const repoRoot = resolveRepoRoot();
    const dockerfilePath = join(repoRoot, "apps/worker/Dockerfile");
    const flyTomlPath = join(repoRoot, "apps/worker/fly.toml");
    const runbookPath = join(repoRoot, "DEPLOYMENT.md");
    const envExamplePath = join(repoRoot, ".env.example");

    expect(existsSync(dockerfilePath)).toBe(true);
    expect(existsSync(flyTomlPath)).toBe(true);
    expect(existsSync(runbookPath)).toBe(true);

    const dockerfile = readFileSync(dockerfilePath, "utf-8");
    expect(dockerfile).toContain("mcr.microsoft.com/playwright");
    expect(dockerfile).toContain("HEALTHCHECK");
    expect(dockerfile).toContain("/health");

    const flyToml = readFileSync(flyTomlPath, "utf-8");
    expect(flyToml).toContain('path = "/health"');
    expect(flyToml).toContain('PADDLE_ENV = "sandbox"');

    const envExample = readFileSync(envExamplePath, "utf-8");
    expect(envExample).toContain("PADDLE_ENV=sandbox");

    const runbook = readFileSync(runbookPath, "utf-8");
    expect(runbook).toContain("## 4. Rollback Runbook");
    expect(runbook).toContain("vercel rollback");
    expect(runbook).toContain("fly releases");
    expect(runbook).toContain("neonctl branches create");
    expect(runbook).toContain('PADDLE_ENV="sandbox"');
  });
});
