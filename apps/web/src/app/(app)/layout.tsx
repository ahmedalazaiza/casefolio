import { and, count, eq, isNull } from "@casefolio/db";
import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { computeUserInitials, requireSession } from "@/lib/auth/session";
import { getWorkspaceQuotas, isUnlimitedProjectsLimit } from "@/lib/billing/plans";
import { getUserBillingOverview } from "@/lib/billing/service";
import { db, dbSchema } from "@/lib/db";
import { can } from "@/lib/entitlements";
import { listNotificationsForUser } from "@/lib/notifications/service";

function formatShortDate(iso: string | null): string | null {
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

export default async function WorkspaceLayout({ children }: { children: ReactNode }) {
  const { user } = await requireSession("/dashboard");

  if (user.role === "user" && !user.onboardingCompletedAt) {
    redirect("/onboarding");
  }

  const [billing, projectCountRows, notificationsSummary] = await Promise.all([
    getUserBillingOverview(user.id),
    db
      .select({ total: count() })
      .from(dbSchema.projects)
      .where(and(eq(dbSchema.projects.ownerId, user.id), isNull(dbSchema.projects.archivedAt))),
    listNotificationsForUser(user.id, { limit: 6 }),
  ]);

  const projectsUsed = Number(projectCountRows[0]?.total ?? 0);
  const initials = computeUserInitials(user.name, user.email);
  const isPaid = can(billing.effectivePlan, "pro_templates");
  const quotas = getWorkspaceQuotas(
    billing.effectivePlan,
    billing.teamBilling?.paidSeats ?? 1,
  );
  const periodDate = formatShortDate(billing.subscription?.currentPeriodEndIso ?? null);

  let planLabel = "Free · Starter";
  let renewsLabel = "Upgrade to Pro for Unlimited Case Studies";

  if (isPaid) {
    const tierTitle =
      billing.effectivePlan === "plus"
        ? "Plus"
        : billing.effectivePlan === "team"
          ? "Team"
          : "Pro";
    if (billing.subscription?.status === "past_due") {
      planLabel = `${tierTitle} · Past due`;
      renewsLabel = periodDate ? `Payment retry due ${periodDate}` : "Action needed in Billing";
    } else if (billing.subscription?.status === "cancel_at_period_end") {
      planLabel = `${tierTitle} · Cancels soon`;
      renewsLabel = periodDate ? `Active until ${periodDate}` : "Scheduled to end";
    } else {
      planLabel = `${tierTitle} · Active`;
      renewsLabel = periodDate ? `Renews ${periodDate}` : `${tierTitle} subscription active`;
    }
  }

  const failedPaymentPauseDateLabel =
    billing.subscription?.status === "past_due"
      ? (periodDate ?? "end of period")
      : null;

  return (
    <AppShell
      userInitials={initials}
      userName={user.name}
      userEmail={user.email}
      userImage={user.image}
      showProBadge={isPaid}
      planLabel={planLabel}
      projectsUsed={projectsUsed}
      projectsLimit={
        isUnlimitedProjectsLimit(quotas.activeProjectsLimit)
          ? null
          : quotas.activeProjectsLimit
      }
      renewsLabel={renewsLabel}
      failedPaymentPauseDateLabel={failedPaymentPauseDateLabel}
      initialUnreadNotifications={notificationsSummary.unreadCount}
      initialNotifications={notificationsSummary.notifications}
    >
      {children}
    </AppShell>
  );
}
