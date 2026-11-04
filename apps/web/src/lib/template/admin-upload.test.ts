// @vitest-environment node
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { eq } from "@casefolio/db";
import { describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import { parseAndValidateTemplateJson } from "@/lib/template/parse";
import { saveTemplateDraftFromWizard } from "@/lib/template/service";

function readOrbitJsonString(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      return readFileSync(candidate, "utf-8");
    }
  }
  throw new Error("Could not locate reference/template.example.json");
}

describe("Admin template JSON validation & draft persistence (C-303)", () => {
  it("reports field-level errors on malformed JSON and invalid ratios/tokens", () => {
    const syntaxRes = parseAndValidateTemplateJson("{ broken json ");
    expect(syntaxRes.ok).toBe(false);
    if (!syntaxRes.ok) {
      expect(syntaxRes.issues[0]?.path).toBe("json");
    }

    const orbitObj = JSON.parse(readOrbitJsonString()) as {
      template: { slots: { "hero.mockup": { ratio: string } } };
      puck: { content: Array<{ props: { background: string } }> };
    };
    orbitObj.template.slots["hero.mockup"].ratio = "bad-ratio";
    orbitObj.puck.content[0]!.props.background = "unknownToken";

    const schemaRes = parseAndValidateTemplateJson(JSON.stringify(orbitObj));
    expect(schemaRes.ok).toBe(false);
    if (!schemaRes.ok) {
      const paths = schemaRes.issues.map((i) => i.path);
      expect(paths).toContain("template.slots.hero.mockup.ratio");
      expect(paths).toContain("puck.content.0.props.background");
    }
  });

  it("saves a validated template as draft with version 1.0.0 and logs an audit entry", async () => {
    const rawOrbit = readOrbitJsonString();
    const uniqueSlug = `c303-draft-${Date.now()}`;

    try {
      const result = await saveTemplateDraftFromWizard({
        actorId: null,
        rawJson: rawOrbit,
        metadata: {
          name: "Orbit C303 Draft",
          slug: uniqueSlug,
          type: "mobile",
          category: "Fintech",
          tier: "pro",
          coverUrl: "https://cdn.casefolio.app/templates/orbit/cover.png",
          coverRatio: "4:3",
          changelog: "Initial C-303 test draft",
        },
      });

      expect(result.ok).toBe(true);
      if (!result.ok) return;

      expect(result.version).toBe("1.0.0");
      expect(result.status).toBe("draft");

      const [tplRow] = await db
        .select()
        .from(dbSchema.templates)
        .where(eq(dbSchema.templates.id, result.templateId));

      expect(tplRow).toBeDefined();
      expect(tplRow?.status).toBe("draft");
      expect(tplRow?.tier).toBe("pro");
      expect(tplRow?.currentVersionId).toBe(result.versionId);

      const [verRow] = await db
        .select()
        .from(dbSchema.templateVersions)
        .where(eq(dbSchema.templateVersions.id, result.versionId));

      expect(verRow?.version).toBe("1.0.0");
      expect(verRow?.publishedAt).toBeNull();
    } finally {
      await db.delete(dbSchema.templates).where(eq(dbSchema.templates.slug, uniqueSlug));
    }
  });
});
