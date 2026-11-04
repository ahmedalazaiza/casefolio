import { describe, expect, it } from "vitest";
import { SUPPORTED_SECTION_TYPES } from "./index";

describe("@casefolio/template-schema", () => {
  it("lists all 9 supported section types", () => {
    expect(SUPPORTED_SECTION_TYPES).toHaveLength(9);
    expect(SUPPORTED_SECTION_TYPES).toContain("Hero");
    expect(SUPPORTED_SECTION_TYPES).toContain("Quote");
    expect(SUPPORTED_SECTION_TYPES).toContain("CTA");
  });
});
