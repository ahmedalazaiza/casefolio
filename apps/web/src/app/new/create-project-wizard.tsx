"use client";

import type { PlanTier } from "@casefolio/db";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  Eye,
  Globe,
  Layers,
  Lock,
  Smartphone,
  Store,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { trackClientProductEvent } from "@/components/analytics/posthog-provider";
import { UpgradePromptDialog } from "@/components/billing/upgrade-prompt-dialog";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { TemplateThumbnail } from "@/components/templates/template-thumbnail";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TemplateTypeCard } from "@/components/ui/domain-cards";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isUnlimitedProjectsLimit } from "@/lib/billing/plans";
import { can } from "@/lib/entitlements";
import {
  FREE_PROJECT_LIMIT,
  isTemplateCompatibleWithProjectType,
  slugifyProjectName,
  type CreateProjectInput,
  type CreateProjectResult,
} from "@/lib/projects/types";
import type { TemplateProjectType } from "@/lib/template/schema";
import { buildTemplateThemeStyle } from "@/lib/template/theme-vars";
import type { PublishedTemplateItem } from "@/lib/template/types";
import { cn } from "@/lib/utils";
import type { SpaceSummaryItem } from "@/lib/workspaces/service";

export type WizardStepKey = "type" | "template" | "details";

const WIZARD_STEPS: ReadonlyArray<{ key: WizardStepKey; number: string; label: string }> = [
  { key: "type", number: "01", label: "Type" },
  { key: "template", number: "02", label: "Template" },
  { key: "details", number: "03", label: "Details" },
];

function formatProjectTypeLabel(type: TemplateProjectType): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile & Web";
}

export interface CreateProjectWizardProps {
  templates: PublishedTemplateItem[];
  userPlan: PlanTier;
  existingProjectCount: number;
  lifetimeProjectsCreated?: number;
  activeProjectsLimit?: number;
  spaces?: SpaceSummaryItem[];
  workspaceName?: string;
  workspaceKind?: "personal" | "team";
  initialSpaceId?: string;
  initialStep?: WizardStepKey;
  initialTemplateSlug?: string;
  initialDesignFocus?: TemplateProjectType | null;
  onCreateProject: (input: CreateProjectInput) => Promise<CreateProjectResult>;
}

