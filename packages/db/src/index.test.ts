import { describe, expect, it } from "vitest";
import { DB_PACKAGE_READY } from "./index";

describe("@casefolio/db package", () => {
  it("exports workspace readiness flag", () => {
    expect(DB_PACKAGE_READY).toBe(true);
  });
});
