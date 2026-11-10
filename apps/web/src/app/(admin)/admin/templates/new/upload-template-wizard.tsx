"use client";

import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  FileJson,
  Sparkles,
  Upload,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition, type ChangeEvent } from "react";
import { TemplateCoverUploader } from "@/components/admin/template-cover-uploader";
import { TemplatePuckRenderer } from "@/components/editor/puck-config";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { StepIndicator, type StepState } from "@/components/ui/step-indicator";
import {
  normalizeRawTemplateJsonCoverIfMissing,
  parseAndValidateTemplateJson,
  type ParseTemplateJsonResult,
  type SaveTemplateDraftResult,
  type WizardMetadataInput,
} from "@/lib/template/parse";
import type { PutBinaryTransport } from "@/lib/storage/client-upload";
import type {
  TemplateProjectType,
  TemplateTier,
  TemplateValidationIssue,
} from "@/lib/template/schema";
import { cn } from "@/lib/utils";

const WIZARD_STEPS = [
  { step: 1, label: "Upload JSON", subtitle: "Step 1 of 4 · Upload or paste converter JSON." },
  {
    step: 2,
    label: "Validate",
    subtitle: "Step 2 of 4 · Verify schema, image slot ratios, and theme tokens.",
  },
  {
    step: 3,
    label: "Preview",
    subtitle: "Step 3 of 4 · Inspect live Puck rendering before saving.",
  },
  {
    step: 4,
    label: "Metadata & Save",
    subtitle: "Step 4 of 4 · Set category, tier, and cover, then save as draft v1.0.0.",
  },
] as const;

const TYPE_OPTIONS: ReadonlyArray<{ value: TemplateProjectType; label: string }> = [
  { value: "mobile", label: "Mobile app" },
  { value: "web", label: "Website" },
  { value: "both", label: "Both" },
];

export interface CategoryOption {
  id: string;
  name: string;
  slug: string;
}

export interface UploadTemplateWizardProps {
  categories: CategoryOption[];
  saveDraftAction: (payload: {
    rawJson: string;
    metadata: WizardMetadataInput;
  }) => Promise<SaveTemplateDraftResult>;
  coverPutTransport?: PutBinaryTransport;
}

