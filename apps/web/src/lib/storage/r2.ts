import { createHmac, timingSafeEqual } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, rm, stat, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import type { AllowedUploadMimeType } from "@/lib/storage/quotas";

export interface StorageEnvConfig {
  accountId: string;
  accessKeyId: string;
  secretAccessKey: string;
  bucket: string;
  signingSecret: string;
  appUrl: string;
}

const PLACEHOLDER_TOKENS = [
  "your-",
  "replace-",
  "test_",
  "test-",
  "dev_",
  "dev-",
  "local_",
  "local-",
  "mock_",
  "mock-",
  "placeholder",
  "example",
  "r2-account",
  "r2-key",
  "r2-secret",
];

function looksLikePlaceholder(value: string | undefined): boolean {
  if (!value) return true;
  const normalized = value.trim().toLowerCase();
  if (normalized.length === 0) return true;
  return PLACEHOLDER_TOKENS.some(
    (token) => normalized.startsWith(token) || normalized.includes(token),
  );
}

const DEV_FALLBACK_STORAGE_SECRET = "casefolio-dev-storage-signing-secret-32chars";

export function readStorageEnvConfig(
  envSource: Record<string, string | undefined> = process.env,
): StorageEnvConfig {
  const configuredSecret =
    envSource.STORAGE_SIGNING_SECRET?.trim() ||
    envSource.BETTER_AUTH_SECRET?.trim() ||
    envSource.EXPORT_SIGNING_SECRET?.trim() ||
    "";

  return {
    accountId: envSource.R2_ACCOUNT_ID ?? "",
    accessKeyId: envSource.R2_ACCESS_KEY_ID ?? "",
    secretAccessKey: envSource.R2_SECRET_ACCESS_KEY ?? "",
    bucket: envSource.R2_BUCKET || "casefolio-assets",
    signingSecret:
      configuredSecret.length >= 16
        ? configuredSecret
        : envSource.NODE_ENV === "production"
          ? ""
          : DEV_FALLBACK_STORAGE_SECRET,
    appUrl: envSource.NEXT_PUBLIC_APP_URL || "http://localhost:3000",
  };
}

export function isRealR2Configured(
  config: StorageEnvConfig = readStorageEnvConfig(),
): boolean {
  if (process.env.CASEFOLIO_FORCE_LOCAL_STORAGE === "1") {
    return false;
  }
  const cleanAccountId = config.accountId.trim();
  const isValidAccountIdFormat = /^[a-z0-9]{16,64}$/i.test(cleanAccountId);

  return (
    isValidAccountIdFormat &&
    !looksLikePlaceholder(cleanAccountId) &&
    !looksLikePlaceholder(config.accessKeyId) &&
    !looksLikePlaceholder(config.secretAccessKey) &&
    config.secretAccessKey.trim().length >= 24 &&
    !looksLikePlaceholder(config.bucket)
  );
}

let cachedS3Client: { key: string; client: S3Client } | null = null;

export function getR2S3Client(config: StorageEnvConfig = readStorageEnvConfig()): S3Client {
  const cacheKey = `${config.accountId}:${config.accessKeyId}:${config.bucket}`;
  if (cachedS3Client && cachedS3Client.key === cacheKey) {
    return cachedS3Client.client;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });

  cachedS3Client = { key: cacheKey, client };
  return client;
}

export function resolveLocalUploadRoot(): string {
  if (process.env.CASEFOLIO_LOCAL_UPLOAD_DIR) {
    return resolve(process.env.CASEFOLIO_LOCAL_UPLOAD_DIR);
  }
  const cwd = process.cwd();
  if (existsSync(resolve(cwd, "pnpm-workspace.yaml"))) {
    return resolve(cwd, ".data/uploads");
  }
  const monorepoUp = resolve(cwd, "../../pnpm-workspace.yaml");
  if (existsSync(monorepoUp)) {
    return resolve(cwd, "../../.data/uploads");
  }
  return resolve(cwd, ".data/uploads");
}

