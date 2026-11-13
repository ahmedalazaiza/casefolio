import type { PlanTier, UserRole } from "@casefolio/db";
import {
  clampTeamsSeats,
  getWorkspaceQuotas,
  isUnlimitedProjectsLimit,
  PLUS_INCLUDED_SEATS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
} from "@/lib/billing/plans";

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
  "custom_domain",
  "white_label",
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
  requiredPlan: "pro" | "team" | "plus";
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
    | "PLUS_PLAN_REQUIRED"
    | "PLUS_SEAT_LIMIT_REACHED"
    | "SHARED_SPACE_LIMIT_REACHED";
  message: string;
}

export function normalizePlanTier(subject: EntitlementSubject): PlanTier {
  if (!subject) {
    return "free";
  }
  if (typeof subject === "string") {
    if (subject === "pro" || subject === "team" || subject === "plus") {
      return subject;
    }
    return "free";
  }
  if (
    subject.plan === "pro" ||
    subject.plan === "team" ||
    subject.plan === "plus"
  ) {
    return subject.plan;
  }
  return "free";
}

function resolvePaidSeats(
  plan: PlanTier,
  subject: EntitlementSubject,
  context: EntitlementContext,
): number {
  if (plan === "plus") {
    return PLUS_INCLUDED_SEATS;
  }
  if (plan !== "team") {
    return 1;
  }
  if (typeof context.paidSeats === "number" && context.paidSeats >= 1) {
    return clampTeamsSeats(context.paidSeats);
  }
  if (typeof context.seatsLimit === "number" && context.seatsLimit >= 1) {
    return clampTeamsSeats(context.seatsLimit);
  }
  if (subject && typeof subject === "object" && typeof subject.paidSeats === "number") {
    return clampTeamsSeats(subject.paidSeats);
  }
  return TEAMS_MIN_SEATS;
}

