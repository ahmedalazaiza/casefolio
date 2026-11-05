import type { PlanTier, UserRole } from "@casefolio/db";
import { FREE_MONTHLY_EXPORT_LIMIT } from "@/lib/exports/types";
import { FREE_PROJECT_LIMIT } from "@/lib/projects/types";

export const ENTITLEMENT_FEATURES = [
  "create_project",
  "pro_templates",
  "export_png",
  "export_pdf",
  "export_behance",
  "remove_watermark",
  "full_analytics",
  "team_seats",
  "brand_kit",
] as const;

export type EntitlementFeature = (typeof ENTITLEMENT_FEATURES)[number];

export type EntitlementSubject =
  | PlanTier
  | {
      plan?: PlanTier | null;
      role?: UserRole | null;
    }
  | null
  | undefined;

export interface EntitlementContext {
  projectsCount?: number;
  monthlyExportsCount?: number;
  seatsUsed?: number;
  seatsLimit?: number;
}

export interface EntitlementDecision {
  allowed: boolean;
  plan: PlanTier;
  requiredPlan: "pro" | "team";
  code:
    | "ALLOWED"
    | "PROJECT_LIMIT_REACHED"
    | "PRO_TEMPLATE_LOCKED"
    | "EXPORT_LIMIT_REACHED"
    | "PRO_EXPORT_FORMAT_LOCKED"
    | "WATERMARK_REMOVAL_LOCKED"
    | "FULL_ANALYTICS_LOCKED"
    | "TEAM_PLAN_REQUIRED"
    | "TEAM_SEAT_LIMIT_REACHED"
    | "BRAND_KIT_LOCKED";
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

export function evaluateEntitlement(
  subject: EntitlementSubject,
  feature: EntitlementFeature,
  context: EntitlementContext = {},
): EntitlementDecision {
  const plan = normalizePlanTier(subject);
  const isPaid = plan === "pro" || plan === "team";
  const isTeam = plan === "team";

  switch (feature) {
    case "create_project": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Unlimited projects included.",
        };
      }
      const used = context.projectsCount ?? 0;
      if (used >= FREE_PROJECT_LIMIT) {
        return {
          allowed: false,
          plan,
          requiredPlan: "pro",
          code: "PROJECT_LIMIT_REACHED",
          message: `Free plan includes up to ${FREE_PROJECT_LIMIT} projects. Upgrade to Pro for unlimited case studies.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: `${FREE_PROJECT_LIMIT - used} Free project slot(s) remaining.`,
      };
    }

    case "pro_templates": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Pro templates unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "PRO_TEMPLATE_LOCKED",
        message: "Pro templates require an active Pro or Team plan.",
      };
    }

    case "export_png": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Unlimited PNG exports included.",
        };
      }
      const monthlyUsed = context.monthlyExportsCount ?? 0;
      if (monthlyUsed >= FREE_MONTHLY_EXPORT_LIMIT) {
        return {
          allowed: false,
          plan,
          requiredPlan: "pro",
          code: "EXPORT_LIMIT_REACHED",
          message: `Free plan includes up to ${FREE_MONTHLY_EXPORT_LIMIT} exports per month. Upgrade to Pro for unlimited PNG, PDF, and Behance exports.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "pro",
        code: "ALLOWED",
        message: "PNG export available with Casefolio watermark.",
      };
    }

    case "export_pdf": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "PDF exports unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "PRO_EXPORT_FORMAT_LOCKED",
        message:
          "PDF export requires Casefolio Pro or Team. Free plan supports watermarked PNG exports.",
      };
    }

    case "export_behance": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Behance 1400px slice exports unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "PRO_EXPORT_FORMAT_LOCKED",
        message:
          "Behance 1400px slice export requires Casefolio Pro or Team. Free plan supports watermarked PNG exports.",
      };
    }

    case "remove_watermark": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Watermarks removed on public pages and exports.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "WATERMARK_REMOVAL_LOCKED",
        message:
          "Removing the “Made with Casefolio” watermark requires Casefolio Pro or Team.",
      };
    }

    case "full_analytics": {
      if (isPaid) {
        return {
          allowed: true,
          plan,
          requiredPlan: "pro",
          code: "ALLOWED",
          message: "Full visitor, referrer, and country analytics unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "pro",
        code: "FULL_ANALYTICS_LOCKED",
        message: "Full referrer and daily trend analytics require Casefolio Pro or Team.",
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
            "Inviting collaborative team members requires Casefolio Team (includes 3+ studio seats).",
        };
      }
      const seatsLimit = Math.max(3, context.seatsLimit ?? 3);
      const seatsUsed = context.seatsUsed ?? 1;
      if (seatsUsed >= seatsLimit) {
        return {
          allowed: false,
          plan,
          requiredPlan: "team",
          code: "TEAM_SEAT_LIMIT_REACHED",
          message: `All ${seatsLimit} seats in this Team workspace are occupied or invited. Add seats in Billing settings to invite more members.`,
        };
      }
      return {
        allowed: true,
        plan,
        requiredPlan: "team",
        code: "ALLOWED",
        message: `${seatsLimit - seatsUsed} Team seat(s) available.`,
      };
    }

    case "brand_kit": {
      if (isTeam) {
        return {
          allowed: true,
          plan,
          requiredPlan: "team",
          code: "ALLOWED",
          message: "Shared studio brand kit unlocked.",
        };
      }
      return {
        allowed: false,
        plan,
        requiredPlan: "team",
        code: "BRAND_KIT_LOCKED",
        message: "Shared studio brand kits require Casefolio Team.",
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
