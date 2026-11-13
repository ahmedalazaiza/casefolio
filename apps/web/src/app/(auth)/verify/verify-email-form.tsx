"use client";

import { AlertCircle, ArrowRight, Check, Send } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type ClipboardEvent, type FormEvent, type KeyboardEvent } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { toast } from "@/components/ui/toast";
import { authClient } from "@/lib/auth/client";
import { verifyEmailOtpSchema } from "@/lib/auth/schemas";
import { cn } from "@/lib/utils";

export function VerifyEmailForm({
  initialEmail = "",
  initialName = "",
}: {
  initialEmail?: string;
  initialName?: string;
}) {
  const [email, setEmail] = useState(initialEmail);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [verified, setVerified] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const inputRefs = useRef<Array<HTMLInputElement | null>>([]);

  const firstName = initialName.trim().split(/\s+/)[0] || "";

  function updateDigit(index: number, raw: string) {
    const cleaned = raw.replace(/\D/g, "").slice(-1);
    const next = [...digits];
    next[index] = cleaned;
    setDigits(next);

    if (cleaned && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }
  }

  function handleKeyDown(index: number, event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Backspace" && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  }

  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = event.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;
    event.preventDefault();
    const next = ["", "", "", "", "", ""];
    for (let i = 0; i < pasted.length; i += 1) {
      next[i] = pasted[i] ?? "";
    }
    setDigits(next);
    const focusIndex = Math.min(5, pasted.length);
    inputRefs.current[focusIndex]?.focus();
  }

  async function handleResend() {
    setError(null);
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    const { error: resendErr } = await authClient.emailOtp.sendVerificationOtp({
      email: email.trim(),
      type: "email-verification",
    });

    if (resendErr) {
      setError(resendErr.message ?? "Could not resend verification code.");
      return;
    }

    toast("Sent a new 6-digit verification code.");
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    const otp = digits.join("");
    const parsed = verifyEmailOtpSchema.safeParse({ email, otp });
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Enter the 6-digit code.");
      return;
    }

    setSubmitting(true);
    const { error: verifyErr } = await authClient.emailOtp.verifyEmail({
      email: parsed.data.email,
      otp: parsed.data.otp,
    });
    setSubmitting(false);

    if (verifyErr) {
      setError(verifyErr.message ?? "Invalid or expired verification code.");
      return;
    }

    setVerified(true);
  }

  if (verified) {
    return (
      <div className="flex flex-col gap-6">
        <span
          aria-hidden="true"
          className="bg-success-soft text-success inline-flex size-12 items-center justify-center rounded-md"
        >
          <Check className="size-5" />
        </span>

        <div className="flex flex-col gap-1.5">
          <h1 className="type-heading-l text-foreground">Email verified</h1>
          <p className="text-muted-foreground type-body-m">
            Thanks{firstName ? `, ${firstName}` : ""}. Let&apos;s set up your workspace.
          </p>
        </div>

        <Button asChild size="lg" className="w-full">
          <Link href="/onboarding">
            Start onboarding
            <ArrowRight className="size-4" />
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <span
        aria-hidden="true"
        className="bg-sunken text-foreground inline-flex size-12 items-center justify-center rounded-md"
      >
        <Send className="size-5" />
      </span>

      <div className="flex flex-col gap-1.5">
        <h1 className="type-heading-l text-foreground">Verify your email</h1>
        <p className="text-muted-foreground type-body-m">
          Enter the 6-digit code we sent to{" "}
          <span className="text-foreground font-medium">
            {email || "your email address"}
          </span>
          .
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

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-5">
        {!initialEmail && (
          <InputField
            label="Email"
            name="email"
            type="email"
            placeholder="you@studio.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={submitting}
          />
        )}

        <div className="grid grid-cols-6 gap-2.5" role="group" aria-label="6-digit verification code">
          {digits.map((digit, index) => (
            <input
              key={index}
              ref={(el) => {
                inputRefs.current[index] = el;
              }}
              type="text"
              inputMode="numeric"
              maxLength={1}
              aria-label={`Verification digit ${index + 1}`}
              value={digit}
              onChange={(e) => updateDigit(index, e.target.value)}
              onKeyDown={(e) => handleKeyDown(index, e)}
              onPaste={handlePaste}
              disabled={submitting}
              className={cn(
                "border-input bg-elevated text-foreground focus-visible:border-ring focus-visible:ring-ring/20 h-14 w-full rounded-md border text-center type-heading-m transition-colors outline-none focus-visible:ring-2",
              )}
            />
          ))}
        </div>

        <Button type="submit" size="lg" className="w-full" disabled={submitting}>
          {submitting ? "Verifying..." : "Verify email"}
        </Button>
      </form>

      <div className="flex flex-col gap-2">
        <p className="text-muted-foreground type-caption">
          No code?{" "}
          <button
            type="button"
            onClick={handleResend}
            className="text-primary font-medium hover:underline"
          >
            Resend
          </button>{" "}
          ·{" "}
          <Link href="/sign-up" className="text-primary font-medium hover:underline">
            Change email
          </Link>
        </p>

        <p className="text-tertiary type-caption">
          Email taking a moment?{" "}
          <Link
            href="/onboarding"
            data-testid="skip-verify-for-now"
            className="text-foreground font-medium underline underline-offset-4 hover:opacity-80"
          >
            Continue to workspace for now
          </Link>
        </p>
      </div>
    </div>
  );
}

