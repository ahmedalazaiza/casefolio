import type { PlanTier, UserRole } from "@casefolio/db";
import { clampTeamsSeats, getWorkspaceQuotas } from "@/lib/billing/plans";

export const ENTITLEMENT_FEATURES = [
  "create_project",
  "publish_project",
  "pro_templates",
  "export_png",
  "export_png_2x",
  "export_pdf",
  "export_behance",
  "remove_watermark",
  "full_analytics",
  "team_seats",
  "shared_spaces",
] as const;

export type EntitlementFeature = (typeof ENTITLEMENT_FEATURES)[number];

export type EntitlementSubject =
  | PlanTier
  | {
      plan?: PlanTier | null;
      role?: UserRole | null;
      paidSeats?: number | null;
    }
  | null
  | undefined;

export interface EntitlementContext {
  projectsCount?: number;
  retainedProjectsCount?: number;
  publishedProjectsCount?: number;
  monthlyExportsCount?: number;
  seatsUsed?: number;
  seatsLimit?: number;
  paidSeats?: number;
  sharedSpacesCount?: number;
}

export interface EntitlementDecision {
  allowed: boolean;
  plan: PlanTier;
  requiredPlan: "pro" | "team";
  code:
    | "ALLOWED"
    | "PROJECT_LIMIT_REACHED"
    | "RETAINED_PROJECT_LIMIT_REACHED"
    | "PUBLISHED_PROJECT_LIMIT_REACHED"
    | "PRO_TEMPLATE_LOCKED"
    | "EXPORT_LIMIT_REACHED"
    | "PRO_EXPORT_FORMAT_LOCKED"
    | "WATERMARK_REMOVAL_LOCKED"
    | "FULL_ANALYTICS_LOCKED"
    | "TEAM_PLAN_REQUIRED"
    | "TEAM_SEAT_LIMIT_REACHED"
    | "SHARED_SPACE_LIMIT_REACHED";
  message: string;
}

export function normalizePlanTier(subject: EntitlementSubject): PlanTier {
  if (!subject) {
    return "free";
  }
  if (typeof subject === "string") {
    if (subject === "pro" || subject === "team") {
      return subject;
    }
    return "free";
  }
  if (subject.plan === "pro" || subject.plan === "team") {
    return subject.plan;
  }
  return "free";
}

function resolvePaidSeats(
  subject: EntitlementSubject,
  context: EntitlementContext,
): number {
  if (typeof context.paidSeats === "number" && context.paidSeats >= 1) {
    return clampTeamsSeats(context.paidSeats);
  }
  if (typeof context.seatsLimit === "number" && context.seatsLimit >= 1) {
    return clampTeamsSeats(context.seatsLimit);
  }
  if (subject && typeof subject === "object" && typeof subject.paidSeats === "number") {
    return clampTeamsSeats(subject.paidSeats);
  }
  return 1;
}

