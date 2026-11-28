"use client";

import { Plus, Trash2 } from "lucide-react";
import { CmsAssetUploader } from "@/components/admin/cms/cms-asset-uploader";
import {
  CmsField,
  CmsIconAndUploadPicker,
  CmsSectionGroup,
  CmsStringListEditor,
} from "@/components/admin/cms/cms-section-helpers";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import type { SiteCmsContent } from "@/lib/cms/schema";

export function CmsTeamEditor({
  value,
  onChange,
}: {
  value: SiteCmsContent["team"];
  onChange: (next: SiteCmsContent["team"]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CmsSectionGroup
        title="Team Hero & Discipline Badges"
        description="Controls /team intro headline, founding partners summary, and specialty pills."
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Eyebrow Text"
            value={value.eyebrowText}
            onChange={(eyebrowText) => onChange({ ...value, eyebrowText })}
          />
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
        </div>
        <CmsField
          label="Hero Subtitle"
          multiline
          rows={2}
          value={value.heroSubtitle}
          onChange={(heroSubtitle) => onChange({ ...value, heroSubtitle })}
        />
        <CmsStringListEditor
          label="Hero Discipline Badges"
          items={value.badges}
          addLabel="Add badge"
          onChange={(badges) => onChange({ ...value, badges })}
        />
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Founding Partners & Studio Roster"
        description="Edit founding partners, titles, bios, uploaded avatars, and specialty pills."
        action={
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              const nextNum = String(value.members.length + 1).padStart(2, "0");
              onChange({
                ...value,
                members: [
                  ...value.members,
                  {
                    id: nextNum,
                    initials: "TM",
                    name: "New Team Member",
                    role: "Role Title",
                    discipline: "Design",
                    location: "Remote",
                    bio: "Short member biography.",
                    focus: ["Product Design"],
                    tone: "ink",
                    avatarImageUrl: "",
                    linkUrl: "",
                  },
                ],
              });
            }}
          >
            <Plus className="size-3.5" />
            Add member
          </Button>
        }
      >
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Roster Eyebrow"
            value={value.rosterEyebrow}
            onChange={(rosterEyebrow) => onChange({ ...value, rosterEyebrow })}
          />
          <CmsField
            label="Roster Heading"
            value={value.rosterHeading}
            onChange={(rosterHeading) => onChange({ ...value, rosterHeading })}
          />
          <CmsField
            label="Roster Description"
            value={value.rosterDescription}
            onChange={(rosterDescription) => onChange({ ...value, rosterDescription })}
          />
        </div>

        <div className="grid gap-4 lg:grid-cols-2">
          {value.members.map((member, idx) => (
            <div
              key={`${member.id}-${idx}`}
              className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-4"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="type-caption font-bold text-[var(--cf-royal-text)] uppercase">
                  Member {member.id} · {member.name}
                </span>
                {value.members.length > 1 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() =>
                      onChange({
                        ...value,
                        members: value.members.filter((_, i) => i !== idx),
                      })
                    }
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <CmsField
                  label="Full Name"
                  value={member.name}
                  onChange={(name) => {
                    const members = [...value.members];
                    members[idx] = { ...member, name };
                    onChange({ ...value, members });
                  }}
                />
                <CmsField
                  label="Initials"
                  value={member.initials}
                  onChange={(initials) => {
                    const members = [...value.members];
                    members[idx] = { ...member, initials };
                    onChange({ ...value, members });
                  }}
                />
                <div className="flex flex-col gap-1.5">
                  <Label className="text-xs font-semibold">Badge Accent</Label>
                  <Select
                    value={member.tone}
                    onChange={(e) => {
                      const members = [...value.members];
                      members[idx] = {
                        ...member,
                        tone: e.target.value as "royal" | "lime" | "ink",
                      };
                      onChange({ ...value, members });
                    }}
                  >
                    <option value="royal">Royal Blue</option>
                    <option value="lime">Acid Lime</option>
                    <option value="ink">Carbon Ink</option>
                  </Select>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <CmsField
                    label="Role / Title"
                    value={member.role}
                    onChange={(role) => {
                      const members = [...value.members];
                      members[idx] = { ...member, role };
                      onChange({ ...value, members });
                    }}
                  />
                </div>
                <CmsField
                  label="Discipline"
                  value={member.discipline}
                  onChange={(discipline) => {
                    const members = [...value.members];
                    members[idx] = { ...member, discipline };
                    onChange({ ...value, members });
                  }}
                />
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <CmsField
                  label="Badge / Location"
                  value={member.location}
                  onChange={(location) => {
                    const members = [...value.members];
                    members[idx] = { ...member, location };
                    onChange({ ...value, members });
                  }}
                />
                <CmsField
                  label="Profile / Social Link (optional)"
                  placeholder="https://..."
                  value={member.linkUrl}
                  onChange={(linkUrl) => {
                    const members = [...value.members];
                    members[idx] = { ...member, linkUrl };
                    onChange({ ...value, members });
                  }}
                />
              </div>

              <CmsField
                label="Bio"
                multiline
                rows={3}
                value={member.bio}
                onChange={(bio) => {
                  const members = [...value.members];
                  members[idx] = { ...member, bio };
                  onChange({ ...value, members });
                }}
              />

              <CmsAssetUploader
                label="Profile Photo (optional)"
                hint="Upload an image file to replace monogram badge"
                value={member.avatarImageUrl}
                onChange={(avatarImageUrl) => {
                  const members = [...value.members];
                  members[idx] = { ...member, avatarImageUrl };
                  onChange({ ...value, members });
                }}
                compact
                allowUrlFallback={false}
              />

              <CmsStringListEditor
                label="Specialty Tags"
                items={member.focus}
                addLabel="Add tag"
                onChange={(focus) => {
                  const members = [...value.members];
                  members[idx] = { ...member, focus };
                  onChange({ ...value, members });
                }}
              />
            </div>
          ))}
        </div>
      </CmsSectionGroup>

      <CmsSectionGroup
        title="Operating Principles"
        description="Principles row shown below the founding team cards."
      >
        {value.principles.map((p, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
          >
            <div className="grid gap-3 sm:grid-cols-2">
              <CmsField
                label="Principle Title"
                value={p.title}
                onChange={(title) => {
                  const principles = [...value.principles];
                  principles[idx] = { ...p, title };
                  onChange({ ...value, principles });
                }}
              />
              <CmsField
                label="Principle Body"
                value={p.body}
                onChange={(body) => {
                  const principles = [...value.principles];
                  principles[idx] = { ...p, body };
                  onChange({ ...value, principles });
                }}
              />
            </div>
            <CmsIconAndUploadPicker
              iconName={p.iconName}
              onIconNameChange={(iconName) => {
                const principles = [...value.principles];
                principles[idx] = { ...p, iconName };
                onChange({ ...value, principles });
              }}
              customIconUrl={p.customIconUrl}
              onCustomIconUrlChange={(customIconUrl) => {
                const principles = [...value.principles];
                principles[idx] = { ...p, customIconUrl };
                onChange({ ...value, principles });
              }}
            />
          </div>
        ))}
      </CmsSectionGroup>
    </div>
  );
}

