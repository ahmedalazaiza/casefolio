"use client";

import {
  AppWindow,
  ArrowRight,
  Check,
  GraduationCap,
  MoreHorizontal,
  Palette,
  Plus,
  Smartphone,
  Sparkles,
  Store,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, type ChangeEvent, type ComponentType, type FormEvent } from "react";
import { BrandLogo } from "@/components/ui/brand-logo";
import { Button } from "@/components/ui/button";
import { TemplateTypeCard } from "@/components/ui/domain-cards";
import { InputField } from "@/components/ui/input";
import { StepIndicator, type StepState } from "@/components/ui/step-indicator";
import {
  completeOnboardingAction,
  skipOnboardingAction,
} from "@/lib/auth/onboarding-actions";
import type { DesignerRoleId } from "@/lib/auth/schemas";
import { cn } from "@/lib/utils";

interface RoleCardOption {
  id: DesignerRoleId;
  title: string;
  subtitle: string;
  defaultHeadline: string;
  icon: ComponentType<{ className?: string }>;
}

const ROLE_OPTIONS: readonly RoleCardOption[] = [
  {
    id: "ui-ux",
    title: "UI/UX designer",
    subtitle: "Apps, products and flows",
    defaultHeadline: "Product designer",
    icon: Smartphone,
  },
  {
    id: "web",
    title: "Web designer",
    subtitle: "Sites and landing pages",
    defaultHeadline: "Web designer",
    icon: AppWindow,
  },
  {
    id: "exhibition",
    title: "Exhibition designer",
    subtitle: "Booths and spaces",
    defaultHeadline: "Exhibition designer",
    icon: Store,
  },
  {
    id: "brand",
    title: "Brand designer",
    subtitle: "Identity & visual systems",
    defaultHeadline: "Brand designer",
    icon: Palette,
  },
  {
    id: "student",
    title: "Student",
    subtitle: "Building a first portfolio",
    defaultHeadline: "Emerging product designer",
    icon: GraduationCap,
  },
  {
    id: "other",
    title: "Something else",
    subtitle: "Tell us later",
    defaultHeadline: "Multidisciplinary designer",
    icon: MoreHorizontal,
  },
] as const;

function computeInitials(name: string, email: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return `${parts[0]?.[0] ?? ""}${parts[1]?.[0] ?? ""}`.toUpperCase();
  }
  if (parts.length === 1 && (parts[0]?.length ?? 0) >= 2) {
    return (parts[0] ?? "").slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase() || "CF";
}

function toHandleSlug(name: string, email: string): string {
  const base = (name.trim().split(/\s+/)[0] || email.split("@")[0] || "designer")
    .toLowerCase()
    .replace(/[^a-z0-9-]+/g, "");
  return base || "designer";
}

export interface OnboardingWizardProps {
  initialName: string;
  initialEmail: string;
  initialJobTitle?: string | null;
  initialDesignFocus?: "mobile" | "web" | "both" | null;
  initialImage?: string | null;
}