/**
 * Resolves an `r2Key` strictly inside `.data/uploads`, preventing path traversal.
 */
export function resolveSafeLocalFilePath(r2Key: string, rootDir = resolveLocalUploadRoot()): string {
  const cleanedKey = r2Key.replace(/^\/+/, "");
  if (!cleanedKey || cleanedKey.includes("\0")) {
    throw new Error("Invalid storage key.");
  }
  const resolvedRoot = resolve(rootDir);
  const target = resolve(resolvedRoot, cleanedKey);
  const rel = relative(resolvedRoot, target);
  if (rel.startsWith("..") || rel.includes(`..${sep}`) || target === resolvedRoot) {
    throw new Error("Path traversal detected in storage key.");
  }
  return target;
}

export function signStorageToken<TPayload extends { exp: number }>(
  payload: TPayload,
  secret = readStorageEnvConfig().signingSecret,
): string {
  if (!secret || secret.trim().length < 16) {
    throw new Error(
      "Storage signing secret (>= 16 chars) is required in production via BETTER_AUTH_SECRET or STORAGE_SIGNING_SECRET.",
    );
  }
  const encodedPayload = Buffer.from(JSON.stringify(payload), "utf-8").toString("base64url");
  const mac = createHmac("sha256", `casefolio:storage:v1:${secret}`)
    .update(encodedPayload)
    .digest("base64url");
  return `${encodedPayload}.${mac}`;
}

export function verifyStorageToken<TPayload extends { exp: number }>(
  token: string,
  secret = readStorageEnvConfig().signingSecret,
  nowMs = Date.now(),
): TPayload | null {
  if (!secret || secret.trim().length < 16) {
    return null;
  }
  const dotIdx = token.indexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) {
    return null;
  }

  const encodedPayload = token.slice(0, dotIdx);
  const signature = token.slice(dotIdx + 1);

  const expectedMac = createHmac("sha256", `casefolio:storage:v1:${secret}`)
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
    ) as TPayload;
    if (typeof parsed.exp !== "number" || parsed.exp <= nowMs) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export interface LocalPutTokenPayload {
  kind: "local-put";
  r2Key: string;
  mimeType: AllowedUploadMimeType;
  maxBytes: number;
  cacheControl?: string;
  exp: number;
}

export interface PresignedPutTarget {
  mode: "r2" | "local";
  uploadUrl: string;
  fallbackUploadUrl?: string;
  uploadMethod: "PUT";
  uploadHeaders: Record<string, string>;
  expiresInSeconds: number;
}

/**
 * Generates a presigned PUT URL against Cloudflare R2 (`@aws-sdk/s3-request-presigner`)
 * when real R2 credentials are configured, or a short-lived HMAC-signed PUT URL in local dev.
 * Also attaches a signed server-side `fallbackUploadUrl` so browsers on restricted networks
 * or preview domains can seamlessly fall back if direct-to-R2 PUT is blocked.
 */
export async function createPresignedPutTarget(params: {
  r2Key: string;
  mimeType: AllowedUploadMimeType;
  bytes: number;
  maxFileBytes: number;
  cacheControl?: string;
  expiresInSeconds?: number;
  config?: StorageEnvConfig;
}): Promise<PresignedPutTarget> {
  const config = params.config ?? readStorageEnvConfig();
  const expiresInSeconds = params.expiresInSeconds ?? 300;
  const cacheControl = params.cacheControl ?? "private, max-age=31536000, immutable";

  const putToken = signStorageToken<LocalPutTokenPayload>(
    {
      kind: "local-put",
      r2Key: params.r2Key,
      mimeType: params.mimeType,
      maxBytes: Math.min(params.bytes, params.maxFileBytes),
      cacheControl,
      exp: Date.now() + expiresInSeconds * 1000,
    },
    config.signingSecret,
  );
  const localPutUrl = `/api/uploads/local-put?token=${encodeURIComponent(putToken)}`;

  if (isRealR2Configured(config)) {
    const s3 = getR2S3Client(config);
    const command = new PutObjectCommand({
      Bucket: config.bucket,
      Key: params.r2Key,
      ContentType: params.mimeType,
      ContentLength: params.bytes,
      CacheControl: cacheControl,
    });

    const uploadUrl = await getSignedUrl(s3, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      mode: "r2",
      uploadUrl,
      fallbackUploadUrl: localPutUrl,
      uploadMethod: "PUT",
      uploadHeaders: {
        "Content-Type": params.mimeType,
      },
      expiresInSeconds,
    };
  }

  return {
    mode: "local",
    uploadUrl: localPutUrl,
    uploadMethod: "PUT",
    uploadHeaders: {
      "Content-Type": params.mimeType,
    },
    expiresInSeconds,
  };
}