export function UploadTemplateWizard({
  categories,
  saveDraftAction,
  coverPutTransport,
}: UploadTemplateWizardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [currentStep, setCurrentStep] = useState<1 | 2 | 3 | 4>(1);
  const [rawJson, setRawJson] = useState("");
  const [uploadedFileName, setUploadedFileName] = useState<string | null>(null);
  const [validationResult, setValidationResult] = useState<ParseTemplateJsonResult | null>(null);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [projectType, setProjectType] = useState<TemplateProjectType>("mobile");
  const [category, setCategory] = useState("");
  const [tier, setTier] = useState<TemplateTier>("free");
  const [coverUrl, setCoverUrl] = useState("");
  const [hasCustomCover, setHasCustomCover] = useState(false);
  const [coverRatio, setCoverRatio] = useState("4:3");
  const [changelog, setChangelog] = useState("Initial draft import (v1.0.0)");

  const [serverError, setServerError] = useState<string | null>(null);
  const [serverIssues, setServerIssues] = useState<TemplateValidationIssue[]>([]);

  function handleCoverUrlChange(nextUrl: string) {
    setCoverUrl(nextUrl);
    setHasCustomCover(nextUrl.trim().length > 0);
    setServerError(null);
  }

  function populateMetadataFromJson(result: ParseTemplateJsonResult, coverWasMissing: boolean) {
    if (!result.ok) return;
    const tpl = result.data.template;
    setName(tpl.name);
    setSlug(tpl.slug);
    setProjectType(tpl.type);
    setCategory(tpl.category);
    setTier(tpl.tier);
    if (!hasCustomCover) {
      setCoverUrl(coverWasMissing ? "" : tpl.cover.src);
    }
    setCoverRatio(tpl.cover.ratio);
  }

  function tryPrefillMetadataFromJsonText(jsonText: string) {
    try {
      const parsedObj = JSON.parse(jsonText) as {
        template?: {
          name?: unknown;
          slug?: unknown;
          type?: unknown;
          category?: unknown;
          tier?: unknown;
          cover?: { src?: unknown; ratio?: unknown };
        };
      };
      const tpl = parsedObj?.template;
      if (!tpl || typeof tpl !== "object") return;
      if (typeof tpl.name === "string" && tpl.name.trim()) setName(tpl.name.trim());
      if (typeof tpl.slug === "string" && tpl.slug.trim()) setSlug(tpl.slug.trim());
      if (tpl.type === "mobile" || tpl.type === "web" || tpl.type === "both") {
        setProjectType(tpl.type);
      }
      if (typeof tpl.category === "string" && tpl.category.trim()) {
        setCategory(tpl.category.trim());
      }
      if (tpl.tier === "free" || tpl.tier === "pro") {
        setTier(tpl.tier);
      }
      if (!hasCustomCover) {
        const rawSrc = typeof tpl.cover?.src === "string" ? tpl.cover.src.trim() : "";
        setCoverUrl(rawSrc);
      }
      if (typeof tpl.cover?.ratio === "string" && tpl.cover.ratio.trim()) {
        setCoverRatio(tpl.cover.ratio.trim());
      }
    } catch {
      // Ignore partial/invalid JSON while typing
    }
  }

  async function handleFileSelect(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setUploadedFileName(file.name);
    setRawJson(text);
    tryPrefillMetadataFromJsonText(text);
    setServerError(null);
    setServerIssues([]);
  }

  function handleValidateAndAdvance() {
    const { normalizedJson, coverWasMissing } = normalizeRawTemplateJsonCoverIfMissing(rawJson);
    const parsed = parseAndValidateTemplateJson(normalizedJson);
    setValidationResult(parsed);
    setServerError(null);
    setServerIssues([]);
    if (parsed.ok) {
      populateMetadataFromJson(parsed, coverWasMissing);
    }
    setCurrentStep(2);
  }

  const previewDocument = useMemo(() => {
    if (!validationResult?.ok) return null;
    return {
      ...validationResult.data,
      template: {
        ...validationResult.data.template,
        name: name || validationResult.data.template.name,
        slug: slug || validationResult.data.template.slug,
        type: projectType,
        category: category || validationResult.data.template.category,
        tier,
        cover: {
          src: coverUrl.trim() || validationResult.data.template.cover.src,
          ratio: coverRatio || validationResult.data.template.cover.ratio,
        },
      },
    };
  }, [validationResult, name, slug, projectType, category, tier, coverUrl, coverRatio]);

  function handleSaveDraft() {
    setServerError(null);
    setServerIssues([]);

    if (!coverUrl.trim()) {
      setServerError("A cover / thumbnail image is required when adding a template.");
      setServerIssues([
        {
          path: "metadata.coverUrl",
          message: "Upload a PNG, JPG, or WebP cover image (or enter a valid cover URL) before saving.",
        },
      ]);
      return;
    }

    startTransition(async () => {
      const result = await saveDraftAction({
        rawJson,
        metadata: {
          name,
          slug,
          type: projectType,
          category,
          tier,
          coverUrl: coverUrl.trim(),
          coverRatio,
          changelog,
        },
      });

      if (!result.ok) {
        setServerError(result.error);
        setServerIssues(result.issues);
        return;
      }

      router.push(`/admin/templates/${result.templateId}`);
      router.refresh();
    });
  }

  const activeStepMeta = WIZARD_STEPS[currentStep - 1]!;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-8">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <Eyebrow className="w-fit">Template Importer</Eyebrow>
          <h1 className="text-foreground type-display-m">Upload template</h1>
          <p className="text-muted-foreground type-body-m">{activeStepMeta.subtitle}</p>
        </div>

        <Button asChild variant="ghost" size="sm">
          <Link href="/admin/templates">Cancel</Link>
        </Button>
      </header>

      <nav
        aria-label="Template upload steps"
        className="border-border/80 bg-elevated shadow-card flex flex-wrap items-center gap-4 rounded-full border px-6 py-3.5 sm:gap-8"
      >
        {WIZARD_STEPS.map((item) => {
          const state: StepState =
            item.step < currentStep ? "done" : item.step === currentStep ? "current" : "upcoming";
          return (
            <StepIndicator key={item.step} step={item.step} label={item.label} state={state} />
          );
        })}
      </nav>

      {currentStep === 1 && (
        <section className="border-border/80 bg-elevated shadow-card flex flex-col gap-6 rounded-3xl border p-6 sm:p-8">
          <div className="flex flex-col gap-1.5">
            <h2 className="text-foreground type-heading-m">Template JSON source</h2>
            <p className="text-muted-foreground type-body-s">
              Upload a `.json` file exported via the Figma-to-Puck converter or paste raw JSON
              directly below.
            </p>
          </div>

          <label
            htmlFor="template-json-file"
            className="border-border-strong/80 bg-surface/60 hover:border-primary/60 hover:bg-accent/20 flex cursor-pointer flex-col items-center justify-center gap-3 rounded-2xl border border-dashed p-8 text-center transition-colors"
          >
            <span className="bg-accent text-accent-foreground inline-flex size-12 items-center justify-center rounded-2xl">
              <Upload className="size-5" />
            </span>
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-m-strong">
                {uploadedFileName ? `Loaded: ${uploadedFileName}` : "Choose a template .json file"}
              </span>
              <span className="text-tertiary type-caption">
                Matches `packages/template-schema` (`template` + `puck` + `warnings`)
              </span>
            </div>
            <input
              id="template-json-file"
              type="file"
              accept=".json,application/json"
              aria-label="Upload template JSON file"
              onChange={handleFileSelect}
              className="sr-only"
            />
          </label>

          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <label htmlFor="template-json-textarea" className="text-foreground type-body-s-strong">
                Raw JSON payload
              </label>
              <span className="text-tertiary type-caption inline-flex items-center gap-1.5">
                <FileJson className="size-3.5" />
                {rawJson.trim().length > 0 ? `${rawJson.length} chars` : "Empty"}
              </span>
            </div>
            <textarea
              id="template-json-textarea"
              aria-label="Template JSON"
              rows={10}
              value={rawJson}
              onChange={(event) => setRawJson(event.target.value)}
              placeholder='{ "template": { ... }, "puck": { ... }, "warnings": [] }'
              className="border-border/80 bg-surface/40 text-foreground type-body-s focus-visible:ring-ring/40 w-full rounded-2xl border p-4 font-mono outline-none focus-visible:ring-2"
            />
          </div>

          <TemplateCoverUploader
            coverUrl={coverUrl}
            onCoverUrlChange={handleCoverUrlChange}
            coverRatio={coverRatio}
            onCoverRatioChange={setCoverRatio}
            templateName={name || "New template"}
            templateSlug={slug || undefined}
            required
            putTransport={coverPutTransport}
          />

          <div className="border-border/70 flex items-center justify-end gap-3 border-t pt-5">
            <Button type="button" onClick={handleValidateAndAdvance}>
              Validate JSON
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      )}

      {currentStep === 2 && validationResult && (
        <section className="flex flex-col gap-6">
          {!validationResult.ok ? (
            <div
              role="alert"
              data-testid="validation-error-panel"
              className="border-destructive/30 bg-destructive-soft flex flex-col gap-4 rounded-3xl border p-6"
            >
              <div className="flex items-start gap-3">
                <AlertCircle className="text-destructive mt-0.5 size-5 shrink-0" />
                <div className="flex flex-col gap-1">
                  <h2 className="text-destructive type-heading-s">
                    Validation failed ({validationResult.issues.length}{" "}
                    {validationResult.issues.length === 1 ? "error" : "errors"})
                  </h2>
                  <p className="text-foreground type-body-s">
                    Fix the field-level schema issues below before previewing or saving this
                    template.
                  </p>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {validationResult.issues.map((issue, idx) => (
                  <li
                    key={`${issue.path}-${idx}`}
                    data-testid="validation-issue"
                    className="border-border/80 bg-elevated flex flex-col gap-1 rounded-2xl border p-3.5 sm:flex-row sm:items-baseline sm:gap-3"
                  >
                    <code className="bg-sunken text-foreground type-caption shrink-0 rounded-md px-2 py-0.5 font-mono">
                      {issue.path}
                    </code>
                    <span className="text-muted-foreground type-body-s">{issue.message}</span>
                  </li>
                ))}
              </ul>

              <div className="flex items-center justify-between pt-2">
                <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="size-4" />
                  Edit JSON
                </Button>
                <Button type="button" disabled>
                  Continue to preview
                </Button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col gap-6">
              <div
                data-testid="validation-success-panel"
                className="border-success/30 bg-success-soft flex flex-col justify-between gap-4 rounded-3xl border p-5 sm:flex-row sm:items-center"
              >
                <div className="flex items-center gap-3">
                  <CheckCircle2 className="text-success size-5 shrink-0" />
                  <div className="flex flex-col">
                    <span className="text-foreground type-body-m-strong">
                      Schema validated cleanly
                    </span>
                    <span className="text-muted-foreground type-body-s">
                      {validationResult.summary.sectionCount} sections ·{" "}
                      {validationResult.summary.slotCount} locked-ratio image slots ·{" "}
                      {Object.keys(validationResult.data.template.theme.colors).length} theme tokens
                    </span>
                  </div>
                </div>
                <Badge tone="published">Valid JSON</Badge>
              </div>

              <div className="grid gap-6 lg:grid-cols-12">
                <div className="border-border/80 bg-elevated shadow-card flex flex-col gap-4 rounded-3xl border p-6 lg:col-span-7">
                  <div className="flex items-center justify-between">
                    <h2 className="text-foreground type-heading-s">
                      Sections in editor order ({validationResult.summary.sectionCount})
                    </h2>
                    <span className="text-tertiary type-caption">Fields-only constrained</span>
                  </div>

                  <ul className="flex flex-col gap-2.5">
                    {validationResult.data.puck.content.map((section, idx) => (
                      <li
                        key={section.props.id}
                        className="border-border/70 bg-surface/60 flex items-center justify-between gap-3 rounded-2xl border px-4 py-3"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-tertiary type-caption font-mono">0{idx + 1}</span>
                          <span className="text-foreground type-body-s-strong">{section.type}</span>
                          <code className="text-tertiary type-caption font-mono">
                            {section.props.id}
                          </code>
                        </div>
                        <Badge tone={section.props.hidden ? "neutral" : "published"}>
                          {section.props.hidden ? "Hidden" : "Visible by default"}
                        </Badge>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="border-border/80 bg-elevated shadow-card flex flex-col gap-4 rounded-3xl border p-6 lg:col-span-5">
                  <h2 className="text-foreground type-heading-s">
                    Image slots ({validationResult.summary.slotCount})
                  </h2>
                  <ul className="flex flex-col gap-2.5">
                    {Object.entries(validationResult.data.template.slots).map(([key, slot]) => (
                      <li
                        key={key}
                        className="border-border/70 bg-surface/60 flex items-center justify-between gap-2 rounded-2xl border px-3.5 py-2.5"
                      >
                        <code className="text-foreground type-caption font-mono">{key}</code>
                        <div className="flex items-center gap-2">
                          <Badge tone="neutral" withDot={false}>
                            {slot.ratio}
                          </Badge>
                          {slot.device && (
                            <Badge tone="accent" withDot={false}>
                              {slot.device}
                            </Badge>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>

                  {validationResult.summary.warningCount > 0 && (
                    <div className="border-warning/30 bg-warning-soft flex flex-col gap-2 rounded-2xl border p-3.5">
                      <span className="text-warning type-caption">
                        Converter warnings ({validationResult.summary.warningCount})
                      </span>
                      <ul className="text-foreground type-body-s list-disc pl-4">
                        {validationResult.summary.warnings.map((w, idx) => (
                          <li key={idx}>{typeof w === "string" ? w : w.message}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button type="button" variant="secondary" onClick={() => setCurrentStep(1)}>
                  <ArrowLeft className="size-4" />
                  Back to JSON
                </Button>
                <Button type="button" onClick={() => setCurrentStep(3)}>
                  Preview template
                  <Eye className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </section>
      )}

      {currentStep === 3 && previewDocument && (
        <section className="flex flex-col gap-6">
          <div className="border-border/80 bg-elevated shadow-card flex flex-col gap-4 rounded-3xl border p-5 sm:p-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <Sparkles className="text-primary size-4" />
                <span className="text-foreground type-body-s-strong">
                  Live preview · same renderer as publish & export
                </span>
              </div>
              <Badge tone="accent">{previewDocument.template.type}</Badge>
            </div>

            <div className="border-border/80 max-h-[42rem] overflow-y-auto rounded-2xl border">
              <TemplatePuckRenderer document={previewDocument} />
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(2)}>
              <ArrowLeft className="size-4" />
              Back to validation
            </Button>
            <Button type="button" onClick={() => setCurrentStep(4)}>
              Continue to metadata
              <ArrowRight className="size-4" />
            </Button>
          </div>
        </section>
      )}

      {currentStep === 4 && (
        <section className="flex flex-col gap-6">
          {serverError && (
            <div
              role="alert"
              className="border-destructive/30 bg-destructive-soft flex flex-col gap-3 rounded-2xl border p-5"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="text-destructive size-5 shrink-0" />
                <span className="text-destructive type-body-m-strong">{serverError}</span>
              </div>
              {serverIssues.length > 0 && (
                <ul className="flex flex-col gap-1.5">
                  {serverIssues.map((issue, idx) => (
                    <li key={`${issue.path}-${idx}`} className="text-foreground type-body-s">
                      <code className="font-mono">{issue.path}</code>: {issue.message}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}

          <div className="grid gap-6 lg:grid-cols-12">
            <div className="border-border/80 bg-elevated shadow-card flex flex-col gap-5 rounded-3xl border p-6 lg:col-span-7">
              <h2 className="text-foreground type-heading-s">Details</h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="tpl-name" className="text-foreground type-body-s-strong">
                    Template name *
                  </label>
                  <Input
                    id="tpl-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    placeholder="Orbit"
                  />
                </div>

                <div className="flex flex-col gap-1.5">
                  <label htmlFor="tpl-slug" className="text-foreground type-body-s-strong">
                    Slug *
                  </label>
                  <Input
                    id="tpl-slug"
                    value={slug}
                    onChange={(event) => setSlug(event.target.value)}
                    placeholder="orbit"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-foreground type-body-s-strong">Template type *</span>
                <div
                  role="group"
                  aria-label="Template type"
                  className="border-border/70 bg-sunken/80 inline-flex flex-wrap gap-1 rounded-full border p-1"
                >
                  {TYPE_OPTIONS.map((opt) => {
                    const active = projectType === opt.value;
                    return (
                      <button
                        key={opt.value}
                        type="button"
                        aria-pressed={active}
                        onClick={() => setProjectType(opt.value)}
                        className={cn(
                          "rounded-full px-3.5 py-1.5 transition-all",
                          active
                            ? "bg-elevated text-foreground shadow-card type-body-s-strong"
                            : "text-muted-foreground hover:text-foreground type-body-s",
                        )}
                      >
                        {opt.label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label htmlFor="tpl-category" className="text-foreground type-body-s-strong">
                  Category *
                </label>
                <Input
                  id="tpl-category"
                  list="template-category-suggestions"
                  value={category}
                  onChange={(event) => setCategory(event.target.value)}
                  placeholder="Fintech"
                />
                <datalist id="template-category-suggestions">
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.name} />
                  ))}
                </datalist>
                {categories.length > 0 && (
                  <div className="flex flex-wrap gap-1.5 pt-0.5">
                    {categories.map((cat) => (
                      <button
                        key={cat.id}
                        type="button"
                        onClick={() => setCategory(cat.name)}
                        className="border-border/80 bg-surface/70 hover:border-border-strong text-muted-foreground type-caption rounded-full border px-2.5 py-0.5 transition-colors"
                      >
                        {cat.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex flex-col gap-2">
                <span className="text-foreground type-body-s-strong">Access tier *</span>
                <div
                  role="group"
                  aria-label="Access tier"
                  className="border-border/70 bg-sunken/80 inline-flex w-fit gap-1 rounded-full border p-1"
                >
                  <button
                    type="button"
                    aria-pressed={tier === "free"}
                    onClick={() => setTier("free")}
                    className={cn(
                      "rounded-full px-4 py-1.5 transition-all",
                      tier === "free"
                        ? "bg-elevated text-foreground shadow-card type-body-s-strong"
                        : "text-muted-foreground hover:text-foreground type-body-s",
                    )}
                  >
                    Free
                  </button>
                  <button
                    type="button"
                    aria-pressed={tier === "pro"}
                    onClick={() => setTier("pro")}
                    className={cn(
                      "inline-flex items-center gap-2 rounded-full px-4 py-1.5 transition-all",
                      tier === "pro"
                        ? "bg-elevated text-foreground shadow-card type-body-s-strong"
                        : "text-muted-foreground hover:text-foreground type-body-s",
                    )}
                  >
                    <span>Pro</span>
                    <ProBadge />
                  </button>
                </div>
              </div>

              <div className="flex flex-col gap-1.5">
                <label htmlFor="tpl-changelog" className="text-foreground type-body-s-strong">
                  Version changelog
                </label>
                <Input
                  id="tpl-changelog"
                  value={changelog}
                  onChange={(event) => setChangelog(event.target.value)}
                  placeholder="Initial draft import (v1.0.0)"
                />
              </div>
            </div>

            <div className="border-border/80 bg-elevated shadow-card flex flex-col justify-between gap-5 rounded-3xl border p-6 lg:col-span-5">
              <div className="flex flex-col gap-4">
                <h2 className="text-foreground type-heading-s">Cover & thumbnail</h2>

                <TemplateCoverUploader
                  coverUrl={coverUrl}
                  onCoverUrlChange={handleCoverUrlChange}
                  coverRatio={coverRatio}
                  onCoverRatioChange={setCoverRatio}
                  templateName={name || "New template"}
                  templateSlug={slug || undefined}
                  required
                  compact
                  putTransport={coverPutTransport}
                />
              </div>

              <div className="border-border/70 bg-wash-panel flex flex-col gap-2 rounded-2xl border p-4">
                <div className="flex items-center justify-between">
                  <span className="text-tertiary type-overline">Initial release target</span>
                  <Badge tone="draft">Draft · v1.0.0</Badge>
                </div>
                <p className="text-muted-foreground type-body-s">
                  Saving creates draft version <code className="font-mono">1.0.0</code>. Users only
                  see templates after you publish them on the detail screen.
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between">
            <Button type="button" variant="secondary" onClick={() => setCurrentStep(3)}>
              <ArrowLeft className="size-4" />
              Back to preview
            </Button>

            <Button type="button" disabled={isPending} onClick={handleSaveDraft}>
              {isPending ? "Saving draft..." : "Save as draft (v1.0.0)"}
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}
