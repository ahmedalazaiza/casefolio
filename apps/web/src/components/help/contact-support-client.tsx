"use client";

import { Check, Loader2, Plus, Upload } from "lucide-react";
import Link from "next/link";
import { useState, type FormEvent } from "react";
import { Button } from "@/components/ui/button";
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

  // Message sent confirmation view matching Figma 2:10147
  if (sentTicket) {
    return (
      <section
        data-testid="support-message-sent"
        className="border-border bg-surface flex flex-col items-start gap-5 rounded-xl border p-8 sm:p-12"
      >
        <span
          aria-hidden="true"
          className="bg-success-soft text-success inline-flex size-16 items-center justify-center rounded-xl"
        >
          <Check className="size-7" />
        </span>

        <div className="flex flex-col gap-1.5">
          <h1 className="text-foreground type-display-m">Message sent</h1>
          <p className="text-muted-foreground type-body-m">
            Ticket #{sentTicket.ticketCode} · We’ll reply to{" "}
            <span className="text-foreground font-medium">
              {sentTicket.replyToEmail}
            </span>
            .
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3 pt-1">
          <Button variant="secondary" asChild>
            <Link href="/help">Back to help center</Link>
          </Button>
          <Button asChild>
            <Link href="/dashboard">Go to projects</Link>
          </Button>
        </div>
      </section>
    );
  }

  // Contact support form matching Figma 2:10019
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <p className="text-accent-foreground type-overline">Support</p>
        <h1 className="text-foreground type-display-m">Contact support</h1>
        <p className="text-muted-foreground type-body-m">
          Tell us what you’re running into and our team will reply by email within one business day.
        </p>
      </header>

      <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-12">
        <form
          onSubmit={handleSubmit}
          className="border-border bg-card flex flex-col gap-5 rounded-xl border p-6 sm:p-8 lg:col-span-8"
        >
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
                onChange={(event) =>
                  setTopic(event.target.value as SupportTopic)
                }
                className="border-input bg-background text-foreground focus-visible:ring-ring/40 type-body-m h-11 rounded-md border px-3 outline-none focus-visible:ring-2"
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
                  className="border-input bg-background text-foreground focus-visible:ring-ring/40 type-body-m h-11 rounded-md border px-3 outline-none focus-visible:ring-2"
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
              className="border-input bg-background text-foreground placeholder:text-muted-foreground focus-visible:ring-ring/40 type-body-m w-full rounded-md border p-3 outline-none focus-visible:ring-2"
            />
          </div>

          {/* Optional screenshot attachment slot matching Figma 2:10124 */}
          <div className="flex flex-col gap-2">
            <label
              htmlFor="support-attachment"
              className="border-border-strong bg-surface hover:bg-sunken flex max-w-xs cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed p-6 text-center transition-colors"
            >
              <span className="bg-accent text-accent-foreground inline-flex size-10 items-center justify-center rounded-full">
                <Upload className="size-4" />
              </span>
              <span className="text-foreground type-body-s-strong">
                {attachmentName || "Attach screenshots (optional)"}
              </span>
              <span className="text-muted-foreground type-caption">
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

          <label className="text-foreground type-body-s flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={includeDiagnostics}
              onChange={(event) => setIncludeDiagnostics(event.target.checked)}
              className="accent-primary size-4 rounded-xs"
            />
            <span>Include diagnostic info (browser, project ID)</span>
          </label>

          {errorMessage && (
            <p
              role="alert"
              className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-lg border px-3.5 py-2.5"
            >
              {errorMessage}
            </p>
          )}

          <div className="flex justify-end pt-1">
            <Button type="submit" size="lg" disabled={submitting}>
              {submitting ? (
                <>
                  <Loader2 className="size-4 animate-spin" />
                  Sending…
                </>
              ) : (
                <>
                  <Plus className="size-4" />
                  Send message
                </>
              )}
            </Button>
          </div>
        </form>

        {/* Side panel matching Figma 2:10144 */}
        <aside className="border-border bg-sunken flex flex-col gap-3 rounded-xl border p-6 lg:col-span-4">
          <h2 className="text-foreground type-heading-s">Before you send</h2>
          <ul className="text-muted-foreground type-body-s flex list-disc flex-col gap-2 pl-4">
            <li>Check your Exports tab first for one-click retry options</li>
            <li>Include your live page URL or custom slug for publishing issues</li>
            <li>Billing question? Share your Paddle receipt email or invoice date</li>
          </ul>
        </aside>
      </div>
    </div>
  );
}

