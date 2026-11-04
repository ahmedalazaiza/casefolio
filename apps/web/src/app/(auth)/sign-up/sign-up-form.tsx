"use client";

import { AlertCircle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
import { InputField } from "@/components/ui/input";
import { authClient } from "@/lib/auth/client";
import { signUpSchema } from "@/lib/auth/schemas";

export function SignUpForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleGoogleSignUp() {
    setFormError(null);
    setSubmitting(true);
    const { error } = await authClient.signIn.social({
      provider: "google",
      callbackURL: "/onboarding",
    });
    if (error) {
      setFormError(error.message ?? "Unable to connect to Google right now.");
      setSubmitting(false);
    }
  }

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFieldErrors({});
    setFormError(null);

    const parsed = signUpSchema.safeParse({
      name,
      email,
      password,
      acceptTerms,
    });

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
    const { error } = await authClient.signUp.email({
      name: parsed.data.name,
      email: parsed.data.email,
      password: parsed.data.password,
    });

    if (error) {
      setFormError(error.message ?? "Could not create your account. Try another email.");
      setSubmitting(false);
      return;
    }

    const params = new URLSearchParams({
      email: parsed.data.email,
      name: parsed.data.name,
    });
    router.push(`/verify?${params.toString()}`);
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-col gap-1.5">
        <h1 className="type-heading-l text-foreground">Create your account</h1>
        <p className="text-muted-foreground type-body-m">
          Start building case studies in minutes.
        </p>
      </div>

      <Button
        type="button"
        variant="secondary"
        size="lg"
        className="w-full"
        disabled={submitting}
        onClick={handleGoogleSignUp}
      >
        <span
          aria-hidden="true"
          className="bg-sunken text-foreground inline-flex size-5 items-center justify-center rounded-full type-caption"
        >
          G
        </span>
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

      <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
        <InputField
          label="Full name"
          name="name"
          autoComplete="name"
          placeholder="Ahmed Al-Azaiza"
          value={name}
          onChange={(e) => setName(e.target.value)}
          error={fieldErrors.name}
          disabled={submitting}
        />

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
          autoComplete="new-password"
          placeholder="••••••••••••"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          helperText="At least 8 characters"
          error={fieldErrors.password}
          disabled={submitting}
        />

        <div className="flex flex-col gap-1 pt-1">
          <label className="flex cursor-pointer items-center gap-2.5">
            <input
              type="checkbox"
              name="acceptTerms"
              checked={acceptTerms}
              onChange={(e) => setAcceptTerms(e.target.checked)}
              disabled={submitting}
              className="accent-primary border-input size-4 rounded-xs"
            />
            <span className="text-foreground type-caption">
              I agree to the{" "}
              <Link href="/terms" className="text-primary hover:underline">
                Terms
              </Link>{" "}
              and{" "}
              <Link href="/privacy" className="text-primary hover:underline">
                Privacy Policy
              </Link>
            </span>
          </label>
          {fieldErrors.acceptTerms && (
            <p className="text-destructive type-caption">{fieldErrors.acceptTerms}</p>
          )}
        </div>

        <Button type="submit" size="lg" className="mt-2 w-full" disabled={submitting}>
          {submitting ? "Creating account..." : "Create account"}
        </Button>
      </form>

      <p className="text-muted-foreground type-caption">
        Already have an account?{" "}
        <Link href="/sign-in" className="text-primary font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  );
}