export function CmsAboutEditor({
  value,
  onChange,
}: {
  value: SiteCmsContent["about"];
  onChange: (next: SiteCmsContent["about"]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CmsSectionGroup title="About Hero & 4 Studio Metrics">
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
          <CmsField
            label="Hero Title Trail"
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

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {value.metrics.map((m, idx) => (
            <div
              key={idx}
              className="flex flex-col gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
            >
              <Input
                value={m.value}
                placeholder="100%"
                onChange={(e) => {
                  const metrics = [...value.metrics];
                  metrics[idx] = { ...m, value: e.target.value };
                  onChange({ ...value, metrics });
                }}
              />
              <Input
                value={m.label}
                placeholder="Metric label"
                onChange={(e) => {
                  const metrics = [...value.metrics];
                  metrics[idx] = { ...m, label: e.target.value };
                  onChange({ ...value, metrics });
                }}
              />
              <Input
                value={m.detail}
                placeholder="Detail"
                onChange={(e) => {
                  const metrics = [...value.metrics];
                  metrics[idx] = { ...m, detail: e.target.value };
                  onChange({ ...value, metrics });
                }}
              />
            </div>
          ))}
        </div>
      </CmsSectionGroup>

      <CmsSectionGroup title="Philosophy & Craft Pillars (Icons + Copy)">
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Philosophy Lead"
            value={value.philosophyTitleLead}
            onChange={(philosophyTitleLead) => onChange({ ...value, philosophyTitleLead })}
          />
          <CmsField
            label="Philosophy Highlight"
            value={value.philosophyTitleHighlight}
            onChange={(philosophyTitleHighlight) =>
              onChange({ ...value, philosophyTitleHighlight })
            }
          />
          <CmsField
            label="Philosophy Trail"
            value={value.philosophyTitleTrail}
            onChange={(philosophyTitleTrail) => onChange({ ...value, philosophyTitleTrail })}
          />
        </div>
        {value.pillars.map((pillar, idx) => (
          <div
            key={idx}
            className="flex flex-col gap-3 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
          >
            <CmsField
              label={`Pillar ${pillar.step} Title`}
              value={pillar.title}
              onChange={(title) => {
                const pillars = [...value.pillars];
                pillars[idx] = { ...pillar, title };
                onChange({ ...value, pillars });
              }}
            />
            <CmsField
              label="Body"
              multiline
              rows={2}
              value={pillar.body}
              onChange={(body) => {
                const pillars = [...value.pillars];
                pillars[idx] = { ...pillar, body };
                onChange({ ...value, pillars });
              }}
            />
            <CmsIconAndUploadPicker
              iconName={pillar.iconName}
              onIconNameChange={(iconName) => {
                const pillars = [...value.pillars];
                pillars[idx] = { ...pillar, iconName };
                onChange({ ...value, pillars });
              }}
              customIconUrl={pillar.customIconUrl}
              onCustomIconUrlChange={(customIconUrl) => {
                const pillars = [...value.pillars];
                pillars[idx] = { ...pillar, customIconUrl };
                onChange({ ...value, pillars });
              }}
            />
          </div>
        ))}
      </CmsSectionGroup>
    </div>
  );
}

export function CmsLegalAndHelpEditor({
  value,
  onChange,
}: {
  value: SiteCmsContent["legalAndHelp"];
  onChange: (next: SiteCmsContent["legalAndHelp"]) => void;
}) {
  return (
    <div className="flex flex-col gap-5">
      <CmsSectionGroup
        title="Help Center Hero & Status Notice"
        description="Displayed at /help above search bar and category guides."
      >
        <div className="grid gap-3 sm:grid-cols-2">
          <CmsField
            label="Help Eyebrow"
            value={value.helpEyebrow}
            onChange={(helpEyebrow) => onChange({ ...value, helpEyebrow })}
          />
          <CmsField
            label="Help Headline"
            value={value.helpTitle}
            onChange={(helpTitle) => onChange({ ...value, helpTitle })}
          />
        </div>
        <CmsField
          label="Help Subtitle"
          value={value.helpSubtitle}
          onChange={(helpSubtitle) => onChange({ ...value, helpSubtitle })}
        />
        <CmsField
          label="Optional Top Notice Banner (leave blank to hide)"
          placeholder="e.g. Scheduled maintenance tonight 02:00 UTC..."
          value={value.helpNoticeBanner}
          onChange={(helpNoticeBanner) => onChange({ ...value, helpNoticeBanner })}
        />
      </CmsSectionGroup>

      <CmsSectionGroup title="Privacy Policy (/privacy)">
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Eyebrow"
            value={value.privacyEyebrow}
            onChange={(privacyEyebrow) => onChange({ ...value, privacyEyebrow })}
          />
          <CmsField
            label="Title Highlight"
            value={value.privacyTitleHighlight}
            onChange={(privacyTitleHighlight) => onChange({ ...value, privacyTitleHighlight })}
          />
          <CmsField
            label="Effective Date Strip"
            value={value.privacyEffectiveLine}
            onChange={(privacyEffectiveLine) => onChange({ ...value, privacyEffectiveLine })}
          />
        </div>
        <CmsField
          label="Privacy Subtitle"
          multiline
          rows={2}
          value={value.privacySubtitle}
          onChange={(privacySubtitle) => onChange({ ...value, privacySubtitle })}
        />
        {value.privacyClauses.map((clause, idx) => (
          <div
            key={clause.id}
            className="flex flex-col gap-2 rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-canvas)] p-3"
          >
            <Input
              value={clause.title}
              onChange={(e) => {
                const privacyClauses = [...value.privacyClauses];
                privacyClauses[idx] = { ...clause, title: e.target.value };
                onChange({ ...value, privacyClauses });
              }}
            />
            <CmsField
              label="Body"
              multiline
              rows={2}
              value={clause.body}
              onChange={(body) => {
                const privacyClauses = [...value.privacyClauses];
                privacyClauses[idx] = { ...clause, body };
                onChange({ ...value, privacyClauses });
              }}
            />
          </div>
        ))}
      </CmsSectionGroup>

      <CmsSectionGroup title="Terms of Use (/terms)">
        <div className="grid gap-3 sm:grid-cols-3">
          <CmsField
            label="Eyebrow"
            value={value.termsEyebrow}
            onChange={(termsEyebrow) => onChange({ ...value, termsEyebrow })}
          />
          <CmsField
            label="Title Highlight"
            value={value.termsTitleHighlight}
            onChange={(termsTitleHighlight) => onChange({ ...value, termsTitleHighlight })}
          />
          <CmsField
            label="Effective Date Strip"
            value={value.termsEffectiveLine}
            onChange={(termsEffectiveLine) => onChange({ ...value, termsEffectiveLine })}
          />
        </div>
        <CmsField
          label="Terms Subtitle"
          multiline
          rows={2}
          value={value.termsSubtitle}
          onChange={(termsSubtitle) => onChange({ ...value, termsSubtitle })}
        />
      </CmsSectionGroup>
    </div>
  );
}
