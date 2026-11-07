"use client";

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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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

export type WizardStepKey = "type" | "template" | "details";

const WIZARD_STEPS: ReadonlyArray<{ key: WizardStepKey; number: number; label: string }> = [
  { key: "type", number: 1, label: "Type" },
  { key: "template", number: 2, label: "Template" },
  { key: "details", number: 3, label: "Details" },
];

function formatProjectTypeLabel(type: TemplateProjectType): string {
  if (type === "mobile") return "Mobile app";
  if (type === "web") return "Website";
  return "Mobile & Web";
}

export interface CreateProjectWizardProps {
  templates: PublishedTemplateItem[];
  userPlan: "free" | "pro" | "team";
  existingProjectCount: number;
  initialStep?: WizardStepKey;
  initialTemplateSlug?: string;
  initialDesignFocus?: TemplateProjectType | null;
  onCreateProject: (input: CreateProjectInput) => Promise<CreateProjectResult>;
}

export function CreateProjectWizard({
  templates,
  userPlan,
  existingProjectCount,
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
  } | null>(null);

  const canUseProTemplates = can(userPlan, "pro_templates");
  const isFreeQuotaReached = !can(userPlan, "create_project", {
    projectsCount: existingProjectCount,
  });

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
    <div className="bg-surface text-foreground flex min-h-screen flex-col">
      {/* Top Flow Bar (matches Figma 2:3963 / 2:4162) */}
      <header className="border-border bg-background sticky top-0 z-40 border-b">
        <div className="mx-auto grid h-17 max-w-7xl grid-cols-[minmax(0,1fr)_auto] items-center gap-3 px-4 sm:px-8 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
          <div className="flex max-w-full min-w-0 items-center gap-3 justify-self-start">
            <button
              type="button"
              onClick={handleFlowBack}
              aria-label="Go back"
              className="border-border bg-elevated text-foreground hover:bg-surface focus-visible:ring-ring/40 inline-flex size-9 shrink-0 items-center justify-center rounded-full border transition-colors outline-none focus-visible:ring-2"
            >
              <ArrowLeft className="size-4" />
            </button>
            <span className="text-foreground type-body-m-strong min-w-0 truncate">
              {name.trim() || "New project"}
            </span>
          </div>

          <nav
            aria-label="Create project steps"
            className="hidden shrink-0 items-center gap-3 justify-self-center md:flex"
          >
            {WIZARD_STEPS.map((item, idx) => {
              const isCompleted = idx < stepIndex;
              const isCurrent = item.key === step;
              const canJump =
                item.key === "type" ||
                item.key === "template" ||
                (item.key === "details" && Boolean(selectedTemplate));

              return (
                <div key={item.key} className="flex items-center gap-3">
                  <button
                    type="button"
                    disabled={!canJump}
                    onClick={() => canJump && setStep(item.key)}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn(
                      "focus-visible:ring-ring/40 inline-flex items-center gap-2 rounded-full px-2 py-1 transition-colors outline-none focus-visible:ring-2 disabled:cursor-not-allowed",
                      isCurrent
                        ? "text-foreground type-body-s-strong"
                        : isCompleted
                          ? "text-foreground type-body-s"
                          : "text-tertiary type-body-s",
                    )}
                  >
                    <span
                      className={cn(
                        "inline-flex size-6 items-center justify-center rounded-full text-xs font-semibold",
                        isCompleted && "bg-success text-success-foreground",
                        isCurrent && "bg-inverse text-inverse-foreground",
                        !isCompleted && !isCurrent && "bg-sunken text-tertiary",
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
                        "h-px w-8",
                        idx < stepIndex ? "bg-success" : "bg-border",
                      )}
                    />
                  )}
                </div>
              );
            })}
          </nav>

          <div className="flex shrink-0 items-center gap-2 justify-self-end">
            <Badge tone="neutral" withDot={false} className="md:hidden">
              Step {stepIndex + 1}/3
            </Badge>
            <Button asChild variant="ghost" size="sm">
              <Link href="/dashboard">Exit</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main id="main-content" className="mx-auto flex w-full max-w-6xl flex-1 flex-col px-4 py-8 sm:px-8 sm:py-12">
        {isFreeQuotaReached && (
          <div
            role="alert"
            data-testid="plan-limit-banner"
            className="border-warning/40 bg-warning/10 text-foreground mb-8 flex flex-col justify-between gap-4 rounded-xl border p-4 sm:flex-row sm:items-center"
          >
            <div className="flex items-start gap-3">
              <AlertCircle className="text-warning mt-0.5 size-5 shrink-0" />
              <div className="flex flex-col gap-0.5">
                <p className="type-body-s-strong">
                  You&apos;ve reached the Free plan limit ({existingProjectCount} of{" "}
                  {FREE_PROJECT_LIMIT} projects).
                </p>
                <p className="text-muted-foreground type-body-s">
                  Upgrade to Pro for unlimited case studies, Pro templates, and watermark-free PDF
                  &amp; Behance exports.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              className="w-fit shrink-0"
              onClick={() =>
                setUpgradePrompt({
                  title: "Unlock unlimited case studies",
                  description: `Free plan includes up to ${FREE_PROJECT_LIMIT} projects. Upgrade to Casefolio Pro for unlimited projects, Pro templates, and watermark-free PDF exports.`,
                })
              }
            >
              Upgrade to Pro
            </Button>
          </div>
        )}

        {/* STEP 1: TYPE */}
        {step === "type" && (
          <div data-testid="wizard-step-type" className="flex flex-1 flex-col justify-between gap-10">
            <div className="flex flex-col gap-8">
              <div className="flex flex-col gap-2">
                <span className="text-primary type-overline">Step 1 of 3</span>
                <h1 className="type-display-m sm:type-display-l text-foreground">
                  What are you presenting?
                </h1>
                <p className="text-muted-foreground type-body-m">
                  Pick a type to see the templates available for it.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Project type"
                className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
              >
                <button
                  type="button"
                  role="radio"
                  aria-checked={selectedType === "mobile"}
                  data-testid="type-card-mobile"
                  onClick={() => handleSelectType("mobile")}
                  className="focus-visible:ring-ring/40 rounded-xl text-left outline-none focus-visible:ring-2"
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
                  className="focus-visible:ring-ring/40 rounded-xl text-left outline-none focus-visible:ring-2"
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
                  className="focus-visible:ring-ring/40 rounded-xl text-left outline-none focus-visible:ring-2"
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

            <div className="border-border flex flex-col-reverse items-stretch justify-between gap-3 border-t pt-6 sm:flex-row sm:items-center">
              <Button asChild variant="secondary" size="lg">
                <Link href="/dashboard">Cancel</Link>
              </Button>

              <Button
                type="button"
                size="lg"
                data-testid="wizard-next-to-template"
                onClick={() => setStep("template")}
              >
                Continue to templates
                <ArrowRight className="size-4" />
              </Button>
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
              <div className="flex flex-col gap-2">
                <span className="text-primary type-overline">Step 2 of 3</span>
                <div className="flex flex-wrap items-center gap-3">
                  <h1 className="type-display-m sm:type-display-l text-foreground">
                    {formatProjectTypeLabel(selectedType)} templates
                  </h1>
                  <Badge tone="neutral" withDot={false} className="w-fit">
                    From Casefolio library
                  </Badge>
                </div>
                <p className="text-muted-foreground type-body-m">
                  Templates are designed by the Casefolio team — you choose, then customise.
                </p>
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
                  className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3"
                >
                  {compatibleTemplates.map((item) => {
                    const isLocked = item.tier === "pro" && !canUseProTemplates;
                    const isSelected = selectedTemplateId === item.id;
                    const tplThemeStyle = buildTemplateThemeStyle(item.document.template.theme);

                    return (
                      <article
                        key={item.id}
                        data-slot="wizard-template-card"
                        data-template-slug={item.slug}
                        data-selected={isSelected ? "true" : "false"}
                        data-locked={isLocked ? "true" : "false"}
                        className={cn(
                          "bg-card flex flex-col justify-between gap-4 rounded-xl border p-4 transition-all",
                          isSelected
                            ? "border-primary shadow-card border-2"
                            : "border-border hover:border-border-strong",
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
                          className="focus-visible:ring-ring/40 flex flex-col gap-3.5 text-left outline-none focus-visible:ring-2 disabled:cursor-not-allowed"
                        >
                          <div
                            style={{
                              ...tplThemeStyle,
                              backgroundColor: "var(--tpl-color-background)",
                              color: "var(--tpl-color-text)",
                            }}
                            className="border-border/30 relative flex aspect-[4/3] w-full flex-col justify-between overflow-hidden rounded-lg border p-5"
                          >
                            {item.coverUrl && item.coverUrl.startsWith("/") && (
                              <img
                                src={item.coverUrl}
                                alt=""
                                aria-hidden="true"
                                className="pointer-events-none absolute inset-0 size-full object-cover opacity-80"
                              />
                            )}
                            <div className="relative z-10 flex items-center justify-between gap-2">
                              <span
                                style={{ color: "var(--tpl-color-primary)" }}
                                className="type-heading-m select-none"
                              >
                                Aa
                              </span>
                              <div className="flex items-center gap-1.5">
                                {item.tier === "pro" ? (
                                  <ProBadge />
                                ) : (
                                  <Badge tone="published">Free</Badge>
                                )}
                                {isSelected && (
                                  <span className="bg-primary text-primary-foreground inline-flex size-6 items-center justify-center rounded-full">
                                    <Check className="size-3.5" />
                                  </span>
                                )}
                              </div>
                            </div>

                            {!item.coverUrl?.startsWith("/") && (
                              <div className="flex items-end justify-end gap-3 pt-4">
                                <div
                                  aria-hidden="true"
                                  style={{ backgroundColor: "var(--tpl-color-primary)" }}
                                  className="h-24 w-16 rounded-t-lg opacity-90"
                                />
                                <div
                                  aria-hidden="true"
                                  style={{ backgroundColor: "var(--tpl-color-surface)" }}
                                  className="h-28 w-16 rounded-t-lg"
                                />
                              </div>
                            )}

                            {isLocked && (
                              <div className="bg-inverse/90 text-inverse-foreground type-caption absolute right-3 bottom-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1">
                                <Lock className="size-3" />
                                <span>Pro required</span>
                              </div>
                            )}
                          </div>

                          <div className="flex flex-col gap-1 px-1">
                            <div className="flex items-center justify-between gap-2">
                              <span className="text-foreground type-heading-s truncate">
                                {item.name}
                              </span>
                              <Badge tone="neutral" withDot={false}>
                                v{item.version}
                              </Badge>
                            </div>
                            <span className="text-tertiary type-caption">
                              {item.sectionCount} sections · {item.slotCount} screen slots
                            </span>
                          </div>
                        </button>

                        <div className="border-border flex items-center gap-2 border-t pt-3">
                          <Button
                            type="button"
                            variant="secondary"
                            size="sm"
                            className="flex-1"
                            onClick={() => setPreviewItem(item)}
                          >
                            <Eye className="size-3.5" />
                            Preview
                          </Button>

                          {isLocked ? (
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="flex-1"
                              onClick={() =>
                                setUpgradePrompt({
                                  title: `Unlock the ${item.name} Pro template`,
                                  description:
                                    "Pro templates require Casefolio Pro or Team. Upgrade now to unlock every layout immediately.",
                                })
                              }
                            >
                              <Lock className="size-3.5" />
                              Upgrade
                            </Button>
                          ) : (
                            <Button
                              type="button"
                              variant={isSelected ? "default" : "outline"}
                              size="sm"
                              className="flex-1"
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
                              {isSelected ? "Selected" : "Select"}
                            </Button>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="border-border flex flex-col-reverse items-stretch justify-between gap-4 border-t pt-6 sm:flex-row sm:items-center">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                data-testid="wizard-back-to-type"
                onClick={() => setStep("type")}
              >
                Back
              </Button>

              <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
                {selectedTemplate && (
                  <span className="text-muted-foreground type-body-s text-center sm:text-right">
                    Selected: {formatProjectTypeLabel(selectedType)} · {selectedTemplate.name}
                  </span>
                )}
                <Button
                  type="button"
                  size="lg"
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
                >
                  Use this template
                  <ArrowRight className="size-4" />
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: DETAILS (matches Figma 2:3962) */}
        {step === "details" && (
          <div
            data-testid="wizard-step-details"
            className="grid items-start gap-8 lg:grid-cols-[minmax(0,640px)_minmax(0,400px)] lg:justify-between"
          >
            <Card className="p-6 sm:p-10">
              <form onSubmit={handleSubmitCreate} noValidate className="flex flex-col gap-6">
                <div className="flex flex-col gap-2">
                  <span className="text-primary type-overline">Step 3 of 3</span>
                  <h1 className="type-display-m text-foreground">Name your case study</h1>
                  <p className="text-muted-foreground type-body-m">
                    This is what visitors see first. You can change everything later.
                  </p>
                </div>

                {submitError && (
                  <div
                    role="alert"
                    className="border-destructive/30 bg-destructive/10 text-destructive type-body-s flex items-start gap-2.5 rounded-lg border p-3.5"
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

                <div className="bg-sunken text-muted-foreground type-caption flex items-center justify-between gap-3 rounded-lg px-3.5 py-2.5">
                  <span>
                    Template:{" "}
                    <strong className="text-foreground">
                      {selectedTemplate
                        ? `${selectedTemplate.name} (v${selectedTemplate.version})`
                        : "None selected"}
                    </strong>{" "}
                    · {formatProjectTypeLabel(selectedType)}
                  </span>
                  <button
                    type="button"
                    onClick={() => setStep("template")}
                    className="text-primary hover:underline"
                  >
                    Change
                  </button>
                </div>

                <div className="border-border flex flex-col-reverse items-stretch justify-between gap-3 border-t pt-5 sm:flex-row sm:items-center">
                  <Button
                    type="button"
                    variant="secondary"
                    size="lg"
                    data-testid="wizard-back-to-template"
                    onClick={() => setStep("template")}
                  >
                    Back
                  </Button>

                  <Button
                    type="submit"
                    size="lg"
                    disabled={isPending || isFreeQuotaReached || !selectedTemplate}
                    data-testid="wizard-submit-create"
                  >
                    {isPending ? "Creating project..." : "Create case study"}
                    {!isPending && <ArrowRight className="size-4" />}
                  </Button>
                </div>
              </form>
            </Card>

            {/* Live Preview Mini Cover (matches Figma 2:4053) */}
            <aside aria-label="Live cover preview" className="flex flex-col gap-3">
              <span className="text-tertiary type-overline">Live preview</span>

              <div
                style={{
                  ...previewThemeStyle,
                  backgroundColor: "var(--tpl-color-background, var(--color-inverse))",
                  color: "var(--tpl-color-text, var(--color-inverse-foreground))",
                }}
                className="shadow-card flex flex-col gap-4 rounded-2xl p-8"
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
                  {[client.trim() || "Client", role.trim() || "Lead product designer"].join(" · ")}
                </p>

                <div
                  style={{ backgroundColor: "var(--tpl-color-primary, var(--color-primary))" }}
                  className="mt-2 h-44 w-full rounded-xl opacity-95"
                />
              </div>

              <p className="text-tertiary type-caption truncate">
                casefolio.app/p/{slugPreview}
              </p>
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
                        title: `Unlock the ${tplName} Pro template`,
                        description:
                          "Pro templates require Casefolio Pro or Team. Upgrade now to unlock every layout immediately.",
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
        featureTitle={upgradePrompt?.title}
        featureDescription={upgradePrompt?.description}
      />
    </div>
  );
}