export function evaluateEntitlement(
  subject: EntitlementSubject,
  feature: EntitlementFeature,
  context: EntitlementContext = {},
): EntitlementDecision {
  const plan = normalizePlanTier(subject);
  const isPaid = plan === "pro" || plan === "team";
  const isTeam = plan === "team";
  const paidSeats = resolvePaidSeats(subject, context);
  const quotas = getWorkspaceQuotas(plan, paidSeats);

  switch (feature) {
    case "create_project": {
      const retainedUsed = context.retainedProjectsCount ?? context.projectsCount ?? 0;
      if (retainedUsed >= quotas.retainedProjectsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: plan === "free" ? "pro" : "team",
          code: "RETAINED_PROJECT_LIMIT_REACHED",
          message: `This workspace has reached its total retained project limit (${quotas.retainedProjectsLimit}, including archived projects).`,
        };
      }

      const activeUsed = context.projectsCount ?? 0;
      if (activeUsed >= quotas.activeProjectsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: plan === "free" ? "pro" : "team",
          code: "PROJECT_LIMIT_REACHED",
          message:
            plan === "free"
              ? `Free plan includes up to ${quotas.activeProjectsLimit} active projects. Archive an existing project or upgrade to Pro (up to 20 active projects).`
              : `This workspace has reached its active project limit (${quotas.activeProjectsLimit}). Archive an existing project or add capacity.`,
        };
      }

      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: `${quotas.activeProjectsLimit - activeUsed} active project slot(s) remaining.`,
      };
    }

    case "publish_project": {
      const publishedUsed = context.publishedProjectsCount ?? 0;
      if (publishedUsed >= quotas.publishedProjectsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: plan === "free" ? "pro" : "team",
          code: "PUBLISHED_PROJECT_LIMIT_REACHED",
          message:
            plan === "free"
              ? `Free plan allows ${quotas.publishedProjectsLimit} simultaneously published case study. Unpublish your live project first or upgrade to Pro (up to 10 published).`
              : `This workspace has reached its simultaneous published project limit (${quotas.publishedProjectsLimit}).`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: `${quotas.publishedProjectsLimit - publishedUsed} published slot(s) remaining.`,
      };
    }

    case "pro_templates": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "All eligible published templates unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "PRO_TEMPLATE_LOCKED",
        message: "Pro templates require an active Pro or Teams workspace plan.",
      };
    }

    case "export_png": {
      const monthlyUsed = context.monthlyExportsCount ?? 0;
      if (monthlyUsed >= quotas.monthlyExportsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: plan === "free" ? "pro" : "team",
          code: "EXPORT_LIMIT_REACHED",
          message: `This workspace has reached its ${quotas.monthlyExportsLimit} monthly export limit.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: isPaid
          ? "Unbranded PNG export available."
          : "Branded 1× PNG export available (up to 1,440 px).",
      };
    }

    case "export_png_2x": {
      if (!isPaid) {
        return {
          allowed: false,
          plan,
          requiredPlan: "pro",
          code: "PRO_EXPORT_FORMAT_LOCKED",
          message:
            "2× Retina PNG export (up to 2,880 px) requires Pro or Teams. Free supports 1× PNG up to 1,440 px.",
        };
      }
      const monthlyUsed = context.monthlyExportsCount ?? 0;
      if (monthlyUsed >= quotas.monthlyExportsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "EXPORT_LIMIT_REACHED",
          message: `This workspace has reached its ${quotas.monthlyExportsLimit} monthly export limit.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: "2× PNG export (up to 2,880 px) unlocked.",
      };
    }

    case "export_pdf": {
      if (!isPaid) {
        return {
          allowed: false,
          plan,
          requiredPlan: "pro",
          code: "PRO_EXPORT_FORMAT_LOCKED",
          message:
            "PDF export requires Casefolio Pro or Teams. Free plan supports branded 1× PNG exports.",
        };
      }
      const monthlyUsed = context.monthlyExportsCount ?? 0;
      if (monthlyUsed >= quotas.monthlyExportsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "EXPORT_LIMIT_REACHED",
          message: `This workspace has reached its ${quotas.monthlyExportsLimit} monthly export limit.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: "PDF exports (up to 60 pages) unlocked.",
      };
    }

    case "export_behance": {
      if (!isPaid) {
        return {
          allowed: false,
          plan,
          requiredPlan: "pro",
          code: "PRO_EXPORT_FORMAT_LOCKED",
          message:
            "Behance image pack export requires Casefolio Pro or Teams. Free plan supports branded 1× PNG exports.",
        };
      }
      const monthlyUsed = context.monthlyExportsCount ?? 0;
      if (monthlyUsed >= quotas.monthlyExportsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "EXPORT_LIMIT_REACHED",
          message: `This workspace has reached its ${quotas.monthlyExportsLimit} monthly export limit.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: "Behance 1,400 px slice pack unlocked.",
      };
    }

    case "remove_watermark": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Casefolio branding is removable on public pages and exports.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "WATERMARK_REMOVAL_LOCKED",
        message:
          "Removing the “Made with Casefolio” badge requires Casefolio Pro or Teams.",
      };
    }

    case "full_analytics": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: `${quotas.analyticsRetentionDays}-day visitor, referrer, and country analytics unlocked.`,
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "FULL_ANALYTICS_LOCKED",
        message: "90-day / 365-day referrer and daily trend analytics require Pro or Teams.",
      };
    }

    case "team_seats": {
      if (!isTeam) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_PLAN_REQUIRED",
          message:
            "Inviting team members requires an active Casefolio Teams subscription (S = 1–25 paid seats).",
        };
      }
      if (context.seatsLimit === undefined && context.seatsUsed === undefined) {
        return {
          allowed: true,
          plan,
          requiredPlan: "team",
          code: "ALLOWED",
          message: "Casefolio Teams collaboration unlocked.",
        };
      }
      const seatsLimit = clampTeamsSeats(context.seatsLimit ?? 1);
      const seatsUsed = context.seatsUsed ?? 1;
      if (seatsUsed >= seatsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_SEAT_LIMIT_REACHED",
          message: `All ${seatsLimit} paid seat(s) in this Teams workspace are occupied or reserved. The Owner can review adding seats in Billing.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "team",
        code: "ALLOWED",
        message: `${seatsLimit - seatsUsed} paid seat(s) available.`,
      };
    }

    case "shared_spaces": {
      if (!isTeam) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_PLAN_REQUIRED",
          message: "Shared team spaces require an active Casefolio Teams subscription.",
        };
      }
      const sharedUsed = context.sharedSpacesCount ?? 0;
      if (sharedUsed >= quotas.sharedSpacesLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "SHARED_SPACE_LIMIT_REACHED",
          message: `This Teams workspace has reached its ${quotas.sharedSpacesLimit} shared spaces limit (10 × S).`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "team",
        code: "ALLOWED",
        message: "Shared team spaces unlocked.",
      };
    }
  }
}

/**
 * Canonical single `can(user, feature, context?)` entitlement check (`02-RULES.md §5`).
 */
export function can(
  subject: EntitlementSubject,
  feature: EntitlementFeature,
  context?: EntitlementContext,
): boolean {
  return evaluateEntitlement(subject, feature, context).allowed;
}
