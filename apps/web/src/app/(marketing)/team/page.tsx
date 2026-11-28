import { ArrowRight, Code2, Layers, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CmsIcon } from "@/components/cms/cms-icon";
import {
  DepthStackPanel,
  HighlightUnfurl,
  Reveal,
} from "@/components/marketing/motion";
import { Eyebrow } from "@/components/ui/eyebrow";
import type { SiteCmsContent } from "@/lib/cms/schema";
import { getSiteCmsContent } from "@/lib/cms/service";
import { cn } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Our Studio Team — Casefolio",
  description:
    "Meet Ahmed Al-Azaiza and Mohammed Kullab, the founding partners engineering Casefolio's constrained UI/UX case study studio.",
};

const BADGE_ICONS = [Layers, Code2, Sparkles] as const;

export default async function TeamPage() {
  const cms = await getSiteCmsContent();
  const team: SiteCmsContent["team"] = cms.team;
  const members = team.members;

  return (
    <div className="relative flex flex-col overflow-x-clip bg-[var(--cf-bg-canvas)] text-[var(--cf-text-primary)]">
      {/* 1. Editorial Serif Hero */}
      <section className="relative z-10 overflow-hidden pt-12 pb-14 sm:pt-16 sm:pb-18 lg:pt-20">
        <div className="v3-container flex flex-col items-center text-center">
          <Eyebrow>{team.eyebrowText}</Eyebrow>

          <h1 className="v3-display-xl mt-5 max-w-3xl text-balance text-[var(--cf-text-primary)]">
            {team.heroTitleLead}{" "}
            <span className="v3-sticker-lime">{team.heroTitleHighlight}</span>
          </h1>

          <p className="v3-body-l mt-4 max-w-xl text-pretty text-[var(--cf-text-secondary)]">
            {team.heroSubtitle}
          </p>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
            {team.badges.map((badgeText, idx) => {
              const Icon = BADGE_ICONS[idx % BADGE_ICONS.length]!;
              return (
                <span
                  key={`${badgeText}-${idx}`}
                  className="inline-flex items-center gap-2 rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-surface)] px-3.5 py-1.5 text-xs font-medium text-[var(--cf-text-primary)]"
                >
                  <Icon className="size-3.5 text-[var(--cf-text-secondary)]" />
                  <span>{badgeText}</span>
                </span>
              );
            })}
          </div>
        </div>
      </section>

      {/* 2. Founding Partners Roster */}
      <section className="py-12 sm:py-20">
        <div className="v3-container flex flex-col gap-12">
          <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <Eyebrow>{team.rosterEyebrow}</Eyebrow>
              <h2 className="v3-display-l mt-3 text-[var(--cf-text-primary)]">
                {team.rosterHeading}
              </h2>
            </div>
            <p className="v3-body-s max-w-md text-[var(--cf-text-secondary)]">
              {team.rosterDescription}
            </p>
          </div>

          <Reveal
            stagger
            className={cn(
              "grid grid-cols-1 gap-5 sm:grid-cols-2",
              members.length >= 3 ? "lg:grid-cols-3" : "lg:grid-cols-2",
            )}
          >
            {members.map((member) => (
              <article
                key={member.id}
                data-testid={`team-member-card-${member.id}`}
                className="group flex flex-col justify-between gap-5 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-6 sm:p-7"
              >
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between gap-3 border-b border-[var(--cf-border-subtle)] pb-3.5">
                    <span className="rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2.5 py-0.5 font-mono text-xs font-medium text-[var(--cf-text-secondary)]">
                      {member.id} · {member.discipline}
                    </span>
                    <span className="text-xs font-medium text-[var(--cf-text-tertiary)]">
                      {member.location}
                    </span>
                  </div>

                  <div className="flex items-center gap-4">
                    {member.avatarImageUrl ? (
                      <img
                        loading="lazy"
                        decoding="async"
                        src={member.avatarImageUrl}
                        alt={member.name}
                        className="size-14 shrink-0 rounded-2xl border border-[var(--cf-border-subtle)] object-cover"
                      />
                    ) : (
                      <span
                        aria-hidden="true"
                        className="inline-flex size-14 shrink-0 items-center justify-center rounded-2xl bg-[var(--cf-lp-action)] font-editorial text-xl font-normal text-[var(--cf-lp-on-action)] uppercase"
                      >
                        {member.initials}
                      </span>
                    )}
                    <div className="min-w-0">
                      <h3 className="truncate text-lg font-semibold tracking-tight text-[var(--cf-text-primary)]">
                        {member.name}
                      </h3>
                      <p className="truncate text-xs font-medium text-[var(--cf-text-secondary)] sm:text-sm">
                        {member.role}
                      </p>
                    </div>
                  </div>

                  <p className="v3-body-s leading-relaxed text-[var(--cf-text-secondary)]">
                    {member.bio}
                  </p>
                </div>

                <div className="flex flex-col gap-3 border-t border-[var(--cf-border-subtle)] pt-3.5">
                  <div className="flex flex-wrap gap-1.5">
                    {member.focus.map((tag) => (
                      <span
                        key={tag}
                        className="rounded-full border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] px-2.5 py-0.5 text-[0.6875rem] font-medium text-[var(--cf-text-secondary)]"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>
                  {member.linkUrl && (
                    <a
                      href={member.linkUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex w-fit items-center gap-1 text-xs font-medium text-[var(--cf-text-primary)] hover:underline"
                    >
                      <span>Connect</span>
                      <ArrowRight className="size-3" />
                    </a>
                  )}
                </div>
              </article>
            ))}
          </Reveal>

          {/* Studio Operating Principles Strip */}
          <div className="mt-4 flex flex-col gap-6 border-t border-[var(--cf-border-subtle)] pt-12">
            <HighlightUnfurl className="flex flex-col gap-2">
              <Eyebrow>{team.principlesEyebrow}</Eyebrow>
              <h2 className="v3-heading-l text-[var(--cf-text-primary)]">
                {team.principlesHeading}
              </h2>
            </HighlightUnfurl>

            <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
              {team.principles.map((item) => (
                <DepthStackPanel key={item.title}>
                  <div className="flex h-full flex-col gap-3 rounded-[0.5625rem] border border-[var(--cf-lp-card-border)] bg-[var(--cf-lp-card)] p-6">
                    <span className="inline-flex size-10 items-center justify-center rounded-xl border border-[var(--cf-border-subtle)] bg-[var(--cf-bg-elevated)] text-[var(--cf-text-primary)]">
                      <CmsIcon
                        iconName={item.iconName}
                        customIconUrl={item.customIconUrl}
                        className="size-5"
                      />
                    </span>
                    <h3 className="v3-heading-s text-[var(--cf-text-primary)]">
                      {item.title}
                    </h3>
                    <p className="v3-body-s leading-relaxed text-[var(--cf-text-secondary)]">
                      {item.body}
                    </p>
                  </div>
                </DepthStackPanel>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* 3. Calm Editorial Final CTA */}
      <section className="py-20 sm:py-28">
        <div className="v3-container flex flex-col items-center text-center">
          <h2 className="v3-display-l max-w-2xl text-[var(--cf-text-primary)]">
            {team.ctaTitleLead}{" "}
            <span className="italic text-[var(--cf-lp-subtle)]">{team.ctaTitleHighlight}</span>?
          </h2>
          <p className="v3-body-m mt-4 max-w-md text-[var(--cf-text-secondary)]">
            {team.ctaBody}
          </p>
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href={team.ctaButtonHref}
              className="v3-btn-primary focus-visible:ring-ring/40 py-3.5 px-7 outline-none focus-visible:ring-2"
            >
              <span>{team.ctaButtonLabel}</span>
              <ArrowRight className="size-4" />
            </Link>
            <Link
              href="/about"
              className="v3-btn-secondary focus-visible:ring-ring/40 py-3.5 px-7 outline-none focus-visible:ring-2"
            >
              <span>Our philosophy</span>
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}
