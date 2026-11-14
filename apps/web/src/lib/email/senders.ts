import { env } from "@/env";

export const EMAIL_DEPARTMENTS = [
  "admin",
  "security",
  "welcome",
  "team",
  "billing",
  "notifications",
  "support",
] as const;

export type EmailDepartment = (typeof EMAIL_DEPARTMENTS)[number];

export interface DepartmentSenderProfile {
  department: EmailDepartment;
  displayName: string;
  localPart: string;
  address: string;
  formattedFrom: string;
  defaultReplyTo: string;
  badgeLabel: string;
  categoryLabel: string;
  description: string;
}

function normalizeDomain(rawDomain: string | undefined): string {
  const cleaned = (rawDomain ?? "casefolio.com")
    .trim()
    .toLowerCase()
    .replace(/^@+/, "")
    .replace(/^https?:\/\//, "")
    .replace(/\/.*$/, "");
  return cleaned || "casefolio.com";
}

function parseOverrideSender(
  rawOverride: string | undefined,
  fallbackDisplayName: string,
  fallbackAddress: string,
): { displayName: string; address: string; formattedFrom: string } {
  const trimmed = rawOverride?.trim();
  if (!trimmed) {
    return {
      displayName: fallbackDisplayName,
      address: fallbackAddress,
      formattedFrom: `${fallbackDisplayName} <${fallbackAddress}>`,
    };
  }

  const angleMatch = trimmed.match(/^([^<]+)<([^>]+)>$/);
  if (angleMatch) {
    const displayName = angleMatch[1]?.trim() || fallbackDisplayName;
    const address = angleMatch[2]?.trim().toLowerCase() || fallbackAddress;
    return {
      displayName,
      address,
      formattedFrom: `${displayName} <${address}>`,
    };
  }

  if (trimmed.includes("@") && !trimmed.includes(" ")) {
    const address = trimmed.toLowerCase();
    return {
      displayName: fallbackDisplayName,
      address,
      formattedFrom: `${fallbackDisplayName} <${address}>`,
    };
  }

  return {
    displayName: fallbackDisplayName,
    address: fallbackAddress,
    formattedFrom: `${fallbackDisplayName} <${fallbackAddress}>`,
  };
}

export function resolveEmailDomain(): string {
  return normalizeDomain(env.EMAIL_DOMAIN);
}

export function resolveAdminAlertMailbox(): string {
  const configured = env.ADMIN_ALERT_EMAIL?.trim().toLowerCase();
  if (configured && configured.includes("@")) {
    return configured;
  }
  return `admin@${resolveEmailDomain()}`;
}

export function resolveSupportInboxMailbox(): string {
  const configured = env.SUPPORT_INBOX_EMAIL?.trim().toLowerCase();
  if (configured && configured.includes("@")) {
    return configured;
  }
  return `support@${resolveEmailDomain()}`;
}

export function resolveDepartmentSender(department: EmailDepartment): DepartmentSenderProfile {
  const domain = resolveEmailDomain();
  const supportAddress = resolveSupportInboxMailbox();
  const adminAddress = `admin@${domain}`;
  const billingAddress = `billing@${domain}`;

  const definitions: Record<
    EmailDepartment,
    {
      displayName: string;
      localPart: string;
      overrideValue: string | undefined;
      defaultReplyTo: string;
      badgeLabel: string;
      categoryLabel: string;
      description: string;
    }
  > = {
    admin: {
      displayName: "Casefolio Admin",
      localPart: "admin",
      overrideValue: env.EMAIL_FROM_ADMIN,
      defaultReplyTo: adminAddress,
      badgeLabel: "ADMINISTRATION",
      categoryLabel: "Admin & Governance",
      description:
        "Official platform governance, role grants, account moderation, and inbound admin alerts.",
    },
    security: {
      displayName: "Casefolio Security",
      localPart: "security",
      overrideValue: env.EMAIL_FROM_SECURITY,
      defaultReplyTo: supportAddress,
      badgeLabel: "ACCOUNT SECURITY",
      categoryLabel: "Auth & Security",
      description:
        "Verification OTPs, magic sign-in links, password resets, session revocations, and deletion receipts.",
    },
    welcome: {
      displayName: "Casefolio Studio",
      localPart: "hello",
      overrideValue: env.EMAIL_FROM_WELCOME,
      defaultReplyTo: supportAddress,
      badgeLabel: "WELCOME TO STUDIO",
      categoryLabel: "New User & Onboarding",
      description:
        "First-time creator welcome, studio quickstart guidance, and onboarding milestones.",
    },
    team: {
      displayName: "Casefolio Teams",
      localPart: "team",
      overrideValue: env.EMAIL_FROM_TEAM,
      defaultReplyTo: supportAddress,
      badgeLabel: "TEAM WORKSPACE",
      categoryLabel: "Teams & Collaboration",
      description:
        "Workspace invitations, member joins, role updates, ownership transfers, and departure recovery.",
    },
    billing: {
      displayName: "Casefolio Billing",
      localPart: "billing",
      overrideValue: env.EMAIL_FROM_BILLING,
      defaultReplyTo: billingAddress,
      badgeLabel: "BILLING & PLANS",
      categoryLabel: "Billing & Subscriptions",
      description:
        "Plan activations, seat adjustments, past-due dunning alerts, cancellations, and resumptions.",
    },
    notifications: {
      displayName: "Casefolio Notifications",
      localPart: "notifications",
      overrideValue: env.EMAIL_FROM_NOTIFICATIONS,
      defaultReplyTo: supportAddress,
      badgeLabel: "STUDIO ACTIVITY",
      categoryLabel: "Publishing & Exports",
      description:
        "Live case study publication links, PNG/PDF/Behance export completions, and template releases.",
    },
    support: {
      displayName: "Casefolio Support",
      localPart: "support",
      overrideValue: env.EMAIL_FROM_SUPPORT,
      defaultReplyTo: supportAddress,
      badgeLabel: "SUPPORT DESK",
      categoryLabel: "Help & Support",
      description:
        "Support ticket acknowledgements to users and inbound help-desk routing to the support team.",
    },
  };

  const def = definitions[department];
  const fallbackAddress = `${def.localPart}@${domain}`;
  const resolved = parseOverrideSender(def.overrideValue, def.displayName, fallbackAddress);

  return {
    department,
    displayName: resolved.displayName,
    localPart: def.localPart,
    address: resolved.address,
    formattedFrom: resolved.formattedFrom,
    defaultReplyTo: def.defaultReplyTo,
    badgeLabel: def.badgeLabel,
    categoryLabel: def.categoryLabel,
    description: def.description,
  };
}

export function listAllDepartmentSenders(): DepartmentSenderProfile[] {
  return EMAIL_DEPARTMENTS.map((dept) => resolveDepartmentSender(dept));
}

