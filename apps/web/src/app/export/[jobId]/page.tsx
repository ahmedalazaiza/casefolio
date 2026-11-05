import { eq } from "@casefolio/db";
import { verifyExportRenderToken } from "@casefolio/worker/token";
import type { Metadata } from "next";
import { forbidden, notFound } from "next/navigation";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { CasefolioWatermark } from "@/components/sections/casefolio-watermark";
import { db, dbSchema } from "@/lib/db";
import { can } from "@/lib/entitlements";
import { resolveEffectivePlanForUser } from "@/lib/entitlements/server";
import {
  puckDocumentSchema,
  templateThemeSchema,
  validateTemplateDocument,
} from "@/lib/template/schema";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Casefolio Export Renderer",
  robots: {
    index: false,
    follow: false,
    nocache: true,
  },
};

interface ExportRenderPageProps {
  params: Promise<{ jobId: string }>;
  searchParams: Promise<{ token?: string }>;
}

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export default async function ExportRenderPage({
  params,
  searchParams,
}: ExportRenderPageProps) {
  const { jobId } = await params;
  const { token } = await searchParams;

  const verified = verifyExportRenderToken(token, {
    expectedExportId: jobId,
  });

  if (!verified || !UUID_REGEX.test(jobId)) {
    forbidden();
  }

  const [row] = await db
    .select({
      exportJob: dbSchema.exportsTable,
      project: dbSchema.projects,
      version: dbSchema.templateVersions,
      ownerPlan: dbSchema.users.plan,
    })
    .from(dbSchema.exportsTable)
    .innerJoin(dbSchema.projects, eq(dbSchema.exportsTable.projectId, dbSchema.projects.id))
    .innerJoin(
      dbSchema.templateVersions,
      eq(dbSchema.projects.templateVersionId, dbSchema.templateVersions.id),
    )
    .innerJoin(dbSchema.users, eq(dbSchema.projects.ownerId, dbSchema.users.id))
    .where(eq(dbSchema.exportsTable.id, jobId))
    .limit(1);

  if (!row || row.project.id !== verified.projectId) {
    notFound();
  }

  const tplDocCheck = validateTemplateDocument(row.version.data);
  if (!tplDocCheck.ok) {
    notFound();
  }

  const tplDoc = tplDocCheck.data;
  const puckCheck = puckDocumentSchema.safeParse(row.project.puckData);
  const themeCheck = templateThemeSchema.safeParse(row.project.theme);
  const resolvedPuck = puckCheck.success ? puckCheck.data : structuredClone(tplDoc.puck);
  const resolvedTheme = themeCheck.success
    ? themeCheck.data
    : structuredClone(tplDoc.template.theme);

  const effectiveOwnerPlan = await resolveEffectivePlanForUser(row.project.ownerId);

  return (
    <main
      data-testid="export-render-ready"
      data-export-id={row.exportJob.id}
      data-export-format={row.exportJob.format}
      data-owner-plan={effectiveOwnerPlan}
      className="bg-background text-foreground min-h-screen w-full"
    >
      <TemplatePuckRenderer
        puckData={resolvedPuck}
        theme={resolvedTheme}
        slots={tplDoc.template.slots}
        projectType={row.project.type}
        className="rounded-none"
      />
      <CasefolioWatermark
        visible={!can(effectiveOwnerPlan, "remove_watermark")}
        interactive={false}
      />
    </main>
  );
}

