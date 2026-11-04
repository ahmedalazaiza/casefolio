import { existsSync } from "node:fs";
import { resolve } from "node:path";

export function loadWorkspaceEnv(): void {
  if (process.env.DATABASE_URL) {
    return;
  }

  for (const candidate of [
    resolve(process.cwd(), ".env"),
    resolve(process.cwd(), "../.env"),
    resolve(process.cwd(), "../../.env"),
  ]) {
    if (existsSync(candidate)) {
      process.loadEnvFile(candidate);
      return;
    }
  }
}
