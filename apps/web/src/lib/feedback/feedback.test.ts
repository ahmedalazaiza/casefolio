// @vitest-environment node
import { randomUUID } from "node:crypto";
import { eq } from "@casefolio/db";
import { afterEach, describe, expect, it } from "vitest";
import { db, dbSchema } from "@/lib/db";
import {
  getAdminFeedbackOverview,
  getFeedbackEligibilityForUser,
  serializeAdminFeedbackCsv,
  snoozeUserFeedback,
  submitUserFeedback,
} from "@/lib/feedback/service";

const createdUserIds: string[] = [];

afterEach(async () => {
  for (const uid of createdUserIds.splice(0, createdUserIds.length)) {
    await db.delete(dbSchema.users).where(eq(dbSchema.users.id, uid)).catch(() => undefined);
  }
});

async function createSeededProjectUser() {
  const userId = randomUUID();
  const tplId = randomUUID();
  const verId = randomUUID();
  const catId = randomUUID();
  const projId = randomUUID();

  await db.insert(dbSchema.users).values({
    id: userId,
    name: "Survey Designer",
    email: `survey-${userId}@example.com`,
    emailVerified: true,
    role: "user",
    plan: "pro",
  });
  createdUserIds.push(userId);

  await db.insert(dbSchema.categories).values({
    id: catId,
    slug: `cat-${catId.slice(0, 8)}`,
    name: "Fintech",
  });

  await db.insert(dbSchema.templates).values({
    id: tplId,
    slug: `tpl-${tplId.slice(0, 8)}`,
    name: "Survey Test Template",
    type: "mobile",
    tier: "free",
    status: "published",
    categoryId: catId,
    coverUrl: "/cdn/covers/test.png",
  });

  await db.insert(dbSchema.templateVersions).values({
    id: verId,
    templateId: tplId,
    version: "1.0.0",
    data: { template: { slots: {} } },
  });

  await db.insert(dbSchema.projects).values({
    id: projId,
    ownerId: userId,
    templateVersionId: verId,
    name: "Survey Case Study",
    type: "mobile",
    puckData: {},
    theme: {},
    visibility: "private",
  });

  return { userId, projId, tplId, catId };
}

describe("Smart timed 5-star feedback survey lifecycle & admin analytics", () => {
  it("triggers after first publish or export, respects 30-day snooze, and never re-prompts after submission", async () => {
    const { userId, projId } = await createSeededProjectUser();

    // Brand-new draft-only user created just now -> NOT eligible yet
    const initial = await getFeedbackEligibilityForUser(userId);
    expect(initial.eligible).toBe(false);
    expect(initial.alreadySubmitted).toBe(false);

    // Completing an export triggers first_export eligibility
    await db.insert(dbSchema.exportsTable).values({
      projectId: projId,
      requestedByUserId: userId,
      format: "pdf",
      status: "completed",
      scale: 2,
      hasWatermark: false,
    });

    const afterExport = await getFeedbackEligibilityForUser(userId);
    expect(afterExport.eligible).toBe(true);
    expect(afterExport.triggerMoment).toBe("first_export");

    // Snoozing pauses eligibility for 30 days
    await snoozeUserFeedback({ userId, triggerMoment: "first_export" });
    const afterSnooze = await getFeedbackEligibilityForUser(userId);
    expect(afterSnooze.eligible).toBe(false);
    expect(afterSnooze.snoozedUntilIso).toBeTruthy();

    // Submitting saves 5-star score + plan snapshot, permanently preventing auto re-prompts
    await submitUserFeedback({
      userId,
      rating: 5,
      triggerMoment: "first_export",
      primaryUseCase: "Job search / UX portfolio",
      topFeatureRequest: "More templates & layouts",
      sentimentTags: ["Fast workflow", "Crisp exports"],
      comment: "Really love the Figma-style workflow.",
    });

    const afterSubmit = await getFeedbackEligibilityForUser(userId);
    expect(afterSubmit.eligible).toBe(false);
    expect(afterSubmit.alreadySubmitted).toBe(true);

    // Appears accurately in Admin Feedback overview & CSV export
    const overview = await getAdminFeedbackOverview();
    const entry = overview.entries.find((e) => e.userId === userId);
    expect(entry).toBeDefined();
    expect(entry?.rating).toBe(5);
    expect(entry?.planTier).toBe("pro");
    expect(entry?.topFeatureRequest).toBe("More templates & layouts");

    const csv = serializeAdminFeedbackCsv(overview);
    expect(csv).toContain("Survey Designer");
    expect(csv).toContain("More templates & layouts");
  });
});
