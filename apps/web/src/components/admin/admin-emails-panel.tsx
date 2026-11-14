"use client";

import {
  CheckCircle2,
  FileText,
  Laptop,
  Mail,
  Send,
  Smartphone,
} from "lucide-react";
import { useMemo, useState, useTransition } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Eyebrow } from "@/components/ui/eyebrow";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import type {
  AdminEmailDepartmentSummary,
  AdminEmailPreviewPayload,
  AdminEmailTemplateSummary,
} from "@/lib/admin/emails-types";
import type { EmailDepartment } from "@/lib/email/senders";
import { cn } from "@/lib/utils";

type StudioTab = "catalog" | "compose";
type PreviewViewport = "desktop" | "mobile" | "plaintext";

export function AdminEmailsPanel({
  departments,
  templates,
  initialPreview,
  adminEmail,
  liveResendConfigured,
  emailDomain,
}: {
  departments: AdminEmailDepartmentSummary[];
  templates: AdminEmailTemplateSummary[];
  initialPreview: AdminEmailPreviewPayload;
  adminEmail: string;
  liveResendConfigured: boolean;
  emailDomain: string;
}) {
  const [activeTab, setActiveTab] = useState<StudioTab>("catalog");
  const [departmentFilter, setDepartmentFilter] = useState<"all" | EmailDepartment>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [viewport, setViewport] = useState<PreviewViewport>("desktop");
  const [preview, setPreview] = useState<AdminEmailPreviewPayload>(initialPreview);
  const [loadingPreviewKey, setLoadingPreviewKey] = useState<string | null>(null);

  const [testRecipient, setTestRecipient] = useState(adminEmail);
  const [statusNotice, setStatusNotice] = useState<string | null>(null);
  const [errorNotice, setErrorNotice] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Direct Admin Notice form state
  const [composeRecipientEmail, setComposeRecipientEmail] = useState("");
  const [composeRecipientName, setComposeRecipientName] = useState("");
  const [composeSubject, setComposeSubject] = useState("");
  const [composeHeading, setComposeHeading] = useState("");
  const [composeMessage, setComposeMessage] = useState("");
  const [composeCtaLabel, setComposeCtaLabel] = useState("Open Dashboard");
  const [composeCtaUrl, setComposeCtaUrl] = useState("");

  const filteredTemplates = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return templates.filter((item) => {
      if (departmentFilter !== "all" && item.department !== departmentFilter) {
        return false;
      }
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.key.toLowerCase().includes(q) ||
        item.senderAddress.toLowerCase().includes(q) ||
        item.audienceLabel.toLowerCase().includes(q) ||
        item.triggerSummary.toLowerCase().includes(q)
      );
    });
  }, [templates, departmentFilter, searchQuery]);

  async function handleSelectTemplate(templateKey: string) {
    if (templateKey === preview.key) return;
    setErrorNotice(null);
    setStatusNotice(null);
    setLoadingPreviewKey(templateKey);
    try {
      const res = await fetch(
        `/api/admin/emails?template=${encodeURIComponent(templateKey)}`,
        { cache: "no-store" },
      );
      const data = (await res.json().catch(() => ({}))) as {
        preview?: AdminEmailPreviewPayload;
        error?: string;
      };
      if (!res.ok || !data.preview) {
        setErrorNotice(data.error ?? "Could not load template preview.");
        return;
      }
      setPreview(data.preview);
    } finally {
      setLoadingPreviewKey(null);
    }
  }

  function handleSendTestEmail() {
    setErrorNotice(null);
    setStatusNotice(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_test",
          templateKey: preview.key,
          recipientEmail: testRecipient,
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        from?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorNotice(data.error ?? "Failed to dispatch test email.");
        return;
      }
      setStatusNotice(
        data.delivered
          ? `Test email delivered via Resend from ${data.from} to ${testRecipient}.`
          : `Rendered & verified from ${data.from} (local dev key active — add live RESEND_API_KEY on ${emailDomain} to deliver externally).`,
      );
    });
  }

  function handleSendAdminNotice(event: React.FormEvent) {
    event.preventDefault();
    setErrorNotice(null);
    setStatusNotice(null);

    startTransition(async () => {
      const res = await fetch("/api/admin/emails", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "send_admin_notice",
          recipientEmail: composeRecipientEmail,
          recipientName: composeRecipientName || undefined,
          subject: composeSubject,
          heading: composeHeading,
          message: composeMessage,
          ctaLabel: composeCtaLabel || undefined,
          ctaUrl: composeCtaUrl || "",
        }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        delivered?: boolean;
        from?: string;
        error?: string;
      };
      if (!res.ok || !data.ok) {
        setErrorNotice(data.error ?? "Failed to send administrative notice.");
        return;
      }
      setStatusNotice(
        data.delivered
          ? `Official notice sent from ${data.from} to ${composeRecipientEmail}.`
          : `Official notice prepared from ${data.from} for ${composeRecipientEmail} (local dev mode active).`,
      );
      setComposeSubject("");
      setComposeHeading("");
      setComposeMessage("");
    });
  }

  const adminDept = departments.find((d) => d.department === "admin");

  return (
    <div className="mx-auto flex w-full max-w-7xl min-w-0 flex-col gap-6">
      {/* Header */}
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-2">
          <Eyebrow className="w-fit">Transactional Email System</Eyebrow>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-foreground type-display-m">Email studio & routing</h1>
            <Badge tone={liveResendConfigured ? "published" : "neutral"}>
              {liveResendConfigured ? "Resend Live" : "Dev Preview Mode"}
            </Badge>
          </div>
          <p className="text-muted-foreground type-body-s max-w-2xl">
            Every Casefolio lifecycle, security, team, billing, support, and moderation scenario
            styled in V3 Flat-Editorial tokens and routed from dedicated @{emailDomain} mailboxes.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={activeTab === "catalog" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("catalog")}
          >
            <Mail className="size-4" />
            Template catalog ({templates.length})
          </Button>
          <Button
            type="button"
            variant={activeTab === "compose" ? "default" : "secondary"}
            size="sm"
            onClick={() => setActiveTab("compose")}
          >
            <Send className="size-4" />
            Send from Admin
          </Button>
        </div>
      </header>

      {/* Departmental Sender Architecture Bar */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {departments.map((dept) => {
          const isSelected = departmentFilter === dept.department && activeTab === "catalog";
          return (
            <button
              key={dept.department}
              type="button"
              onClick={() => {
                setActiveTab("catalog");
                setDepartmentFilter((prev) =>
                  prev === dept.department ? "all" : dept.department,
                );
              }}
              className={cn(
                "flex min-w-0 flex-col items-start gap-1 rounded-xl border p-3.5 text-left transition-colors",
                isSelected
                  ? "border-[var(--cf-royal)] bg-[var(--cf-bg-elevated)]"
                  : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] hover:border-[var(--cf-border-strong)]",
              )}
            >
              <span className="v3-label text-[var(--cf-royal-text)] uppercase">
                {dept.badgeLabel}
              </span>
              <span
                title={dept.address}
                className="text-foreground w-full truncate font-mono text-xs font-semibold"
              >
                {dept.address}
              </span>
              <span className="text-muted-foreground text-xs">{dept.displayName}</span>
            </button>
          );
        })}
      </div>

      {errorNotice && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-xl border px-4 py-3"
        >
          {errorNotice}
        </div>
      )}

      {statusNotice && (
        <div
          role="status"
          className="border-success/30 bg-success-soft text-foreground type-body-s flex items-center gap-2 rounded-xl border px-4 py-3"
        >
          <CheckCircle2 className="text-success size-4 shrink-0" />
          <span>{statusNotice}</span>
        </div>
      )}

      {activeTab === "catalog" ? (
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Left Column: Filter + Template List */}
          <Card className="flex min-w-0 flex-col gap-4 p-4 lg:col-span-4">
            <div className="flex flex-col gap-2.5">
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search scenario, sender, or key..."
                aria-label="Search email templates"
              />
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="button"
                  onClick={() => setDepartmentFilter("all")}
                  className={cn(
                    "rounded-lg border px-2.5 py-1 text-xs font-medium transition-colors",
                    departmentFilter === "all"
                      ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                      : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                  )}
                >
                  All ({templates.length})
                </button>
                {departments.map((dept) => (
                  <button
                    key={dept.department}
                    type="button"
                    onClick={() => setDepartmentFilter(dept.department)}
                    className={cn(
                      "rounded-lg border px-2.5 py-1 text-xs font-medium capitalize transition-colors",
                      departmentFilter === dept.department
                        ? "border-[var(--cf-royal)] bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                        : "border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] text-[var(--cf-text-secondary)] hover:text-[var(--cf-text-primary)]",
                    )}
                  >
                    {dept.department}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex max-h-160 flex-col gap-1.5 overflow-y-auto pr-1">
              {filteredTemplates.map((item) => {
                const active = item.key === preview.key;
                const loading = loadingPreviewKey === item.key;
                return (
                  <button
                    key={item.key}
                    type="button"
                    onClick={() => handleSelectTemplate(item.key)}
                    className={cn(
                      "flex flex-col items-start gap-1 rounded-xl border px-3.5 py-3 text-left transition-colors",
                      active
                        ? "border-[var(--cf-royal)] bg-[var(--cf-bg-canvas)]"
                        : "border-transparent hover:border-[var(--cf-border-subtle)] hover:bg-[var(--cf-bg-canvas)]/60",
                    )}
                  >
                    <div className="flex w-full items-center justify-between gap-2">
                      <span className="v3-label text-[var(--cf-royal-text)] uppercase">
                        {item.audienceLabel}
                      </span>
                      <span className="text-muted-foreground font-mono text-xs">
                        {loading ? "Loading..." : item.senderAddress.split("@")[0] + "@"}
                      </span>
                    </div>
                    <span className="text-foreground text-sm font-semibold">{item.title}</span>
                    <span className="text-muted-foreground line-clamp-2 text-xs">
                      {item.triggerSummary}
                    </span>
                  </button>
                );
              })}

              {filteredTemplates.length === 0 && (
                <p className="text-muted-foreground py-8 text-center text-sm">
                  No templates match your filter.
                </p>
              )}
            </div>
          </Card>

          {/* Right Column: Live Email Envelope + HTML/Text Preview */}
          <div className="flex min-w-0 flex-col gap-4 lg:col-span-8">
            <Card className="flex flex-col gap-4 p-5">
              <div className="flex flex-col justify-between gap-3 border-b border-[var(--cf-border-subtle)] pb-4 sm:flex-row sm:items-center">
                <div className="flex flex-col gap-0.5">
                  <span className="v3-label text-[var(--cf-royal-text)] uppercase">
                    Template key: {preview.key}
                  </span>
                  <h2 className="text-foreground type-heading-s">{preview.title}</h2>
                </div>

                <div className="flex items-center gap-1.5">
                  <Button
                    type="button"
                    size="sm"
                    variant={viewport === "desktop" ? "default" : "secondary"}
                    onClick={() => setViewport("desktop")}
                  >
                    <Laptop className="size-3.5" />
                    Desktop
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewport === "mobile" ? "default" : "secondary"}
                    onClick={() => setViewport("mobile")}
                  >
                    <Smartphone className="size-3.5" />
                    Mobile
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={viewport === "plaintext" ? "default" : "secondary"}
                    onClick={() => setViewport("plaintext")}
                  >
                    <FileText className="size-3.5" />
                    Plain text
                  </Button>
                </div>
              </div>

              {/* Envelope Headers */}
              <dl className="grid gap-2.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-4 text-xs sm:grid-cols-2">
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground font-mono uppercase">From header</dt>
                  <dd className="text-foreground font-mono font-semibold">{preview.from}</dd>
                </div>
                <div className="flex flex-col gap-0.5">
                  <dt className="text-muted-foreground font-mono uppercase">Reply-To header</dt>
                  <dd className="text-foreground font-mono font-semibold">{preview.replyTo}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <dt className="text-muted-foreground font-mono uppercase">Subject line</dt>
                  <dd className="text-foreground text-sm font-semibold">{preview.subject}</dd>
                </div>
                <div className="flex flex-col gap-0.5 sm:col-span-2">
                  <dt className="text-muted-foreground font-mono uppercase">Backend trigger</dt>
                  <dd className="text-muted-foreground">{preview.triggerSummary}</dd>
                </div>
              </dl>

              {/* Send Test Dispatch Bar */}
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <Input
                  type="email"
                  value={testRecipient}
                  onChange={(e) => setTestRecipient(e.target.value)}
                  placeholder="Recipient email for test dispatch..."
                  aria-label="Test email recipient"
                  className="sm:flex-1"
                />
                <Button
                  type="button"
                  disabled={isPending || !testRecipient.trim()}
                  onClick={handleSendTestEmail}
                >
                  <Send className="size-4" />
                  Send test ({preview.senderAddress})
                </Button>
              </div>
            </Card>

            {/* Rendered Viewport */}
            <Card className="flex items-center justify-center overflow-hidden bg-[var(--cf-bg-canvas)] p-4">
              {viewport === "plaintext" ? (
                <pre className="text-foreground max-h-170 w-full overflow-auto rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-5 font-mono text-xs leading-relaxed whitespace-pre-wrap">
                  {preview.text}
                </pre>
              ) : (
                <iframe
                  title={`Preview of ${preview.title}`}
                  srcDoc={preview.html}
                  sandbox=""
                  className={cn(
                    "h-175 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] transition-all",
                    viewport === "mobile" ? "w-94 max-w-full" : "w-full",
                  )}
                />
              )}
            </Card>
          </div>
        </div>
      ) : (
        /* Compose Official Admin Email Tab */
        <Card className="mx-auto flex w-full max-w-3xl flex-col gap-5 p-6">
          <div className="flex flex-col gap-1 border-b border-[var(--cf-border-subtle)] pb-4">
            <span className="v3-label text-[var(--cf-royal-text)] uppercase">
              Official Administration Dispatch
            </span>
            <h2 className="text-foreground type-heading-s">
              Send official email from {adminDept?.address ?? `admin@${emailDomain}`}
            </h2>
            <p className="text-muted-foreground type-body-s">
              Messages sent here use the Casefolio V3 Administration layout with From and Reply-To
              set to {adminDept?.formattedFrom ?? `Casefolio Admin <admin@${emailDomain}>`} and are
              logged in the Admin Audit Trail.
            </p>
          </div>

          <form onSubmit={handleSendAdminNotice} className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground text-xs font-semibold" htmlFor="admin-to-email">
                  Recipient email
                </label>
                <Input
                  id="admin-to-email"
                  type="email"
                  required
                  value={composeRecipientEmail}
                  onChange={(e) => setComposeRecipientEmail(e.target.value)}
                  placeholder="designer@studio.com"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-foreground text-xs font-semibold" htmlFor="admin-to-name">
                  Recipient name (optional)
                </label>
                <Input
                  id="admin-to-name"
                  value={composeRecipientName}
                  onChange={(e) => setComposeRecipientName(e.target.value)}
                  placeholder="Lina Haddad"
                />
              </div>
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-foreground text-xs font-semibold" htmlFor="admin-subject">
                Email subject
              </label>
              <Input
                id="admin-subject"
                required
                value={composeSubject}
                onChange={(e) => setComposeSubject(e.target.value)}
                placeholder="Important update regarding your Casefolio workspace"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-foreground text-xs font-semibold" htmlFor="admin-heading">
                Editorial display heading
              </label>
              <Input
                id="admin-heading"
                required
                value={composeHeading}
                onChange={(e) => setComposeHeading(e.target.value)}
                placeholder="Workspace verification & showcase invitation"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label className="text-foreground text-xs font-semibold" htmlFor="admin-message">
                Message body (separate paragraphs with a blank line)
              </label>
              <Textarea
                id="admin-message"
                required
                rows={6}
                value={composeMessage}
                onChange={(e) => setComposeMessage(e.target.value)}
                placeholder="Write your official message to the user..."
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="flex flex-col gap-1.5">
                <label className="text-foreground text-xs font-semibold" htmlFor="admin-cta-label">
                  Button label (optional)
                </label>
                <Input
                  id="admin-cta-label"
                  value={composeCtaLabel}
                  onChange={(e) => setComposeCtaLabel(e.target.value)}
                  placeholder="Open Dashboard"
                />
              </div>

              <div className="flex flex-col gap-1.5">
                <label className="text-foreground text-xs font-semibold" htmlFor="admin-cta-url">
                  Button URL (optional — defaults to /dashboard)
                </label>
                <Input
                  id="admin-cta-url"
                  type="url"
                  value={composeCtaUrl}
                  onChange={(e) => setComposeCtaUrl(e.target.value)}
                  placeholder="https://casefolio.com/dashboard"
                />
              </div>
            </div>

            <div className="flex justify-end pt-2">
              <Button type="submit" disabled={isPending}>
                <Send className="size-4" />
                Dispatch from {adminDept?.address ?? `admin@${emailDomain}`}
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  );
}

