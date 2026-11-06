"use client";

import { AlertCircle, CheckCircle2, Mail } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { GoogleIcon } from "@/components/ui/google-icon";
import { InputField } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { authClient } from "@/lib/auth/client";
import { magicLinkSchema, signInPasswordSchema } from "@/lib/auth/schemas";

function sanitizeCallbackUrl(raw?: string): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) {
    return "/dashboard";
  }
  return raw;
}

export function SignInForm({ callbackUrl }: { callbackUrl?: string }) {
  const router = useRouter();
  const safeCallback = sanitizeCallbackUrl(callbackUrl);

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
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-heading-l text-foreground">Welcome back</h1>
        <p className="text-muted-foreground type-body-m">Log in to continue your case studies.</p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={submitting}
        onClick={handleGoogleSignIn}
      >
        <GoogleIcon />
        Continue with Google
      </Button>

      <div className="flex items-center gap-3">
        <div className="bg-border h-px flex-1" />
        <span className="text-tertiary type-caption">or</span>
        <div className="bg-border h-px flex-1" />
      </div>

      {formError && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive flex items-start gap-2.5 rounded-md border p-3.5"
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
          <form onSubmit={handlePasswordSubmit} noValidate className="flex flex-col gap-4">
            <InputField
              label="Email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="ahmed@example.com"
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

            <div className="flex items-center justify-between gap-2 pt-1">
              <label className="flex cursor-pointer items-center gap-2">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  disabled={submitting}
                  className="accent-primary border-input size-4 rounded-xs"
                />
                <span className="text-foreground type-caption">Remember me</span>
              </label>

              <Link href="/reset" className="text-primary type-caption hover:underline">
                Forgot password?
              </Link>
            </div>

            <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
              {submitting ? "Logging in..." : "Log in"}
            </Button>
          </form>
        </TabsContent>

        <TabsContent value="magic-link" className="pt-2">
          {magicSent ? (
            <div className="border-border bg-surface flex flex-col gap-3 rounded-lg border p-5">
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
                placeholder="ahmed@example.com"
                value={magicEmail}
                onChange={(e) => setMagicEmail(e.target.value)}
                helperText="We will email you a passwordless sign-in link."
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

      <p className="text-muted-foreground type-caption">
        New to Casefolio?{" "}
        <Link href="/sign-up" className="text-primary font-medium underline underline-offset-4">
          Create an account
        </Link>
      </p>
    </div>
  );
}
