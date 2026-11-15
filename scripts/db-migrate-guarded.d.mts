export interface MigrationGuardInput {
  databaseUrl: string | undefined;
  confirmDbHost: string | undefined;
  allowRemoteSeed: string | undefined;
  seed: boolean;
}
export interface MigrationGuardVerdict {
  ok: boolean;
  reason: string;
  host: string | null;
  local: boolean;
}
export function evaluateMigrationGuard(input: MigrationGuardInput): MigrationGuardVerdict;
