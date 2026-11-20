import { putBinaryWithFallback, type PutBinaryTransport } from "@/lib/storage/client-upload";

export interface UploadCmsMediaResult {
  assetUrl: string;
  r2Key: string;
  bytes: number;
  mimeType: string;
}

function inferCmsMimeType(file: File): string {
  const type = file.type.trim().toLowerCase();
  if (type === "image/jpg") return "image/jpeg";
  if (type) return type;
  const lower = file.name.toLowerCase();
  if (lower.endsWith(".svg")) return "image/svg+xml";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".webp")) return "image/webp";
  return "image/jpeg";
}

export async function uploadCmsMediaClient(options: {
  file: File;
  onProgress?: (pct: number) => void;
  putTransport?: PutBinaryTransport;
}): Promise<UploadCmsMediaResult> {
  const { file, onProgress, putTransport } = options;
  const mimeType = inferCmsMimeType(file);
  onProgress?.(10);

  if (mimeType === "image/svg+xml") {
    const svgContent = await file.text();
    onProgress?.(50);
    const res = await fetch("/api/admin/cms/upload", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "upload_svg",
        svgContent,
      }),
    });
    const json = (await res.json().catch(() => ({}))) as {
      ok?: boolean;
      error?: string;
      assetUrl?: string;
      r2Key?: string;
      bytes?: number;
      mimeType?: string;
    };
    if (!res.ok || !json.ok || !json.assetUrl) {
      throw new Error(json.error ?? "Failed to upload SVG icon.");
    }
    onProgress?.(100);
    return {
      assetUrl: json.assetUrl,
      r2Key: json.r2Key ?? "",
      bytes: json.bytes ?? file.size,
      mimeType: "image/svg+xml",
    };
  }

  const bodyBytes = new Uint8Array(await file.arrayBuffer());

  const presignRes = await fetch("/api/admin/cms/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "presign",
      fileName: file.name || "asset.png",
      mimeType,
      bytes: bodyBytes.byteLength,
    }),
  });

  const presignJson = (await presignRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    uploadUrl?: string;
    fallbackUploadUrl?: string;
    uploadHeaders?: Record<string, string>;
    completeToken?: string;
  };

  if (!presignRes.ok || !presignJson.ok || !presignJson.uploadUrl || !presignJson.completeToken) {
    throw new Error(presignJson.error ?? "Failed to initiate CMS asset upload.");
  }

  onProgress?.(35);

  await putBinaryWithFallback({
    uploadUrl: presignJson.uploadUrl,
    fallbackUploadUrl: presignJson.fallbackUploadUrl,
    headers: presignJson.uploadHeaders ?? { "Content-Type": mimeType },
    body: bodyBytes,
    putTransport,
    onProgress: (ratio) => {
      onProgress?.(Math.min(88, 35 + Math.round(ratio * 53)));
    },
  });

  onProgress?.(92);

  const completeRes = await fetch("/api/admin/cms/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      action: "complete",
      completeToken: presignJson.completeToken,
    }),
  });

  const completeJson = (await completeRes.json().catch(() => ({}))) as {
    ok?: boolean;
    error?: string;
    assetUrl?: string;
    r2Key?: string;
    bytes?: number;
    mimeType?: string;
  };

  if (!completeRes.ok || !completeJson.ok || !completeJson.assetUrl) {
    throw new Error(completeJson.error ?? "Failed to finalize CMS asset upload.");
  }

  onProgress?.(100);

  return {
    assetUrl: completeJson.assetUrl,
    r2Key: completeJson.r2Key ?? "",
    bytes: completeJson.bytes ?? bodyBytes.byteLength,
    mimeType: completeJson.mimeType ?? mimeType,
  };
}
