import type { PlanTier, UserRole } from "@casefolio/db";
import {
  clampTeamsSeats,
  FREE_LIFETIME_PROJECT_LIMIT,
  getWorkspaceQuotas,
  isUnlimitedProjectsLimit,
  PRO_MAX_PROJECTS,
  TEAMS_MAX_SELF_SERVE_SEATS,
  TEAMS_MIN_SEATS,
} from "@/lib/billing/plans";

export const ENTITLEMENT_FEATURES = [
  "create_project",
  "publish_project",
  "custom_slug",
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
  lifetimeProjectsCreated?: number;
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
    | "FREE_LIFETIME_CREDIT_USED"
    | "RETAINED_PROJECT_LIMIT_REACHED"
    | "PUBLISHED_PROJECT_LIMIT_REACHED"
    | "CUSTOM_SLUG_LOCKED"
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

export function normalizePlanTier(subject: EntitlementSubject): "free" | "pro" | "team" {
  if (!subject) {
    return "free";
  }
  if (typeof subject === "string") {
    if (subject === "pro") return "pro";
    if (subject === "team" || subject === "plus") return "team";
    return "free";
  }
  if (subject.plan === "pro") return "pro";
  if (subject.plan === "team" || subject.plan === "plus") return "team";
  return "free";
}

function resolvePaidSeats(
  plan: "free" | "pro" | "team",
  subject: EntitlementSubject,
  context: EntitlementContext,
): number {
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
  const isPaid = plan === "pro" || plan === "team";
  const isTeam = plan === "team";
  const paidSeats = resolvePaidSeats(plan, subject, context);
  const quotas = getWorkspaceQuotas(plan, paidSeats);

  switch (feature) {
    case "create_project": {
      if (plan === "free" && quotas.lifetimeProjectsLimit !== null) {
        const lifetimeUsed = Math.max(
          context.lifetimeProjectsCreated ?? 0,
          context.projectsCount ?? 0,
        );
        if (lifetimeUsed >= quotas.lifetimeProjectsLimit) {
          return {
            allowed: false,
            plan,
            requiredPlan: "pro",
            code: "PROJECT_LIMIT_REACHED",
            message:
              "You've used your 1 lifetime free Case Study credit. Deleting a project on the Free plan does not grant a new credit — upgrade to Casefolio Pro ($7.99/mo · 2 months free on annual) for up to 10 rotatable Case Studies.",
          };
        }
      }

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
                ? "You've used your 1 lifetime free Case Study credit. Upgrade to Casefolio Pro ($7.99/mo · 2 months free on annual) for up to 10 active Case Studies."
                : `You've reached all ${PRO_MAX_PROJECTS} active Case Study slots on Pro. Delete or archive a project to free a slot, or upgrade to Teams ($5.99/seat/mo) for unlimited shared Case Studies.`,
          };
        }

        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message:
            plan === "free"
              ? `${FREE_LIFETIME_PROJECT_LIMIT - activeUsed} lifetime free Case Study credit available.`
              : `${quotas.activeProjectsLimit - activeUsed} of ${quotas.activeProjectsLimit} active Case Study slots remaining.`,
        };
      }

      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: "Unlimited shared Case Studies unlocked.",
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
                ? `Free plan allows ${quotas.publishedProjectsLimit} live Case Study. Upgrade to Casefolio Pro ($7.99/mo) for up to ${PRO_MAX_PROJECTS} live Case Studies with custom URLs.`
                : `You've reached all ${quotas.publishedProjectsLimit} simultaneous published Case Study slots on Pro. Unpublish a project or upgrade to Teams for unlimited live Case Studies.`,
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

    case "custom_slug": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Custom Case Study URL (/p/your-custom-slug) unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "CUSTOM_SLUG_LOCKED",
        message:
          "Custom Case Study URLs (/p/your-custom-slug) require Casefolio Pro ($7.99/mo) or Teams. Free Case Studies publish with an automatic shareable URL.",
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
        message: "Pro & Premium templates require Casefolio Pro or Teams.",
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
            "High-res 2× Retina PNG export (up to 2,880 px) without watermark requires Casefolio Pro or Teams.",
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
          message: "Behance image pack export requires Casefolio Pro or Teams.",
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
        message: "Removing the Casefolio watermark requires Casefolio Pro or Teams.",
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
        message: "View analytics on live links require Casefolio Pro or Teams.",
      };
    }

    case "team_seats": {
      if (!isTeam) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_PLAN_REQUIRED",
          message: `Inviting team members requires an active Casefolio Teams (${TEAMS_MIN_SEATS}–${TEAMS_MAX_SELF_SERVE_SEATS} seats) plan.`,
        };
      }
      if (context.seatsLimit === undefined && context.seatsUsed === undefined) {
        return {
          allowed: true,
          plan,
          requiredPlan: "team",
          code: "ALLOWED",
          message: "Team collaboration unlocked.",
        };
      }

      const seatsLimit = clampTeamsSeats(context.seatsLimit ?? TEAMS_MIN_SEATS);
      const seatsUsed = context.seatsUsed ?? 1;
      if (seatsUsed >= seatsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_SEAT_LIMIT_REACHED",
          message:
            seatsLimit >= TEAMS_MAX_SELF_SERVE_SEATS
              ? `All ${seatsLimit} self-serve seats are occupied or reserved. Contact support for 26+ enterprise seats.`
              : `All ${seatsLimit} paid seat(s) in this Teams workspace are occupied or reserved. Add seats in Team & Billing (up to ${TEAMS_MAX_SELF_SERVE_SEATS}).`,
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
          message: "Shared team workspaces require Casefolio Teams.",
        };
      }
      const sharedUsed = context.sharedSpacesCount ?? 0;
      if (sharedUsed >= quotas.sharedSpacesLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
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

    case "custom_domain":
    case "white_label": {
      return {
        allowed: false,
        plan,
        requiredPlan: "team",
        code: "TEAM_PLAN_REQUIRED",
        message: "Custom domains and white-label delivery are not active on self-serve tiers.",
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
