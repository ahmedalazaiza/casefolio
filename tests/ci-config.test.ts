import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("CI workflow & Vercel preview configuration (C-005)", () => {
  it("defines GitHub Actions CI pipeline with lint, typecheck, db migrate/seed, unit, and e2e steps", () => {
    const workflow = readFileSync(
      resolve(process.cwd(), ".github/workflows/ci.yml"),
      "utf-8",
    );

    expect(workflow).toContain("pull_request:");
    expect(workflow).toContain("postgres:16-alpine");
    expect(workflow).toContain("pnpm lint");
    expect(workflow).toContain("pnpm typecheck");
    expect(workflow).toContain("pnpm db:migrate && pnpm db:seed");
    expect(workflow).toContain("pnpm test");
    expect(workflow).toContain("pnpm test:e2e");
    expect(workflow).toContain("Post Preview URL on Pull Request");
  });

  it("defines valid Vercel monorepo configuration targeting @casefolio/web", () => {
    const raw = readFileSync(resolve(process.cwd(), "vercel.json"), "utf-8");
    const parsed = JSON.parse(raw) as {
      framework: string;
      installCommand: string;
      buildCommand: string;
      outputDirectory: string;
    };

    expect(parsed.framework).toBe("nextjs");
    expect(parsed.buildCommand).toContain("@casefolio/web build");
    expect(parsed.outputDirectory).toBe("apps/web/.next");
  });
});
