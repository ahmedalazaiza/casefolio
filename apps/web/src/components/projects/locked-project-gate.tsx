"use client";

import { ArrowLeft, Building2, CreditCard, Lock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { PaddleCheckoutModal } from "@/components/billing/paddle-checkout-modal";
import { Button } from "@/components/ui/button";

export interface LockedProjectGateProps {
  projectName: string;
  workspaceKind: "personal" | "team";
  isTeamOwner: boolean;
  error: string;
}

export function LockedProjectGate({
  projectName,
  workspaceKind,
  isTeamOwner,
  error,
}: LockedProjectGateProps) {
  const [checkoutOpen, setCheckoutOpen] = useState(false);

  const isTeam = workspaceKind === "team";

  return (
    <div
      data-testid="locked-project-gate"
      className="bg-surface flex min-h-screen items-center justify-center p-6"
    >
      <div className="border-border bg-elevated flex w-full max-w-lg flex-col gap-6 rounded-xl border p-8">
        <div className="flex items-start gap-4">
          <div className="bg-warning-soft text-warning flex size-12 shrink-0 items-center justify-center rounded-xl">
            <Lock className="size-6" />
          </div>
          <div className="flex flex-col gap-1.5">
            <span className="text-muted-foreground type-caption font-semibold uppercase tracking-wider">
              {isTeam ? "Team workspace locked" : "Case study locked · Free limit"}
            </span>
            <h1 className="text-foreground type-heading-l">“{projectName}” is locked</h1>
            <p className="text-muted-foreground type-body-s">{error}</p>
          </div>
        </div>

        <div className="border-border bg-surface flex flex-col gap-2 rounded-xl border p-4">
          <p className="text-foreground type-body-s-strong">
            {isTeam
              ? isTeamOwner
                ? "Renew Teams to unlock all team Case Studies & live URLs"
                : "Ask your Team Owner to renew Teams"
              : "Nothing was deleted — upgrade anytime to unlock"}
          </p>
          <p className="text-muted-foreground type-caption">
            {isTeam
              ? "All team drafts, images, and custom links remain stored safely and restore automatically upon renewal. Your own Personal Workspace remains active with your Free Case Study allowance."
              : "All sections, images, exports metadata, and custom URL slugs are preserved. Paying immediately unlocks opening, editing, exports, and restores previously published links."}
          </p>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button asChild variant="secondary">
            <Link href="/dashboard">
              <ArrowLeft className="size-4" />
              Back to dashboard
            </Link>
          </Button>

          {(!isTeam || isTeamOwner) ? (
            <div className="flex flex-wrap items-center gap-2">
              <Button asChild variant="secondary">
                <Link href="/account/billing">
                  <CreditCard className="size-4" />
                  Billing settings
                </Link>
              </Button>
              <Button
                type="button"
                data-testid="locked-gate-upgrade-btn"
                onClick={() => setCheckoutOpen(true)}
              >
                <Sparkles className="size-4" />
                {isTeam ? "Renew Teams" : "Upgrade to Pro"}
              </Button>
            </div>
          ) : (
            <Button asChild variant="default">
              <Link href="/dashboard">
                <Building2 className="size-4" />
                Open Personal Workspace
              </Link>
            </Button>
          )}
        </div>
      </div>

      {checkoutOpen && (
        <PaddleCheckoutModal
          open={checkoutOpen}
          onOpenChange={setCheckoutOpen}
          initialPlan={isTeam ? "team" : "pro"}
          initialInterval="monthly"
        />
      )}
    </div>
  );
}
