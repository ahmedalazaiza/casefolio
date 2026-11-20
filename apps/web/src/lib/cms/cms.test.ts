// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { afterEach, describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import {
  sanitizeUploadedSvg,
} from "@/lib/cms/media-storage";
import {
  applyCmsPaddleOverrides,
  computeTeamsPriceWithCms,
  DEFAULT_SITE_CMS_CONTENT,
  mergeBillingCatalogWithCms,
} from "@/lib/cms/schema";
import {
  getUncachedSiteCmsContent,
  resetSiteCmsContent,
  SITE_CMS_ROW_KEY,
  updateSiteCmsSection,
} from "@/lib/cms/service";

const createdUserIds: string[] = [];

afterEach(async () => {
  await db
    .delete(dbSchema.platformSettings)
    .where(eq(dbSchema.platformSettings.key, SITE_CMS_ROW_KEY))
    .catch(() => undefined);
  for (const uid of createdUserIds.splice(0, createdUserIds.length)) {
    await db.delete(dbSchema.users).where(eq(dbSchema.users.id, uid)).catch(() => undefined);
  }
});

describe("CMS schema, 2-founder team defaults, pricing sync & SVG sanitization", () => {
  it("keeps strictly the two actual founding partners (Ahmed Al-Azaiza & Mohammed Kullab) in Team defaults", () => {
    const members = DEFAULT_SITE_CMS_CONTENT.team.members;
    expect(members).toHaveLength(2);
    expect(members[0]?.name).toBe("Ahmed Al-Azaiza");
    expect(members[0]?.role).toBe("Founder & Product Architect");
    expect(members[1]?.name).toBe("Mohammed Kullab");
    expect(members[1]?.role).toBe("Co-Founder & Lead Full-Stack Engineer");
  });

  it("merges CMS pricing edits, Teams seat rates, and Paddle overrides dynamically", () => {
    const customPricing = structuredClone(DEFAULT_SITE_CMS_CONTENT.pricing);
    customPricing.popularTier = "team";
    customPricing.tiers.pro.monthlyPriceCents = 999;
    customPricing.tiers.pro.yearlyTotalCents = 9990;
    customPricing.tiers.team.monthlyPriceCents = 700;
    customPricing.tiers.team.yearlyTotalCents = 7000;
    customPricing.paddlePriceOverrides.pro_monthly = "pri_custom_pro_mo";

    const merged = mergeBillingCatalogWithCms(customPricing);
    expect(merged.pro.monthlyPriceCents).toBe(999);
    expect(merged.pro.highlighted).toBe(false);
    expect(merged.team.highlighted).toBe(true);

    const calc = computeTeamsPriceWithCms(4, "yearly", customPricing.tiers.team);
    expect(calc.ok).toBe(true);
    if (calc.ok) {
      expect(calc.yearlyTotalCents).toBe(28_000);
      expect(calc.chargeCents).toBe(28_000);
    }

    const overriddenPaddle = applyCmsPaddleOverrides(
      {
        pro_monthly: "pri_env_pro_mo",
        pro_yearly: "pri_env_pro_yr",
        team_monthly: "pri_env_team_mo",
        team_yearly: "pri_env_team_yr",
      },
      customPricing,
    );
    expect(overriddenPaddle.pro_monthly).toBe("pri_custom_pro_mo");
    expect(overriddenPaddle.team_yearly).toBe("pri_env_team_yr");
  });

  it("blocks malicious SVG scripts/handlers while accepting clean SVG vectors", () => {
    const evilScript = sanitizeUploadedSvg('<svg><script>alert(1)</script><path d="M0 0"/></svg>');
    expect(evilScript.ok).toBe(false);

    const evilHandler = sanitizeUploadedSvg('<svg onload="fetch(\'/x\')"><rect width="10"/></svg>');
    expect(evilHandler.ok).toBe(false);

    const clean = sanitizeUploadedSvg(
      '<?xml version="1.0"?><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="8"/></svg>',
    );
    expect(clean.ok).toBe(true);
    if (clean.ok) {
      expect(clean.svg.startsWith("<svg")).toBe(true);
      expect(clean.svg.endsWith("</svg>")).toBe(true);
    }
  });

  it("persists updated CMS sections to platform_settings and resets cleanly", async () => {
    const adminId = randomUUID();
    await db.insert(dbSchema.users).values({
      id: adminId,
      name: "CMS Admin",
      email: `cms-admin-${adminId}@example.com`,
      emailVerified: true,
      role: "superadmin",
      plan: "free",
    });
    createdUserIds.push(adminId);

    const nextAbout = structuredClone(DEFAULT_SITE_CMS_CONTENT.about);
    nextAbout.heroTitleHighlight = "curated shipping";

    const updateRes = await updateSiteCmsSection({
      actorId: adminId,
      section: "about",
      data: nextAbout,
    });
    expect(updateRes.ok).toBe(true);

    const fetched = await getUncachedSiteCmsContent();
    expect(fetched.about.heroTitleHighlight).toBe("curated shipping");

    const resetDoc = await resetSiteCmsContent({ actorId: adminId, section: "about" });
    expect(resetDoc.about.heroTitleHighlight).toBe(
      DEFAULT_SITE_CMS_CONTENT.about.heroTitleHighlight,
    );
  });
});