export function evaluateEntitlement(
  subject: EntitlementSubject,
  feature: EntitlementFeature,
  context: EntitlementContext = {},
): EntitlementDecision {
  const plan = normalizePlanTier(subject);
  const isPaid = plan === "pro" || plan === "team" || plan === "plus";
  const isTeamOrPlus = plan === "team" || plan === "plus";
  const isPlus = plan === "plus";
  const paidSeats = resolvePaidSeats(plan, subject, context);
  const quotas = getWorkspaceQuotas(plan, paidSeats);

  switch (feature) {
    case "create_project": {
      if (!isUnlimitedProjectsLimit(quotas.retainedProjectsLimit)) {
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
      }

      if (!isUnlimitedProjectsLimit(quotas.activeProjectsLimit)) {
        const activeUsed = context.projectsCount ?? 0;
        if (activeUsed >= quotas.activeProjectsLimit) {
          return {
            allowed: false,
            plan,
            requiredPlan: plan === "free" ? "pro" : "team",
            code: "PROJECT_LIMIT_REACHED",
            message:
              plan === "free"
                ? "Free plan allows 1 active Case Study. Upgrade to Casefolio Pro ($9.99/mo or $7.99/mo billed annually) for unlimited Case Studies."
                : `This workspace has reached its active project limit (${quotas.activeProjectsLimit}).`,
          };
        }

        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: `${quotas.activeProjectsLimit - activeUsed} active case study slot(s) remaining.`,
        };
      }

      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: "Unlimited Case Studies unlocked.",
      };
    }

    case "publish_project": {
      if (!isUnlimitedProjectsLimit(quotas.publishedProjectsLimit)) {
        const publishedUsed = context.publishedProjectsCount ?? 0;
        if (publishedUsed >= quotas.publishedProjectsLimit) {
          return {
            allowed: false,
            plan,
            requiredPlan: plan === "free" ? "pro" : "team",
            code: "PUBLISHED_PROJECT_LIMIT_REACHED",
            message:
              plan === "free"
                ? `Free plan allows ${quotas.publishedProjectsLimit} active live Case Study. Upgrade to Casefolio Pro for unlimited live Case Studies.`
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
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: "Unlimited published Case Studies unlocked.",
      };
    }

    case "pro_templates": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "All Pro & Premium templates unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "PRO_TEMPLATE_LOCKED",
        message: "Pro & Premium templates require Casefolio Pro, Team, or Plus.",
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
          ? "High-res PNG export without watermark available."
          : "PNG export available (includes subtle Casefolio watermark).",
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
            "High-res 2× Retina PNG export (up to 2,880 px) without watermark requires Casefolio Pro, Team, or Plus.",
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
        message: "High-res 2× PNG export (up to 2,880 px) unlocked.",
      };
    }

    case "export_pdf": {
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
          ? "High-res PDF export without watermark unlocked."
          : "PDF export available (includes subtle Casefolio watermark).",
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
            "Behance image pack export requires Casefolio Pro, Team, or Plus.",
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
          message: "Exports and live links are free of watermarks.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "WATERMARK_REMOVAL_LOCKED",
        message:
          "Removing the Casefolio watermark requires Casefolio Pro, Team, or Plus.",
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
        message: "View analytics on live links require Casefolio Pro, Team, or Plus.",
      };
    }

    case "team_seats": {
      if (!isTeamOrPlus) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_PLAN_REQUIRED",
          message:
            "Inviting team members requires an active Casefolio Team (2–10 seats) or Plus (up to 20 seats) plan.",
        };
      }
      if (context.seatsLimit === undefined && context.seatsUsed === undefined) {
        return {
          allowed: true,
          plan,
          requiredPlan: plan === "plus" ? "plus" : "team",
          code: "ALLOWED",
          message: "Team collaboration unlocked.",
        };
      }

      if (plan === "plus") {
        const plusLimit = Math.min(
          PLUS_INCLUDED_SEATS,
          Math.max(1, Math.floor(context.seatsLimit ?? PLUS_INCLUDED_SEATS)),
        );
        const used = context.seatsUsed ?? 1;
        if (used >= plusLimit) {
          return {
            allowed: false,
            plan,
            requiredPlan: "plus",
            code: "PLUS_SEAT_LIMIT_REACHED",
            message: `All ${plusLimit} team seats included in Casefolio Plus are occupied or reserved.`,
          };
        }
        return {
          allowed: true,
          plan,
          requiredPlan: "plus",
          code: "ALLOWED",
          message: `${plusLimit - used} Plus team seat(s) available.`,
        };
      }

      const seatsLimit = clampTeamsSeats(context.seatsLimit ?? TEAMS_MIN_SEATS);
      const seatsUsed = context.seatsUsed ?? 1;
      if (seatsUsed >= seatsLimit) {
        if (seatsLimit >= TEAMS_MAX_SELF_SERVE_SEATS) {
          return {
            allowed: false,
            plan,
            requiredPlan: "plus",
            code: "PLUS_PLAN_REQUIRED",
            message: `Team plan supports up to ${TEAMS_MAX_SELF_SERVE_SEATS} seats. Upgrade to Casefolio Plus ($99/mo or $79/mo billed annually) for up to ${PLUS_INCLUDED_SEATS} team seats.`,
          };
        }
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_SEAT_LIMIT_REACHED",
          message: `All ${seatsLimit} paid seat(s) in this Team workspace are occupied or reserved. Add seats in Billing (up to ${TEAMS_MAX_SELF_SERVE_SEATS}) or upgrade to Plus for up to ${PLUS_INCLUDED_SEATS} seats.`,
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
      if (!isTeamOrPlus) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_PLAN_REQUIRED",
          message: "Shared team workspaces require Casefolio Team or Plus.",
        };
      }
      const sharedUsed = context.sharedSpacesCount ?? 0;
      if (sharedUsed >= quotas.sharedSpacesLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: plan === "team" ? "plus" : "plus",
          code: "SHARED_SPACE_LIMIT_REACHED",
          message: `This workspace has reached its ${quotas.sharedSpacesLimit} shared spaces limit.`,
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

    case "custom_domain": {
      if (isPlus) {
        return {
          allowed: true,
          plan,
          requiredPlan: "plus",
          code: "ALLOWED",
          message: "Custom domain for live links unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "plus",
        code: "PLUS_PLAN_REQUIRED",
        message:
          "Connecting a custom domain (e.g., work.youragency.com) requires Casefolio Plus.",
      };
    }

    case "white_label": {
      if (isPlus) {
        return {
          allowed: true,
          plan,
          requiredPlan: "plus",
          code: "ALLOWED",
          message:
            "Complete white-labeling (removal of Casefolio branding from live links & PDF metadata) unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "plus",
        code: "PLUS_PLAN_REQUIRED",
        message:
          "Complete white-labeling on live links and PDF metadata requires Casefolio Plus.",
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