export function CreateProjectWizard({
  templates,
  userPlan,
  existingProjectCount,
  lifetimeProjectsCreated,
  activeProjectsLimit,
  spaces = [],
  workspaceName,
  workspaceKind = "personal",
  initialSpaceId,
  initialStep = "type",
  initialTemplateSlug,
  initialDesignFocus,
  onCreateProject,
}: CreateProjectWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [upgradePrompt, setUpgradePrompt] = useState<{
    title: string;
    description: string;
    requiredPlan?: "pro" | "team";
  } | null>(null);

  const canUseProTemplates = can(userPlan, "pro_templates");
  const isUnlimitedQuota =
    typeof activeProjectsLimit === "number"
      ? isUnlimitedProjectsLimit(activeProjectsLimit)
      : userPlan !== "free" && userPlan !== "pro";
  const effectiveActiveLimit = activeProjectsLimit ?? (userPlan === "pro" ? 10 : FREE_PROJECT_LIMIT);
  const effectiveLifetimeUsed = Math.max(lifetimeProjectsCreated ?? 0, existingProjectCount);
  const isFreeQuotaReached =
    !can(userPlan, "create_project", {
      projectsCount: existingProjectCount,
      lifetimeProjectsCreated: effectiveLifetimeUsed,
    }) ||
    (!isUnlimitedQuota && existingProjectCount >= effectiveActiveLimit);

  const defaultSpaceId = useMemo(() => {
    if (initialSpaceId && spaces.some((s) => s.id === initialSpaceId)) {
      return initialSpaceId;
    }
    const ownPrivate = spaces.find((s) => s.visibility === "private" && s.isMine);
    return ownPrivate?.id ?? spaces[0]?.id ?? "";
  }, [initialSpaceId, spaces]);

  const [selectedSpaceId, setSelectedSpaceId] = useState<string>(defaultSpaceId);

  const preselectedFromSlug = useMemo(() => {
    if (!initialTemplateSlug) return null;
    const match = templates.find(
      (item) => item.slug.toLowerCase() === initialTemplateSlug.trim().toLowerCase(),
    );
    if (!match) return null;
    if (match.tier === "pro" && !canUseProTemplates) return null;
    return match;
  }, [templates, initialTemplateSlug, canUseProTemplates]);

  const defaultType: TemplateProjectType =
    preselectedFromSlug?.type ?? initialDesignFocus ?? "mobile";

  const [step, setStep] = useState<WizardStepKey>(() => {
    if (preselectedFromSlug && initialStep === "type") {
      return "details";
    }
    return initialStep;
  });

  const [selectedType, setSelectedType] = useState<TemplateProjectType>(defaultType);

  const findDefaultTemplateId = (type: TemplateProjectType): string => {
    if (
      preselectedFromSlug &&
      isTemplateCompatibleWithProjectType(preselectedFromSlug.type, type)
    ) {
      return preselectedFromSlug.id;
    }
    const unlockedMatch = templates.find(
      (tpl) =>
        isTemplateCompatibleWithProjectType(tpl.type, type) &&
        (tpl.tier === "free" || canUseProTemplates),
    );
    return unlockedMatch?.id ?? "";
  };

  const [selectedTemplateId, setSelectedTemplateId] = useState<string>(() =>
    findDefaultTemplateId(defaultType),
  );
  const [previewItem, setPreviewItem] = useState<PublishedTemplateItem | null>(null);

  // Step 3 form state (preserved across Back / Next navigation)
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [client, setClient] = useState("");
  const [role, setRole] = useState("");
  const [year, setYear] = useState("2026");
  const [tools, setTools] = useState("");
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState<string | null>(null);

  const compatibleTemplates = useMemo(
    () =>
      templates.filter((item) => isTemplateCompatibleWithProjectType(item.type, selectedType)),
    [templates, selectedType],
  );

  const selectedTemplate = useMemo(
    () => templates.find((item) => item.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const templateCounts = useMemo(() => {
    return {
      mobile: templates.filter((t) => isTemplateCompatibleWithProjectType(t.type, "mobile")).length,
      web: templates.filter((t) => isTemplateCompatibleWithProjectType(t.type, "web")).length,
      both: templates.filter((t) => isTemplateCompatibleWithProjectType(t.type, "both")).length,
    };
  }, [templates]);

  const handleSelectType = (nextType: TemplateProjectType) => {
    setSelectedType(nextType);
    setSubmitError(null);

    const currentStillValid =
      selectedTemplate &&
      isTemplateCompatibleWithProjectType(selectedTemplate.type, nextType) &&
      (selectedTemplate.tier === "free" || canUseProTemplates);

    if (!currentStillValid) {
      const nextDefault = templates.find(
        (tpl) =>
          isTemplateCompatibleWithProjectType(tpl.type, nextType) &&
          (tpl.tier === "free" || canUseProTemplates),
      );
      setSelectedTemplateId(nextDefault?.id ?? "");
    }
  };

  const stepIndex = WIZARD_STEPS.findIndex((s) => s.key === step);

  const handleFlowBack = () => {
    if (step === "details") {
      setStep("template");
      return;
    }
    if (step === "template") {
      setStep("type");
      return;
    }
    router.push("/dashboard");
  };

  const handleSubmitCreate = (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setFieldErrors({});

    const trimmedName = name.trim();
    if (trimmedName.length < 2) {
      setFieldErrors({ name: "Project name must be at least 2 characters." });
      return;
    }

    if (!selectedTemplate) {
      setSubmitError("Please select a template before creating your project.");
      setStep("template");
      return;
    }

    startTransition(async () => {
      const result = await onCreateProject({
        type: selectedType,
        templateId: selectedTemplate.id,
        spaceId: selectedSpaceId || undefined,
        name: trimmedName,
        description: description.trim() || undefined,
        client: client.trim() || undefined,
        role: role.trim() || undefined,
        year: year.trim() || undefined,
        tools: tools.trim() || undefined,
      });

      if (!result.ok) {
        if (result.fieldErrors) {
          setFieldErrors(result.fieldErrors);
        }
        setSubmitError(result.error);
        return;
      }

      router.push(`/editor/${result.projectId}`);
    });
  };

  const slugPreview = slugifyProjectName(name);
  const previewThemeStyle = buildTemplateThemeStyle(selectedTemplate?.document.template.theme);

  return (
    <div className="bg-wash-top text-foreground flex min-h-screen flex-col">
      {/* Top Studio Stepper Bar */}
      <header className="sticky top-0 z-40 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]/92 backdrop-blur-xl">
        <div className="mx-auto grid h-17 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex max-w-full min-w-0 items-center gap-3 justify-self-start">
            <button
              type="button"
              onClick={handleFlowBack}
              aria-label="Go back"
              className="focus-visible:ring-ring/40 inline-flex size-9 shrink-0 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)] transition-colors outline-none hover:border-[var(--cf-royal)] hover:bg-[var(--cf-bg-surface)] focus-visible:ring-2"
            >
              <ArrowLeft className="size-4" />
            </button>
            <div className="flex min-w-0 flex-col">
              <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
                Case Study Studio
              </span>
              <span className="text-foreground font-display min-w-0 truncate text-sm font-bold tracking-tight sm:text-base">
                {name.trim() || "New project"}
              </span>
            </div>
          </div>

          <nav
            aria-label="Create project steps"
            className="hidden shrink-0 items-center gap-1.5 justify-self-center rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-1 md:flex"
          >
            {WIZARD_STEPS.map((item, idx) => {
              const isCompleted = idx < stepIndex;
              const isCurrent = item.key === step;
              const canJump =
                item.key === "type" ||
                item.key === "template" ||
                (item.key === "details" && Boolean(selectedTemplate));

              return (
                <div key={item.key} className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={!canJump}
                    onClick={() => canJump && setStep(item.key)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-xl px-3 py-1.5 text-sm font-semibold transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
                      isCurrent
                        ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                        : isCompleted
                          ? "text-[var(--cf-text-primary)] hover:bg-[var(--cf-bg-elevated)]"
                          : "text-[var(--cf-text-tertiary)]",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex h-5.5 min-w-5.5 items-center justify-center rounded-md px-1 text-[0.6875rem] font-bold tracking-wider",
                        isCompleted &&
                          "bg-[var(--cf-bg-surface)] text-[var(--cf-royal-text)]",
                        isCurrent &&
                          "bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]",
                        !isCompleted &&
                          !isCurrent &&
                          "bg-[var(--cf-bg-surface)] text-[var(--cf-text-tertiary)]",
                      )}
                    >
                      {isCompleted ? <Check className="size-3.5" /> : item.number}
                    </span>
                    <span>{item.label}</span>
                  </button>
                  {idx < WIZARD_STEPS.length - 1 && (
                    <span
                      aria-hidden="true"
                      className={cn(
                        "h-px w-4",
                        idx < stepIndex
                          ? "bg-[var(--cf-royal)]"
                          : "bg-[var(--cf-border-subtle)]",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 justify-self-end">
            <span className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-2.5 py-1 font-mono text-xs font-bold text-[var(--cf-text-primary)] md:hidden">
              0{stepIndex + 1}/03
            </span>
            <Link href="/dashboard" className="v3-btn-secondary px-3.5 py-2 text-xs font-semibold">
              Exit
            </Link>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main
        id="main-content"
        className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-8 sm:py-12"
      >
        {isFreeQuotaReached && (
          <div
            role="alert"
            data-testid="plan-limit-banner"
            className="border-warning/40 bg-warning-soft text-foreground mb-8 flex flex-col justify-between gap-4 rounded-2xl border p-5 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="text-warning mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="type-body-s-strong">
                  {userPlan === "free"
                    ? existingProjectCount === 0 && effectiveLifetimeUsed >= 1
                      ? "You’ve used your 1 of 1 lifetime Free Case Study credit."
                      : `You’ve reached your Free plan Case Study limit (${Math.max(1, effectiveLifetimeUsed)} of ${FREE_PROJECT_LIMIT} lifetime credit used).`
                    : `You’ve reached your Pro plan active limit (${existingProjectCount} of ${effectiveActiveLimit} rotatable Case Studies).`}
                </p>
                <p className="text-muted-foreground type-body-s">
                  {userPlan === "free"
                    ? existingProjectCount === 0 && effectiveLifetimeUsed >= 1
                      ? "Deleting a project on the Free plan does not restore your lifetime credit. Upgrade to Casefolio Pro ($7.99/mo · 2 months free on annual) for up to 10 rotatable Case Studies, custom URLs, and watermark-free exports."
                      : "Free includes 1 lifetime Case Study credit. Upgrade to Casefolio Pro ($7.99/mo · 2 months free on annual) for up to 10 rotatable Case Studies, custom URLs, all Pro templates, and watermark-free exports."
                    : "Archive or delete a finished draft to free one of your 10 Pro slots, or upgrade to Casefolio Teams ($5.99/seat/mo · 2 months free on annual) for unlimited shared Case Studies."}
                </p>
              </div>
            </div>
            {userPlan === "free" ? (
              <Button
                type="button"
                size="sm"
                className="w-fit shrink-0"
                data-testid="plan-limit-upgrade-btn"
                onClick={() =>
                  setUpgradePrompt({
                    requiredPlan: "pro",
                    title: "Upgrade to Casefolio Pro",
                    description: `Free includes ${FREE_PROJECT_LIMIT} lifetime Case Study credit. Upgrade to Casefolio Pro ($7.99/mo · $79.90/yr with 2 months free) for up to 10 rotatable Case Studies, custom Case Study URLs, all Pro templates, and watermark-free high-res PNG, PDF & Behance exports.`,
                  })
                }
              >
                Upgrade to Pro
              </Button>
            ) : userPlan === "pro" ? (
              <Button
                type="button"
                size="sm"
                className="w-fit shrink-0"
                data-testid="plan-limit-upgrade-btn"
                onClick={() =>
                  setUpgradePrompt({
                    requiredPlan: "team",
                    title: "Upgrade to Casefolio Teams",
                    description:
                      "Pro includes up to 10 rotatable Case Studies. Upgrade to Casefolio Teams ($5.99/seat/mo · 2–25 seats, 2 months free on annual) for unlimited shared Case Studies and collaborative spaces.",
                  })
                }
              >
                Upgrade to Teams
              </Button>
            ) : null}
          </div>
        )}

        {/* STEP 1: TYPE */}
        {step === "type" && (
          <div data-testid="wizard-step-type" className="flex flex-1 flex-col justify-between gap-10">
            <div className="flex flex-col gap-8">
              <div className="v3-pattern-grid relative overflow-hidden rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-9">
                <div className="flex flex-col items-start gap-3">
                  <Eyebrow>Step 1 of 3</Eyebrow>
                  <h1 className="v3-display-l text-[var(--cf-text-primary)]">
                    What are you presenting?
                  </h1>
                  <p className="v3-body-l max-w-xl text-[var(--cf-text-secondary)]">
                    Pick a platform canvas to filter ratio-locked Casefolio studio templates built
                    specifically for your screens.
                  </p>
                </div>
              </div>

              <div
                role="radiogroup"
                aria-label="Project type"
                className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedType === "mobile"}
                  data-testid="type-card-mobile"
                  onClick={() => handleSelectType("mobile")}
                  className="focus-visible:ring-ring/40 rounded-[1.5rem] text-left outline-none focus-visible:ring-2"
                >
                  <TemplateTypeCard
                    title="Mobile app"
                    description="Case study layouts for iOS & Android products with device-framed screen slots."
                    templateCount={templateCounts.mobile}
                    state={selectedType === "mobile" ? "selected" : "default"}
                    icon={<Smartphone className="size-5" />}
                    className="h-full"
                  />
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedType === "web"}
                  data-testid="type-card-web"
                  onClick={() => handleSelectType("web")}
                  className="focus-visible:ring-ring/40 rounded-[1.5rem] text-left outline-none focus-visible:ring-2"
                >
                  <TemplateTypeCard
                    title="Website"
                    description="Long-scroll layouts for marketing sites, dashboards and web apps in browser frames."
                    templateCount={templateCounts.web}
                    state={selectedType === "web" ? "selected" : "default"}
                    icon={<Globe className="size-5" />}
                    className="h-full"
                  />
                </button>

                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedType === "both"}
                  data-testid="type-card-both"
                  onClick={() => handleSelectType("both")}
                  className="focus-visible:ring-ring/40 rounded-[1.5rem] text-left outline-none focus-visible:ring-2"
                >
                  <TemplateTypeCard
                    title="Mobile & Web"
                    description="Cross-platform product stories combining mobile device screens and web views."
                    templateCount={templateCounts.both}
                    state={selectedType === "both" ? "selected" : "default"}
                    icon={<Layers className="size-5" />}
                    className="h-full"
                  />
                </button>

                <TemplateTypeCard
                  title="Booth / Exhibition"
                  description="Spatial and event design: renders, floor plans and build photos."
                  footerLabel="Coming soon"
                  state="coming-soon"
                  icon={<Store className="size-5" />}
                  className="h-full"
                />
              </div>
            </div>

            <div className="flex flex-col-reverse items-stretch justify-between gap-3 rounded-[1.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 sm:flex-row sm:items-center sm:px-6">
              <Link href="/dashboard" className="v3-btn-secondary py-2.5 text-sm">
                Cancel
              </Link>

              <button
                type="button"
                data-testid="wizard-next-to-template"
                onClick={() => setStep("template")}
                className="v3-btn-primary py-2.5 pr-3 pl-5 text-sm"
              >
                <span>Continue to templates</span>
                <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
                  <ArrowRight className="size-3.5" />
                </span>
              </button>
            </div>
          </div>
        )}

        {/* STEP 2: TEMPLATE */}
        {step === "template" && (
          <div
            data-testid="wizard-step-template"
            className="flex flex-1 flex-col justify-between gap-10"
          >
            <div className="flex flex-col gap-6">
              <div className="v3-pattern-grid relative overflow-hidden rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-8">
                <div className="flex flex-col items-start gap-3">
                  <Eyebrow>Step 2 of 3</Eyebrow>
                  <div className="flex flex-wrap items-center gap-3">
                    <h1 className="v3-display-l text-[var(--cf-text-primary)]">
                      {formatProjectTypeLabel(selectedType)} templates
                    </h1>
                    <span className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-3 py-1.5 text-xs font-bold tracking-wider text-[var(--cf-text-primary)] uppercase">
                      From Casefolio library
                    </span>
                  </div>
                  <p className="v3-body-l max-w-xl text-[var(--cf-text-secondary)]">
                    Templates are designed by the Casefolio team — pick a studio layout, then make
                    the narrative and screens yours.
                  </p>
                </div>
              </div>

              {compatibleTemplates.length === 0 ? (
                <Card className="flex flex-col items-center justify-center gap-4 p-12 text-center">
                  <h2 className="text-foreground type-heading-s">
                    No {formatProjectTypeLabel(selectedType).toLowerCase()} templates published yet
                  </h2>
                  <p className="text-muted-foreground type-body-s max-w-md">
                    Switch to Mobile &amp; Web or Mobile app to start from an available published
                    template.
                  </p>
                  <div className="flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => handleSelectType("both")}
                    >
                      Show all compatible templates
                    </Button>
                    <Button type="button" onClick={() => setStep("type")}>
                      Change type
                    </Button>
                  </div>
                </Card>
              ) : (
                <div
                  role="radiogroup"
                  aria-label="Choose template"
                  className="grid gap-6 lg:grid-cols-2"
                >
                  {compatibleTemplates.map((item, idx) => {
                    const isLocked = item.tier === "pro" && !canUseProTemplates;
                    const isSelected = selectedTemplateId === item.id;
                    const themeColors = item.document.template.theme.colors;
                    const indexBadge = String(idx + 1).padStart(2, "0");

                    return (
                      <article
                        key={item.id}
                        data-slot="wizard-template-card"
                        data-template-slug={item.slug}
                        data-selected={isSelected ? "true" : "false"}
                        data-locked={isLocked ? "true" : "false"}
                        className={cn(
                          "group flex flex-col justify-between overflow-hidden rounded-[2rem] border bg-[var(--cf-bg-elevated)] transition-all duration-300",
                          isSelected
                            ? "border-2 border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]"
                            : "border-[var(--cf-border-subtle)] hover:-translate-y-1 hover:border-[var(--cf-royal)] hover:shadow-[var(--cf-shadow-hover)]",
                        )}
                      >
                        <button
                          type="button"
                          role="radio"
                          aria-checked={isSelected}
                          disabled={isLocked}
                          onClick={() => {
                            if (!isLocked) {
                              setSelectedTemplateId(item.id);
                              trackClientProductEvent("template_selected", {
                                templateSlug: item.slug,
                                templateTier: item.tier,
                                projectType: selectedType,
                                surface: "wizard_card",
                              });
                            }
                          }}
                          className="focus-visible:ring-ring/40 flex flex-col text-left outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
                        >
                          {/* Architectural Spec Bar */}
                          <div className="flex w-full items-center justify-between gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-4 py-2.5">
                            <div className="flex items-center gap-2">
                              <span className="inline-flex h-5 items-center rounded-md border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2 font-mono text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-primary)] uppercase">
                                {indexBadge}
                              </span>
                              <span className="font-mono text-[0.6875rem] font-medium text-[var(--cf-text-tertiary)]">
                                casefolio.app/t/{item.slug}
                              </span>
                            </div>
                            <span className="font-mono text-[0.6875rem] font-semibold text-[var(--cf-text-secondary)]">
                              v{item.version}
                            </span>
                          </div>

                          <div className="p-3.5 pb-0">
                            <div className="relative aspect-[16/10] w-full overflow-hidden rounded-2xl border border-[var(--cf-border-subtle)]">
                              <TemplateThumbnail
                                testId={`wizard-template-thumb-${item.slug}`}
                                coverUrl={item.coverUrl}
                                slug={item.slug}
                                name={item.name}
                                theme={{
                                  bg: themeColors.background,
                                  fg: themeColors.text,
                                  accent: themeColors.primary,
                                }}
                                className="size-full"
                                imageClassName="group-hover:scale-[1.03]"
                              />

                              <div className="pointer-events-none absolute top-3 right-3 z-10 flex items-center gap-1.5">
                                {item.tier === "pro" ? (
                                  <ProBadge />
                                ) : (
                                  <Badge tone="published">Free</Badge>
                                )}
                                {isSelected && (
                                  <span className="inline-flex items-center gap-1 rounded-lg bg-[var(--cf-bg-accent)] px-2 py-1 text-[0.6875rem] font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
                                    <Check className="size-3" />
                                    Selected
                                  </span>
                                )}
                              </div>

                              {isLocked && (
                                <div className="bg-inverse/90 text-inverse-foreground type-caption absolute right-3 bottom-3 z-10 inline-flex items-center gap-1.5 rounded-lg px-3 py-1">
                                  <Lock className="size-3" />
                                  <span>Pro required</span>
                                </div>
                              )}
                            </div>
                          </div>

                          <div className="flex flex-col gap-3 p-5 pb-4">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-col gap-0.5">
                                <span className="v3-heading-s text-[var(--cf-text-primary)]">
                                  {item.name}
                                </span>
                                <span className="v3-body-s text-[var(--cf-text-secondary)]">
                                  {item.categoryName} · {item.sectionCount} sections ·{" "}
                                  {item.slotCount} screen slots
                                </span>
                              </div>
                              <div className="flex items-center gap-2">
                                <div
                                  aria-hidden="true"
                                  className="flex items-center -space-x-1 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-1"
                                >
                                  <span
                                    className="size-3 rounded-full border border-white/50"
                                    style={{ backgroundColor: themeColors.background }}
                                  />
                                  <span
                                    className="size-3 rounded-full border border-white/50"
                                    style={{ backgroundColor: themeColors.primary }}
                                  />
                                </div>
                              </div>
                            </div>
                          </div>
                        </button>

                        <div className="flex items-center gap-2.5 border-t border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)]/55 px-5 py-3.5">
                          <button
                            type="button"
                            className="v3-btn-secondary flex-1 py-2 text-xs font-semibold"
                            onClick={() => setPreviewItem(item)}
                          >
                            <Eye className="size-3.5" />
                            Preview
                          </button>

                          {isLocked ? (
                            <button
                              type="button"
                              className="v3-btn-lime flex-1 py-2 text-xs font-bold"
                              onClick={() =>
                                setUpgradePrompt({
                                  requiredPlan: "pro",
                                  title: `Unlock the ${item.name} Pro template`,
                                  description:
                                    "Pro templates require Casefolio Pro ($7.99/mo) or Teams ($5.99/seat/mo). Upgrade now to unlock every layout, custom Case Study URLs, and watermark-free exports.",
                                })
                              }
                            >
                              <Lock className="size-3.5" />
                              Upgrade
                            </button>
                          ) : (
                            <button
                              type="button"
                              className={cn(
                                "flex-1 py-2 text-xs font-semibold",
                                isSelected ? "v3-btn-primary" : "v3-btn-secondary",
                              )}
                              onClick={() => {
                                setSelectedTemplateId(item.id);
                                trackClientProductEvent("template_selected", {
                                  templateSlug: item.slug,
                                  templateTier: item.tier,
                                  projectType: selectedType,
                                  surface: "wizard_select_button",
                                });
                              }}
                            >
                              {isSelected ? (
                                <>
                                  <Check className="size-3.5" />
                                  Selected
                                </>
                              ) : (
                                "Select"
                              )}
                            </button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="flex flex-col-reverse items-stretch justify-between gap-4 rounded-[1.5rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-4 sm:flex-row sm:items-center sm:px-6">
              <button
                type="button"
                data-testid="wizard-back-to-type"
                onClick={() => setStep("type")}
                className="v3-btn-secondary py-2.5 text-sm"
              >
                Back
              </button>

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {selectedTemplate && (
                  <span className="rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-3.5 py-2 text-center text-xs font-semibold text-[var(--cf-text-primary)] sm:text-right">
                    Selected: {formatProjectTypeLabel(selectedType)} · {selectedTemplate.name}
                  </span>
                )}
                <button
                  type="button"
                  disabled={!selectedTemplate}
                  data-testid="wizard-next-to-details"
                  onClick={() => {
                    if (selectedTemplate) {
                      trackClientProductEvent("template_selected", {
                        templateSlug: selectedTemplate.slug,
                        templateTier: selectedTemplate.tier,
                        projectType: selectedType,
                        surface: "wizard_confirm",
                      });
                    }
                    setStep("details");
                  }}
                  className="v3-btn-primary py-2.5 pr-3 pl-5 text-sm disabled:pointer-events-none disabled:opacity-50"
                >
                  <span>Use this template</span>
                  <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
                    <ArrowRight className="size-3.5" />
                  </span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS */}
        {step === "details" && (
          <div
            data-testid="wizard-step-details"
            className="grid items-start gap-8 lg:grid-cols-[minmax(0,640px)_minmax(0,420px)] lg:justify-between"
          >
            <Card className="rounded-[2rem] border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-10">
              <form onSubmit={handleSubmitCreate} noValidate className="flex flex-col gap-6">
                <div className="flex flex-col items-start gap-3">
                  <Eyebrow>Step 3 of 3</Eyebrow>
                  <h1 className="v3-heading-m sm:v3-display-l text-[var(--cf-text-primary)]">
                    Name your case study
                  </h1>
                  <p className="v3-body-m text-[var(--cf-text-secondary)]">
                    This is what hiring leads see first. You can customize every slot, font, and
                    section later.
                  </p>
                </div>

                {submitError && (
                  <div
                    role="alert"
                    className="border-destructive/30 bg-destructive/10 text-destructive type-body-s flex items-start gap-2.5 rounded-xl border p-3.5"
                  >
                    <AlertCircle className="mt-0.5 size-4 shrink-0" />
                    <span>{submitError}</span>
                  </div>
                )}

                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-project-name">Project name *</Label>
                  <Input
                    id="wizard-project-name"
                    name="name"
                    required
                    placeholder="Mosaed — Smart debt management"
                    value={name}
                    aria-invalid={Boolean(fieldErrors.name)}
                    aria-describedby={
                      fieldErrors.name ? "wizard-project-name-error" : "wizard-project-name-hint"
                    }
                    onChange={(e) => {
                      setName(e.target.value);
                      if (fieldErrors.name) {
                        setFieldErrors((prev) => {
                          const next = { ...prev };
                          delete next.name;
                          return next;
                        });
                      }
                    }}
                  />
                  {fieldErrors.name ? (
                    <p id="wizard-project-name-error" className="text-destructive type-caption">
                      {fieldErrors.name}
                    </p>
                  ) : (
                    <p id="wizard-project-name-hint" className="text-tertiary type-caption">
                      Required · used as the page title and default URL slug
                    </p>
                  )}
                </div>

                <div className="flex flex-col gap-2">
                  <Label htmlFor="wizard-project-description">Short description</Label>
                  <Input
                    id="wizard-project-description"
                    name="description"
                    placeholder="One or two sentences about the project and its outcome"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wizard-project-client">Client</Label>
                    <Input
                      id="wizard-project-client"
                      name="client"
                      placeholder="Client or company"
                      value={client}
                      onChange={(e) => setClient(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wizard-project-role">Your role</Label>
                    <Input
                      id="wizard-project-role"
                      name="role"
                      placeholder="e.g. Lead product designer"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    />
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wizard-project-year">Year</Label>
                    <Input
                      id="wizard-project-year"
                      name="year"
                      placeholder="2026"
                      value={year}
                      onChange={(e) => setYear(e.target.value)}
                    />
                  </div>

                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wizard-project-tools">Tools</Label>
                    <Input
                      id="wizard-project-tools"
                      name="tools"
                      placeholder="Figma, Prototyping"
                      value={tools}
                      onChange={(e) => setTools(e.target.value)}
                    />
                  </div>
                </div>

                {spaces.length > 0 && (spaces.length > 1 || workspaceKind === "team") && (
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="wizard-project-space">
                      Destination space{workspaceName ? ` (${workspaceName})` : ""}
                    </Label>
                    <select
                      id="wizard-project-space"
                      data-testid="wizard-space-select"
                      value={selectedSpaceId}
                      onChange={(e) => setSelectedSpaceId(e.target.value)}
                      className="focus-visible:ring-ring/40 type-body-s h-11 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 text-[var(--cf-text-primary)] outline-none focus-visible:ring-2"
                    >
                      {spaces.map((sp) => (
                        <option key={sp.id} value={sp.id}>
                          {sp.name} —{" "}
                          {sp.visibility === "private"
                            ? "Private Space (only visible to you)"
                            : "Shared Team Space (visible to teammates)"}
                        </option>
                      ))}
                    </select>
                    <p className="text-tertiary type-caption">
                      Defaults to your Private Space so drafts stay invisible to teammates until you
                      move them to a Shared Space.
                    </p>
                  </div>
                )}

                <div className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-4 py-3 text-xs text-[var(--cf-text-secondary)]">
                  <div className="flex items-center gap-3">
                    {selectedTemplate && (
                      <TemplateThumbnail
                        coverUrl={selectedTemplate.coverUrl}
                        slug={selectedTemplate.slug}
                        name={selectedTemplate.name}
                        hideFallbackLabel
                        className="aspect-[4/3] w-13 shrink-0 rounded-lg border border-[var(--cf-border-subtle)]"
                      />
                    )}
                    <span>
                      Template:{" "}
                      <strong className="font-semibold text-[var(--cf-text-primary)]">
                        {selectedTemplate
                          ? `${selectedTemplate.name} (v${selectedTemplate.version})`
                          : "None selected"}
                      </strong>{" "}
                      · {formatProjectTypeLabel(selectedType)}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setStep("template")}
                    className="v3-btn-secondary shrink-0 px-3 py-1.5 text-xs font-semibold"
                  >
                    Change
                  </button>
                </div>

                <div className="flex flex-col-reverse items-stretch justify-between gap-3 border-t border-[var(--cf-border-subtle)] pt-5 sm:flex-row sm:items-center">
                  <button
                    type="button"
                    data-testid="wizard-back-to-template"
                    onClick={() => setStep("template")}
                    className="v3-btn-secondary py-2.5 text-sm"
                  >
                    Back
                  </button>

                  <button
                    type="submit"
                    disabled={isPending || isFreeQuotaReached || !selectedTemplate}
                    data-testid="wizard-submit-create"
                    className="v3-btn-primary py-2.5 pr-3 pl-5 text-sm disabled:pointer-events-none disabled:opacity-50"
                  >
                    <span>{isPending ? "Creating project..." : "Create case study"}</span>
                    {!isPending && (
                      <span className="inline-flex size-6 items-center justify-center rounded-md bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
                        <ArrowRight className="size-3.5" />
                      </span>
                    )}
                  </button>
                </div>
              </form>
            </Card>

            {/* Studio Live Cover Preview */}
            <aside aria-label="Live cover preview" className="flex flex-col gap-3">
              <div className="flex items-center justify-between gap-2">
                <Eyebrow>Cover preview</Eyebrow>
                <span className="v3-label text-[var(--cf-text-tertiary)] uppercase">
                  Auto-synced
                </span>
              </div>

              <div className="overflow-hidden rounded-[2rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)]">
                {/* Architectural Spec Chrome */}
                <div className="flex items-center justify-between gap-2 border-b border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-4 py-3">
                  <div className="flex min-w-0 items-center gap-2">
                    <span className="inline-flex shrink-0 items-center rounded-md bg-[var(--cf-ink)] px-2 py-0.5 font-mono text-[0.6875rem] font-bold text-[var(--cf-text-on-ink)] uppercase">
                      URL
                    </span>
                    <p className="truncate font-mono text-[0.6875rem] text-[var(--cf-text-tertiary)]">
                      casefolio.app/p/{slugPreview}
                    </p>
                  </div>
                </div>

                <div
                  style={{
                    ...previewThemeStyle,
                    backgroundColor: "var(--tpl-color-background, var(--color-inverse))",
                    color: "var(--tpl-color-text, var(--color-inverse-foreground))",
                  }}
                  className="flex flex-col gap-4 p-7 sm:p-8"
                >
                  <span
                    style={{ color: "var(--tpl-color-primary, var(--color-primary))" }}
                    className="type-overline"
                  >
                    CASE STUDY · {year.trim() || "2026"}
                  </span>

                  <h2 className="type-heading-l line-clamp-3">
                    {name.trim() || "Untitled case study"}
                  </h2>

                  <p
                    style={{ color: "var(--tpl-color-textMuted, var(--color-tertiary))" }}
                    className="type-body-s"
                  >
                    {[client.trim() || "Client", role.trim() || "Lead product designer"].join(
                      " · ",
                    )}
                  </p>

                  {selectedTemplate ? (
                    <TemplateThumbnail
                      testId="wizard-step3-cover-preview"
                      coverUrl={selectedTemplate.coverUrl}
                      slug={selectedTemplate.slug}
                      name={selectedTemplate.name}
                      theme={{
                        bg: selectedTemplate.document.template.theme.colors.background,
                        fg: selectedTemplate.document.template.theme.colors.text,
                        accent: selectedTemplate.document.template.theme.colors.primary,
                      }}
                      className="border-border/30 mt-2 aspect-[4/3] w-full rounded-xl border"
                    />
                  ) : (
                    <div
                      style={{ backgroundColor: "var(--tpl-color-primary, var(--color-primary))" }}
                      className="mt-2 h-44 w-full rounded-xl opacity-95"
                    />
                  )}
                </div>
              </div>
            </aside>
          </div>
        )}
      </main>

      {/* Template Preview Modal */}
      <Dialog
        open={previewItem !== null}
        onOpenChange={(open) => {
          if (!open) setPreviewItem(null);
        }}
      >
        <DialogContent className="max-w-5xl">
          {previewItem && (
            <>
              <DialogHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <DialogTitle>{previewItem.name}</DialogTitle>
                  {previewItem.tier === "pro" ? <ProBadge /> : <Badge tone="published">Free</Badge>}
                  <Badge tone="neutral" withDot={false}>
                    v{previewItem.version}
                  </Badge>
                </div>
                <DialogDescription>
                  {formatProjectTypeLabel(previewItem.type)} · {previewItem.sectionCount} sections ·{" "}
                  {previewItem.slotCount} ratio-locked slots
                </DialogDescription>
              </DialogHeader>

              <div className="border-border max-h-[65vh] overflow-y-auto rounded-xl border">
                <TemplatePuckRenderer document={previewItem.document} />
              </div>

              <DialogFooter>
                <Button type="button" variant="secondary" onClick={() => setPreviewItem(null)}>
                  Close
                </Button>
                {previewItem.tier === "free" || canUseProTemplates ? (
                  <Button
                    type="button"
                    onClick={() => {
                      setSelectedTemplateId(previewItem.id);
                      setPreviewItem(null);
                      setStep("details");
                    }}
                  >
                    Select {previewItem.name}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    onClick={() => {
                      const tplName = previewItem.name;
                      setPreviewItem(null);
                      setUpgradePrompt({
                        requiredPlan: "pro",
                        title: `Unlock the ${tplName} Pro template`,
                        description:
                          "Pro templates require Casefolio Pro ($7.99/mo) or Teams ($5.99/seat/mo). Upgrade now to unlock every layout, custom Case Study URLs, and watermark-free exports.",
                      });
                    }}
                  >
                    <Lock className="size-4" />
                    Upgrade to Pro
                  </Button>
                )}
              </DialogFooter>
            </>
          )}
        </DialogContent>
      </Dialog>

      <UpgradePromptDialog
        open={upgradePrompt !== null}
        onOpenChange={(open) => {
          if (!open) setUpgradePrompt(null);
        }}
        requiredPlan={upgradePrompt?.requiredPlan ?? "pro"}
        featureTitle={upgradePrompt?.title}
        featureDescription={upgradePrompt?.description}
      />
    </div>
  );
}
