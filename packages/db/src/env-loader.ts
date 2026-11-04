import { existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rootEnvPath = resolve(currentDir, "../../../.env");

export function loadWorkspaceEnv(): void {
  if (!process.env.DATABASE_URL && existsSync(rootEnvPath)) {
    process.loadEnvFile(rootEnvPath);
  }
}
