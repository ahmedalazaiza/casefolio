import type { PlanTier } from "@casefolio/db";
import type { AppShellProps } from "@/components/layout/app-shell";
import { computeUserInitials } from "@/lib/auth/session";
import {
  evaluateSubscriptionLifecycle,
  FREE_LIFETIME_PROJECT_LIMIT,
  getPastDueDaysRemaining,
  PAST_DUE_GRACE_DAYS,
  PRO_MAX_PROJECTS,
} from "@/lib/billing/plans";
import { getUserBillingOverview } from "@/lib/billing/service";
import { can, normalizePlanTier } from "@/lib/entitlements";
import {
  getTeamSeatOccupancy,
  getWorkspaceLifetimeProjectsCreated,
} from "@/lib/entitlements/team-invitations";
import { listNotificationsForUser } from "@/lib/notifications/service";
import { listWorkspaceSwitcherState } from "@/lib/workspaces/service";

export interface WorkspaceShellUserInput {
  id: string;
  name: string;
  email: string;
  image?: string | null;
}

export interface ComputedWorkspaceShellResult {
  shellProps: Omit<AppShellProps, "children">;
  activePlan: PlanTier;
}

function formatShortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

export async function buildWorkspaceShellProps(
  user: WorkspaceShellUserInput,
  activeOrganizationId: string | null = null,
  now: Date = new Date(),
): Promise<ComputedWorkspaceShellResult> {
  const [switcher, billing, notificationsSummary] = await Promise.all([
    listWorkspaceSwitcherState(user.id, activeOrganizationId, now),
    getUserBillingOverview(user.id, now, activeOrganizationId),
    listNotificationsForUser(user.id, { limit: 6 }),
  ]);

  const activeWs = switcher.activeWorkspace;
  const activeOrgId = activeWs.kind === "team" ? activeWs.organizationId : null;
  const canonicalPlan = normalizePlanTier(activeWs.plan);
  const initials = computeUserInitials(user.name, user.email);

  let planLabel: string;
  let planStatus: string;
  let projectsUsed: number;
  let projectsLimit: number | null;
  let quotaSummaryLabel: string;
  let renewsLabel: string;
  let failedPaymentPauseDateLabel: string | null = null;
  let renewalGraceBanner: AppShellProps["renewalGraceBanner"] = null;

  if (activeWs.kind === "team") {
    if (canonicalPlan === "team") {
      const matchedTeamBilling =
        billing.teamBilling?.organizationId === activeOrgId
          ? billing.teamBilling
          : null;
      const occupancy =
        matchedTeamBilling ??
        (activeOrgId ? await getTeamSeatOccupancy(activeOrgId, now) : null);

      const occupiedSeats = occupancy?.occupiedSeats ?? 1;
      const paidSeats = matchedTeamBilling?.paidSeats ?? activeWs.paidSeats;
      const teamStatus = matchedTeamBilling?.status ?? "active";
      const periodEndDate = matchedTeamBilling?.currentPeriodEndIso
        ? new Date(matchedTeamBilling.currentPeriodEndIso)
        : null;
      const periodDate = formatShortDate(matchedTeamBilling?.currentPeriodEndIso ?? null);

      planStatus = teamStatus;
      projectsUsed = occupiedSeats;
      projectsLimit = paidSeats;
      quotaSummaryLabel = `${occupiedSeats} of ${paidSeats} Seats occupied · Unlimited Case Studies`;

      if (teamStatus === "past_due") {
        const pastDueAnchor = matchedTeamBilling?.pastDueSinceIso
          ? new Date(matchedTeamBilling.pastDueSinceIso)
          : periodEndDate;
        const lifecycle = evaluateSubscriptionLifecycle({
          status: "past_due",
          currentPeriodEnd: periodEndDate,
          pastDueSince: pastDueAnchor,
          now,
        });
        const daysLeft = getPastDueDaysRemaining(lifecycle.pastDueEndsAt, now);
        const deadlineLabel = formatShortDate(lifecycle.pastDueEndsAt?.toISOString() ?? null);
        planLabel = daysLeft > 0 ? `TEAMS · RENEW (${daysLeft}D LEFT)` : "TEAMS · PAST DUE";
        renewsLabel = deadlineLabel ? `Locks ${deadlineLabel}` : "Action needed in Billing";
        failedPaymentPauseDateLabel = deadlineLabel ?? "end of grace window";
        renewalGraceBanner = {
          kind: "past_due",
          daysRemaining: daysLeft,
          deadlineLabel: deadlineLabel ?? "soon",
          isTeam: true,
          isTeamOwner: Boolean(matchedTeamBilling?.isOwner),
        };
      } else if (teamStatus === "cancel_at_period_end") {
        planLabel = "TEAMS · CANCELS SOON";
        renewsLabel = periodDate ? `Active until ${periodDate}` : "Scheduled to end";
        if (periodEndDate && periodEndDate.getTime() > now.getTime()) {
          const daysLeft = getPastDueDaysRemaining(periodEndDate, now);
          if (daysLeft <= PAST_DUE_GRACE_DAYS) {
            renewalGraceBanner = {
              kind: "ending_soon",
              daysRemaining: daysLeft,
              deadlineLabel: periodDate ?? "soon",
              isTeam: true,
              isTeamOwner: Boolean(matchedTeamBilling?.isOwner),
            };
          }
        }
      } else {
        planLabel = "TEAMS · ACTIVE";
        renewsLabel = periodDate ? `Renews ${periodDate}` : "Teams subscription active";
      }
    } else {
      planLabel = "TEAM · UNFUNDED";
      planStatus = "unfunded";
      projectsUsed = 0;
      projectsLimit = 1;
      quotaSummaryLabel = "No active Teams seats yet";
      renewsLabel = "Activate Casefolio Teams ($5.99/seat/mo · 2–25 seats)";
    }
  } else if (canonicalPlan === "pro") {
    const personalStatus = billing.subscription?.status ?? "active";
    const periodEndDate = billing.subscription?.currentPeriodEndIso
      ? new Date(billing.subscription.currentPeriodEndIso)
      : null;
    const periodDate = formatShortDate(billing.subscription?.currentPeriodEndIso ?? null);

    planStatus = personalStatus;
    projectsUsed = activeWs.usage.activeProjects;
    projectsLimit = PRO_MAX_PROJECTS;
    quotaSummaryLabel = `${projectsUsed} of ${PRO_MAX_PROJECTS} Case Studies`;

    if (personalStatus === "past_due") {
      const pastDueAnchor = billing.subscription?.pastDueSinceIso
        ? new Date(billing.subscription.pastDueSinceIso)
        : periodEndDate;
      const lifecycle = evaluateSubscriptionLifecycle({
        status: "past_due",
        currentPeriodEnd: periodEndDate,
        pastDueSince: pastDueAnchor,
        now,
      });
      const daysLeft = getPastDueDaysRemaining(lifecycle.pastDueEndsAt, now);
      const deadlineLabel = formatShortDate(lifecycle.pastDueEndsAt?.toISOString() ?? null);
      planLabel = daysLeft > 0 ? `PRO · RENEW (${daysLeft}D LEFT)` : "PRO · PAST DUE";
      renewsLabel = deadlineLabel ? `Locks ${deadlineLabel}` : "Action needed in Billing";
      failedPaymentPauseDateLabel = deadlineLabel ?? "end of grace window";
      renewalGraceBanner = {
        kind: "past_due",
        daysRemaining: daysLeft,
        deadlineLabel: deadlineLabel ?? "soon",
        isTeam: false,
        isTeamOwner: true,
      };
    } else if (personalStatus === "cancel_at_period_end") {
      planLabel = "PRO · CANCELS SOON";
      renewsLabel = periodDate ? `Active until ${periodDate}` : "Scheduled to end";
      if (periodEndDate && periodEndDate.getTime() > now.getTime()) {
        const daysLeft = getPastDueDaysRemaining(periodEndDate, now);
        if (daysLeft <= PAST_DUE_GRACE_DAYS) {
          renewalGraceBanner = {
            kind: "ending_soon",
            daysRemaining: daysLeft,
            deadlineLabel: periodDate ?? "soon",
            isTeam: false,
            isTeamOwner: true,
          };
        }
      }
    } else {
      planLabel = "PRO · ACTIVE";
      renewsLabel = periodDate ? `Renews ${periodDate}` : "Pro subscription active";
    }
  } else {
    const lifetimeCreated = await getWorkspaceLifetimeProjectsCreated(activeWs.workspaceId);
    const lifetimeUsed = Math.min(
      FREE_LIFETIME_PROJECT_LIMIT,
      Math.max(lifetimeCreated, activeWs.usage.activeProjects),
    );
    planLabel = "FREE · STARTER";
    planStatus = "active";
    projectsUsed = lifetimeUsed;
    projectsLimit = FREE_LIFETIME_PROJECT_LIMIT;
    quotaSummaryLabel = `${lifetimeUsed} of ${FREE_LIFETIME_PROJECT_LIMIT} Lifetime Case Study credit used`;
    renewsLabel = "2 months free on annual · Up to 10 Case Studies";
  }

  const isPaid = can(activeWs.plan, "pro_templates");
  const headerPlanTier: "free" | "pro" | "team" =
    canonicalPlan === "team" ? "team" : canonicalPlan === "pro" ? "pro" : "free";

  return {
    activePlan: activeWs.plan,
    shellProps: {
      userInitials: initials,
      userName: user.name,
      userEmail: user.email,
      userImage: user.image,
      showProBadge: isPaid,
      headerPlanTier,
      planTier: canonicalPlan,
      planStatus,
      planLabel,
      projectsUsed,
      projectsLimit,
      quotaSummaryLabel,
      renewsLabel,
      failedPaymentPauseDateLabel,
      renewalGraceBanner,
      activeOrganizationId: activeOrgId,
      activeWorkspaceName:
        activeWs.kind === "personal" ? "Personal Workspace" : activeWs.name,
      workspaces: switcher.workspaces.map((ws) => ({
        workspaceId: ws.workspaceId,
        kind: ws.kind,
        name: ws.name,
        organizationId: ws.organizationId,
        plan: ws.plan,
        paidSeats: ws.paidSeats,
      })),
      initialUnreadNotifications: notificationsSummary.unreadCount,
      initialNotifications: notificationsSummary.notifications,
    },
  };
}
