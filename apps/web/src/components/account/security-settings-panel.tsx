"use client";

import {
  AlertTriangle,
  KeyRound,
  Laptop,
  Loader2,
  Mail,
  Shield,
  Trash2,
  Undo2,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  cancelScheduledAccountDeletionAction,
  deleteUserAccountAction,
  revokeOtherUserSessionsAction,
  revokeUserSessionAction,
} from "@/lib/account/actions";
import { authClient } from "@/lib/auth/client";

export interface ActiveSessionView {
  id: string;
  deviceLabel: string;
  subLabel: string;
  isCurrent: boolean;
}

export interface SecuritySettingsPanelProps {
  email: string;
  emailVerified: boolean;
  hasPasswordAccount: boolean;
  passwordUpdatedLabel: string | null;
  googleConnected: boolean;
  projectsCount: number;
  publishedCount: number;
  sessions: ActiveSessionView[];
  deletionScheduledForIso?: string | null;
}

export function SecuritySettingsPanel({
  email,
  emailVerified,
  hasPasswordAccount,
  passwordUpdatedLabel,
  googleConnected,
  projectsCount,
  publishedCount,
  sessions,
  deletionScheduledForIso = null,
}: SecuritySettingsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Change email modal
  const [emailModalOpen, setEmailModalOpen] = useState(false);
  const [newEmail, setNewEmail] = useState("");
  const [emailChangeStep, setEmailChangeStep] = useState<"request" | "verify">("request");
  const [emailChangeOtp, setEmailChangeOtp] = useState("");
  const [emailSaving, setEmailSaving] = useState(false);
  const [emailError, setEmailError] = useState<string | null>(null);

  // Change password modal
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete account modal + server-side step-up
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [stepUpMode, setStepUpMode] = useState<"password" | "otp">(
    hasPasswordAccount ? "password" : "otp",
  );
  const [stepUpPassword, setStepUpPassword] = useState("");
  const [stepUpOtp, setStepUpOtp] = useState("");
  const [stepUpOtpSent, setStepUpOtpSent] = useState(false);
  const [stepUpSending, setStepUpSending] = useState(false);
  const [deleteSubmitting, setDeleteSubmitting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

  const formattedScheduledDate = deletionScheduledForIso
    ? new Date(deletionScheduledForIso).toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      })
    : null;

  async function handleRequestEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    const cleaned = newEmail.trim().toLowerCase();
    if (!cleaned || cleaned === email.toLowerCase()) {
      setEmailError("Enter a different email address.");
      return;
    }

    setEmailSaving(true);
    try {
      const result = await authClient.emailOtp.requestEmailChange({
        newEmail: cleaned,
      });
      if (result.error) {
        setEmailError(result.error.message || "Could not send verification code.");
        return;
      }
      setEmailChangeStep("verify");
      toast.success(`Sent a 6-digit verification code to ${cleaned}.`);
    } catch {
      setEmailError("Could not send verification code right now.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleConfirmEmailChange(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEmailError(null);
    const cleaned = newEmail.trim().toLowerCase();
    const cleanOtp = emailChangeOtp.trim();
    if (!/^\d{6}$/.test(cleanOtp)) {
      setEmailError("Enter the 6-digit verification code sent to your new email.");
      return;
    }

    setEmailSaving(true);
    try {
      const result = await authClient.emailOtp.changeEmail({
        newEmail: cleaned,
        otp: cleanOtp,
      });
      if (result.error) {
        setEmailError(result.error.message || "Invalid or expired verification code.");
        return;
      }
      toast.success("Account email updated.");
      setEmailModalOpen(false);
      setNewEmail("");
      setEmailChangeOtp("");
      setEmailChangeStep("request");
      router.refresh();
    } catch {
      setEmailError("Could not confirm email change right now.");
    } finally {
      setEmailSaving(false);
    }
  }

  async function handleChangePassword(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPasswordError(null);

    if (newPassword.length < 8) {
      setPasswordError("New password must be at least 8 characters.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match.");
      return;
    }

    setPasswordSaving(true);
    try {
      const result = await authClient.changePassword({
        currentPassword,
        newPassword,
        revokeOtherSessions: false,
      });

      if (result.error) {
        setPasswordError(result.error.message || "Could not update password.");
        return;
      }

      toast.success("Password updated.");
      setPasswordOpen(false);
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      router.refresh();
    } catch {
      setPasswordError("Could not update password right now.");
    } finally {
      setPasswordSaving(false);
    }
  }

  function handleRevokeSession(sessionId: string) {
    startTransition(async () => {
      const res = await revokeUserSessionAction(sessionId);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Session revoked.");
      router.refresh();
    });
  }

  function handleRevokeOtherSessions() {
    startTransition(async () => {
      const res = await revokeOtherUserSessionsAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Signed out of all other sessions.");
      router.refresh();
    });
  }

  async function handleSendStepUpOtp() {
    setDeleteError(null);
    setStepUpSending(true);
    try {
      const response = await fetch("/api/account/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_otp",
          purpose: "account_deletion",
        }),
      });
      const json = (await response.json()) as { ok: boolean; error?: string };
      if (!response.ok || !json.ok) {
        setDeleteError(json.error || "Could not send confirmation code.");
        return;
      }
      setStepUpOtpSent(true);
      toast.success(`Sent a 6-digit security confirmation code to ${email}.`);
    } catch {
      setDeleteError("Network error while sending confirmation code.");
    } finally {
      setStepUpSending(false);
    }
  }

  async function handleDeleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteError(null);
    setDeleteSubmitting(true);

    try {
      const stepUpPayload =
        stepUpMode === "password"
          ? {
              action: "verify_password" as const,
              purpose: "account_deletion" as const,
              password: stepUpPassword,
            }
          : {
              action: "verify_otp" as const,
              purpose: "account_deletion" as const,
              otp: stepUpOtp.trim(),
            };

      const stepUpRes = await fetch("/api/account/step-up", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(stepUpPayload),
      });
      const stepUpJson = (await stepUpRes.json()) as
        | { ok: true; stepUpToken: string }
        | { ok: false; error?: string };

      if (!stepUpRes.ok || !stepUpJson.ok) {
        setDeleteError(
          ("error" in stepUpJson && stepUpJson.error) ||
            "Identity verification failed. Please check your credentials.",
        );
        return;
      }

      const res = await deleteUserAccountAction({
        confirmEmail,
        stepUpToken: stepUpJson.stepUpToken,
      });
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }

      toast.success(
        "Account deletion scheduled for 7 days from now. You can cancel anytime during the grace period.",
      );
      setDeleteOpen(false);
      setStepUpPassword("");
      setStepUpOtp("");
      setConfirmEmail("");
      router.refresh();
    } catch {
      setDeleteError("Could not schedule account deletion right now.");
    } finally {
      setDeleteSubmitting(false);
    }
  }

  function handleCancelScheduledDeletion() {
    startTransition(async () => {
      const res = await cancelScheduledAccountDeletionAction();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Scheduled account deletion canceled.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="security-settings-panel">
      {/* Scheduled deletion grace banner */}
      {deletionScheduledForIso && (
        <section
          data-testid="scheduled-deletion-banner"
          className="border-destructive/40 bg-destructive-soft flex flex-col justify-between gap-4 rounded-xl border p-5 sm:flex-row sm:items-center"
        >
          <div className="flex items-start gap-3">
            <AlertTriangle className="text-destructive mt-0.5 size-5 shrink-0" />
            <div className="flex flex-col gap-1">
              <p className="text-foreground type-body-s-strong">
                Account scheduled for permanent deletion on {formattedScheduledDate}
              </p>
              <p className="text-muted-foreground type-caption">
                Your projects, published case studies, and subscription stay intact during the
                7-day grace window. Cancel below to keep your account active.
              </p>
            </div>
          </div>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            data-testid="cancel-scheduled-deletion-btn"
            disabled={isPending}
            onClick={handleCancelScheduledDeletion}
          >
            <Undo2 className="size-3.5" />
            Cancel deletion
          </Button>
        </section>
      )}

      {/* Login & security card */}
      <section className="border-border/80 bg-elevated flex flex-col gap-2 rounded-xl border p-6 sm:p-8">
        <h2 className="text-foreground type-heading-m pb-2">Login &amp; security</h2>

        <div className="divide-border flex flex-col divide-y">
          {/* Email row */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">Email</span>
              <span className="text-muted-foreground type-caption">
                {email} · {emailVerified ? "verified" : "unverified"}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <Badge tone={emailVerified ? "published" : "draft"}>
                {emailVerified ? "Verified" : "Unverified"}
              </Badge>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="security-change-email-btn"
                onClick={() => {
                  setEmailError(null);
                  setNewEmail("");
                  setEmailChangeOtp("");
                  setEmailChangeStep("request");
                  setEmailModalOpen(true);
                }}
              >
                <Mail className="size-3.5" />
                Change email
              </Button>
            </div>
          </div>

          {/* Password row */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">Password</span>
              <span className="text-muted-foreground type-caption">
                {hasPasswordAccount
                  ? passwordUpdatedLabel
                    ? `Last changed ${passwordUpdatedLabel}`
                    : "Email & password enabled"
                  : "Managed via magic link or OAuth"}
              </span>
            </div>
            {hasPasswordAccount ? (
              <Button
                type="button"
                variant="secondary"
                size="sm"
                data-testid="security-change-password-btn"
                onClick={() => {
                  setPasswordError(null);
                  setPasswordOpen(true);
                }}
              >
                <KeyRound className="size-3.5" />
                Change
              </Button>
            ) : (
              <Badge tone="neutral" withDot={false}>
                Passwordless
              </Badge>
            )}
          </div>

          {/* Two-factor authentication row */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">
                Two-factor authentication
              </span>
              <span className="text-muted-foreground type-caption">
                Authenticator app (TOTP coming soon)
              </span>
            </div>
            <Badge tone="neutral" withDot={false}>
              Coming soon
            </Badge>
          </div>

          {/* Google OAuth row */}
          <div className="flex flex-wrap items-center justify-between gap-4 py-4">
            <div className="flex flex-col gap-1">
              <span className="text-foreground type-body-s-strong">Google</span>
              <span className="text-muted-foreground type-caption">
                {googleConnected ? "Connected for sign-in" : "Not connected"}
              </span>
            </div>
            <Badge tone={googleConnected ? "published" : "neutral"}>
              {googleConnected ? "Connected" : "Not connected"}
            </Badge>
          </div>
        </div>
      </section>

      {/* Active sessions card */}
      <section className="border-border/80 bg-elevated flex flex-col gap-4 rounded-xl border p-6 sm:p-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Shield className="text-primary size-4" />
            <h2 className="text-foreground type-heading-m">Active sessions</h2>
          </div>
          {otherSessionsCount > 0 && (
            <Button
              type="button"
              variant="secondary"
              size="sm"
              data-testid="revoke-other-sessions-btn"
              onClick={handleRevokeOtherSessions}
              disabled={isPending}
            >
              Sign out other sessions
            </Button>
          )}
        </div>

        <div className="divide-border flex flex-col divide-y">
          {sessions.map((s) => (
            <div
              key={s.id}
              data-testid={s.isCurrent ? "current-session-row" : "other-session-row"}
              className="flex flex-wrap items-center justify-between gap-4 py-4"
            >
              <div className="flex items-start gap-3">
                <Laptop className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                <div className="flex flex-col gap-0.5">
                  <span className="text-foreground type-body-s-strong">
                    {s.deviceLabel}
                    {s.isCurrent ? " — This device" : ""}
                  </span>
                  <span className="text-muted-foreground type-caption">{s.subLabel}</span>
                </div>
              </div>

              {s.isCurrent ? (
                <Badge tone="published">This device</Badge>
              ) : (
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => handleRevokeSession(s.id)}
                  disabled={isPending}
                >
                  Revoke
                </Button>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Delete account danger card */}
      <section className="border-destructive/30 bg-elevated flex flex-col gap-4 rounded-xl border p-6 sm:p-8">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-foreground type-heading-m">Delete account</h2>
          <p className="text-muted-foreground type-body-s">
            Schedules permanent deletion of your projects, published pages, and exports after a
            7-day grace period. Active personal subscriptions are canceled before final erasure.
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            data-testid="open-delete-account-modal"
            disabled={Boolean(deletionScheduledForIso)}
            onClick={() => {
              setConfirmEmail("");
              setStepUpPassword("");
              setStepUpOtp("");
              setStepUpOtpSent(false);
              setStepUpMode(hasPasswordAccount ? "password" : "otp");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-3.5" />
            {deletionScheduledForIso ? "Deletion scheduled" : "Delete account"}
          </Button>
        </div>
      </section>

      {/* Change email dialog */}
      {emailModalOpen && (
        <Dialog open={emailModalOpen} onOpenChange={setEmailModalOpen}>
          <DialogContent className="max-w-md" data-testid="change-email-dialog">
            <DialogHeader>
              <DialogTitle>Change account email</DialogTitle>
              <DialogDescription>
                {emailChangeStep === "request"
                  ? "We will send a 6-digit verification code to your new email address before updating your primary sign-in email."
                  : `Enter the 6-digit verification code sent to ${newEmail.trim().toLowerCase()}.`}
              </DialogDescription>
            </DialogHeader>

            {emailChangeStep === "request" ? (
              <form onSubmit={handleRequestEmailChange} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sec-new-email">New email address</Label>
                  <Input
                    id="sec-new-email"
                    type="email"
                    autoComplete="email"
                    placeholder="you@studio.design"
                    value={newEmail}
                    onChange={(e) => setNewEmail(e.target.value)}
                    required
                  />
                </div>

                {emailError && (
                  <p
                    role="alert"
                    className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
                  >
                    {emailError}
                  </p>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEmailModalOpen(false)}
                    disabled={emailSaving}
                  >
                    Cancel
                  </Button>
                  <Button type="submit" disabled={emailSaving}>
                    {emailSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Sending code...
                      </>
                    ) : (
                      "Send 6-digit code"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            ) : (
              <form onSubmit={handleConfirmEmailChange} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="sec-email-change-otp">6-digit verification code</Label>
                  <Input
                    id="sec-email-change-otp"
                    inputMode="numeric"
                    maxLength={6}
                    placeholder="000000"
                    value={emailChangeOtp}
                    onChange={(e) => setEmailChangeOtp(e.target.value.replace(/\D/g, ""))}
                    required
                  />
                </div>

                {emailError && (
                  <p
                    role="alert"
                    className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
                  >
                    {emailError}
                  </p>
                )}

                <DialogFooter>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setEmailChangeStep("request")}
                    disabled={emailSaving}
                  >
                    Back
                  </Button>
                  <Button type="submit" disabled={emailSaving || emailChangeOtp.length !== 6}>
                    {emailSaving ? (
                      <>
                        <Loader2 className="size-4 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Confirm new email"
                    )}
                  </Button>
                </DialogFooter>
              </form>
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Change password dialog */}
      {passwordOpen && (
        <Dialog open={passwordOpen} onOpenChange={setPasswordOpen}>
          <DialogContent className="max-w-md" data-testid="change-password-dialog">
            <DialogHeader>
              <DialogTitle>Change password</DialogTitle>
              <DialogDescription>
                Enter your current password and choose a new password of at least 8
                characters.
              </DialogDescription>
            </DialogHeader>

            <form onSubmit={handleChangePassword} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sec-current-password">Current password</Label>
                <Input
                  id="sec-current-password"
                  type="password"
                  autoComplete="current-password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sec-new-password">New password</Label>
                <Input
                  id="sec-new-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="sec-confirm-password">Confirm new password</Label>
                <Input
                  id="sec-confirm-password"
                  type="password"
                  autoComplete="new-password"
                  minLength={8}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>

              {passwordError && (
                <p
                  role="alert"
                  className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
                >
                  {passwordError}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setPasswordOpen(false)}
                  disabled={passwordSaving}
                >
                  Cancel
                </Button>
                <Button type="submit" disabled={passwordSaving}>
                  {passwordSaving ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Updating...
                    </>
                  ) : (
                    "Update password"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}

      {/* Delete account dialog with server-verified step-up */}
      {deleteOpen && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md" data-testid="delete-account-dialog">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="bg-destructive-soft text-destructive flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <DialogTitle>Schedule account deletion?</DialogTitle>
                  <DialogDescription>
                    After a 7-day grace window, this permanently deletes {projectsCount}{" "}
                    {projectsCount === 1 ? "project" : "projects"}, {publishedCount}{" "}
                    published {publishedCount === 1 ? "page" : "pages"} and all exports. You
                    can cancel anytime within 7 days.
                  </DialogDescription>
                </div>
              </div>
            </DialogHeader>

            <form onSubmit={handleDeleteAccount} className="flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="delete-confirm-email">
                  Type <span className="font-mono">{email}</span> to confirm
                </Label>
                <Input
                  id="delete-confirm-email"
                  type="email"
                  placeholder={email}
                  value={confirmEmail}
                  onChange={(e) => setConfirmEmail(e.target.value)}
                  required
                />
              </div>

              {stepUpMode === "password" ? (
                <div className="flex flex-col gap-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="delete-stepup-password">Confirm your password</Label>
                    <button
                      type="button"
                      onClick={() => {
                        setStepUpMode("otp");
                        setDeleteError(null);
                      }}
                      className="text-primary type-caption underline-offset-4 hover:underline"
                    >
                      Use email code instead
                    </button>
                  </div>
                  <Input
                    id="delete-stepup-password"
                    type="password"
                    autoComplete="current-password"
                    value={stepUpPassword}
                    onChange={(e) => setStepUpPassword(e.target.value)}
                    required
                  />
                </div>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-center justify-between gap-2">
                    <Label htmlFor="delete-stepup-otp">6-digit security code</Label>
                    {hasPasswordAccount && (
                      <button
                        type="button"
                        onClick={() => {
                          setStepUpMode("password");
                          setDeleteError(null);
                        }}
                        className="text-primary type-caption underline-offset-4 hover:underline"
                      >
                        Use password instead
                      </button>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id="delete-stepup-otp"
                      inputMode="numeric"
                      maxLength={6}
                      placeholder="000000"
                      value={stepUpOtp}
                      onChange={(e) => setStepUpOtp(e.target.value.replace(/\D/g, ""))}
                      required
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      disabled={stepUpSending}
                      onClick={handleSendStepUpOtp}
                    >
                      {stepUpSending ? "Sending..." : stepUpOtpSent ? "Resend" : "Send code"}
                    </Button>
                  </div>
                </div>
              )}

              {deleteError && (
                <p
                  role="alert"
                  className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
                >
                  {deleteError}
                </p>
              )}

              <DialogFooter>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => setDeleteOpen(false)}
                  disabled={deleteSubmitting}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    deleteSubmitting ||
                    confirmEmail.trim().toLowerCase() !== email.toLowerCase() ||
                    (stepUpMode === "password"
                      ? stepUpPassword.length === 0
                      : stepUpOtp.trim().length !== 6)
                  }
                >
                  {deleteSubmitting ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Confirming...
                    </>
                  ) : (
                    "Schedule deletion (7 days)"
                  )}
                </Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}
