import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, relative, resolve, sep } from "node:path";
import { PutObjectCommand, S3Client } from "@aws-sdk/client-s3";

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

export function isWorkerRealR2Configured(
  envSource: Record<string, string | undefined> = process.env,
): boolean {
  if (envSource.CASEFOLIO_FORCE_LOCAL_STORAGE === "1") {
    return false;
  }
  const accountId = (envSource.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = envSource.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = envSource.R2_SECRET_ACCESS_KEY ?? "";
  const bucket = envSource.R2_BUCKET ?? "";

  return (
    /^[a-z0-9]{16,64}$/i.test(accountId) &&
    !looksLikePlaceholder(accountId) &&
    !looksLikePlaceholder(accessKeyId) &&
    !looksLikePlaceholder(secretAccessKey) &&
    secretAccessKey.trim().length >= 24 &&
    !looksLikePlaceholder(bucket)
  );
}

function resolveLocalUploadRoot(): string {
  if (process.env.CASEFOLIO_LOCAL_UPLOAD_DIR) {
    return resolve(process.env.CASEFOLIO_LOCAL_UPLOAD_DIR);
  }
  const cwd = process.cwd();
  if (existsSync(resolve(cwd, "pnpm-workspace.yaml"))) {
    return resolve(cwd, ".data/uploads");
  }
  if (existsSync(resolve(cwd, "../../pnpm-workspace.yaml"))) {
    return resolve(cwd, "../../.data/uploads");
  }
  return resolve(cwd, ".data/uploads");
}

function resolveSafeLocalPath(r2Key: string): string {
  const cleanedKey = r2Key.replace(/^\/+/, "");
  if (!cleanedKey || cleanedKey.includes("\0")) {
    throw new Error("Invalid export storage key.");
  }
  const rootDir = resolveLocalUploadRoot();
  const target = resolve(rootDir, cleanedKey);
  const rel = relative(rootDir, target);
  if (rel.startsWith("..") || rel.includes(`..${sep}`) || target === rootDir) {
    throw new Error("Path traversal detected in export storage key.");
  }
  return target;
}

let cachedS3Client: { key: string; client: S3Client } | null = null;

function getWorkerS3Client(envSource: Record<string, string | undefined> = process.env): S3Client {
  const accountId = (envSource.R2_ACCOUNT_ID ?? "").trim();
  const accessKeyId = envSource.R2_ACCESS_KEY_ID ?? "";
  const secretAccessKey = envSource.R2_SECRET_ACCESS_KEY ?? "";
  const cacheKey = `${accountId}:${accessKeyId}`;

  if (cachedS3Client && cachedS3Client.key === cacheKey) {
    return cachedS3Client.client;
  }

  const client = new S3Client({
    region: "auto",
    endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId,
      secretAccessKey,
    },
  });
  cachedS3Client = { key: cacheKey, client };
  return client;
}

export async function storeRenderedExportArtifact(params: {
  r2Key: string;
  bytes: Uint8Array;
  contentType: string;
  envSource?: Record<string, string | undefined>;
}): Promise<{ mode: "r2" | "local"; r2Key: string; bytes: number }> {
  const envSource = params.envSource ?? process.env;

  if (isWorkerRealR2Configured(envSource)) {
    const s3 = getWorkerS3Client(envSource);
    const bucket = envSource.R2_BUCKET || "casefolio-assets";
    await s3.send(
      new PutObjectCommand({
        Bucket: bucket,
        Key: params.r2Key,
        Body: params.bytes,
        ContentType: params.contentType,
        CacheControl: "private, max-age=31536000",
      }),
    );
    return {
      mode: "r2",
      r2Key: params.r2Key,
      bytes: params.bytes.byteLength,
    };
  }

  const targetPath = resolveSafeLocalPath(params.r2Key);
  await mkdir(dirname(targetPath), { recursive: true });
  await writeFile(targetPath, params.bytes);

  return {
    mode: "local",
    r2Key: params.r2Key,
    bytes: params.bytes.byteLength,
  };
}

