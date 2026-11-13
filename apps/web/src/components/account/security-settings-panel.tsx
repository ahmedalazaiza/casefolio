"use client";

import { AlertTriangle, KeyRound, Laptop, Loader2, Shield, Trash2 } from "lucide-react";
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
}: SecuritySettingsPanelProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Change password modal
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  // Delete account modal
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [confirmEmail, setConfirmEmail] = useState("");
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const otherSessionsCount = sessions.filter((s) => !s.isCurrent).length;

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

  function handleDeleteAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setDeleteError(null);

    startTransition(async () => {
      const res = await deleteUserAccountAction(confirmEmail);
      if (!res.ok) {
        setDeleteError(res.error);
        return;
      }
      toast.success("Your account has been permanently deleted.");
      setDeleteOpen(false);
      router.push("/sign-in");
    });
  }

  return (
    <div className="flex flex-col gap-6" data-testid="security-settings-panel">
      {/* Login & security card */}
      <section className="border-border/80 bg-elevated shadow-card flex flex-col gap-2 rounded-3xl border p-6 sm:p-8">
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
            <Badge tone={emailVerified ? "published" : "draft"}>
              {emailVerified ? "Verified" : "Unverified"}
            </Badge>
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
      <section className="border-border/80 bg-elevated shadow-card flex flex-col gap-4 rounded-3xl border p-6 sm:p-8">
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
      <section className="border-destructive/30 bg-elevated shadow-card flex flex-col gap-4 rounded-3xl border p-6 sm:p-8">
        <div className="flex flex-col gap-1.5">
          <h2 className="text-foreground type-heading-m">Delete account</h2>
          <p className="text-muted-foreground type-body-s">
            Permanently deletes your projects, published pages, and exports. Active
            subscriptions are canceled immediately.
          </p>
        </div>

        <div>
          <Button
            type="button"
            variant="destructive"
            size="sm"
            data-testid="open-delete-account-modal"
            onClick={() => {
              setConfirmEmail("");
              setDeleteError(null);
              setDeleteOpen(true);
            }}
          >
            <Trash2 className="size-3.5" />
            Delete account
          </Button>
        </div>
      </section>

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

      {/* Delete account dialog (Figma 2:12819) */}
      {deleteOpen && (
        <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
          <DialogContent className="max-w-md" data-testid="delete-account-dialog">
            <DialogHeader>
              <div className="flex items-start gap-3">
                <div className="bg-destructive-soft text-destructive flex size-10 shrink-0 items-center justify-center rounded-lg">
                  <AlertTriangle className="size-5" />
                </div>
                <div className="flex flex-col gap-1">
                  <DialogTitle>Delete your account?</DialogTitle>
                  <DialogDescription>
                    This permanently deletes {projectsCount}{" "}
                    {projectsCount === 1 ? "project" : "projects"}, {publishedCount}{" "}
                    published {publishedCount === 1 ? "page" : "pages"} and all exports.
                    This can&apos;t be undone.
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
                  disabled={isPending}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="destructive"
                  disabled={
                    isPending ||
                    confirmEmail.trim().toLowerCase() !== email.toLowerCase()
                  }
                >
                  {isPending ? (
                    <>
                      <Loader2 className="size-4 animate-spin" />
                      Deleting...
                    </>
                  ) : (
                    "Permanently delete"
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
