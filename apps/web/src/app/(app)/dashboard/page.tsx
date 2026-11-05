import { ArrowRight, Check, Plus, Sparkles } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DashboardProjectsClient } from "@/components/projects/dashboard-projects-client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { requireSession } from "@/lib/auth/session";
import { listDashboardProjectsForUser } from "@/lib/projects/dashboard";

export const metadata: Metadata = {
  title: "Projects — Casefolio",
};

const FIRST_RUN_CHECKLIST = [
  {
    id: "account",
    title: "Create your account",
    subtitle: "Done",
    done: true,
    href: "/account",
  },
  {
    id: "project",
    title: "Create a project",
    subtitle: "Name it and add details",
    done: false,
    href: "/new",
  },
  {
    id: "template",
    title: "Pick a template",
    subtitle: "Mobile app or Website",
    done: false,
    href: "/templates",
  },
  {
    id: "screenshots",
    title: "Add your screenshots",
    subtitle: "Fill template slots",
    done: false,
    href: "/templates",
  },
  {
    id: "publish",
    title: "Publish or export",
    subtitle: "Share a link or download PNG/PDF",
    done: false,
    href: "/templates",
  },
] as const;

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ welcome?: string }>;
}) {
  const { user, session } = await requireSession("/dashboard");
  const { welcome } = await searchParams;

  const userProjects = await listDashboardProjectsForUser(
    user.id,
    session.activeOrganizationId ?? null,
  );

  const firstName = user.name.trim().split(/\s+/)[0] || "Designer";

  // First-run onboarding checklist immediately after completing /onboarding (Figma 2:1716)
  if (welcome === "1" && userProjects.length === 0) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-8">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-1.5">
            <span className="text-primary type-overline">Welcome, {firstName}</span>
            <h1 className="type-display-m sm:type-display-l text-foreground">
              Let&apos;s make your first case study
            </h1>
            <p className="text-muted-foreground type-body-m">
              Follow the checklist — most people finish in one sitting.
            </p>
          </div>

          <Button asChild size="lg" className="w-fit">
            <Link href="/new">
              <Plus className="size-4" />
              New project
            </Link>
          </Button>
        </div>

        <div className="grid items-start gap-6 lg:grid-cols-[1fr_320px]">
          <Card className="flex flex-col gap-5 p-6">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-foreground type-heading-s">Getting started</h2>
              <Badge tone="accent">1 of 5</Badge>
            </div>

            <div
              role="progressbar"
              aria-label="Onboarding checklist progress"
              aria-valuenow={1}
              aria-valuemin={0}
              aria-valuemax={5}
              className="bg-sunken h-1.5 w-full overflow-hidden rounded-full"
            >
              <div className="bg-primary h-full w-1/5 rounded-full" />
            </div>

            <div className="divide-border flex flex-col divide-y">
              {FIRST_RUN_CHECKLIST.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between gap-4 py-4 first:pt-2 last:pb-1"
                >
                  <div className="flex items-center gap-3.5">
                    {item.done ? (
                      <span
                        aria-hidden="true"
                        className="bg-success text-success-foreground inline-flex size-6 shrink-0 items-center justify-center rounded-full"
                      >
                        <Check className="size-3.5" />
                      </span>
                    ) : (
                      <span
                        aria-hidden="true"
                        className="bg-sunken inline-flex size-6 shrink-0 rounded-full"
                      />
                    )}
                    <div className="flex flex-col">
                      <span
                        className={
                          item.done
                            ? "text-muted-foreground type-body-s-strong"
                            : "text-foreground type-body-s-strong"
                        }
                      >
                        {item.title}
                      </span>
                      <span className="text-muted-foreground type-caption">{item.subtitle}</span>
                    </div>
                  </div>

                  {!item.done && (
                    <Button asChild variant="secondary" size="sm">
                      <Link href={item.href}>Start</Link>
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <div className="bg-sunken flex flex-col gap-4 rounded-xl p-6">
            <Sparkles className="text-foreground size-5" />
            <div className="flex flex-col gap-1.5">
              <h2 className="text-foreground type-heading-s">Start from a finished project</h2>
              <p className="text-muted-foreground type-body-s">
                Gather 4–6 final screenshots before you begin — slots are easier to fill.
              </p>
            </div>
            <Link
              href="/templates"
              className="text-foreground hover:text-primary type-body-s-strong inline-flex w-fit items-center gap-1.5 transition-colors"
            >
              Browse templates
              <ArrowRight className="size-4" />
            </Link>
          </div>
        </div>

        <div
          role="status"
          className="bg-inverse text-inverse-foreground shadow-overlay inline-flex w-fit items-center gap-3 self-end rounded-xl px-4 py-3"
        >
          <span className="bg-success text-success-foreground inline-flex size-5 items-center justify-center rounded-full">
            <Check className="size-3" />
          </span>
          <span className="type-body-s">Welcome to Casefolio! Your workspace is ready.</span>
        </div>
      </div>
    );
  }

  return <DashboardProjectsClient initialProjects={userProjects} />;
}
