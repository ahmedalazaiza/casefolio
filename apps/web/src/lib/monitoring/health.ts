import { count, eq, sql } from "@casefolio/db";
import { db, dbSchema } from "@/lib/db";
import { parseSentryDsn } from "@/lib/monitoring/sentry";

export interface WebHealthReport {
  ok: boolean;
  status: "healthy" | "unhealthy";
  service: "casefolio-web";
  timestamp: string;
  uptimeSeconds: number;
  environment: {
    nodeEnv: string;
    paddleEnv: "sandbox" | "production";
    sentryConfigured: boolean;
  };
  checks: {
    database: {
      status: "up" | "down";
      latencyMs: number;
    };
    templates: {
      status: "up" | "empty";
      publishedCount: number;
    };
  };
}

export async function checkWebHealth(options?: {
  probeDatabase?: () => Promise<{ publishedTemplatesCount: number }>;
  envSource?: Record<string, string | undefined>;
}): Promise<WebHealthReport> {
  const source = options?.envSource ?? process.env;
  const startedAt = performance.now();

  const defaultProbe = async () => {
    await db.execute(sql`SELECT 1`);
    const [row] = await db
      .select({ total: count() })
      .from(dbSchema.templates)
      .where(eq(dbSchema.templates.status, "published"));
    return {
      publishedTemplatesCount: Number(row?.total ?? 0),
    };
  };

  const probe = options?.probeDatabase ?? defaultProbe;
  const paddleEnv = source.PADDLE_ENV === "production" ? "production" : "sandbox";
  const sentryConfigured = Boolean(parseSentryDsn(source.SENTRY_DSN));

  try {
    const { publishedTemplatesCount } = await probe();
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));

    return {
      ok: true,
      status: "healthy",
      service: "casefolio-web",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: {
        nodeEnv: source.NODE_ENV ?? "development",
        paddleEnv,
        sentryConfigured,
      },
      checks: {
        database: {
          status: "up",
          latencyMs,
        },
        templates: {
          status: publishedTemplatesCount > 0 ? "up" : "empty",
          publishedCount: publishedTemplatesCount,
        },
      },
    };
  } catch {
    const latencyMs = Math.max(0, Math.round(performance.now() - startedAt));
    return {
      ok: false,
      status: "unhealthy",
      service: "casefolio-web",
      timestamp: new Date().toISOString(),
      uptimeSeconds: Math.floor(process.uptime()),
      environment: {
        nodeEnv: source.NODE_ENV ?? "development",
        paddleEnv,
        sentryConfigured,
      },
      checks: {
        database: {
          status: "down",
          latencyMs,
        },
        templates: {
          status: "empty",
          publishedCount: 0,
        },
      },
    };
  }
}
