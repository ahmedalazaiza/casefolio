import { resolve } from "node:path";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(__dirname, "./apps/web/src"),
    },
  },
  test: {
    include: [
      "apps/**/*.test.{ts,tsx}",
      "packages/**/*.test.{ts,tsx}",
      "tests/**/*.test.{ts,tsx}",
    ],
    exclude: ["**/node_modules/**", "**/.next/**", "**/dist/**", "tests/e2e/**"],
    environment: "jsdom",
    setupFiles: ["./apps/web/vitest.setup.ts"],
    clearMocks: true,
    restoreMocks: true,
  },
});
