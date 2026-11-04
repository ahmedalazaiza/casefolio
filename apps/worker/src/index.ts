export const WORKER_SERVICE_NAME = "casefolio-export-worker" as const;

export function getWorkerHealth() {
  return {
    service: WORKER_SERVICE_NAME,
    status: "ready" as const,
  };
}
