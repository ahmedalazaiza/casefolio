import { createHmac, timingSafeEqual } from "node:crypto";

export interface ExportRenderTokenPayload {
  kind: "export-render";
  exportId: string;
  projectId: string;
  exp: number;
}

export const DEFAULT_EXPORT_TOKEN_TTL_MS = 5 * 60 * 1000;

export function resolveExportSigningSecret(
  envSource: Record<string, string | undefined> = process.env,
): string {
  return (
    envSource.EXPORT_SIGNING_SECRET ||
    envSource.BETTER_AUTH_SECRET ||
    "casefolio-dev-export-signing-secret-32chars"
  );
}

export function signExportRenderToken(
  params: {
    exportId: string;
    projectId: string;
    ttlMs?: number;
    nowMs?: number;
  },
  secret = resolveExportSigningSecret(),
): string {
  const nowMs = params.nowMs ?? Date.now();
  const ttlMs = params.ttlMs ?? DEFAULT_EXPORT_TOKEN_TTL_MS;
  const payload: ExportRenderTokenPayload = {
    kind: "export-render",
    exportId: params.exportId,
    projectId: params.projectId,
    exp: nowMs + ttlMs,
  };

  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const mac = createHmac("sha256", `casefolio:export:v1:${secret}`)
    .update(encodedPayload)
    .digest("base64url");

  return `${encodedPayload}.${mac}`;
}

export function verifyExportRenderToken(
  token: string | null | undefined,
  options?: {
    expectedExportId?: string;
    secret?: string;
    nowMs?: number;
  },
): ExportRenderTokenPayload | null {
  if (!token || typeof token !== "string") {
    return null;
  }

  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) {
    return null;
  }

  const secret = options?.secret ?? resolveExportSigningSecret();
  const nowMs = options?.nowMs ?? Date.now();
  const encodedPayload = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);

  const expectedMac = createHmac("sha256", `casefolio:export:v1:${secret}`)
    .update(encodedPayload)
    .digest("base64url");

  const sigBuf = Buffer.from(signature, "utf-8");
  const expBuf = Buffer.from(expectedMac, "utf-8");
  if (sigBuf.length !== expBuf.length || !timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }

  try {
    const parsed = JSON.parse(
      Buffer.from(encodedPayload, "base64url").toString("utf-8"),
    ) as Partial<ExportRenderTokenPayload>;

    if (
      parsed.kind !== "export-render" ||
      typeof parsed.exportId !== "string" ||
      typeof parsed.projectId !== "string" ||
      typeof parsed.exp !== "number" ||
      parsed.exp <= nowMs
    ) {
      return null;
    }

    if (options?.expectedExportId && parsed.exportId !== options.expectedExportId) {
      return null;
    }

    return parsed as ExportRenderTokenPayload;
  } catch {
    return null;
  }
}
