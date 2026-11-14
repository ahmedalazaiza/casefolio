"use client";

import { ArrowRight, Check, Loader2, Plus, Sparkles, Upload } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { SUPPORT_TOPICS, type SupportTopic } from "@/lib/help/contact";

export interface ContactSupportProjectOption {
  id: string;
  title: string;
}

export interface ContactSupportClientProps {
  defaultEmail?: string;
  projects?: readonly ContactSupportProjectOption[];
}

export function ContactSupportClient({
  defaultEmail = "",
  projects = [],
}: ContactSupportClientProps) {
  const [email, setEmail] = useState(defaultEmail);
  const [topic, setTopic] = useState<SupportTopic>("Exports");
  const [relatedProject, setRelatedProject] = useState(
    projects[0]?.title ?? "",
  );
  const [subject, setSubject] = useState("");
  const [message, setMessage] = useState("");
  const [attachmentName, setAttachmentName] = useState("");
  const [includeDiagnostics, setIncludeDiagnostics] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [sentTicket, setSentTicket] = useState<{
    ticketCode: string;
    replyToEmail: string;
  } | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);
    setSubmitting(true);

    try {
      const diagnosticSummary =
        includeDiagnostics && typeof navigator !== "undefined"
          ? `${navigator.userAgent.slice(0, 180)}`
          : "";

      const response = await fetch("/api/help/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email,
          topic,
          relatedProject,
          subject,
          message,
          attachmentName,
          includeDiagnostics,
          diagnosticSummary,
        }),
      });

      const json = (await response.json()) as
        | { ok: true; ticketCode: string; replyToEmail: string }
        | { ok: false; error?: string };

      if (!response.ok || !json.ok) {
        setErrorMessage(
          ("error" in json && json.error) ||
            "Could not send message. Please check your details and try again.",
        );
        return;
      }

      setSentTicket({
        ticketCode: json.ticketCode,
        replyToEmail: json.replyToEmail,
      });
    } catch {
      setErrorMessage("Network error while sending support message.");
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTicket) {
    return (
      <section
        data-testid="support-message-sent"
        className="v3-pattern-dots-light flex flex-col items-start gap-6 rounded-[2rem] border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-8 shadow-[var(--cf-shadow-card)] sm:p-12"
      >
        <div className="flex items-center gap-3">
          <span
            aria-hidden="true"
            className="inline-flex size-14 items-center justify-center rounded-2xl bg-[var(--cf-royal)] text-[var(--cf-bg-accent)] shadow-[var(--cf-shadow-royal)]"
          >
            <Check className="size-7" />
          </span>
          <span className="rounded-lg bg-[var(--cf-bg-accent)] px-3 py-1 font-mono text-xs font-bold tracking-wider text-[var(--cf-text-on-accent)] uppercase">
            01 · Dispatched
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <h1 className="v3-display-l text-[var(--cf-text-primary)]">Message sent</h1>
          <p className="text-base leading-relaxed text-[var(--cf-text-secondary)]">
            Ticket #{sentTicket.ticketCode} · We’ll reply to{" "}
            <span className="font-semibold text-[var(--cf-text-primary)]">
              {sentTicket.replyToEmail}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Link href="/help" className="v3-btn-secondary">
            <span>Back to help center</span>
          </Link>
          <Link href="/dashboard" className="v3-btn-primary">
            <span>Go to projects</span>
            <ArrowRight className="size-3.5" />
          </Link>
        </div>
      </section>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <header className="v3-pattern-grid relative overflow-hidden rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-10">
        <div className="flex flex-col gap-3">
          <Eyebrow className="w-fit">
            Support
          </Eyebrow>
          <h1 className="v3-display-l text-[var(--cf-text-primary)]">
            Contact support
          </h1>
          <p className="max-w-2xl text-base leading-relaxed text-[var(--cf-text-secondary)]">
            Tell us what you’re running into and our studio team will reply by email within one
            business day.
          </p>
        </div>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-2xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-6 sm:p-8 lg:col-span-8"
        >
          <div className="flex items-center justify-between border-b border-[var(--cf-border-subtle)] pb-4">
            <div className="flex items-center gap-2">
              <span className="size-2.5 rounded-full bg-[var(--cf-royal)]" />
              <span className="size-2.5 rounded-full bg-[var(--cf-bg-accent)]" />
              <span className="ml-1 font-mono text-[0.6875rem] font-semibold tracking-wider text-[var(--cf-text-tertiary)] uppercase">
                support.casefolio.app/ticket
              </span>
            </div>
            <span className="rounded-md bg-[var(--cf-royal-soft)] px-2.5 py-1 font-mono text-[0.6875rem] font-bold text-[var(--cf-royal-text)]">
              02 · Ticket Details
            </span>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="support-email">Reply-to email</Label>
            <Input
              id="support-email"
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="designer@studio.com"
            />
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="support-topic">Topic</Label>
              <select
                id="support-topic"
                value={topic}
                onChange={(event) => setTopic(event.target.value as SupportTopic)}
                className="h-11 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 text-sm font-medium text-[var(--cf-text-primary)] outline-none transition-colors focus-visible:border-[var(--cf-royal)] focus-visible:ring-2 focus-visible:ring-[var(--cf-royal)]/30"
              >
                {SUPPORT_TOPICS.map((item) => (
                  <option key={item} value={item}>
                    {item}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex flex-col gap-1.5">
              <Label htmlFor="support-project">Related project</Label>
              {projects.length > 0 ? (
                <select
                  id="support-project"
                  value={relatedProject}
                  onChange={(event) => setRelatedProject(event.target.value)}
                  className="h-11 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] px-3.5 text-sm font-medium text-[var(--cf-text-primary)] outline-none transition-colors focus-visible:border-[var(--cf-royal)] focus-visible:ring-2 focus-visible:ring-[var(--cf-royal)]/30"
                >
                  {projects.map((proj) => (
                    <option key={proj.id} value={proj.title}>
                      {proj.title}
                    </option>
                  ))}
                  <option value="">Not project-specific</option>
                </select>
              ) : (
                <Input
                  id="support-project"
                  value={relatedProject}
                  onChange={(event) => setRelatedProject(event.target.value)}
                  placeholder="Optional — e.g. Mosaed — Debt app"
                />
              )}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="support-subject">Subject</Label>
            <Input
              id="support-subject"
              required
              minLength={4}
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="e.g., PDF export is taking longer than expected"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="support-message">Message</Label>
            <textarea
              id="support-message"
              required
              minLength={10}
              rows={5}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder="Describe what happened, the project or template involved, and any steps that help us reproduce it…"
              className="w-full rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3.5 text-sm text-[var(--cf-text-primary)] placeholder:text-[var(--cf-text-tertiary)] outline-none transition-colors focus-visible:border-[var(--cf-royal)] focus-visible:ring-2 focus-visible:ring-[var(--cf-royal)]/30"
            />
          </div>

          <div className="flex flex-col gap-2">
            <label
              htmlFor="support-attachment"
              className="flex max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border border-dashed border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-6 text-center transition-colors hover:border-[var(--cf-royal)] hover:bg-[var(--cf-bg-surface)]"
            >
              <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cf-royal)] text-[var(--cf-bg-accent)]">
                <Upload className="size-4" />
              </span>
              <span className="text-sm font-semibold text-[var(--cf-text-primary)]">
                {attachmentName || "Attach screenshots (optional)"}
              </span>
              <span className="font-mono text-xs text-[var(--cf-text-secondary)]">
                PNG / JPG · up to 10 MB
              </span>
              <input
                id="support-attachment"
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(event) => {
                  const file = event.target.files?.[0];
                  setAttachmentName(file?.name ?? "");
                }}
              />
            </label>
          </div>

          <label className="flex items-center gap-2.5 text-sm font-medium text-[var(--cf-text-primary)]">
            <input
              type="checkbox"
              checked={includeDiagnostics}
              onChange={(event) => setIncludeDiagnostics(event.target.checked)}
              className="size-4 rounded-xs accent-[var(--cf-royal)]"
            />
            <span>Include diagnostic info (browser, project ID)</span>
          </label>

          {errorMessage && (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive-soft text-destructive rounded-xl border px-3.5 py-2.5 text-sm font-medium"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="v3-btn-primary disabled:pointer-events-none disabled:opacity-60"
            >
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  <span>Sending…</span>
                </>
              ) : (
                <>
                  <span>Send message</span>
                  <Plus className="size-3.5" />
                </>
              )}
            </button>
          </div>
        </form>

        <aside className="v3-pattern-dots-dark v3-sheet-royal flex flex-col gap-4 rounded-2xl border border-[var(--cf-border-on-royal)] p-6 sm:p-7 lg:col-span-4">
          <div className="flex items-center justify-between">
            <span className="inline-flex size-10 items-center justify-center rounded-xl bg-[var(--cf-bg-accent)] text-[var(--cf-text-on-accent)]">
              <Sparkles className="size-5" />
            </span>
            <span className="rounded-md bg-[var(--cf-bg-inverse-elevated)] px-2.5 py-1 font-mono text-[0.6875rem] font-bold tracking-wider text-[var(--cf-bg-accent)] uppercase">
              03 · Checklist
            </span>
          </div>
          <h2 className="v3-heading-s text-[var(--cf-text-on-royal)]">Before you send</h2>
          <ul className="flex list-disc flex-col gap-2.5 pl-4 text-sm leading-relaxed text-[var(--cf-text-on-royal-muted)]">
            <li>Check your Exports tab first for one-click retry options</li>
            <li>Include your live page URL or custom slug for publishing issues</li>
            <li>Billing question? Share your Paddle receipt email or invoice date</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

