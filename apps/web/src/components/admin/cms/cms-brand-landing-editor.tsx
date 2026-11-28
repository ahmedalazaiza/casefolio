"use client";

import { Plus, Trash2 } from "lucide-react";
import { CmsAssetUploader } from "@/components/admin/cms/cms-asset-uploader";
import {
  CmsField,
  CmsIconAndUploadPicker,
  CmsSectionGroup,
} from "@/components/admin/cms/cms-section-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { SiteCmsContent } from "@/lib/cms/schema";

export function CmsBrandEditor({
  value,
  onChange,
}: {
  value: SiteCmsContent["brand"];
  onChange: (next: SiteCmsContent["brand"]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CmsSectionGroup
        title="Brand Identity & Top Announcement"
        description="Controls logo/mark, site name, header navigation links, and top promotional banner across marketing pages."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CmsField
            label="Site / Brand Name"
            value={value.siteName}
            onChange={(siteName) => onChange({ ...value, siteName })}
          />
          <CmsAssetUploader
            label="Brand Logo / Mark (SVG or PNG)"
            hint="Leave blank to keep the built-in Casefolio mark"
            value={value.logoImageUrl}
            onChange={(logoImageUrl) => onChange({ ...value, logoImageUrl })}
            compact
            testId="cms-brand-logo-uploader"
          />
        </div>

        <div className="grid gap-3 sm:grid-cols-4">
          <CmsField
            label="Top Badge"
            value={value.announcementTag}
            onChange={(announcementTag) => onChange({ ...value, announcementTag })}
          />
          <div className="sm:col-span-2">
            <CmsField
              label="Announcement Copy"
              value={value.announcementText}
              onChange={(announcementText) => onChange({ ...value, announcementText })}
            />
          </div>
          <CmsField
            label="CTA Label"
            value={value.announcementCtaLabel}
            onChange={(announcementCtaLabel) => onChange({ ...value, announcementCtaLabel })}
          />
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Header Navigation Links</Label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  navLinks: [...value.navLinks, { label: "New Page", href: "/" }],
                })
              }
            >
              <Plus className="size-3.5" />
              Add link
            </Button>
          </div>
          {value.navLinks.map((link, idx) => (
            <div key={idx} className="grid items-center gap-2 sm:grid-cols-[1fr_1fr_auto]">
              <Input
                value={link.label}
                placeholder="Label"
                onChange={(e) => {
                  const navLinks = [...value.navLinks];
                  navLinks[idx] = { ...link, label: e.target.value };
                  onChange({ ...value, navLinks });
                }}
              />
              <Input
                value={link.href}
                placeholder="/path"
                onChange={(e) => {
                  const navLinks = [...value.navLinks];
                  navLinks[idx] = { ...link, href: e.target.value };
                  onChange({ ...value, navLinks });
                }}
              />
              {value.navLinks.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...value,
                      navLinks: value.navLinks.filter((_, i) => i !== idx),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
          ))}
        </div>
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Footer Columns & Social Links"
        description="Footer description, legal copyright, columns, and custom social icons."
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <CmsField
            label="Footer Tagline"
            multiline
            rows={2}
            value={value.footerTagline}
            onChange={(footerTagline) => onChange({ ...value, footerTagline })}
          />
          <CmsField
            label="Copyright Text"
            value={value.copyrightText}
            onChange={(copyrightText) => onChange({ ...value, copyrightText })}
          />
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          {value.footerColumns.map((col, colIdx) => (
            <div
              key={colIdx}
              className="flex flex-col gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
            >
              <Input
                value={col.heading}
                onChange={(e) => {
                  const footerColumns = [...value.footerColumns];
                  footerColumns[colIdx] = { ...col, heading: e.target.value };
                  onChange({ ...value, footerColumns });
                }}
                placeholder="Column heading"
              />
              {col.links.map((l, lIdx) => (
                <div key={lIdx} className="grid grid-cols-[1fr_1fr_auto] gap-1.5">
                  <Input
                    value={l.label}
                    placeholder="Label"
                    onChange={(e) => {
                      const footerColumns = [...value.footerColumns];
                      const links = [...col.links];
                      links[lIdx] = { ...l, label: e.target.value };
                      footerColumns[colIdx] = { ...col, links };
                      onChange({ ...value, footerColumns });
                    }}
                  />
                  <Input
                    value={l.href}
                    placeholder="/href"
                    onChange={(e) => {
                      const footerColumns = [...value.footerColumns];
                      const links = [...col.links];
                      links[lIdx] = { ...l, href: e.target.value };
                      footerColumns[colIdx] = { ...col, links };
                      onChange({ ...value, footerColumns });
                    }}
                  />
                  {col.links.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        const footerColumns = [...value.footerColumns];
                        footerColumns[colIdx] = {
                          ...col,
                          links: col.links.filter((_, i) => i !== lIdx),
                        };
                        onChange({ ...value, footerColumns });
                      }}
                    >
                      <Trash2 className="size-3" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  const footerColumns = [...value.footerColumns];
                  footerColumns[colIdx] = {
                    ...col,
                    links: [...col.links, { label: "Link", href: "/" }],
                  };
                  onChange({ ...value, footerColumns });
                }}
              >
                <Plus className="size-3" />
                Add link
              </Button>
            </div>
          ))}
        </div>

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold">Social Links & Icons</Label>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() =>
                onChange({
                  ...value,
                  socialLinks: [
                    ...value.socialLinks,
                    { platform: "custom", label: "Website", href: "https://", customIconUrl: "" },
                  ],
                })
              }
            >
              <Plus className="size-3.5" />
              Add social
            </Button>
          </div>
          {value.socialLinks.map((soc, idx) => (
            <div
              key={idx}
              className="grid items-center gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3 sm:grid-cols-[8rem_1fr_1fr_auto]"
            >
              <Select
                value={soc.platform}
                onChange={(e) => {
                  const socialLinks = [...value.socialLinks];
                  socialLinks[idx] = {
                    ...soc,
                    platform: e.target.value as typeof soc.platform,
                  };
                  onChange({ ...value, socialLinks });
                }}
              >
                <option value="x">X</option>
                <option value="linkedin">LinkedIn</option>
                <option value="dribbble">Dribbble</option>
                <option value="behance">Behance</option>
                <option value="github">GitHub</option>
                <option value="instagram">Instagram</option>
                <option value="youtube">YouTube</option>
                <option value="custom">Custom</option>
              </Select>
              <Input
                value={soc.label}
                placeholder="Accessible label"
                onChange={(e) => {
                  const socialLinks = [...value.socialLinks];
                  socialLinks[idx] = { ...soc, label: e.target.value };
                  onChange({ ...value, socialLinks });
                }}
              />
              <Input
                value={soc.href}
                placeholder="https://..."
                onChange={(e) => {
                  const socialLinks = [...value.socialLinks];
                  socialLinks[idx] = { ...soc, href: e.target.value };
                  onChange({ ...value, socialLinks });
                }}
              />
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  onChange({
                    ...value,
                    socialLinks: value.socialLinks.filter((_, i) => i !== idx),
                  })
                }
              >
                <Trash2 className="size-3.5" />
              </Button>
              <div className="sm:col-span-4">
                <CmsAssetUploader
                  label="Custom icon (optional)"
                  value={soc.customIconUrl ?? ""}
                  onChange={(customIconUrl) => {
                    const socialLinks = [...value.socialLinks];
                    socialLinks[idx] = { ...soc, customIconUrl };
                    onChange({ ...value, socialLinks });
                  }}
                  compact
                />
              </div>
            </div>
          ))}
        </div>
      </CmsSectionGroup>
    </div>
  );
}

