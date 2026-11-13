"use client";

import type { PlanTier } from "@casefolio/db";
import { Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import { toast } from "sonner";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { updateAccountProfileAction } from "@/lib/account/actions";
import { can } from "@/lib/entitlements";

export interface ProfileSettingsPanelProps {
  initialProfile: {
    name: string;
    email: string;
    emailVerified: boolean;
    image: string | null;
    initials: string;
    role: string;
    effectivePlan: PlanTier;
    jobTitle: string | null;
    designFocus: "mobile" | "web" | "both" | null;
  };
}

export function ProfileSettingsPanel({ initialProfile }: ProfileSettingsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState(initialProfile.name);
  const [jobTitle, setJobTitle] = useState(initialProfile.jobTitle ?? "");
  const [designFocus, setDesignFocus] = useState<"mobile" | "web" | "both">(
    initialProfile.designFocus ?? "both",
  );
  const [imageUrl, setImageUrl] = useState(initialProfile.image ?? "");
  const [editingAvatarUrl, setEditingAvatarUrl] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPaid = can(initialProfile.effectivePlan, "pro_templates");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(async () => {
      const result = await updateAccountProfileAction({
        name,
        jobTitle,
        designFocus,
        imageUrl,
      });

      if (!result.ok) {
        setErrorMessage(result.error);
        return;
      }

      setEditingAvatarUrl(false);
      toast.success("Profile changes saved.");
      router.refresh();
    });
  }

  return (
    <Card className="flex min-w-0 flex-col gap-6 p-5 sm:p-8" data-testid="profile-settings-card">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-foreground type-heading-s">Public profile</h2>
          <p className="text-muted-foreground type-caption">
            Displayed on your published case studies and shared workspaces.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {isPaid ? (
            <ProBadge />
          ) : (
            <Badge tone="neutral">Free plan</Badge>
          )}
        </div>
      </div>

      {/* Avatar Row (Figma 2:10445) */}
      <div className="flex flex-wrap items-center gap-4">
        <AvatarBadge
          initials={initialProfile.initials}
          src={imageUrl.trim() || null}
          alt={name || initialProfile.name}
          size="lg"
        />
        <div className="flex flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setEditingAvatarUrl((prev) => !prev)}
          >
            Change avatar
          </Button>
          {imageUrl.trim().length > 0 && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setImageUrl("");
                setEditingAvatarUrl(false);
              }}
            >
              Remove
            </Button>
          )}
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-5">
        {editingAvatarUrl && (
          <InputField
            label="Avatar image URL"
            type="url"
            placeholder="https://images.example.com/avatar.jpg"
            value={imageUrl}
            onChange={(event) => setImageUrl(event.target.value)}
          />
        )}

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <InputField
            label="Full name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            required
          />

          <InputField
            label="Role / title"
            placeholder="Lead Product Designer"
            value={jobTitle}
            onChange={(event) => setJobTitle(event.target.value)}
          />
        </div>

        <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex min-w-0 flex-col gap-1.5">
            <Label htmlFor="profile-design-focus">Design focus</Label>
            <select
              id="profile-design-focus"
              value={designFocus}
              onChange={(event) =>
                setDesignFocus(event.target.value as "mobile" | "web" | "both")
              }
              className="border-input bg-elevated text-foreground focus-visible:ring-ring/40 type-body-m h-11 w-full min-w-0 rounded-2xl border px-3.5 outline-none focus-visible:ring-2"
            >
              <option value="mobile">Mobile app</option>
              <option value="web">Website</option>
              <option value="both">Mobile &amp; Web</option>
            </select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>Account email</Label>
            <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex h-11 min-w-0 items-center justify-between gap-2 rounded-2xl border px-3.5">
              <span className="min-w-0 flex-1 truncate">{initialProfile.email}</span>
              <span className="text-success type-caption inline-flex shrink-0 items-center gap-1">
                {initialProfile.emailVerified ? (
                  <>
                    <Check className="size-3.5" />
                    Verified
                  </>
                ) : (
                  "Unverified"
                )}
              </span>
            </div>
          </div>
        </div>

        {errorMessage && (
          <p
            role="alert"
            className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
          >
            {errorMessage}
          </p>
        )}

        <div className="border-border flex items-center justify-end border-t pt-5">
          <Button type="submit" disabled={isPending} data-testid="save-profile-button">
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Saving...
              </>
            ) : (
              "Save changes"
            )}
          </Button>
        </div>
      </form>
    </Card>
  );
}
