"use client";

import { AlertCircle, ArrowRight, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { InputField } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/client";
import { sanitizeCallbackUrl } from "@/lib/auth/safe-redirect";
import { magicLinkSchema, signInPasswordSchema } from "@/lib/auth/schemas";

export function SignInForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const safeCallback = sanitizeCallbackUrl(callbackUrl);
  const hasCustomCallback = Boolean(callbackUrl && safeCallback !== "/dashboard");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(true);
  const [magicEmail, setMagicEmail] = useState("");
  const [magicSent, setMagicSent] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleSignIn() {
    setFormError(null);
    setSubmitting(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: safeCallback,
    });
    if (error) {
      setFormError(error.message ?? "Unable to sign in with Google right now.");
      setSubmitting(false);
    }
  }

  async function handlePasswordSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = signInPasswordSchema.safeParse({ email, password, rememberMe });
    if (!parsed.success) {
      const nextErrors: Record<string, string> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "form");
        if (!nextErrors[key]) {
          nextErrors[key] = issue.message;
        }
      }
      setFieldErrors(nextErrors);
      return;
    }

    setSubmitting(true);
    const { error } = await authClient.signIn.email({
      email: parsed.data.email,
      password: parsed.data.password,
      rememberMe: parsed.data.rememberMe,
    });

    if (error) {
      if (error.code === "EMAIL_NOT_VERIFIED") {
        // The server already sent a fresh verification code; continue on /verify instead of dead-ending.
        const params = new URLSearchParams({ email: parsed.data.email, sent: "1" });
        if (hasCustomCallback) {
          params.set("callbackUrl", safeCallback);
        }
        router.push(`/verify?${params.toString()}`);
        return;
      }
      setFormError(error.message ?? "Email or password is incorrect.");
      setFieldErrors({ password: "Check your password and try again" });
      setSubmitting(false);
      return;
    }

    router.push(safeCallback);
    router.refresh();
  }

  async function handleMagicLinkSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = magicLinkSchema.safeParse({ email: magicEmail });
    if (!parsed.success) {
      setFieldErrors({
        magicEmail: parsed.error.issues[0]?.message ?? "Enter a valid email address.",
      });
      return;
    }

    setSubmitting(true);
    const { error } = await authClient.signIn.magicLink({
      email: parsed.data.email,
      callbackURL: safeCallback,
    });
    setSubmitting(false);

    if (error) {
      setFormError(error.message ?? "Could not send magic link right now.");
      return;
    }

    setMagicSent(true);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col gap-2">
        <p className="cf-lp-kicker text-[var(--cf-lp-kicker-muted)]">WELCOME BACK</p>
        <h1 className="font-editorial text-[2.375rem] leading-[1.04] font-normal tracking-[-0.04em] text-[var(--cf-lp-ink)]">
          Continue your story.
        </h1>
        <p className="text-[0.8125rem] leading-relaxed text-[var(--cf-lp-subtle)]">
          Sign in to edit, publish, and share your case studies.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="h-11 w-full rounded-[0.375rem] border-[var(--cf-lp-input-border)] bg-[var(--cf-lp-google-bg)] text-[0.8125rem] font-medium text-[var(--cf-lp-ink)] hover:bg-[var(--cf-lp-card)]"
        disabled={submitting}
        onClick={handleGoogleSignIn}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <div className="h-px flex-1 bg-[var(--cf-lp-card-border)]" />
        <span className="font-mono text-[0.6875rem] text-[var(--cf-lp-kicker-muted)]">or</span>
        <div className="h-px flex-1 bg-[var(--cf-lp-card-border)]" />
      </div>

      {formError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive flex items-start gap-2.5 rounded-[0.375rem] border p-3.5"
        >
          <AlertCircle className="mt-0.5 size-4 shrink-0" />
          <p className="type-caption">{formError}</p>
        </div>
      )}

      <Tabs defaultValue="password">
        <TabsList className="w-full">
          <TabsTrigger value="password" className="flex-1">
            Email & password
          </TabsTrigger>
          <TabsTrigger value="magic-link" className="flex-1">
            Magic link
          </TabsTrigger>
        </TabsList>

        <TabsContent value="password" className="pt-2">
          <form onSubmit={handlePasswordSubmit} noValidate className="flex flex-col gap-3.5">
            <InputField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="alex@casefol.io"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={fieldErrors.email}
              disabled={submitting}
            />

            <InputField
              label="Password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="••••••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={fieldErrors.password}
              disabled={submitting}
            />

            <div className="flex items-center justify-between gap-2 pt-0.5">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={submitting}
                  className="accent-primary border-[var(--cf-lp-input-border)] size-4 rounded-xs"
                />
                <span className="text-[0.75rem] text-[var(--cf-lp-ink)]">Remember me</span>
              </label>

              <Link
                href="/reset"
                className="text-[0.75rem] font-medium text-[var(--cf-lp-ink)] underline underline-offset-4 hover:opacity-75"
              >
                Forgot password?
              </Link>
            </div>

            <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
              <span>{submitting ? "Logging in..." : "Log in to your studio"}</span>
              <ArrowRight className="size-4" />
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic-link" className="pt-2">
          {magicSent ? (
            <div className="flex flex-col gap-3 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-5">
              <div className="text-success flex items-center gap-2">
                <CheckCircle2 className="size-5 shrink-0" />
                <p className="type-body-s-strong">Check your inbox</p>
              </div>
              <p className="text-muted-foreground type-body-s">
                We sent a one-click sign-in link to{" "}
                <strong className="text-foreground">{magicEmail}</strong>.
              </p>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                className="w-fit"
                onClick={() => setMagicSent(false)}
              >
                Use another email
              </Button>
            </div>
          ) : (
            <form onSubmit={handleMagicLinkSubmit} noValidate className="flex flex-col gap-4">
              <InputField
                label="Email"
                name="magicEmail"
                type="email"
                autoComplete="email"
                placeholder="alex@casefol.io"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                helperText="We’ll email you a one-click, passwordless sign-in link."
                error={fieldErrors.magicEmail}
                disabled={submitting}
              />

              <Button type="submit" size="lg" className="w-full" disabled={submitting}>
                <Mail className="size-4" />
                {submitting ? "Sending link..." : "Send magic link"}
              </Button>
            </form>
          )}
        </TabsContent>
      </Tabs>

      <p className="text-[0.75rem] text-[var(--cf-lp-subtle)]">
        New to Casefolio?{" "}
        <Link
          href={
            hasCustomCallback
              ? `/sign-up?callbackUrl=${encodeURIComponent(safeCallback)}`
              : "/sign-up"
          }
          className="font-semibold text-[var(--cf-lp-ink)] underline underline-offset-4 hover:opacity-75"
        >
          Create a free account
        </Link>
      </p>
    </div>
  );
}