export async function writeLocalStoredObject(r2Key: string, bytes: Uint8Array): Promise<void> {
  const targetPath = resolveSafeLocalFilePath(r2Key);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, bytes);
}

export async function writeStoredObject(
  r2Key: string,
  bytes: Uint8Array,
  options?: {
    contentType?: string;
    cacheControl?: string;
    config?: StorageEnvConfig;
  },
): Promise<void> {
  const config = options?.config ?? readStorageEnvConfig();
  if (isRealR2Configured(config)) {
    const s3 = getR2S3Client(config);
    await s3.send(
      new PutObjectCommand({
        Bucket: config.bucket,
        Key: r2Key,
        Body: bytes,
        ContentLength: bytes.byteLength,
        ContentType: options?.contentType ?? "application/octet-stream",
        CacheControl: options?.cacheControl ?? "private, max-age=31536000, immutable",
      }),
    );
    return;
  }

  await writeLocalStoredObject(r2Key, bytes);
}

export async function headStoredObject(
  r2Key: string,
  config: StorageEnvConfig = readStorageEnvConfig(),
): Promise<{ exists: boolean; bytes: number }> {
  if (isRealR2Configured(config)) {
    try {
      const s3 = getR2S3Client(config);
      const head = await s3.send(
        new HeadObjectCommand({
          Bucket: config.bucket,
          Key: r2Key,
        }),
      );
      return {
        exists: true,
        bytes: head.ContentLength ?? 0,
      };
    } catch {
      return { exists: false, bytes: 0 };
    }
  }

  try {
    const targetPath = resolveSafeLocalFilePath(r2Key);
    const info = await stat(targetPath);
    if (!info.isFile()) {
      return { exists: false, bytes: 0 };
    }
    return {
      exists: true,
      bytes: info.size,
    };
  } catch {
    return { exists: false, bytes: 0 };
  }
}

export async function readStoredObjectBytes(
  r2Key: string,
  config: StorageEnvConfig = readStorageEnvConfig(),
): Promise<Uint8Array | null> {
  if (isRealR2Configured(config)) {
    try {
      const s3 = getR2S3Client(config);
      const response = await s3.send(
        new GetObjectCommand({
          Bucket: config.bucket,
          Key: r2Key,
        }),
      );
      if (!response.Body) return null;
      return await response.Body.transformToByteArray();
    } catch {
      return null;
    }
  }

  try {
    const targetPath = resolveSafeLocalFilePath(r2Key);
    const buf = await readFile(targetPath);
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength);
  } catch {
    return null;
  }
}

export async function deleteStoredObject(
  r2Key: string,
  config: StorageEnvConfig = readStorageEnvConfig(),
): Promise<void> {
  if (isRealR2Configured(config)) {
    const s3 = getR2S3Client(config);
    await s3.send(
      new DeleteObjectCommand({
        Bucket: config.bucket,
        Key: r2Key,
      }),
    );
    return;
  }

  try {
    const targetPath = resolveSafeLocalFilePath(r2Key);
    await rm(targetPath, { force: true });
  } catch {
    // Ignore missing file on cleanup
  }
}
