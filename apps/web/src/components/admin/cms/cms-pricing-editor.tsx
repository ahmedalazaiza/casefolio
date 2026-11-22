"use client";

import { AlertTriangle, Calculator, Plus, Trash2 } from "lucide-react";
import {
  CmsField,
  CmsSectionGroup,
  CmsStringListEditor,
} from "@/components/admin/cms/cms-section-helpers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { SiteCmsContent } from "@/lib/cms/schema";

const TIER_KEYS = ["free", "pro", "team"] as const;

function centsToDollarInput(cents: number): string {
  return (cents / 100).toFixed(2);
}

function parseDollarInputToCents(raw: string): number {
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const num = Number.parseFloat(cleaned);
  if (!Number.isFinite(num) || num < 0) return 0;
  return Math.round(num * 100);
}

export function CmsPricingEditor({
  value,
  onChange,
}: {
  value: SiteCmsContent["pricing"];
  onChange: (next: SiteCmsContent["pricing"]) => void;
}) {
  function updateTier(
    tierKey: (typeof TIER_KEYS)[number],
    patch: Partial<SiteCmsContent["pricing"]["tiers"]["pro"]>,
  ) {
    onChange({
      ...value,
      tiers: {
        ...value.tiers,
        [tierKey]: {
          ...value.tiers[tierKey],
          ...patch,
        },
      },
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <div
        role="note"
        className="border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] text-foreground flex items-start gap-3 rounded-xl border p-4"
      >
        <AlertTriangle className="text-warning mt-0.5 size-4 shrink-0" />
        <div className="type-caption flex flex-col gap-1">
          <span className="font-semibold">Live Site &amp; Paddle Pricing Sync</span>
          <span>
            Updates here take effect immediately on the public <code>/pricing</code> page, interactive calculator, comparison matrix, and upgrade prompts. If you change live charged dollar prices, also update your matching Price ID in Paddle Dashboard or paste the updated Price IDs below.
          </span>
        </div>
      </div>

      <CmsSectionGroup
        title="Pricing Hero & Highlight Badge"
        description="Configure top headline, Most Popular highlight card, and annual 2-months-free labels."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Hero Title Lead"
            value={value.heroTitleLead}
            onChange={(heroTitleLead) => onChange({ ...value, heroTitleLead })}
          />
          <CmsField
            label="Hero Highlight"
            value={value.heroTitleHighlight}
            onChange={(heroTitleHighlight) => onChange({ ...value, heroTitleHighlight })}
          />
          <div className="flex flex-col gap-1.5">
            <Label className="text-xs font-semibold">Most Popular Tier</Label>
            <select
              aria-label="Most Popular Tier"
              value={value.popularTier}
              onChange={(e) =>
                onChange({
                  ...value,
                  popularTier: e.target.value as SiteCmsContent["pricing"]["popularTier"],
                })
              }
              className="border-input bg-background h-9 rounded-md border px-2 text-xs"
            >
              <option value="free">Free</option>
              <option value="pro">Pro (Recommended)</option>
              <option value="team">Teams</option>
            </select>
          </div>
        </div>

        <CmsField
          label="Hero Subtitle"
          multiline
          rows={2}
          value={value.heroSubtitle}
          onChange={(heroSubtitle) => onChange({ ...value, heroSubtitle })}
        />

        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Popular Badge Text"
            value={value.popularBadgeText}
            onChange={(popularBadgeText) => onChange({ ...value, popularBadgeText })}
          />
          <CmsField
            label="Annual Discount Badge"
            value={value.annualBadgeLabel}
            onChange={(annualBadgeLabel) => onChange({ ...value, annualBadgeLabel })}
          />
          <CmsField
            label="Matrix Legend Pill"
            value={value.annualPillText}
            onChange={(annualPillText) => onChange({ ...value, annualPillText })}
          />
        </div>
      </CmsSectionGroup>

      {/* Per-Tier Pricing & Features Cards */}
      <div className="grid gap-5 lg:grid-cols-3">
        {TIER_KEYS.map((tierKey) => {
          const tier = value.tiers[tierKey];
          const isPopular = value.popularTier === tierKey;

          return (
            <CmsSectionGroup
              key={tierKey}
              title={`${tier.name} Tier`}
              description={tierKey === "team" ? "Per-seat multi-member plan" : "Personal plan"}
              action={
                isPopular ? (
                  <Badge tone="accent">{value.popularBadgeText}</Badge>
                ) : (
                  <Badge tone="neutral">{tierKey.toUpperCase()}</Badge>
                )
              }
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <CmsField
                  label="Display Name"
                  value={tier.name}
                  onChange={(name) => updateTier(tierKey, { name })}
                />
                <CmsField
                  label="CTA Button Label"
                  value={tier.ctaLabel}
                  onChange={(ctaLabel) => updateTier(tierKey, { ctaLabel })}
                />
              </div>

              <CmsField
                label="Card Tagline"
                multiline
                rows={2}
                value={tier.tagline}
                onChange={(tagline) => updateTier(tierKey, { tagline })}
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <CmsField
                  label="Scope Summary"
                  value={tier.scopeSummary}
                  onChange={(scopeSummary) => updateTier(tierKey, { scopeSummary })}
                />
                <CmsField
                  label="Badge / Subtitle Pill"
                  value={tier.badgeLabel}
                  onChange={(badgeLabel) => updateTier(tierKey, { badgeLabel })}
                />
              </div>

              <div className="grid gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3 sm:grid-cols-3">
                <div className="flex flex-col gap-1">
                  <Label className="text-[0.6875rem] font-semibold">
                    {tierKey === "team" ? "Monthly / seat ($)" : "Monthly ($)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    data-testid={`cms-price-monthly-${tierKey}`}
                    value={centsToDollarInput(tier.monthlyPriceCents)}
                    onChange={(e) => {
                      const monthlyPriceCents = parseDollarInputToCents(e.target.value);
                      updateTier(tierKey, { monthlyPriceCents });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[0.6875rem] font-semibold">
                    {tierKey === "team" ? "Annual / seat ($)" : "Annual Total ($)"}
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    data-testid={`cms-price-yearly-${tierKey}`}
                    value={centsToDollarInput(tier.yearlyTotalCents)}
                    onChange={(e) => {
                      const yearlyTotalCents = parseDollarInputToCents(e.target.value);
                      const yearlyMonthlyEquivalentCents = Math.round(yearlyTotalCents / 12);
                      updateTier(tierKey, {
                        yearlyTotalCents,
                        yearlyMonthlyEquivalentCents,
                      });
                    }}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label className="text-[0.6875rem] font-semibold">Max Projects (-1=∞)</Label>
                  <Input
                    type="number"
                    min="-1"
                    value={String(tier.maxCaseStudies)}
                    onChange={(e) =>
                      updateTier(tierKey, {
                        maxCaseStudies: Math.max(-1, Number.parseInt(e.target.value || "0", 10) || 0),
                      })
                    }
                  />
                </div>
              </div>

              {tierKey !== "free" && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    const annual10Months = tier.monthlyPriceCents * 10;
                    updateTier(tierKey, {
                      yearlyTotalCents: annual10Months,
                      yearlyMonthlyEquivalentCents: Math.round(annual10Months / 12),
                      yearlySavingsPercent: 17,
                    });
                  }}
                >
                  <Calculator className="size-3.5" />
                  <span>Auto-set Annual = 10× Monthly (2 months free)</span>
                </Button>
              )}

              {tierKey === "team" && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="flex flex-col gap-1">
                    <Label className="text-[0.6875rem]">Min Seats</Label>
                    <Input
                      type="number"
                      min="1"
                      value={String(tier.minSeats)}
                      onChange={(e) =>
                        updateTier("team", {
                          minSeats: Math.max(1, Number.parseInt(e.target.value || "2", 10) || 2),
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[0.6875rem]">Default Seats</Label>
                    <Input
                      type="number"
                      min="1"
                      value={String(tier.defaultSeats)}
                      onChange={(e) =>
                        updateTier("team", {
                          defaultSeats: Math.max(1, Number.parseInt(e.target.value || "3", 10) || 3),
                        })
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <Label className="text-[0.6875rem]">Max Seats</Label>
                    <Input
                      type="number"
                      min="2"
                      value={String(tier.maxSeats)}
                      onChange={(e) =>
                        updateTier("team", {
                          maxSeats: Math.max(2, Number.parseInt(e.target.value || "25", 10) || 25),
                        })
                      }
                    />
                  </div>
                </div>
              )}

              <CmsStringListEditor
                label="Feature Bullets"
                items={tier.features}
                addLabel="Add bullet"
                onChange={(features) => updateTier(tierKey, { features })}
              />
            </CmsSectionGroup>
          );
        })}
      </div>

      <CmsSectionGroup
        title="Paddle Price ID Overrides (Optional)"
        description="Override environment variable Paddle Price IDs cleanly without redeploying when creating new pricing plans in Paddle."
      >
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <CmsField
            label="Pro Monthly Price ID"
            placeholder="pri_... (optional)"
            value={value.paddlePriceOverrides.pro_monthly}
            onChange={(pro_monthly) =>
              onChange({
                ...value,
                paddlePriceOverrides: { ...value.paddlePriceOverrides, pro_monthly },
              })
            }
          />
          <CmsField
            label="Pro Annual Price ID"
            placeholder="pri_... (optional)"
            value={value.paddlePriceOverrides.pro_yearly}
            onChange={(pro_yearly) =>
              onChange({
                ...value,
                paddlePriceOverrides: { ...value.paddlePriceOverrides, pro_yearly },
              })
            }
          />
          <CmsField
            label="Teams Monthly Price ID"
            placeholder="pri_... (optional)"
            value={value.paddlePriceOverrides.team_monthly}
            onChange={(team_monthly) =>
              onChange({
                ...value,
                paddlePriceOverrides: { ...value.paddlePriceOverrides, team_monthly },
              })
            }
          />
          <CmsField
            label="Teams Annual Price ID"
            placeholder="pri_... (optional)"
            value={value.paddlePriceOverrides.team_yearly}
            onChange={(team_yearly) =>
              onChange({
                ...value,
                paddlePriceOverrides: { ...value.paddlePriceOverrides, team_yearly },
              })
            }
          />
        </div>
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Comparison Matrix Rows"
        description="Edit labels and comparison details displayed in the 4-column breakdown table."
      >
        <div className="flex flex-col gap-4">
          {value.comparisonGroups.map((group, gIdx) => (
            <div
              key={group.id}
              className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-4"
            >
              <div className="grid gap-3 sm:grid-cols-2">
                <CmsField
                  label={`Group 0${gIdx + 1} Title`}
                  value={group.title}
                  onChange={(title) => {
                    const comparisonGroups = [...value.comparisonGroups];
                    comparisonGroups[gIdx] = { ...group, title };
                    onChange({ ...value, comparisonGroups });
                  }}
                />
                <CmsField
                  label="Group Description"
                  value={group.description}
                  onChange={(description) => {
                    const comparisonGroups = [...value.comparisonGroups];
                    comparisonGroups[gIdx] = { ...group, description };
                    onChange({ ...value, comparisonGroups });
                  }}
                />
              </div>

              {group.rows.map((row, rIdx) => (
                <div
                  key={rIdx}
                  className="grid gap-2 rounded-lg border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] p-2.5 sm:grid-cols-4"
                >
                  <Input
                    value={row.feature}
                    placeholder="Capability label"
                    onChange={(e) => {
                      const comparisonGroups = [...value.comparisonGroups];
                      const rows = [...group.rows];
                      rows[rIdx] = { ...row, feature: e.target.value };
                      comparisonGroups[gIdx] = { ...group, rows };
                      onChange({ ...value, comparisonGroups });
                    }}
                  />
                  {(["free", "pro", "team"] as const).map((tierKey) => {
                    const cellVal = row[tierKey];
                    const displayStr =
                      typeof cellVal === "boolean"
                        ? cellVal
                          ? "Included"
                          : "Not included"
                        : typeof cellVal === "object"
                          ? cellVal.detail
                          : cellVal;
                    return (
                      <Input
                        key={tierKey}
                        value={displayStr}
                        aria-label={`${tierKey} value for ${row.feature}`}
                        onChange={(e) => {
                          const txt = e.target.value;
                          const nextCell =
                            txt.trim().toLowerCase() === "included"
                              ? true
                              : txt.trim().toLowerCase() === "not included"
                                ? false
                                : txt;
                          const comparisonGroups = [...value.comparisonGroups];
                          const rows = [...group.rows];
                          rows[rIdx] = { ...row, [tierKey]: nextCell };
                          comparisonGroups[gIdx] = { ...group, rows };
                          onChange({ ...value, comparisonGroups });
                        }}
                      />
                    );
                  })}
                </div>
              ))}
            </div>
          ))}
        </div>
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Pricing FAQ Strip"
        description="Edit billing questions below the seat calculator."
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() =>
              onChange({
                ...value,
                faqs: [...value.faqs, { question: "New billing question", answer: "Details..." }],
              })
            }
          >
            <Plus className="size-3.5" />
            Add FAQ
          </Button>
        }
      >
        {value.faqs.map((faq, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
          >
            <div className="flex items-center justify-between">
              <span className="type-caption font-semibold text-[var(--cf-text-tertiary)]">
                FAQ 0{idx + 1}
              </span>
              {value.faqs.length > 1 && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() =>
                    onChange({ ...value, faqs: value.faqs.filter((_, i) => i !== idx) })
                  }
                >
                  <Trash2 className="size-3.5" />
                </Button>
              )}
            </div>
            <Input
              value={faq.question}
              onChange={(e) => {
                const faqs = [...value.faqs];
                faqs[idx] = { ...faq, question: e.target.value };
                onChange({ ...value, faqs });
              }}
            />
            <Textarea
              rows={2}
              value={faq.answer}
              onChange={(e) => {
                const faqs = [...value.faqs];
                faqs[idx] = { ...faq, answer: e.target.value };
                onChange({ ...value, faqs });
              }}
            />
          </div>
        ))}
      </CmsSectionGroup>
    </div>
  );
}
