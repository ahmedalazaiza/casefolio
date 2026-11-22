"use client";

import { CheckCircle2, ExternalLink, Loader2, RotateCcw, Save } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  CmsBrandEditor,
  CmsLandingEditor,
} from "@/components/admin/cms/cms-brand-landing-editor";
import {
  CmsAboutEditor,
  CmsLegalAndHelpEditor,
  CmsTeamEditor,
} from "@/components/admin/cms/cms-pages-editor";
import { CmsPricingEditor } from "@/components/admin/cms/cms-pricing-editor";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { CmsSectionKey, SiteCmsContent } from "@/lib/cms/schema";
import { cn } from "@/lib/utils";

const CMS_TABS: ReadonlyArray<{
  key: CmsSectionKey;
  label: string;
  previewHref: string;
}> = [
  { key: "brand", label: "Brand & Shell", previewHref: "/" },
  { key: "landing", label: "Landing Page", previewHref: "/" },
  { key: "pricing", label: "Plans & Pricing", previewHref: "/pricing" },
  { key: "team", label: "Our Team", previewHref: "/team" },
  { key: "about", label: "About Us", previewHref: "/about" },
  { key: "legalAndHelp", label: "Legal & Help", previewHref: "/privacy" },
];

export function AdminCmsPanel({
  initialContent,
}: {
  initialContent: SiteCmsContent;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [content, setContent] = useState<SiteCmsContent>(initialContent);
  const [activeTab, setActiveTab] = useState<CmsSectionKey>("team");
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentTabMeta = CMS_TABS.find((t) => t.key === activeTab) ?? CMS_TABS[0]!;

  function handleSaveCurrentSection() {
    setErrorMessage(null);
    setStatusMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/cms", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          section: activeTab,
          data: content[activeTab],
        }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        content?: SiteCmsContent;
      };
      if (!response.ok || !payload.ok || !payload.content) {
        setErrorMessage(payload.error ?? "Failed to save CMS section.");
        return;
      }
      setContent(payload.content);
      setStatusMessage(
        `${currentTabMeta.label} published live (CMS v${payload.content.version}).`,
      );
      router.refresh();
    });
  }

  function handleResetSection() {
    setErrorMessage(null);
    setStatusMessage(null);
    startTransition(async () => {
      const response = await fetch("/api/admin/cms", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "reset", section: activeTab }),
      });
      const payload = (await response.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        content?: SiteCmsContent;
      };
      if (!response.ok || !payload.ok || !payload.content) {
        setErrorMessage(payload.error ?? "Failed to reset CMS section.");
        return;
      }
      setContent(payload.content);
      setStatusMessage(`${currentTabMeta.label} restored to studio defaults.`);
      router.refresh();
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-6xl min-w-0 flex-col gap-6">
      <header className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div className="flex flex-col gap-1.5">
          <div className="flex items-center gap-2">
            <Eyebrow>Full-Site CMS</Eyebrow>
            <Badge tone="neutral">v{content.version}</Badge>
          </div>
          <h1 className="text-foreground type-display-m">
            Site Content, Plans &amp; Media Studio
          </h1>
          <p className="text-muted-foreground type-body-s max-w-2xl">
            Manage all copy, uploaded imagery, custom SVG/PNG icons, founding partners, plans, and legal pages across Casefolio without touching code.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Button asChild variant="secondary" size="sm">
            <Link href={currentTabMeta.previewHref} target="_blank">
              <ExternalLink className="size-3.5" />
              <span>Preview page</span>
            </Link>
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={isPending}
            data-testid="cms-reset-section-btn"
            onClick={handleResetSection}
          >
            <RotateCcw className="size-3.5" />
            <span>Reset tab</span>
          </Button>
          <Button
            type="button"
            disabled={isPending}
            data-testid="cms-save-section-btn"
            onClick={handleSaveCurrentSection}
          >
            {isPending ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <Save className="size-4" />
            )}
            <span>Save &amp; publish tab</span>
          </Button>
        </div>
      </header>

      <div
        role="tablist"
        aria-label="Site CMS sections"
        className="flex flex-wrap items-center gap-1.5 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-1.5"
      >
        {CMS_TABS.map((tab) => {
          const active = tab.key === activeTab;
          return (
            <button
              key={tab.key}
              type="button"
              role="tab"
              aria-selected={active}
              data-testid={`cms-tab-${tab.key}`}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                "rounded-xl px-4 py-2 text-xs font-semibold transition-colors outline-none sm:text-sm",
                active
                  ? "bg-[var(--cf-royal)] text-[var(--cf-text-on-royal)]"
                  : "text-[var(--cf-text-secondary)] hover:bg-[var(--cf-bg-canvas)] hover:text-[var(--cf-text-primary)]",
              )}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      {errorMessage && (
        <div
          role="alert"
          className="border-destructive/30 bg-destructive-soft text-destructive type-body-s rounded-xl border px-4 py-3"
        >
          {errorMessage}
        </div>
      )}

      {statusMessage && (
        <div
          role="status"
          data-testid="cms-status-banner"
          className="border-success/30 bg-success-soft text-foreground type-body-s flex items-center gap-2 rounded-xl border px-4 py-3"
        >
          <CheckCircle2 className="text-success size-4 shrink-0" />
          <span>{statusMessage}</span>
        </div>
      )}

      {activeTab === "brand" && (
        <CmsBrandEditor
          value={content.brand}
          onChange={(brand) => setContent((prev) => ({ ...prev, brand }))}
        />
      )}
      {activeTab === "landing" && (
        <CmsLandingEditor
          value={content.landing}
          onChange={(landing) => setContent((prev) => ({ ...prev, landing }))}
        />
      )}
      {activeTab === "pricing" && (
        <CmsPricingEditor
          value={content.pricing}
          onChange={(pricing) => setContent((prev) => ({ ...prev, pricing }))}
        />
      )}
      {activeTab === "team" && (
        <CmsTeamEditor
          value={content.team}
          onChange={(team) => setContent((prev) => ({ ...prev, team }))}
        />
      )}
      {activeTab === "about" && (
        <CmsAboutEditor
          value={content.about}
          onChange={(about) => setContent((prev) => ({ ...prev, about }))}
        />
      )}
      {activeTab === "legalAndHelp" && (
        <CmsLegalAndHelpEditor
          value={content.legalAndHelp}
          onChange={(legalAndHelp) => setContent((prev) => ({ ...prev, legalAndHelp }))}
        />
      )}
    </div>
  );
}
