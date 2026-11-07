import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SUPPORTED_SECTION_TYPES,
  parseAspectRatio,
  templateDocumentSchema,
  validateTemplateDocument,
} from "./index";

function loadReferenceJson(fileName: string): Record<string, unknown> {
  for (const candidate of [
    resolve(process.cwd(), `reference/${fileName}`),
    resolve(process.cwd(), `../../reference/${fileName}`),
  ]) {
    try {
      return JSON.parse(readFileSync(candidate, "utf-8")) as Record<string, unknown>;
    } catch {
      // try next path
    }
  }
  throw new Error(`Could not locate reference/${fileName}`);
}

function loadOrbitExample(): Record<string, unknown> {
  return loadReferenceJson("template.example.json");
}

describe("Template JSON Zod schema (C-301)", () => {
  it("supports all 9 required section types", () => {
    expect(SUPPORTED_SECTION_TYPES).toEqual([
      "Hero",
      "Overview",
      "Problem",
      "Process",
      "ScreensGallery",
      "Results",
      "Quote",
      "CTA",
      "Custom",
    ]);
  });

  it("validates reference/template.example.json (Orbit) with zero errors", () => {
    const orbit = loadOrbitExample();
    const res = validateTemplateDocument(orbit);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.template.slug).toBe("orbit");
      expect(res.data.template.type).toBe("mobile");
      expect(res.data.puck.content).toHaveLength(6);
      expect(res.data.warnings).toEqual([]);
    }
  });

  it("validates Quote, CTA, Custom sections and structured warnings", () => {
    const orbit = structuredClone(loadOrbitExample()) as {
      template: { slots: Record<string, unknown> };
      puck: { content: Array<Record<string, unknown>> };
      warnings?: unknown[];
    };

    orbit.template.slots["quote.avatar"] = { ratio: "1:1", minWidth: 96 };
    orbit.puck.content.push(
      {
        type: "Quote",
        props: {
          id: "Quote-1",
          quote: "Orbit made saving effortless for our entire university cohort.",
          author: "Sara K.",
          role: "Beta tester",
          avatar: { slot: "quote.avatar", src: "", alt: "Sara avatar", crop: null },
          background: "surface",
        },
      },
      {
        type: "CTA",
        props: {
          id: "CTA-1",
          heading: "Want to walk through the full prototype?",
          subheading: "Available for senior product design roles.",
          primaryLabel: "Get in touch",
          primaryHref: "mailto:designer@casefolio.app",
          background: "background",
          accent: "accent",
        },
      },
      {
        type: "Custom",
        props: {
          id: "Custom-1",
          heading: "Design System Retrospective",
          body: { type: "doc", content: [{ type: "paragraph" }] },
          background: "surface",
        },
      },
    );
    orbit.warnings = [
      { code: "UNMATCHED_LAYER", message: "Decorative divider skipped", nodeId: "14:90" },
    ];

    const parsed = templateDocumentSchema.safeParse(orbit);
    expect(parsed.success).toBe(true);
  });

  it("rejects invalid aspect ratios with clear field-level errors", () => {
    expect(parseAspectRatio("9:19.5")?.width).toBe(9);
    expect(parseAspectRatio("16x9")).toBeNull();
    expect(parseAspectRatio("0:10")).toBeNull();

    const invalid = structuredClone(loadOrbitExample()) as {
      template: { slots: Record<string, { ratio: string; minWidth: number }> };
    };
    invalid.template.slots["hero.mockup"] = { ratio: "16x9", minWidth: 390 };

    const res = validateTemplateDocument(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(
        res.issues.some(
          (i) =>
            i.path === "template.slots.hero.mockup.ratio" &&
            i.message.includes("Invalid aspect ratio"),
        ),
      ).toBe(true);
    }
  });

  it("rejects raw HEX colors, unknown theme tokens, unknown slots, and duplicate section IDs in props", () => {
    const invalid = structuredClone(loadOrbitExample()) as {
      puck: { content: Array<{ type: string; props: Record<string, unknown> }> };
    };

    // 1. Raw HEX inside section props
    invalid.puck.content[0]!.props.background = "#5B4BFF";
    // 2. Unknown theme color token
    invalid.puck.content[1]!.props.background = "neonPurple";
    // 3. Unknown image slot reference
    invalid.puck.content[0]!.props.mockup = {
      slot: "hero.nonexistent",
      src: "",
      alt: "Missing",
      crop: null,
    };
    // 4. Duplicate section props.id
    invalid.puck.content[2]!.props.id = "Hero-1";

    const res = validateTemplateDocument(invalid);
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const messages = res.issues.map((i) => `${i.path}: ${i.message}`).join("\n");
      expect(messages).toContain("puck.content.0.props.background: Raw color '#5B4BFF' is forbidden");
      expect(messages).toContain(
        "puck.content.1.props.background: Color token 'neonPurple' is not defined",
      );
      expect(messages).toContain(
        "puck.content.0.props.mockup.slot: Image slot 'hero.nonexistent' is not defined",
      );
      expect(messages).toContain("puck.content.2.props.id: Duplicate section id 'Hero-1'");
    }
  });

  it("validates reference/template.cinema.json (.Cinema) with multi-device slots, 5-col galleries, timeline, and design-system swatches", () => {
    const cinema = loadReferenceJson("template.cinema.json");
    const res = validateTemplateDocument(cinema);

    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.template.slug).toBe("cinema");
      expect(res.data.template.type).toBe("both");
      expect(res.data.puck.content).toHaveLength(14);
      expect(res.data.template.slots["custom.image"]?.device).toBe("macbook");
    }

    const brokenCinema = structuredClone(cinema) as {
      puck: { content: Array<{ type: string; props: Record<string, unknown> }> };
    };
    const dsSection = brokenCinema.puck.content.find(
      (s) => s.type === "Custom" && s.props.layout === "design-system",
    );
    expect(dsSection).toBeDefined();
    if (dsSection) {
      dsSection.props.swatches = [{ label: "Unknown", token: "nonExistentToken" }];
    }

    const brokenRes = validateTemplateDocument(brokenCinema);
    expect(brokenRes.ok).toBe(false);
    if (!brokenRes.ok) {
      expect(
        brokenRes.issues.some((i) =>
          i.message.includes("Swatch color token 'nonExistentToken' is not defined"),
        ),
      ).toBe(true);
    }
  });
});