export function CmsLandingEditor({
  value,
  onChange,
}: {
  value: SiteCmsContent["landing"];
  onChange: (next: SiteCmsContent["landing"]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CmsSectionGroup
        title="Hero Section & Visual Stage"
        description="Edit landing hero headline, lime sticker highlight, CTAs, or upload a custom hero image."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Eyebrow Step"
            value={value.heroEyebrowStep}
            onChange={(heroEyebrowStep) => onChange({ ...value, heroEyebrowStep })}
          />
          <div className="sm:col-span-2">
            <CmsField
              label="Eyebrow Text"
              value={value.heroEyebrowText}
              onChange={(heroEyebrowText) => onChange({ ...value, heroEyebrowText })}
            />
          </div>
          <CmsField
            label="Headline Lead"
            value={value.heroTitleLead}
            onChange={(heroTitleLead) => onChange({ ...value, heroTitleLead })}
          />
          <CmsField
            label="Highlight Word (Lime)"
            value={value.heroTitleHighlight}
            onChange={(heroTitleHighlight) => onChange({ ...value, heroTitleHighlight })}
          />
          <CmsField
            label="Headline Trail"
            value={value.heroTitleTrail}
            onChange={(heroTitleTrail) => onChange({ ...value, heroTitleTrail })}
          />
        </div>
        <CmsField
          label="Hero Subtitle"
          multiline
          rows={2}
          value={value.heroSubtitle}
          onChange={(heroSubtitle) => onChange({ ...value, heroSubtitle })}
        />
        <div className="grid gap-3 sm:grid-cols-4">
          <CmsField
            label="Primary CTA Label"
            value={value.primaryCtaLabel}
            onChange={(primaryCtaLabel) => onChange({ ...value, primaryCtaLabel })}
          />
          <CmsField
            label="Primary CTA Link"
            value={value.primaryCtaHref}
            onChange={(primaryCtaHref) => onChange({ ...value, primaryCtaHref })}
          />
          <CmsField
            label="Secondary CTA Label"
            value={value.secondaryCtaLabel}
            onChange={(secondaryCtaLabel) => onChange({ ...value, secondaryCtaLabel })}
          />
          <CmsField
            label="Secondary CTA Link"
            value={value.secondaryCtaHref}
            onChange={(secondaryCtaHref) => onChange({ ...value, secondaryCtaHref })}
          />
        </div>
        <CmsAssetUploader
          label="Hero Frame Image (optional)"
          hint="Upload a custom image to replace the hero frame with a pure image, or leave blank to display the live interactive Studio Builder powered by a real Casefolio template."
          value={value.heroMockupImageUrl}
          onChange={(heroMockupImageUrl) => onChange({ ...value, heroMockupImageUrl })}
          testId="cms-landing-hero-uploader"
        />
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Workflow Split Panels"
        description="Edit split panel copy, 3-column spec metrics, and optional uploaded panel artwork."
      >
        <div className="grid gap-3 sm:grid-cols-4">
          <CmsField
            label="Section Eyebrow"
            value={value.workflowEyebrow}
            onChange={(workflowEyebrow) => onChange({ ...value, workflowEyebrow })}
          />
          <CmsField
            label="Title Lead"
            value={value.workflowTitleLead}
            onChange={(workflowTitleLead) => onChange({ ...value, workflowTitleLead })}
          />
          <CmsField
            label="Highlight Word"
            value={value.workflowTitleHighlight}
            onChange={(workflowTitleHighlight) => onChange({ ...value, workflowTitleHighlight })}
          />
          <CmsField
            label="Title Trail"
            value={value.workflowTitleTrail}
            onChange={(workflowTitleTrail) => onChange({ ...value, workflowTitleTrail })}
          />
        </div>

        {value.workflowPanels.map((panel, pIdx) => (
          <div
            key={pIdx}
            className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-4"
          >
            <p className="type-caption font-bold uppercase text-[var(--cf-royal-text)]">
              Panel {pIdx + 1} · {panel.badgeLabel}
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              <CmsField
                label="Badge Label"
                value={panel.badgeLabel}
                onChange={(badgeLabel) => {
                  const workflowPanels = [...value.workflowPanels];
                  workflowPanels[pIdx] = { ...panel, badgeLabel };
                  onChange({ ...value, workflowPanels });
                }}
              />
              <CmsField
                label="Meta Tag"
                value={panel.metaLabel}
                onChange={(metaLabel) => {
                  const workflowPanels = [...value.workflowPanels];
                  workflowPanels[pIdx] = { ...panel, metaLabel };
                  onChange({ ...value, workflowPanels });
                }}
              />
              <CmsField
                label="CTA Label"
                value={panel.ctaLabel}
                onChange={(ctaLabel) => {
                  const workflowPanels = [...value.workflowPanels];
                  workflowPanels[pIdx] = { ...panel, ctaLabel };
                  onChange({ ...value, workflowPanels });
                }}
              />
            </div>
            <CmsField
              label="Panel Heading"
              value={panel.title}
              onChange={(title) => {
                const workflowPanels = [...value.workflowPanels];
                workflowPanels[pIdx] = { ...panel, title };
                onChange({ ...value, workflowPanels });
              }}
            />
            <CmsField
              label="Panel Body"
              multiline
              rows={2}
              value={panel.body}
              onChange={(body) => {
                const workflowPanels = [...value.workflowPanels];
                workflowPanels[pIdx] = { ...panel, body };
                onChange({ ...value, workflowPanels });
              }}
            />
            <CmsAssetUploader
              label="Custom Panel Image (optional)"
              hint="Replaces the interactive SVG preview on this split panel"
              value={panel.imageUrl}
              onChange={(imageUrl) => {
                const workflowPanels = [...value.workflowPanels];
                workflowPanels[pIdx] = { ...panel, imageUrl };
                onChange({ ...value, workflowPanels });
              }}
              compact
            />
          </div>
        ))}
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Bento Feature Cards (Icons & Copy)"
        description="Edit the 3-column bento grid and choose icons or upload custom SVG/PNG icons."
      >
        {value.featureCards.map((card, cIdx) => (
          <div
            key={cIdx}
            className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-4"
          >
            <div className="flex items-center justify-between">
              <span className="type-caption font-bold text-[var(--cf-text-primary)]">
                Card 0{cIdx + 1}
              </span>
              {value.featureCards.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...value,
                      featureCards: value.featureCards.filter((_, i) => i !== cIdx),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <CmsField
                label="Title"
                value={card.title}
                onChange={(title) => {
                  const featureCards = [...value.featureCards];
                  featureCards[cIdx] = { ...card, title };
                  onChange({ ...value, featureCards });
                }}
              />
              <CmsField
                label="Body"
                value={card.body}
                onChange={(body) => {
                  const featureCards = [...value.featureCards];
                  featureCards[cIdx] = { ...card, body };
                  onChange({ ...value, featureCards });
                }}
              />
            </div>
            <CmsIconAndUploadPicker
              iconName={card.iconName}
              onIconNameChange={(iconName) => {
                const featureCards = [...value.featureCards];
                featureCards[cIdx] = { ...card, iconName };
                onChange({ ...value, featureCards });
              }}
              customIconUrl={card.customIconUrl}
              onCustomIconUrlChange={(customIconUrl) => {
                const featureCards = [...value.featureCards];
                featureCards[cIdx] = { ...card, customIconUrl };
                onChange({ ...value, featureCards });
              }}
            />
          </div>
        ))}
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Landing FAQ & Bottom CTA"
        description="Manage homepage accordion questions and final launch banner."
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                faqItems: [
                  ...value.faqItems,
                  { question: "New question", answer: "Answer here." },
                ],
              })
            }
          >
            <Plus className="size-3.5" />
            Add FAQ
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="FAQ Eyebrow"
            value={value.faqEyebrow}
            onChange={(faqEyebrow) => onChange({ ...value, faqEyebrow })}
          />
          <CmsField
            label="FAQ Title Lead"
            value={value.faqTitleLead}
            onChange={(faqTitleLead) => onChange({ ...value, faqTitleLead })}
          />
          <CmsField
            label="FAQ Highlight"
            value={value.faqTitleHighlight}
            onChange={(faqTitleHighlight) => onChange({ ...value, faqTitleHighlight })}
          />
        </div>

        {value.faqItems.map((faq, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="type-caption font-semibold text-[var(--cf-text-tertiary)]">
                Question {idx + 1}
              </span>
              {value.faqItems.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({
                      ...value,
                      faqItems: value.faqItems.filter((_, i) => i !== idx),
                    })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <Input
              value={faq.question}
              placeholder="Question"
              onChange={(e) => {
                const faqItems = [...value.faqItems];
                faqItems[idx] = { ...faq, question: e.target.value };
                onChange({ ...value, faqItems });
              }}
            />
            <Textarea
              rows={2}
              value={faq.answer}
              placeholder="Answer"
              onChange={(e) => {
                const faqItems = [...value.faqItems];
                faqItems[idx] = { ...faq, answer: e.target.value };
                onChange({ ...value, faqItems });
              }}
            />
          </div>
        ))}

        <div className="grid gap-3 border-t border-[var(--cf-border-subtle)] pt-3 sm:grid-cols-4">
          <CmsField
            label="Final CTA Eyebrow"
            value={value.finalCtaEyebrow}
            onChange={(finalCtaEyebrow) => onChange({ ...value, finalCtaEyebrow })}
          />
          <CmsField
            label="Final Title Lead"
            value={value.finalCtaTitleLead}
            onChange={(finalCtaTitleLead) => onChange({ ...value, finalCtaTitleLead })}
          />
          <CmsField
            label="Final Highlight"
            value={value.finalCtaTitleHighlight}
            onChange={(finalCtaTitleHighlight) => onChange({ ...value, finalCtaTitleHighlight })}
          />
          <CmsField
            label="Final Button Label"
            value={value.finalCtaButtonLabel}
            onChange={(finalCtaButtonLabel) => onChange({ ...value, finalCtaButtonLabel })}
          />
        </div>
      </CmsSectionGroup>
    </div>
  );
}
