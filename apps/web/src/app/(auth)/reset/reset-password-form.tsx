"use client";

import { AlertCircle, ArrowLeft, Check } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { requestPasswordResetSchema, resetPasswordSchema } from "@/lib/auth/schemas";
import { cn } from "@/lib/utils";

function computeStrengthScore(password: string): number {
  let score = 0;
  if (password.length >= 8) score += 1;
  if (password.length >= 12) score += 1;
  if (/[A-Z]/.test(password) && /[a-z]/.test(password)) score += 1;
  if (/\d/.test(password) || /[^A-Za-z0-9]/.test(password)) score += 1;
  return score;
}

export function ResetPasswordForm({ token }: { token?: string }) {
  const [email, setEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [requestSent, setRequestSent] = useState(false);
  const [resetDone, setResetDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const strength = computeStrengthScore(newPassword);

  async function handleRequestReset(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = requestPasswordResetSchema.safeParse({ email });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter a valid email address.");
      return;
    }

    setSubmitting(true);
    const { error: resetErr } = await authClient.requestPasswordReset({
      email: parsed.data.email,
      redirectTo: "/reset",
    });
    setSubmitting(false);

    if (resetErr) {
      setError(resetErr.message ?? "Could not send password reset email.");
      return;
    }

    setRequestSent(true);
  }

  async function handleUpdatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const parsed = resetPasswordSchema.safeParse({
      token: token ?? "",
      newPassword,
      confirmPassword,
    });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Check your password fields.");
      return;
    }

    setSubmitting(true);
    const { error: updateErr } = await authClient.resetPassword({
      token: parsed.data.token,
      newPassword: parsed.data.newPassword,
    });
    setSubmitting(false);

    if (updateErr) {
      setError(updateErr.message ?? "Reset link is invalid or expired.");
      return;
    }

    setResetDone(true);
  }

  if (token) {
    if (resetDone) {
      return (
        <div className="flex flex-col gap-6">
          <span
            aria-hidden="true"
            className="bg-success-soft text-success inline-flex size-12 items-center justify-center rounded-md"
          >
            <Check className="size-5" />
          </span>
          <div className="flex flex-col gap-1.5">
            <h1 className="type-heading-l text-foreground">Password updated</h1>
            <p className="text-muted-foreground type-body-m">
              Your Casefolio password has been updated. You can now sign in.
            </p>
          </div>
          <Button asChild size="lg" className="w-full">
            <Link href="/sign-in">Continue to log in</Link>
          </Button>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-6">
        <div className="flex flex-col gap-1.5">
          <h1 className="type-heading-l text-foreground">Choose a new password</h1>
          <p className="text-muted-foreground type-body-m">Make it strong and unique.</p>
        </div>

        {error && (
          <div
            role="alert"
            className="border-destructive/30 bg-destructive-soft text-destructive flex items-start gap-2.5 rounded-md border p-3.5"
          >
            <AlertCircle className="mt-0.5 size-4 shrink-0" />
            <p className="type-caption">{error}</p>
          </div>
        )}

        <form onSubmit={handleUpdatePassword} noValidate className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <InputField
              label="New password"
              name="newPassword"
              type="password"
              autoComplete="new-password"
              placeholder="••••••••••••"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              disabled={submitting}
            />
            <div className="grid grid-cols-4 gap-1.5" aria-hidden="true">
              {[1, 2, 3, 4].map((bar) => (
                <div
                  key={bar}
                  className={cn(
                    "h-1 rounded-full transition-colors",
                    strength >= bar ? "bg-success" : "bg-border",
                  )}
                />
              ))}
            </div>
          </div>

          <InputField
            label="Confirm password"
            name="confirmPassword"
            type="password"
            autoComplete="new-password"
            placeholder="••••••••••••"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            disabled={submitting}
          />

          <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
            {submitting ? "Updating..." : "Update password"}
          </Button>
        </form>
      </div>
    );
  }

  if (requestSent) {
    return (
      <div className="flex flex-col gap-6">
        <span
          aria-hidden="true"
          className="bg-success-soft text-success inline-flex size-12 items-center justify-center rounded-md"
        >
          <Check className="size-5" />
        </span>
        <div className="flex flex-col gap-1.5">
          <h1 className="type-heading-l text-foreground">Reset link sent</h1>
          <p className="text-muted-foreground type-body-m">
            If an account exists for <strong className="text-foreground">{email}</strong>, we sent a password reset link.
          </p>
        </div>
        <Button asChild variant="secondary" size="lg" className="w-full">
          <Link href="/sign-in">Back to log in</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <Link
        href="/sign-in"
        className="text-muted-foreground hover:text-foreground inline-flex w-fit items-center gap-1.5 type-caption"
      >
        <ArrowLeft className="size-3.5" />
        Back to log in
      </Link>

      <div className="flex flex-col gap-1.5">
        <h1 className="type-heading-l text-foreground">Reset your password</h1>
        <p className="text-muted-foreground type-body-m">
          Enter the email you signed up with and we&apos;ll send a reset link.
        </p>
      </div>

      {error && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive flex items-start gap-2.5 rounded-md border p-3.5"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="type-caption">{error}</p>
        </div>
      )}

      <form onSubmit={handleRequestReset} noValidate className="flex flex-col gap-4">
        <InputField
          label="Email"
          name="email"
          type="email"
          autoComplete="email"
          placeholder="ahmed@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
        />

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
          {submitting ? "Sending..." : "Send reset link"}
        </Button>
      </form>
    </div>
  );
}

