import { existsSync } from "node:fs";
import { createServer, type Server } from "node:http";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { closeSharedExportBrowser } from "./renderer";
import { startPgBossExportConsumer, type ExportWorkerConsumerHandle } from "./queue";

export * from "./token";
export * from "./zip";
export * from "./storage";
export * from "./renderer";
export * from "./queue";

export const WORKER_SERVICE_NAME = "casefolio-export-worker" as const;

export function getWorkerHealth() {
  return {
    service: WORKER_SERVICE_NAME,
    status: "ready" as const,
  };
}

export function buildWorkerHealthHttpResponse() {
  return {
    ok: true as const,
    ...getWorkerHealth(),
    uptimeSeconds: Math.floor(process.uptime()),
    timestamp: new Date().toISOString(),
  };
}

export interface RunningWorkerServer {
  server: Server;
  consumer: ExportWorkerConsumerHandle;
  port: number;
  close: () => Promise<void>;
}

export async function startWorkerServer(options?: {
  databaseUrl?: string;
  appUrl?: string;
  port?: number;
}): Promise<RunningWorkerServer> {
  const databaseUrl = options?.databaseUrl ?? process.env.DATABASE_URL;
  if (!databaseUrl) {
    throw new Error("DATABASE_URL is required to start casefolio-export-worker.");
  }

  const appUrl =
    options?.appUrl ??
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.BETTER_AUTH_URL ??
    "http://localhost:3000";
  const requestedPort = options?.port ?? Number(process.env.PORT || 4000);

  const consumer = await startPgBossExportConsumer({
    databaseUrl,
    appUrl,
  });

  const server = createServer((req, res) => {
    if (req.method === "GET" && (req.url === "/health" || req.url === "/")) {
      const body = JSON.stringify(buildWorkerHealthHttpResponse());
      res.writeHead(200, {
        "Content-Type": "application/json",
        "Cache-Control": "no-store",
      });
      res.end(body);
      return;
    }

    if (req.method === "POST" && req.url === "/wake") {
      consumer.boss.notifyWorker(consumer.workerId);
      res.writeHead(202, { "Content-Type": "application/json" });
      res.end(JSON.stringify({ ok: true }));
      return;
    }

    res.writeHead(404, { "Content-Type": "application/json" });
    res.end(JSON.stringify({ error: "Not found" }));
  });

  const port = await new Promise<number>((resolvePort, rejectPort) => {
    server.once("error", rejectPort);
    server.listen(requestedPort, "0.0.0.0", () => {
      const addr = server.address();
      resolvePort(typeof addr === "object" && addr ? addr.port : requestedPort);
    });
  });

  return {
    server,
    consumer,
    port,
    close: async () => {
      await new Promise<void>((res) => server.close(() => res()));
      await consumer.stop();
      await closeSharedExportBrowser();
    },
  };
}

// Standalone entrypoint when executed directly (`node dist/index.js` or `node --experimental-strip-types src/index.ts`)
const isMainModule =
  typeof process !== "undefined" &&
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(resolve(process.argv[1]!)).href;

if (isMainModule) {
  for (const envCandidate of [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../../.env"),
  ]) {
    if (existsSync(envCandidate) && typeof process.loadEnvFile === "function") {
      process.loadEnvFile(envCandidate);
      break;
    }
  }

  startWorkerServer()
    .then((running) => {
      console.log(`[${WORKER_SERVICE_NAME}] listening on port ${running.port}`);
      const shutdown = () => {
        running
          .close()
          .catch(() => undefined)
          .finally(() => process.exit(0));
      };
      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    })
    .catch((err) => {
      console.error(`[${WORKER_SERVICE_NAME}] failed to start:`, err);
      process.exit(1);
    });
}
