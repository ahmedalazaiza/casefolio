"use client";

import type { PlanTier } from "@casefolio/db";
import { Check, Loader2, Upload } from "lucide-react";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition, type ChangeEvent, type FormEvent } from "react";
import { toast } from "sonner";
import { AvatarBadge } from "@/components/ui/avatar-badge";
import { Badge, ProBadge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { InputField } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
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
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [name, setName] = useState(initialProfile.name);
  const [jobTitle, setJobTitle] = useState(initialProfile.jobTitle ?? "");
  const [designFocus, setDesignFocus] = useState<"mobile" | "web" | "both">(
    initialProfile.designFocus ?? "both",
  );
  const [imageUrl, setImageUrl] = useState(initialProfile.image ?? "");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const isPaid = can(initialProfile.effectivePlan, "pro_templates");

  async function handleAvatarUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      setErrorMessage("Please choose a PNG, JPG, or WebP photo up to 5 MB.");
      return;
    }

    setErrorMessage(null);
    setUploadingAvatar(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const response = await fetch("/api/account/avatar", {
        method: "POST",
        body: formData,
      });
      const json = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        avatarUrl?: string;
        error?: string;
      };
      if (!response.ok || !json.ok || !json.avatarUrl) {
        setErrorMessage(json.error ?? "Could not upload profile photo.");
        return;
      }
      setImageUrl(json.avatarUrl);
      toast.success("Profile photo uploaded.");
      router.refresh();
    } catch {
      setErrorMessage("Network error while uploading profile photo.");
    } finally {
      setUploadingAvatar(false);
    }
  }

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

      {/* Avatar Upload Row */}
      <div className="flex flex-wrap items-center gap-4">
        <AvatarBadge
          initials={initialProfile.initials}
          src={imageUrl.trim() || null}
          alt={name || initialProfile.name}
          size="lg"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/png,image/jpeg,image/webp"
          aria-label="Upload profile photo"
          onChange={handleAvatarUpload}
          className="sr-only"
          data-testid="profile-avatar-file-input"
        />
        <div className="flex flex-col gap-1">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              disabled={uploadingAvatar || isPending}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploadingAvatar ? (
                <>
                  <Loader2 className="size-3.5 animate-spin" />
                  <span>Uploading…</span>
                </>
              ) : (
                <>
                  <Upload className="size-3.5" />
                  <span>Change avatar</span>
                </>
              )}
            </Button>
            {imageUrl.trim().length > 0 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                disabled={uploadingAvatar || isPending}
                onClick={() => {
                  setImageUrl("");
                }}
              >
                Remove
              </Button>
            )}
          </div>
          <span className="text-tertiary type-caption">PNG, JPG, or WebP · up to 5 MB</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="flex min-w-0 flex-col gap-5">
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
            <Select
              id="profile-design-focus"
              value={designFocus}
              onChange={(event) =>
                setDesignFocus(event.target.value as "mobile" | "web" | "both")
              }
            >
              <option value="mobile">Mobile app</option>
              <option value="web">Website</option>
              <option value="both">Mobile &amp; Web</option>
            </Select>
          </div>

          <div className="flex min-w-0 flex-col gap-1.5">
            <Label>Account email</Label>
            <div className="border-border/80 bg-surface text-muted-foreground type-body-s flex h-11 min-w-0 items-center justify-between gap-2 rounded-xl border px-3.5">
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