export function OnboardingWizard({
  initialName,
  initialEmail,
  initialJobTitle,
  initialDesignFocus,
  initialImage,
}: OnboardingWizardProps) {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [selectedRole, setSelectedRole] = useState<DesignerRoleId>("ui-ux");

  const [mobileSelected, setMobileSelected] = useState<boolean>(
    initialDesignFocus ? initialDesignFocus !== "web" : true,
  );
  const [webSelected, setWebSelected] = useState<boolean>(
    initialDesignFocus ? initialDesignFocus !== "mobile" : true,
  );

  const [displayName, setDisplayName] = useState(initialName);
  const [headline, setHeadline] = useState(initialJobTitle ?? "Product designer");
  const [headlineTouched, setHeadlineTouched] = useState(Boolean(initialJobTitle));
  const [publicHandle, setPublicHandle] = useState(
    `casefolio.app/${toHandleSlug(initialName, initialEmail)}`,
  );
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialImage ?? null);

  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  function resolveStepState(targetStep: 1 | 2 | 3): StepState {
    if (step > targetStep) return "done";
    if (step === targetStep) return "current";
    return "upcoming";
  }

  function resolveDesignFocus(): "mobile" | "web" | "both" {
    if (mobileSelected && webSelected) return "both";
    if (webSelected) return "web";
    return "mobile";
  }

  function handleSelectRole(option: RoleCardOption) {
    setSelectedRole(option.id);
    if (!headlineTouched) {
      setHeadline(option.defaultHeadline);
    }
    if (option.id === "web") {
      setMobileSelected(false);
      setWebSelected(true);
    } else if (option.id === "ui-ux") {
      setMobileSelected(true);
      setWebSelected(true);
    }
  }

  function handleToggleFocus(target: "mobile" | "web") {
    setErrorMessage(null);
    if (target === "mobile") {
      if (mobileSelected && !webSelected) return;
      setMobileSelected((prev) => !prev);
    } else {
      if (webSelected && !mobileSelected) return;
      setWebSelected((prev) => !prev);
    }
  }

  function handlePhotoUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    if (file.size > 350 * 1024) {
      setErrorMessage("Please choose a PNG or JPG image smaller than 350 KB.");
      return;
    }

    setErrorMessage(null);
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === "string") {
        setAvatarUrl(reader.result);
      }
    };
    reader.readAsDataURL(file);
  }

  async function handleSkip() {
    setSubmitting(true);
    setErrorMessage(null);
    const res = await skipOnboardingAction();
    setSubmitting(false);

    if (!res.ok) {
      setErrorMessage(res.error ?? "Could not skip onboarding.");
      return;
    }

    router.push("/dashboard?welcome=1");
    router.refresh();
  }

  async function handleComplete(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSubmitting(true);
    setErrorMessage(null);

    const res = await completeOnboardingAction({
      name: displayName,
      jobTitle: headline,
      designFocus: resolveDesignFocus(),
      image: avatarUrl,
    });

    setSubmitting(false);

    if (!res.ok) {
      setErrorMessage(res.error ?? "Could not save profile.");
      return;
    }

    router.push("/dashboard?welcome=1");
    router.refresh();
  }

  const initials = computeInitials(displayName, initialEmail);

  return (
    <div className="bg-background text-foreground flex min-h-screen flex-col">
      <header className="grid h-20 grid-cols-[minmax(0,1fr)_auto] items-center gap-4 px-6 sm:px-10 md:grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)]">
        <div className="justify-self-start">
          <BrandLogo href="/dashboard" />
        </div>

        <nav
          aria-label="Onboarding steps"
          className="hidden shrink-0 items-center gap-3 justify-self-center md:flex"
        >
          <StepIndicator step={1} label="Your role" state={resolveStepState(1)} />
          <span
            aria-hidden="true"
            className={cn("h-px w-8", step > 1 ? "bg-success/50" : "bg-border")}
          />
          <StepIndicator step={2} label="What you present" state={resolveStepState(2)} />
          <span
            aria-hidden="true"
            className={cn("h-px w-8", step > 2 ? "bg-success/50" : "bg-border")}
          />
          <StepIndicator step={3} label="Profile" state={resolveStepState(3)} />
        </nav>

        <button
          type="button"
          disabled={submitting}
          onClick={handleSkip}
          className="text-foreground hover:text-primary focus-visible:ring-ring/40 type-body-s-strong justify-self-end rounded-full px-3 py-1.5 transition-colors outline-none focus-visible:ring-2 disabled:opacity-50"
        >
          Skip for now
        </button>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center px-6 py-10 sm:py-14">
        {step === 1 && (
          <section aria-labelledby="onboarding-step-1-heading" className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <span className="text-primary type-overline">Step 1 of 3</span>
              <h1
                id="onboarding-step-1-heading"
                className="type-display-m sm:type-display-l text-foreground"
              >
                What best describes you?
              </h1>
              <p className="text-muted-foreground type-body-m">
                We&apos;ll tailor templates and tips. You can change this later.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {ROLE_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = selectedRole === option.id;
                return (
                  <button
                    key={option.id}
                    type="button"
                    aria-pressed={active}
                    onClick={() => handleSelectRole(option)}
                    className={cn(
                      "focus-visible:ring-ring/40 flex flex-col gap-5 rounded-xl border p-5 text-left transition-colors outline-none focus-visible:ring-2",
                      active
                        ? "border-primary bg-card shadow-card border-2"
                        : "border-border bg-card hover:border-border-strong",
                    )}
                  >
                    <div className="flex w-full items-start justify-between">
                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-flex size-10 items-center justify-center rounded-md",
                          active
                            ? "bg-primary text-primary-foreground"
                            : "bg-accent text-accent-foreground",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>

                      <span
                        aria-hidden="true"
                        className={cn(
                          "inline-flex size-5 items-center justify-center rounded-xs border",
                          active
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border-strong bg-elevated",
                        )}
                      >
                        {active && <Check className="size-3.5" />}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1">
                      <span className="text-foreground type-heading-s">{option.title}</span>
                      <span className="text-muted-foreground type-caption">{option.subtitle}</span>
                    </div>
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-end">
              <Button type="button" size="lg" onClick={() => setStep(2)}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </section>
        )}

        {step === 2 && (
          <section aria-labelledby="onboarding-step-2-heading" className="flex flex-col gap-8">
            <div className="flex flex-col gap-2">
              <span className="text-primary type-overline">Step 2 of 3</span>
              <h1
                id="onboarding-step-2-heading"
                className="type-display-m sm:type-display-l text-foreground"
              >
                What will you present first?
              </h1>
              <p className="text-muted-foreground type-body-m">
                Pick one or more — we&apos;ll show matching templates first.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <button
                type="button"
                aria-pressed={mobileSelected}
                onClick={() => handleToggleFocus("mobile")}
                className="focus-visible:ring-ring/40 rounded-xl text-left outline-none focus-visible:ring-2"
              >
                <TemplateTypeCard
                  title="Mobile app"
                  description="Device-framed screens and flows."
                  templateCount={2}
                  state={mobileSelected ? "selected" : "default"}
                  icon={<Smartphone className="size-5" />}
                  className="h-full"
                />
              </button>

              <button
                type="button"
                aria-pressed={webSelected}
                onClick={() => handleToggleFocus("web")}
                className="focus-visible:ring-ring/40 rounded-xl text-left outline-none focus-visible:ring-2"
              >
                <TemplateTypeCard
                  title="Website"
                  description="Browser-framed pages and sections."
                  templateCount={1}
                  state={webSelected ? "selected" : "default"}
                  icon={<AppWindow className="size-5" />}
                  className="h-full"
                />
              </button>

              <TemplateTypeCard
                title="Booth / Exhibition"
                description="Spatial and event work."
                footerLabel="COMING SOON"
                state="coming-soon"
                icon={<Store className="size-5" />}
              />

              <TemplateTypeCard
                title="More coming"
                description="Branding, packaging and more."
                footerLabel="ON THE ROADMAP"
                state="coming-soon"
                icon={<Sparkles className="size-5" />}
              />
            </div>

            <div className="flex items-center justify-between">
              <Button type="button" variant="secondary" size="lg" onClick={() => setStep(1)}>
                Back
              </Button>
              <Button type="button" size="lg" onClick={() => setStep(3)}>
                Continue
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </section>
        )}

        {step === 3 && (
          <form
            aria-labelledby="onboarding-step-3-heading"
            onSubmit={handleComplete}
            className="flex flex-col gap-8"
          >
            <div className="flex flex-col gap-2">
              <span className="text-primary type-overline">Step 3 of 3</span>
              <h1
                id="onboarding-step-3-heading"
                className="type-display-m sm:type-display-l text-foreground"
              >
                Set up your public profile
              </h1>
              <p className="text-muted-foreground type-body-m">Shown on published case studies.</p>
            </div>

            <div className="flex items-center gap-5">
              {avatarUrl ? (
                <img
                  src={avatarUrl}
                  alt={displayName || "Profile avatar"}
                  className="border-border size-20 rounded-full border object-cover"
                />
              ) : (
                <div
                  aria-hidden="true"
                  className="bg-inverse text-inverse-foreground inline-flex size-20 shrink-0 items-center justify-center rounded-full type-heading-m"
                >
                  {initials}
                </div>
              )}

              <div className="flex flex-col items-start gap-1.5">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  aria-label="Upload avatar photo"
                  onChange={handlePhotoUpload}
                  className="sr-only"
                />
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <Plus className="size-4" />
                    Upload photo
                  </Button>
                  {avatarUrl && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAvatarUrl(null)}
                    >
                      Remove
                    </Button>
                  )}
                </div>
                <span className="text-tertiary type-caption">PNG or JPG · up to 350 KB</span>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <InputField
                label="Display name"
                value={displayName}
                onChange={(e) => {
                  const next = e.target.value;
                  setDisplayName(next);
                  setPublicHandle(`casefolio.app/${toHandleSlug(next, initialEmail)}`);
                }}
                placeholder="Ahmed Al-Azaiza"
                required
              />

              <InputField
                label="Headline"
                value={headline}
                onChange={(e) => {
                  setHeadlineTouched(true);
                  setHeadline(e.target.value);
                }}
                placeholder="Product designer"
                required
              />
            </div>

            <InputField
              label="Public handle"
              value={publicHandle}
              onChange={(e) => setPublicHandle(e.target.value)}
              helperText="Available — shown on your published case studies"
            />

            {errorMessage && (
              <p role="alert" className="text-destructive type-body-s">
                {errorMessage}
              </p>
            )}

            <div className="flex items-center justify-between">
              <Button
                type="button"
                variant="secondary"
                size="lg"
                disabled={submitting}
                onClick={() => setStep(2)}
              >
                Back
              </Button>
              <Button type="submit" size="lg" disabled={submitting}>
                {submitting ? "Saving..." : "Continue"}
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  );
}

