import type { PgBoss } from "pg-boss";

export type ExportFormat = "png_long" | "pdf" | "behance";

export const EXPORT_QUEUE_NAME = "casefolio-exports" as const;

export interface ExportQueueJobPayload {
  exportId: string;
  projectId: string;
  format: ExportFormat;
  appUrl?: string;
  workspaceId?: string | null;
  requestedByUserId?: string | null;
  scale?: 1 | 2;
  maxMegapixels?: number;
  maxPdfPages?: number;
  timeoutMs?: number;
  reservationJobId?: string;
}

export async function enqueueExportJobToPgBoss(
  boss: PgBoss,
  payload: ExportQueueJobPayload,
): Promise<string | null> {
  await boss.createQueue(EXPORT_QUEUE_NAME).catch(() => {
    // Queue already exists
  });

  return boss.send(EXPORT_QUEUE_NAME, payload, {
    retryLimit: 2,
    retryDelay: 3,
    retryBackoff: true,
    expireInSeconds: 180,
  });
}
