import { env } from "@/env";
import {
  renderCasefolioEmail,
  sendCasefolioEmail,
  type SendCasefolioEmailInput,
  type SendCasefolioEmailResult,
} from "@/lib/email/client";
import {
  resolveAdminAlertMailbox,
  resolveDepartmentSender,
  resolveSupportInboxMailbox,
  type EmailDepartment,
} from "@/lib/email/senders";

export type EmailAudienceGroup =
  | "new_user"
  | "existing_user"
  | "team"
  | "billing"
  | "support"
  | "admin";

export interface EmailCatalogEntry {
  key: string;
  title: string;
  audience: EmailAudienceGroup;
  audienceLabel: string;
  department: EmailDepartment;
  triggerSummary: string;
  buildSample: (appBaseUrl?: string) => Omit<SendCasefolioEmailInput, "to">;
}

function resolveAppBase(override?: string): string {
  return (override ?? env.NEXT_PUBLIC_APP_URL ?? "https://casefolio.com").replace(/\/+$/, "");
}

function formatPlanLabel(plan: string | null | undefined): string {
  const clean = (plan ?? "pro").trim().toLowerCase();
  if (clean === "team" || clean === "plus") return "Casefolio Teams";
  if (clean === "pro") return "Casefolio Pro";
  return "Casefolio Free";
}

function formatRoleLabel(role: string): string {
  const clean = role.trim().toLowerCase();
  if (clean === "superadmin") return "Superadmin";
  if (clean === "owner") return "Workspace Owner";
  if (clean === "admin") return "Admin";
  if (clean === "member") return "Member";
  return "User";
}

// ============================================================================
// 1. NEW USER & ONBOARDING (security@casefolio.com & hello@casefolio.com)
// ============================================================================

export function buildVerificationOtpEmail(args: {
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);

  if (args.type === "forget-password") {
    return {
      department: "security",
      templateKey: "security.password_reset_otp",
      subject: "Your Casefolio password reset code",
      appBaseUrl: baseUrl,
      content: {
        previewText: `Your 6-digit Casefolio password reset code is ${args.otp}`,
        eyebrow: "Password Recovery",
        heading: "Reset your password",
        paragraphs: [
          "Use the 6-digit verification code below to confirm your password reset request in Casefolio.",
          "For your protection, never share this one-time security code with anyone.",
        ],
        code: args.otp,
        codeCaption: "EXPIRES IN 10 MINUTES · SINGLE USE",
        footerNote:
          "If you did not request a password reset, ignore this message — your password remains unchanged.",
      },
    };
  }

  if (args.type === "change-email") {
    return {
      department: "security",
      templateKey: "security.email_change_otp",
      subject: "Confirm your new Casefolio email address",
      appBaseUrl: baseUrl,
      content: {
        previewText: `Your 6-digit Casefolio email confirmation code is ${args.otp}`,
        eyebrow: "Email Change Verification",
        heading: "Confirm your new email",
        paragraphs: [
          "Enter the 6-digit security code below to verify this email address and attach it to your Casefolio account.",
        ],
        code: args.otp,
        codeCaption: "EXPIRES IN 10 MINUTES · ACCOUNT SECURITY",
        footerNote:
          "If you did not initiate an email change on Casefolio, you can safely disregard this email.",
      },
    };
  }

  if (args.type === "sign-in") {
    return {
      department: "security",
      templateKey: "auth.signin_otp",
      subject: "Your Casefolio sign-in code",
      appBaseUrl: baseUrl,
      content: {
        previewText: `Your 6-digit Casefolio sign-in code is ${args.otp}`,
        eyebrow: "One-Time Sign-In",
        heading: "Sign-in verification code",
        paragraphs: [
          "Enter the 6-digit verification code below to finish signing in to your Casefolio studio.",
        ],
        code: args.otp,
        codeCaption: "EXPIRES IN 10 MINUTES · SINGLE USE",
        footerNote:
          "If you did not attempt to sign in, you can safely ignore this email.",
      },
    };
  }

  return {
    department: "security",
    templateKey: "auth.verify_otp",
    subject: "Verify your Casefolio email",
    appBaseUrl: baseUrl,
    content: {
      previewText: `Your 6-digit Casefolio code is ${args.otp}`,
      eyebrow: "New Account Verification",
      heading: "Verify your email",
      paragraphs: [
        "Welcome to Casefolio. Enter the 6-digit verification code below to verify your email address and unlock your portfolio studio.",
      ],
      code: args.otp,
      codeCaption: "EXPIRES IN 10 MINUTES · SINGLE USE",
      footerNote:
        "If you did not create a Casefolio account, you can safely ignore this message.",
    },
  };
}

export function buildWelcomeNewUserEmail(args: {
  name?: string | null;
  jobTitle?: string | null;
  designFocus?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const firstName = args.name?.trim().split(/\s+/)[0] || "there";
  const focusLabel =
    args.designFocus === "mobile"
      ? "Mobile product design"
      : args.designFocus === "web"
        ? "Web & SaaS design"
        : "Product & digital design";

  return {
    department: "welcome",
    templateKey: "welcome.new_user",
    subject: "Welcome to Casefolio Studio — ship your first case study",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Your Casefolio studio is ready. Pick a ratio-locked template and publish in minutes.",
      eyebrow: "Studio Ready",
      heading: "Welcome to Casefolio.",
      greeting: `Hi ${firstName},`,
      paragraphs: [
        "Your personal Casefolio workspace is active and ready. We built Casefolio so product designers and studios can turn raw screens and decisions into crisp, architectural case studies — without fighting brittle layouts.",
        "Start from any curated template, drop screenshots into ratio-locked frames, customize your typography and color tokens, and publish a fast public link or export pixel-sharp PDFs and Behance slices.",
      ],
      specs: [
        { label: "Workspace", value: "Personal Studio (Active)" },
        { label: "Role Profile", value: args.jobTitle?.trim() || "Product Designer" },
        { label: "Focus Track", value: focusLabel },
      ],
      highlights: [
        {
          title: "Choose an editorial template",
          description: "Browse curated mobile, SaaS, and branding templates engineered with strict grid discipline.",
        },
        {
          title: "Drop screens into smart slots",
          description: "Upload high-DPI screenshots — every device and browser frame keeps exact aspect ratios.",
        },
        {
          title: "Publish live or export",
          description: "Share a clean /p/slug URL or export presentation-ready PNG, PDF, and Behance assets.",
        },
      ],
      ctaLabel: "Create your first case study",
      ctaUrl: `${baseUrl}/new`,
      secondaryCta: {
        label: "Explore templates",
        url: `${baseUrl}/templates`,
      },
      footerNote:
        "Questions or feedback? Reply directly to this email — it routes straight to our studio team.",
    },
  };
}

export async function sendWelcomeNewUserEmail(args: {
  to: string;
  name?: string | null;
  jobTitle?: string | null;
  designFocus?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildWelcomeNewUserEmail(args),
  });
}

// ============================================================================
// 2. AUTHENTICATION & ACCOUNT SECURITY (security@casefolio.com)
// ============================================================================

export function buildMagicLinkSignInEmail(args: {
  url: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "security",
    templateKey: "auth.magic_link",
    subject: "Sign in to Casefolio",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Your one-click sign-in link for Casefolio",
      eyebrow: "Instant Sign-In",
      heading: "Sign in to Casefolio",
      paragraphs: [
        "Click the button below to securely sign in to your Casefolio workspace. This link is single-use and expires in 5 minutes.",
      ],
      callout: {
        tone: "info",
        title: "Security check",
        body: "Only open this link on the device where you requested sign-in.",
      },
      ctaLabel: "Sign in to Casefolio",
      ctaUrl: args.url,
      footerNote:
        "If you did not request this sign-in link, ignore this message — nobody can access your account without clicking this link.",
    },
  };
}

export function buildPasswordResetLinkEmail(args: {
  url: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "security",
    templateKey: "auth.password_reset",
    subject: "Reset your Casefolio password",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Reset your Casefolio account password",
      eyebrow: "Credential Recovery",
      heading: "Reset your password",
      paragraphs: [
        "We received a request to reset the password for your Casefolio account. Choose a new password using the secure link below.",
      ],
      ctaLabel: "Choose new password",
      ctaUrl: args.url,
      footerNote:
        "If you did not request a password reset, you can safely ignore this email — your current password stays active.",
    },
  };
}

export function buildPasswordChangedEmail(args: {
  name?: string | null;
  changedAtIso?: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const timestamp = new Date(args.changedAtIso ?? new Date().toISOString()).toUTCString();
  return {
    department: "security",
    templateKey: "security.password_changed",
    subject: "Security alert: Your Casefolio password was updated",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Your Casefolio account password was just changed.",
      eyebrow: "Account Security",
      heading: "Your password was updated",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        "This is an automated confirmation that the password for your Casefolio account was recently updated.",
        "If you made this change, no further action is needed.",
      ],
      specs: [
        { label: "Security Event", value: "Account password updated" },
        { label: "Timestamp (UTC)", value: timestamp },
      ],
      callout: {
        tone: "warning",
        title: "Wasn't you?",
        body: "Reset your password immediately and revoke active sessions from Account Security.",
      },
      ctaLabel: "Review active sessions",
      ctaUrl: `${baseUrl}/account/security`,
    },
  };
}

export async function sendPasswordChangedEmail(args: {
  to: string;
  name?: string | null;
  changedAtIso?: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildPasswordChangedEmail(args),
  });
}

export function buildSessionsRevokedEmail(args: {
  name?: string | null;
  revokedAtIso?: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const timestamp = new Date(args.revokedAtIso ?? new Date().toISOString()).toUTCString();
  return {
    department: "security",
    templateKey: "security.sessions_revoked",
    subject: "Active devices signed out on your Casefolio account",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Other active sessions on your Casefolio account were signed out.",
      eyebrow: "Session Control",
      heading: "Other devices signed out",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        "All other active browser and device sessions signed in to your Casefolio account were revoked from your Security Settings.",
      ],
      specs: [
        { label: "Action", value: "Revoked all other active sessions" },
        { label: "Timestamp (UTC)", value: timestamp },
      ],
      ctaLabel: "Open Security Settings",
      ctaUrl: `${baseUrl}/account/security`,
    },
  };
}

export async function sendSessionsRevokedEmail(args: {
  to: string;
  name?: string | null;
  revokedAtIso?: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildSessionsRevokedEmail(args),
  });
}

export function buildAccountDeletedEmail(args: {
  name?: string | null;
  deletedAtIso?: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const timestamp = new Date(args.deletedAtIso ?? new Date().toISOString()).toUTCString();
  return {
    department: "security",
    templateKey: "security.account_deleted",
    subject: "Your Casefolio account has been permanently deleted",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Confirmation that your Casefolio account and personal assets were permanently purged.",
      eyebrow: "Account Closure Receipt",
      heading: "Account permanently deleted",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        "Your Casefolio account deletion request is complete. Your personal profile, personal case studies, uploaded screenshots, export artifacts, and active personal subscriptions have been permanently removed.",
        "Thank you for building with Casefolio. Should you ever return in the future, you are always welcome to start a fresh workspace.",
      ],
      specs: [
        { label: "Status", value: "Permanently purged" },
        { label: "Completed At", value: timestamp },
        { label: "Personal Billing", value: "Canceled" },
      ],
      footerNote:
        "This is a final one-time confirmation receipt for your records. No further emails will be sent.",
    },
  };
}

export async function sendAccountDeletedEmail(args: {
  to: string;
  name?: string | null;
  deletedAtIso?: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildAccountDeletedEmail(args),
  });
}

function formatUtcDate(iso: string): string {
  return new Date(iso).toUTCString();
}

export function buildAccountDeletionScheduledEmail(args: {
  name?: string | null;
  scheduledForIso: string;
  cancelUrl?: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const when = formatUtcDate(args.scheduledForIso);
  return {
    department: "security",
    templateKey: "security.account_deletion_scheduled",
    subject: "Your Casefolio account is scheduled for deletion",
    appBaseUrl: baseUrl,
    content: {
      previewText: `Your Casefolio account will be permanently deleted on ${when}. You can cancel until then.`,
      eyebrow: "Account Closure Scheduled",
      heading: "Account scheduled for deletion",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        "We received a request to permanently delete your Casefolio account. Nothing has been removed yet: your account stays intact during a 7-day grace period and all other devices were signed out.",
        "If you did not request this, cancel the deletion now and change your password.",
      ],
      specs: [
        { label: "Status", value: "Scheduled — not yet deleted" },
        { label: "Permanent deletion on (UTC)", value: when },
      ],
      ctaLabel: "Cancel account deletion",
      ctaUrl: args.cancelUrl ?? `${baseUrl}/account?cancelDeletion=1`,
      footerNote:
        "After the grace period your profile, personal case studies, uploads and exports are permanently erased and your personal subscription is canceled.",
    },
  };
}

export async function sendAccountDeletionScheduledEmail(args: {
  to: string;
  name?: string | null;
  scheduledForIso: string;
  cancelUrl?: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildAccountDeletionScheduledEmail(args),
  });
}

export function buildAccountDeletionCanceledEmail(args: {
  name?: string | null;
  canceledAtIso?: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const timestamp = formatUtcDate(args.canceledAtIso ?? new Date().toISOString());
  return {
    department: "security",
    templateKey: "security.account_deletion_canceled",
    subject: "Your Casefolio account deletion was canceled",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Your scheduled Casefolio account deletion was canceled. Your account is safe.",
      eyebrow: "Account Closure Canceled",
      heading: "Account deletion canceled",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        "The scheduled deletion of your Casefolio account was canceled. Your workspace, case studies and subscription are unchanged.",
      ],
      specs: [
        { label: "Status", value: "Account active" },
        { label: "Canceled At (UTC)", value: timestamp },
      ],
      ctaLabel: "Open Account Settings",
      ctaUrl: `${baseUrl}/account`,
      footerNote:
        "If you did not cancel this deletion yourself, review your active sessions and change your password.",
    },
  };
}

export async function sendAccountDeletionCanceledEmail(args: {
  to: string;
  name?: string | null;
  canceledAtIso?: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildAccountDeletionCanceledEmail(args),
  });
}

export function buildAccountDeletionBlockedEmail(args: {
  name?: string | null;
  organizationName: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "security",
    templateKey: "security.account_deletion_blocked",
    subject: "Transfer team ownership to finish deleting your Casefolio account",
    appBaseUrl: baseUrl,
    content: {
      previewText: `Your account deletion is on hold until ownership of ${args.organizationName} is transferred.`,
      eyebrow: "Account Closure On Hold",
      heading: "Transfer team ownership first",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        `Your grace period ended, but you are still the Owner of the team workspace "${args.organizationName}" which has other members. We cannot delete your account without leaving that team without an Owner.`,
        "Transfer ownership to another member (or remove the other members). Your account stays scheduled and we will retry automatically.",
      ],
      specs: [
        { label: "Status", value: "On hold — action required" },
        { label: "Team workspace", value: args.organizationName },
      ],
      ctaLabel: "Open Team Settings",
      ctaUrl: `${baseUrl}/account/team`,
      footerNote: "You can also cancel the deletion from Account Settings at any time.",
    },
  };
}

export async function sendAccountDeletionBlockedEmail(args: {
  to: string;
  name?: string | null;
  organizationName: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildAccountDeletionBlockedEmail(args),
  });
}

export function buildStepUpCodeEmail(args: {
  otp: string;
  purpose: "account_deletion" | "ownership_transfer";
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const action =
    args.purpose === "account_deletion"
      ? "delete your Casefolio account"
      : "change team workspace ownership";
  return {
    department: "security",
    templateKey: "security.step_up_code",
    subject: "Your Casefolio security confirmation code",
    appBaseUrl: baseUrl,
    content: {
      previewText: `Your 6-digit Casefolio confirmation code is ${args.otp}`,
      eyebrow: "Security Confirmation",
      heading: "Confirm it's you",
      paragraphs: [
        `Enter the 6-digit code below to confirm that you want to ${action}.`,
        "For your protection, never share this one-time security code with anyone.",
      ],
      code: args.otp,
      codeCaption: "EXPIRES IN 10 MINUTES · SINGLE USE",
      footerNote:
        "If you did not request this, someone may be using your session. Sign out of other devices from Account Security.",
    },
  };
}

export async function sendStepUpCodeEmail(args: {
  to: string;
  otp: string;
  purpose: "account_deletion" | "ownership_transfer";
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildStepUpCodeEmail(args),
  });
}

// ============================================================================
// 3. EXISTING USER: PROJECTS, PUBLISHING & EXPORTS (notifications@casefolio.com)
// ============================================================================

export function buildProjectPublishedEmail(args: {
  projectName: string;
  slug: string;
  projectId?: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const liveUrl = `${baseUrl}/p/${args.slug}`;

  return {
    department: "notifications",
    templateKey: "project.published",
    subject: `“${args.projectName}” is now live on Casefolio`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `${args.projectName} is published at ${liveUrl}`,
      eyebrow: "Case Study Live",
      heading: `“${args.projectName}” is live`,
      paragraphs: [
        "Your case study snapshot has been published and is ready to share with hiring managers, clients, and collaborators.",
        "Any future edits you make inside the builder stay safely in draft until you choose to publish an updated snapshot.",
      ],
      specs: [
        { label: "Case Study", value: args.projectName },
        { label: "Public URL", value: liveUrl },
      ],
      ctaLabel: "View live case study",
      ctaUrl: liveUrl,
      secondaryCta: args.projectId
        ? {
            label: "Open in Builder",
            url: `${baseUrl}/editor/${args.projectId}`,
          }
        : undefined,
    },
  };
}

export function buildExportReadyEmail(args: {
  projectName: string;
  formatLabel: string;
  exportsUrl: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "notifications",
    templateKey: "export.ready",
    subject: `Your ${args.formatLabel} export for “${args.projectName}” is ready`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `“${args.projectName}” ${args.formatLabel} is ready to download.`,
      eyebrow: "Export Completed",
      heading: "Export ready to download",
      paragraphs: [
        `“${args.projectName}” ${args.formatLabel} is ready to download from your project Exports hub.`,
      ],
      specs: [
        { label: "Case Study", value: args.projectName },
        { label: "Format", value: args.formatLabel },
        { label: "Download Retention", value: "Available in Exports Hub" },
      ],
      ctaLabel: "Download export",
      ctaUrl: args.exportsUrl,
    },
  };
}

export function buildExportFailedEmail(args: {
  projectName: string;
  formatLabel: string;
  exportsUrl: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "notifications",
    templateKey: "export.failed",
    subject: `Export failed for “${args.projectName}”`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `“${args.projectName}” couldn’t render. Retry from Exports.`,
      eyebrow: "Export Issue",
      heading: "Export failed",
      paragraphs: [
        `“${args.projectName}” (${args.formatLabel}) couldn’t finish rendering on the export worker. Your export quota was automatically released so it doesn't count against your limit.`,
      ],
      callout: {
        tone: "warning",
        title: "One-click retry available",
        body: "Open your project Exports tab to re-run the export immediately.",
      },
      ctaLabel: "View exports",
      ctaUrl: args.exportsUrl,
    },
  };
}

export function buildTemplateUpdatedEmail(args: {
  templateName: string;
  version: string;
  templatesUrl: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "notifications",
    templateKey: "template.updated",
    subject: `${args.templateName} v${args.version} is now available on Casefolio`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `${args.templateName} v${args.version} is now available in the template library.`,
      eyebrow: "Template Release",
      heading: `${args.templateName} v${args.version} released`,
      paragraphs: [
        `A new version of ${args.templateName} (v${args.version}) has been published to the Casefolio template catalog.`,
        "Your existing projects remain pinned to their current version so nothing shifts unexpectedly — and new projects automatically start on the latest release.",
      ],
      specs: [
        { label: "Template", value: args.templateName },
        { label: "New Version", value: `v${args.version}` },
      ],
      ctaLabel: "Browse templates",
      ctaUrl: args.templatesUrl,
    },
  };
}

// ============================================================================
// 4. TEAM & WORKSPACE COLLABORATION (team@casefolio.com)
// ============================================================================

export function buildTeamInvitationEmail(args: {
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  role: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const roleLabel = formatRoleLabel(args.role);

  return {
    department: "team",
    templateKey: "team.invitation",
    subject: `Join ${args.organizationName} on Casefolio`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `${args.inviterName} invited you to collaborate in ${args.organizationName} on Casefolio`,
      eyebrow: "Workspace Invitation",
      heading: `Join ${args.organizationName}`,
      paragraphs: [
        `${args.inviterName} invited you to join ${args.organizationName} as ${roleLabel} on Casefolio.`,
        "You will get access to shared studio case studies plus your own private member space inside the workspace. Your personal Casefolio projects stay completely separate.",
      ],
      specs: [
        { label: "Workspace", value: args.organizationName },
        { label: "Invited By", value: args.inviterName },
        { label: "Assigned Role", value: roleLabel },
        { label: "Link Validity", value: "7 days (single-use)" },
      ],
      ctaLabel: "Accept invitation",
      ctaUrl: args.acceptUrl,
      footerNote:
        "Sign in with the exact email address this invitation was sent to in order to claim your reserved seat.",
    },
  };
}

export function buildTeamMemberJoinedEmail(args: {
  ownerName?: string | null;
  memberName: string;
  memberEmail: string;
  organizationName: string;
  role: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "team",
    templateKey: "team.member_joined",
    subject: `${args.memberName} joined ${args.organizationName}`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `${args.memberName} (${args.memberEmail}) accepted their invitation to ${args.organizationName}.`,
      eyebrow: "Team Roster Update",
      heading: `${args.memberName} joined your team`,
      greeting: args.ownerName ? `Hi ${args.ownerName.trim()},` : undefined,
      paragraphs: [
        `${args.memberName} accepted their workspace invitation and is now an active collaborator in ${args.organizationName}.`,
      ],
      specs: [
        { label: "Workspace", value: args.organizationName },
        { label: "New Member", value: `${args.memberName} (${args.memberEmail})` },
        { label: "Role", value: formatRoleLabel(args.role) },
      ],
      ctaLabel: "Manage team members",
      ctaUrl: `${baseUrl}/account/team`,
    },
  };
}

export async function sendTeamMemberJoinedEmail(args: {
  to: string;
  ownerName?: string | null;
  memberName: string;
  memberEmail: string;
  organizationName: string;
  role: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildTeamMemberJoinedEmail(args),
  });
}

export function buildTeamRoleUpdatedEmail(args: {
  memberName?: string | null;
  organizationName: string;
  newRole: "admin" | "member";
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const roleLabel = formatRoleLabel(args.newRole);
  return {
    department: "team",
    templateKey: "team.role_updated",
    subject: `Your role in ${args.organizationName} was updated to ${roleLabel}`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Your workspace role in ${args.organizationName} is now ${roleLabel}.`,
      eyebrow: "Workspace Permissions",
      heading: `Role updated to ${roleLabel}`,
      greeting: args.memberName ? `Hi ${args.memberName.trim()},` : undefined,
      paragraphs: [
        `The workspace Owner updated your permissions in ${args.organizationName}. Your new workspace role is ${roleLabel}.`,
      ],
      specs: [
        { label: "Workspace", value: args.organizationName },
        { label: "Updated Role", value: roleLabel },
      ],
      ctaLabel: "Open workspace settings",
      ctaUrl: `${baseUrl}/account/team`,
    },
  };
}

export async function sendTeamRoleUpdatedEmail(args: {
  to: string;
  memberName?: string | null;
  organizationName: string;
  newRole: "admin" | "member";
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildTeamRoleUpdatedEmail(args),
  });
}

export function buildTeamMemberRemovedEmail(args: {
  memberName?: string | null;
  organizationName: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "team",
    templateKey: "team.member_removed",
    subject: `Your membership in ${args.organizationName} has ended`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Your access to ${args.organizationName} has ended. Private work remains recoverable for 90 days.`,
      eyebrow: "Workspace Departure & Recovery",
      heading: `Removed from ${args.organizationName}`,
      greeting: args.memberName ? `Hi ${args.memberName.trim()},` : undefined,
      paragraphs: [
        `Your team membership in ${args.organizationName} has ended. Shared workspace projects remain with the organization, while your personal Casefolio workspace is completely untouched.`,
      ],
      callout: {
        tone: "info",
        title: "90-day private work protection",
        body: "Any private projects you created inside your private team space are hidden from the team and held in your Private Recovery Vault for 90 days so you can copy them to your personal workspace.",
      },
      ctaLabel: "Open Recovery Vault",
      ctaUrl: `${baseUrl}/account/recovery`,
    },
  };
}

export async function sendTeamMemberRemovedEmail(args: {
  to: string;
  memberName?: string | null;
  organizationName: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildTeamMemberRemovedEmail(args),
  });
}

export function buildOwnershipTransferRequestedEmail(args: {
  recipientName?: string | null;
  currentOwnerName: string;
  organizationName: string;
  expiresAtIso: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const expiresLabel = new Date(args.expiresAtIso).toUTCString();
  return {
    department: "team",
    templateKey: "team.ownership_transfer_requested",
    subject: `Action required: Accept ownership of ${args.organizationName}`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `${args.currentOwnerName} requested to transfer ownership of ${args.organizationName} to you.`,
      eyebrow: "Ownership Handoff",
      heading: `Accept ownership of ${args.organizationName}`,
      greeting: args.recipientName ? `Hi ${args.recipientName.trim()},` : undefined,
      paragraphs: [
        `${args.currentOwnerName} initiated a formal request to transfer primary Owner authority for ${args.organizationName} to your account.`,
        "Review and confirm the transfer in Team Settings within 48 hours. Once accepted, you will control workspace billing, seat capacity, and member roles.",
      ],
      specs: [
        { label: "Workspace", value: args.organizationName },
        { label: "Current Owner", value: args.currentOwnerName },
        { label: "Expires At", value: expiresLabel },
      ],
      ctaLabel: "Review & accept transfer",
      ctaUrl: `${baseUrl}/account/team`,
    },
  };
}

export async function sendOwnershipTransferRequestedEmail(args: {
  to: string;
  recipientName?: string | null;
  currentOwnerName: string;
  organizationName: string;
  expiresAtIso: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildOwnershipTransferRequestedEmail(args),
  });
}

export function buildOwnershipTransferredEmail(args: {
  recipientRole: "new_owner" | "previous_owner";
  previousOwnerName: string;
  newOwnerName: string;
  organizationName: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const isNewOwner = args.recipientRole === "new_owner";
  return {
    department: "team",
    templateKey: "team.ownership_transferred",
    subject: `Workspace ownership transferred for ${args.organizationName}`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `${args.newOwnerName} is now the Workspace Owner of ${args.organizationName}.`,
      eyebrow: "Ownership Confirmed",
      heading: isNewOwner
        ? `You are now Owner of ${args.organizationName}`
        : `Ownership transferred to ${args.newOwnerName}`,
      paragraphs: [
        isNewOwner
          ? `Ownership handoff is complete. You now hold full Owner authority for ${args.organizationName}, including seat billing, member permissions, and workspace governance.`
          : `Ownership handoff for ${args.organizationName} is complete. ${args.newOwnerName} is now the primary Owner, and your membership continues with Admin access.`,
      ],
      specs: [
        { label: "Workspace", value: args.organizationName },
        { label: "New Owner", value: args.newOwnerName },
        { label: "Previous Owner", value: `${args.previousOwnerName} (now Admin)` },
      ],
      ctaLabel: "View workspace",
      ctaUrl: `${baseUrl}/account/team`,
    },
  };
}

export async function sendOwnershipTransferredEmail(args: {
  to: string;
  recipientRole: "new_owner" | "previous_owner";
  previousOwnerName: string;
  newOwnerName: string;
  organizationName: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildOwnershipTransferredEmail(args),
  });
}

// ============================================================================
// 5. BILLING & SUBSCRIPTIONS (billing@casefolio.com)
// ============================================================================

export function buildSubscriptionActivatedEmail(args: {
  name?: string | null;
  plan: string;
  interval: "monthly" | "yearly";
  seats?: number;
  renewsAtIso?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const planTitle = formatPlanLabel(args.plan);
  const cycleLabel = args.interval === "yearly" ? "Annual billing" : "Monthly billing";
  const renewsLabel = args.renewsAtIso
    ? new Date(args.renewsAtIso).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Next billing period";

  return {
    department: "billing",
    templateKey: "billing.subscription_activated",
    subject: `Your ${planTitle} subscription is active`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Thank you for upgrading to ${planTitle}. All plan entitlements are now unlocked.`,
      eyebrow: "Subscription Active",
      heading: `${planTitle} is now active`,
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        `Thank you for subscribing to ${planTitle}. Your workspace entitlements — including unwatermarked public links, high-resolution PDF/PNG/Behance exports, and full template access — are unlocked immediately.`,
      ],
      specs: [
        { label: "Active Plan", value: planTitle },
        { label: "Billing Cycle", value: cycleLabel },
        ...(args.seats && args.seats > 1
          ? [{ label: "Included Seats", value: `${args.seats} seats` }]
          : []),
        { label: "Next Renewal", value: renewsLabel },
      ],
      ctaLabel: "Manage billing & invoices",
      ctaUrl: `${baseUrl}/account/billing`,
    },
  };
}

export async function sendSubscriptionActivatedEmail(args: {
  to: string;
  name?: string | null;
  plan: string;
  interval: "monthly" | "yearly";
  seats?: number;
  renewsAtIso?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildSubscriptionActivatedEmail(args),
  });
}

export function buildTeamSeatUpdatedEmail(args: {
  name?: string | null;
  organizationName?: string | null;
  changeKind: "increase_immediate" | "decrease_scheduled";
  currentSeats: number;
  targetSeats: number;
  chargedUsd?: number;
  effectiveAtIso?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const isIncrease = args.changeKind === "increase_immediate";
  const effectiveDate = args.effectiveAtIso
    ? new Date(args.effectiveAtIso).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "Next renewal";

  return {
    department: "billing",
    templateKey: "billing.seat_updated",
    subject: isIncrease
      ? `Team seat capacity increased to ${args.targetSeats} seats`
      : `Team seat reduction to ${args.targetSeats} seats scheduled`,
    appBaseUrl: baseUrl,
    content: {
      previewText: isIncrease
        ? `Your workspace now includes ${args.targetSeats} paid seats.`
        : `Your workspace will renew at ${args.targetSeats} seats on ${effectiveDate}.`,
      eyebrow: "Team Seat Billing",
      heading: isIncrease
        ? `Expanded to ${args.targetSeats} paid seats`
        : `Renewal updated to ${args.targetSeats} seats`,
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        isIncrease
          ? `Your additional team seats are active immediately${args.organizationName ? ` for ${args.organizationName}` : ""}. You can invite collaborators right away from Team Settings.`
          : `We scheduled your seat reduction${args.organizationName ? ` for ${args.organizationName}` : ""}. You retain all ${args.currentSeats} paid seats through the end of your current billing cycle.`,
      ],
      specs: [
        ...(args.organizationName ? [{ label: "Workspace", value: args.organizationName }] : []),
        {
          label: isIncrease ? "Active Paid Seats" : "Current Paid Seats",
          value: `${isIncrease ? args.targetSeats : args.currentSeats} seats`,
        },
        ...(isIncrease && typeof args.chargedUsd === "number"
          ? [{ label: "Prorated Charge", value: `$${args.chargedUsd.toFixed(2)} USD` }]
          : [
              { label: "Next Renewal Seats", value: `${args.targetSeats} seats` },
              { label: "Effective Date", value: effectiveDate },
            ]),
      ],
      ctaLabel: "View team billing",
      ctaUrl: `${baseUrl}/account/billing`,
    },
  };
}

export async function sendTeamSeatUpdatedEmail(args: {
  to: string;
  name?: string | null;
  organizationName?: string | null;
  changeKind: "increase_immediate" | "decrease_scheduled";
  currentSeats: number;
  targetSeats: number;
  chargedUsd?: number;
  effectiveAtIso?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildTeamSeatUpdatedEmail(args),
  });
}

export function buildPaymentFailedEmail(args: {
  plan?: string | null;
  billingUrl: string;
  customMessage?: string;
  daysRemaining?: number;
  graceEndsAtIso?: string | null;
  workspaceName?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const planTitle = formatPlanLabel(args.plan);
  const days = typeof args.daysRemaining === "number" ? args.daysRemaining : 10;
  const endsLabel = args.graceEndsAtIso
    ? new Date(args.graceEndsAtIso).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : `${days} days`;

  return {
    department: "billing",
    templateKey: "billing.payment_failed",
    subject: `Action needed: Renew within ${days} ${days === 1 ? "day" : "days"} to keep your projects unlocked`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `We couldn’t process your ${planTitle} renewal. You have ${days} days before excess projects lock.`,
      eyebrow: "Billing Alert · 10-Day Grace Window",
      heading: "Payment failed — renewal needed",
      paragraphs: [
        args.customMessage ??
          `We couldn’t process your ${planTitle} subscription renewal${args.workspaceName ? ` for ${args.workspaceName}` : ""}. You have ${days} ${days === 1 ? "day" : "days"} (until ${endsLabel}) to renew before your workspace reverts to Free and your extra Case Studies are locked.`,
      ],
      callout: {
        tone: "danger",
        title: `${days}-day grace window active`,
        body:
          args.plan === "team" || args.plan === "plus"
            ? "Your team workspace stays accessible during this 10-day grace period. If payment is not completed by the deadline, all team projects will lock until the Owner renews."
            : "Your Pro projects and published links stay live during this 10-day grace period. If not renewed in 10 days, your account returns to Free (1 active project) and extra projects lock until you pay again.",
      },
      specs: [
        { label: "Subscription", value: planTitle },
        ...(args.workspaceName ? [{ label: "Workspace", value: args.workspaceName }] : []),
        { label: "Grace Deadline", value: endsLabel },
        { label: "Status", value: "Past due — update payment method" },
      ],
      ctaLabel: "Update payment & renew",
      ctaUrl: args.billingUrl,
    },
  };
}

export function buildRenewalGraceReminderEmail(args: {
  name?: string | null;
  plan?: string | null;
  daysRemaining: number;
  graceEndsAtIso: string;
  workspaceName?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const planTitle = formatPlanLabel(args.plan);
  const isTeam = args.plan === "team" || args.plan === "plus";
  const deadlineLabel = new Date(args.graceEndsAtIso).toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
  const urgent = args.daysRemaining <= 1;

  return {
    department: "billing",
    templateKey: "billing.renewal_grace_reminder",
    subject: urgent
      ? `Final reminder: ${args.daysRemaining <= 1 ? "Less than 24h" : "1 day"} left before Casefolio projects lock`
      : `Reminder: ${args.daysRemaining} days left to renew your ${planTitle} plan`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Renew your ${planTitle} subscription by ${deadlineLabel} to prevent project locking.`,
      eyebrow: urgent ? "Urgent Renewal Warning" : "Renewal Grace Reminder",
      heading: urgent
        ? "Last chance before projects lock"
        : `${args.daysRemaining} days left to renew`,
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        isTeam
          ? `Your ${planTitle} subscription${args.workspaceName ? ` for ${args.workspaceName}` : ""} is still past due. Renew before ${deadlineLabel} to keep team projects, exports, and live links active.`
          : `Your ${planTitle} subscription is still waiting for payment. Renew before ${deadlineLabel} — otherwise your account will revert to Free and extra Case Studies will lock until you subscribe again.`,
      ],
      callout: {
        tone: urgent ? "danger" : "warning",
        title: urgent ? "Locks in under 24 hours" : `${args.daysRemaining} days remaining`,
        body: isTeam
          ? "After the deadline, Team projects become strictly locked (no open, edit, or export) until the Owner renews."
          : "No projects are deleted, but excess Case Studies become strictly Locked (unopenable) until payment succeeds.",
      },
      specs: [
        { label: "Plan", value: planTitle },
        ...(args.workspaceName ? [{ label: "Workspace", value: args.workspaceName }] : []),
        { label: "Deadline", value: deadlineLabel },
      ],
      ctaLabel: "Renew subscription now",
      ctaUrl: `${baseUrl}/account/billing`,
    },
  };
}

export async function sendRenewalGraceReminderEmail(args: {
  to: string;
  name?: string | null;
  plan?: string | null;
  daysRemaining: number;
  graceEndsAtIso: string;
  workspaceName?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildRenewalGraceReminderEmail(args),
  });
}

export function buildGraceExpiredLockedEmail(args: {
  name?: string | null;
  plan?: string | null;
  lockedCount?: number;
  workspaceName?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const isTeam = args.plan === "team" || args.plan === "plus";
  const planTitle = formatPlanLabel(args.plan);

  return {
    department: "billing",
    templateKey: "billing.grace_expired_locked",
    subject: isTeam
      ? `Your Team workspace “${args.workspaceName ?? "Teams"}” is now locked`
      : "Your 10-day renewal window ended — extra projects are locked",
    appBaseUrl: baseUrl,
    content: {
      previewText: isTeam
        ? "Team projects and exports are locked until the Owner renews."
        : "Your account returned to Free. Extra Case Studies are locked until you renew Pro.",
      eyebrow: "Renewal Grace Ended",
      heading: isTeam ? "Team workspace locked" : "Account downgraded to Free",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        isTeam
          ? `The 10-day renewal grace period for ${args.workspaceName ?? "your Team workspace"} has ended without payment. All team Case Studies, edits, exports, and live links are locked until Teams is renewed. Each member's Personal Workspace remains unaffected (Free: 1 personal Case Study).`
          : `The 10-day renewal grace window ended without payment, so your account returned to Casefolio Free. Your existing work has NOT been deleted — ${typeof args.lockedCount === "number" && args.lockedCount > 0 ? `${args.lockedCount} excess Case ${args.lockedCount === 1 ? "Study is" : "Studies are"}` : "excess Case Studies are"} safely stored as Locked until you re-subscribe.`,
      ],
      specs: [
        { label: "Current Plan", value: isTeam ? "Team (Locked)" : "Free (1 active project)" },
        ...(typeof args.lockedCount === "number"
          ? [{ label: "Locked Case Studies", value: `${args.lockedCount}` }]
          : []),
        { label: "Unlock Policy", value: "Instant unlock & URL restoration on payment" },
      ],
      ctaLabel: `Renew ${planTitle} to unlock`,
      ctaUrl: `${baseUrl}/account/billing`,
    },
  };
}

export async function sendGraceExpiredLockedEmail(args: {
  to: string;
  name?: string | null;
  plan?: string | null;
  lockedCount?: number;
  workspaceName?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildGraceExpiredLockedEmail(args),
  });
}

export function buildTeamWorkspaceDissolvedEmail(args: {
  memberName?: string | null;
  organizationName: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "team",
    templateKey: "team.workspace_dissolved",
    subject: `Team workspace “${args.organizationName}” was closed by the Owner`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `The Owner permanently closed “${args.organizationName}” and canceled team billing.`,
      eyebrow: "Team Workspace Update",
      heading: "Team workspace closed",
      greeting: args.memberName ? `Hi ${args.memberName.trim()},` : undefined,
      paragraphs: [
        `The Owner permanently deleted their account and closed the “${args.organizationName}” team workspace. Team billing has been canceled and shared workspace content was removed.`,
        "Your own Personal Workspace remains active and unaffected.",
      ],
      ctaLabel: "Open your Personal Dashboard",
      ctaUrl: `${baseUrl}/dashboard`,
    },
  };
}

export async function sendTeamWorkspaceDissolvedEmail(args: {
  to: string;
  memberName?: string | null;
  organizationName: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildTeamWorkspaceDissolvedEmail(args),
  });
}

export function buildSubscriptionCanceledEmail(args: {
  name?: string | null;
  plan: string;
  immediate: boolean;
  effectiveEndIso?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const planTitle = formatPlanLabel(args.plan);
  const endDateLabel = args.effectiveEndIso
    ? new Date(args.effectiveEndIso).toLocaleDateString("en-US", {
        day: "numeric",
        month: "short",
        year: "numeric",
      })
    : "End of current billing period";

  return {
    department: "billing",
    templateKey: "billing.subscription_canceled",
    subject: args.immediate
      ? `Your ${planTitle} subscription has been canceled`
      : `Your ${planTitle} cancellation is scheduled`,
    appBaseUrl: baseUrl,
    content: {
      previewText: args.immediate
        ? `Your ${planTitle} subscription has ended. Your drafts remain safe.`
        : `Your ${planTitle} plan remains active until ${endDateLabel}.`,
      eyebrow: "Subscription Update",
      heading: args.immediate
        ? "Subscription canceled"
        : "Cancellation scheduled",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        args.immediate
          ? `Your ${planTitle} subscription has been canceled immediately. Your account has transitioned to Casefolio Free — zero case studies or uploaded assets are ever deleted.`
          : `Your ${planTitle} subscription is scheduled to end on ${endDateLabel}. You will retain full paid features until that date, and you can resume with one click anytime before then.`,
      ],
      specs: [
        { label: "Plan", value: planTitle },
        {
          label: args.immediate ? "Effective" : "Paid Access Until",
          value: args.immediate ? "Immediately" : endDateLabel,
        },
        { label: "Project Safety", value: "All case study drafts preserved" },
      ],
      ctaLabel: args.immediate ? "View billing overview" : "Resume subscription anytime",
      ctaUrl: `${baseUrl}/account/billing`,
    },
  };
}

export async function sendSubscriptionCanceledEmail(args: {
  to: string;
  name?: string | null;
  plan: string;
  immediate: boolean;
  effectiveEndIso?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildSubscriptionCanceledEmail(args),
  });
}

export function buildSubscriptionResumedEmail(args: {
  name?: string | null;
  plan: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const planTitle = formatPlanLabel(args.plan);

  return {
    department: "billing",
    templateKey: "billing.subscription_resumed",
    subject: `Your ${planTitle} subscription has been resumed`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Scheduled cancellation removed — your ${planTitle} subscription continues uninterrupted.`,
      eyebrow: "Subscription Resumed",
      heading: `${planTitle} continues uninterrupted`,
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        `We removed the scheduled cancellation on your ${planTitle} subscription. Your published case studies, custom styling, and exports will continue without interruption.`,
      ],
      specs: [
        { label: "Plan", value: planTitle },
        { label: "Status", value: "Active (Auto-renewing)" },
      ],
      ctaLabel: "Open Billing Settings",
      ctaUrl: `${baseUrl}/account/billing`,
    },
  };
}

export async function sendSubscriptionResumedEmail(args: {
  to: string;
  name?: string | null;
  plan: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildSubscriptionResumedEmail(args),
  });
}

// ============================================================================
// 6. SUPPORT & HELP DESK (support@casefolio.com)
// ============================================================================

export function buildSupportTicketReceiptEmail(args: {
  ticketCode: string;
  topic: string;
  subjectLine: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "support",
    templateKey: "support.ticket_received",
    subject: `[Ticket #${args.ticketCode}] We received your Casefolio support request`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Ticket #${args.ticketCode} logged · ${args.subjectLine}`,
      eyebrow: `Support Ticket #${args.ticketCode}`,
      heading: "Support request received",
      paragraphs: [
        `Thanks for reaching out to Casefolio Support regarding “${args.subjectLine}”. Our team has logged your request under Ticket #${args.ticketCode} and will reply directly to this email thread.`,
      ],
      specs: [
        { label: "Ticket ID", value: `#${args.ticketCode}` },
        { label: "Topic", value: args.topic },
        { label: "Subject", value: args.subjectLine },
        { label: "Target Response", value: "Within 1 business day" },
      ],
      ctaLabel: "Visit Help Center",
      ctaUrl: `${baseUrl}/help`,
      footerNote:
        "Reply directly to this email if you want to attach extra screenshots or context to your ticket.",
    },
  };
}

export async function sendSupportTicketReceiptEmail(args: {
  to: string;
  ticketCode: string;
  topic: string;
  subjectLine: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildSupportTicketReceiptEmail(args),
  });
}

export function buildSupportTicketIntakeAlertEmail(args: {
  ticketCode: string;
  requesterEmail: string;
  requesterUserId?: string | null;
  topic: string;
  subjectLine: string;
  message: string;
  projectRef?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "support",
    templateKey: "support.ticket_intake_alert",
    replyTo: args.requesterEmail,
    subject: `[Ticket #${args.ticketCode}] ${args.topic}: ${args.subjectLine}`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Inbound support ticket #${args.ticketCode} from ${args.requesterEmail}`,
      eyebrow: "Inbound Support Queue",
      heading: `New ticket #${args.ticketCode}`,
      paragraphs: [
        "A new support request was submitted through the Casefolio Help Center. Hit Reply in your mail client to respond directly to the requester.",
      ],
      specs: [
        { label: "Ticket ID", value: `#${args.ticketCode}` },
        { label: "Requester", value: args.requesterEmail },
        { label: "Authenticated User", value: args.requesterUserId ?? "Guest / Unverified" },
        { label: "Topic", value: args.topic },
        ...(args.projectRef ? [{ label: "Related Project", value: args.projectRef }] : []),
      ],
      quoteBlock: {
        label: `Message · ${args.subjectLine}`,
        content: args.message.slice(0, 4000),
      },
      ctaLabel: "Open Admin Panel",
      ctaUrl: `${baseUrl}/admin/users`,
    },
  };
}

export async function sendSupportTicketIntakeAlertEmail(args: {
  ticketCode: string;
  requesterEmail: string;
  requesterUserId?: string | null;
  topic: string;
  subjectLine: string;
  message: string;
  projectRef?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: resolveSupportInboxMailbox(),
    ...buildSupportTicketIntakeAlertEmail(args),
  });
}

// ============================================================================
// 7. PLATFORM ADMINISTRATION & GOVERNANCE (admin@casefolio.com)
// ============================================================================

export function buildAdminRoleChangedEmail(args: {
  name?: string | null;
  previousRole: string;
  nextRole: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const nextLabel = formatRoleLabel(args.nextRole);
  const prevLabel = formatRoleLabel(args.previousRole);
  const isAdminGrant = args.nextRole === "admin" || args.nextRole === "superadmin";

  return {
    department: "admin",
    templateKey: "admin.role_changed",
    subject: isAdminGrant
      ? `Administrative access granted: ${nextLabel} on Casefolio`
      : "Your Casefolio administrative privileges were updated",
    appBaseUrl: baseUrl,
    content: {
      previewText: `Your Casefolio platform role was updated from ${prevLabel} to ${nextLabel}.`,
      eyebrow: "Platform Governance",
      heading: isAdminGrant
        ? `Granted ${nextLabel} privileges`
        : "Platform role updated",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        isAdminGrant
          ? `A Casefolio platform administrator updated your account permissions to ${nextLabel}. You can now access the Casefolio Admin Console to manage templates, users, moderation, and platform operations.`
          : `Your Casefolio platform role has been updated from ${prevLabel} to ${nextLabel}. Your personal and team design workspaces remain completely unaffected.`,
      ],
      specs: [
        { label: "Previous Role", value: prevLabel },
        { label: "Updated Role", value: nextLabel },
        { label: "Issued By", value: resolveDepartmentSender("admin").address },
      ],
      ctaLabel: isAdminGrant ? "Open Admin Console" : "Go to Dashboard",
      ctaUrl: isAdminGrant ? `${baseUrl}/admin` : `${baseUrl}/dashboard`,
    },
  };
}

export async function sendAdminRoleChangedEmail(args: {
  to: string;
  name?: string | null;
  previousRole: string;
  nextRole: string;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildAdminRoleChangedEmail(args),
  });
}

export function buildAdminAccountSuspendedEmail(args: {
  name?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const supportMailbox = resolveSupportInboxMailbox();
  return {
    department: "admin",
    templateKey: "admin.account_suspended",
    subject: "Important notice: Your Casefolio account has been suspended",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Your Casefolio sign-in access has been suspended by Platform Trust & Safety.",
      eyebrow: "Trust & Safety Notice",
      heading: "Your account has been suspended",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        "Following an administrative review, sign-in access to your Casefolio account has been suspended and active sessions have been signed out.",
        `If you believe this action was taken in error or wish to submit an appeal, reply directly to this email or contact ${supportMailbox}.`,
      ],
      callout: {
        tone: "danger",
        title: "Sign-in temporarily restricted",
        body: "While suspended, new sign-in attempts are blocked. Your underlying project records remain preserved pending appeal review.",
      },
      ctaLabel: "Review Terms of Use",
      ctaUrl: `${baseUrl}/terms`,
    },
  };
}

export function buildAdminAccountReactivatedEmail(args: {
  name?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "admin",
    templateKey: "admin.account_reactivated",
    subject: "Your Casefolio account access has been restored",
    appBaseUrl: baseUrl,
    content: {
      previewText: "Good news — your Casefolio account suspension has been lifted.",
      eyebrow: "Account Restored",
      heading: "Your account is active again",
      greeting: args.name ? `Hi ${args.name.trim()},` : undefined,
      paragraphs: [
        "Casefolio Administration has lifted the suspension on your account. Full sign-in, editing, publishing, and export access have been restored.",
      ],
      callout: {
        tone: "success",
        title: "Access restored",
        body: "You can sign back in to your Casefolio workspace immediately.",
      },
      ctaLabel: "Sign in to Casefolio",
      ctaUrl: `${baseUrl}/sign-in`,
    },
  };
}

export async function sendAdminAccountSuspensionEmail(args: {
  to: string;
  name?: string | null;
  suspended: boolean;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  const payload = args.suspended
    ? buildAdminAccountSuspendedEmail(args)
    : buildAdminAccountReactivatedEmail(args);
  return sendCasefolioEmail({
    to: args.to,
    ...payload,
  });
}

export function buildAdminModerationTakedownEmail(args: {
  projectName: string;
  editorUrl: string;
  customMessage?: string;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "admin",
    templateKey: "admin.moderation_takedown",
    subject: `Case study "${args.projectName}" unpublished — Casefolio`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `Our moderation team unpublished "${args.projectName}". Your draft remains safe in your editor.`,
      eyebrow: "Moderation Notice",
      heading: `“${args.projectName}” was unpublished`,
      paragraphs: [
        args.customMessage ??
          "Our moderation team unpublished your public case study link following a policy review. Your private draft and all uploaded assets remain completely safe in your editor.",
        "Please review our acceptable content guidelines, update any flagged sections in the builder, and reply to this email if you have questions for the moderation team.",
      ],
      callout: {
        tone: "warning",
        title: "Draft preserved in Builder",
        body: "Only the public snapshot was withdrawn — zero work was deleted.",
      },
      ctaLabel: "Review draft in Editor",
      ctaUrl: args.editorUrl,
    },
  };
}

export function buildAdminAbuseReportAlertEmail(args: {
  reportId: string;
  projectName: string;
  projectSlug?: string | null;
  category: string;
  details?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  return {
    department: "admin",
    templateKey: "admin.abuse_report_alert",
    subject: `[Moderation Queue] New report on “${args.projectName}” (${args.category})`,
    appBaseUrl: baseUrl,
    content: {
      previewText: `New public report filed against "${args.projectName}" (${args.category}).`,
      eyebrow: "Inbound Moderation Alert",
      heading: "New case study report submitted",
      paragraphs: [
        "A visitor submitted a moderation report against a published Casefolio case study. Review the live snapshot and resolve or dismiss the report from the Admin Moderation queue.",
      ],
      specs: [
        { label: "Report ID", value: args.reportId },
        { label: "Case Study", value: args.projectName },
        {
          label: "Public Slug",
          value: args.projectSlug ? `/p/${args.projectSlug}` : "Unlisted / Slug",
        },
        { label: "Reason Category", value: args.category },
      ],
      quoteBlock: args.details?.trim()
        ? {
            label: "Reporter Details",
            content: args.details.trim().slice(0, 2000),
          }
        : undefined,
      ctaLabel: "Open Moderation Queue",
      ctaUrl: `${baseUrl}/admin/moderation`,
    },
  };
}

export async function sendAdminAbuseReportAlertEmail(args: {
  reportId: string;
  projectName: string;
  projectSlug?: string | null;
  category: string;
  details?: string | null;
  additionalAdminEmails?: string[];
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  const recipients = Array.from(
    new Set(
      [resolveAdminAlertMailbox(), ...(args.additionalAdminEmails ?? [])]
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
  return sendCasefolioEmail({
    to: recipients,
    ...buildAdminAbuseReportAlertEmail(args),
  });
}

export function buildAdminCustomNoticeEmail(args: {
  recipientName?: string | null;
  subject: string;
  heading: string;
  message: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  appBaseUrl?: string;
}): Omit<SendCasefolioEmailInput, "to"> {
  const baseUrl = resolveAppBase(args.appBaseUrl);
  const paragraphs = args.message
    .split(/\n{2,}/)
    .map((chunk) => chunk.trim())
    .filter(Boolean);

  return {
    department: "admin",
    templateKey: "admin.custom_notice",
    subject: args.subject.trim(),
    appBaseUrl: baseUrl,
    content: {
      previewText: paragraphs[0]?.slice(0, 140) ?? args.heading,
      eyebrow: "Official Administrative Notice",
      heading: args.heading.trim(),
      greeting: args.recipientName ? `Hi ${args.recipientName.trim()},` : undefined,
      paragraphs: paragraphs.length > 0 ? paragraphs : [args.message.trim()],
      ctaLabel: args.ctaLabel?.trim() || "Open Casefolio",
      ctaUrl: args.ctaUrl?.trim() || `${baseUrl}/dashboard`,
      footerNote:
        "This official message was sent by Casefolio Administration. You can reply directly to reach admin@casefolio.com.",
    },
  };
}

export async function sendAdminCustomNoticeEmail(args: {
  to: string;
  recipientName?: string | null;
  subject: string;
  heading: string;
  message: string;
  ctaLabel?: string | null;
  ctaUrl?: string | null;
  appBaseUrl?: string;
}): Promise<SendCasefolioEmailResult> {
  return sendCasefolioEmail({
    to: args.to,
    ...buildAdminCustomNoticeEmail(args),
  });
}

// ============================================================================
// COMPLETE CATALOG REGISTRY (FOR ADMIN EMAIL STUDIO & AUTOMATED QA)
// ============================================================================

export const EMAIL_TEMPLATE_CATALOG: readonly EmailCatalogEntry[] = [
  // New User & Onboarding
  {
    key: "auth.verify_otp",
    title: "Sign-Up Email Verification (6-Digit OTP)",
    audience: "new_user",
    audienceLabel: "New User",
    department: "security",
    triggerSummary: "Sent immediately when a new user registers with email & password.",
    buildSample: (base) =>
      buildVerificationOtpEmail({ otp: "482910", type: "email-verification", appBaseUrl: base }),
  },
  {
    key: "welcome.new_user",
    title: "Welcome to Casefolio Studio",
    audience: "new_user",
    audienceLabel: "New User",
    department: "welcome",
    triggerSummary: "Sent from hello@casefolio.com when a new creator finishes onboarding.",
    buildSample: (base) =>
      buildWelcomeNewUserEmail({
        name: "Lina Haddad",
        jobTitle: "Senior Product Designer",
        designFocus: "both",
        appBaseUrl: base,
      }),
  },

  // Auth & Security
  {
    key: "auth.signin_otp",
    title: "Passwordless Sign-In OTP",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent when an existing user requests a 6-digit one-time sign-in code.",
    buildSample: (base) =>
      buildVerificationOtpEmail({ otp: "739204", type: "sign-in", appBaseUrl: base }),
  },
  {
    key: "auth.magic_link",
    title: "Magic Link One-Click Sign-In",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent when a user requests a passwordless magic sign-in link.",
    buildSample: (base) =>
      buildMagicLinkSignInEmail({
        url: `${resolveAppBase(base)}/api/auth/magic-link/verify?token=sample_magic_token`,
        appBaseUrl: base,
      }),
  },
  {
    key: "auth.password_reset",
    title: "Password Reset Link",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent when a user clicks Forgot Password on the sign-in screen.",
    buildSample: (base) =>
      buildPasswordResetLinkEmail({
        url: `${resolveAppBase(base)}/reset-password?token=sample_reset_token`,
        appBaseUrl: base,
      }),
  },
  {
    key: "security.password_reset_otp",
    title: "Password Reset OTP Code",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent when password recovery is initiated via OTP verification.",
    buildSample: (base) =>
      buildVerificationOtpEmail({ otp: "518392", type: "forget-password", appBaseUrl: base }),
  },
  {
    key: "security.email_change_otp",
    title: "Change Account Email Verification OTP",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent when an existing user updates their primary account email.",
    buildSample: (base) =>
      buildVerificationOtpEmail({ otp: "904127", type: "change-email", appBaseUrl: base }),
  },
  {
    key: "security.password_changed",
    title: "Password Changed Security Confirmation",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent automatically after /reset-password or /change-password succeeds.",
    buildSample: (base) =>
      buildPasswordChangedEmail({
        name: "Tariq Mansour",
        changedAtIso: "2026-11-14T18:30:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "security.sessions_revoked",
    title: "Active Devices Signed Out Alert",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent when a user revokes all other active sessions in Account Security.",
    buildSample: (base) =>
      buildSessionsRevokedEmail({
        name: "Tariq Mansour",
        revokedAtIso: "2026-11-14T18:45:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "security.account_deleted",
    title: "Account Permanently Deleted Receipt",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Final receipt dispatched after personal account & R2 assets are purged.",
    buildSample: (base) =>
      buildAccountDeletedEmail({
        name: "Tariq Mansour",
        deletedAtIso: "2026-11-14T19:00:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "security.account_deletion_scheduled",
    title: "Account Deletion Scheduled (7-Day Grace)",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary:
      "Sent when a re-authenticated user requests account deletion; includes the cancel link for the 7-day grace window.",
    buildSample: (base) =>
      buildAccountDeletionScheduledEmail({
        name: "Tariq Mansour",
        scheduledForIso: "2026-11-21T19:00:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "security.account_deletion_canceled",
    title: "Account Deletion Canceled",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary: "Sent when a user cancels a scheduled account deletion during the grace window.",
    buildSample: (base) =>
      buildAccountDeletionCanceledEmail({
        name: "Tariq Mansour",
        canceledAtIso: "2026-11-15T09:00:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "security.account_deletion_blocked",
    title: "Account Deletion On Hold — Transfer Team Ownership",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary:
      "Sent by the retention job when the grace period ended but the user still owns a team workspace with other members.",
    buildSample: (base) =>
      buildAccountDeletionBlockedEmail({
        name: "Tariq Mansour",
        organizationName: "Horizon Studio",
        appBaseUrl: base,
      }),
  },
  {
    key: "security.step_up_code",
    title: "Security Confirmation Code (Step-Up)",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "security",
    triggerSummary:
      "Sent to passwordless (Google / magic-link) users who must re-confirm identity before account deletion or ownership transfer.",
    buildSample: (base) =>
      buildStepUpCodeEmail({
        otp: "482915",
        purpose: "account_deletion",
        appBaseUrl: base,
      }),
  },

  // Projects, Publishing & Exports
  {
    key: "project.published",
    title: "Case Study Published Live",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "notifications",
    triggerSummary: "Sent when a creator publishes their case study to /p/[slug].",
    buildSample: (base) =>
      buildProjectPublishedEmail({
        projectName: "Mosaed — Calm Personal Debt App",
        slug: "mosaed-fintech-2026",
        projectId: "00000000-0000-4000-8000-000000000101",
        appBaseUrl: base,
      }),
  },
  {
    key: "export.ready",
    title: "Export Ready (PDF / PNG / Behance)",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "notifications",
    triggerSummary: "Sent when the Playwright export worker completes rendering.",
    buildSample: (base) =>
      buildExportReadyEmail({
        projectName: "Mosaed — Calm Personal Debt App",
        formatLabel: "PDF",
        exportsUrl: `${resolveAppBase(base)}/projects/00000000-0000-4000-8000-000000000101/exports`,
        appBaseUrl: base,
      }),
  },
  {
    key: "export.failed",
    title: "Export Render Failed (Quota Released)",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "notifications",
    triggerSummary: "Sent if an export job fails so the designer can retry in one click.",
    buildSample: (base) =>
      buildExportFailedEmail({
        projectName: "Mosaed — Calm Personal Debt App",
        formatLabel: "Behance slices",
        exportsUrl: `${resolveAppBase(base)}/projects/00000000-0000-4000-8000-000000000101/exports`,
        appBaseUrl: base,
      }),
  },
  {
    key: "template.updated",
    title: "Template New Version Available",
    audience: "existing_user",
    audienceLabel: "Existing User",
    department: "notifications",
    triggerSummary: "Sent to creators using a template when an admin publishes a new version.",
    buildSample: (base) =>
      buildTemplateUpdatedEmail({
        templateName: "Orbit Mobile Studio",
        version: "2.1.0",
        templatesUrl: `${resolveAppBase(base)}/templates`,
        appBaseUrl: base,
      }),
  },

  // Team & Workspace Collaboration
  {
    key: "team.invitation",
    title: "Team Workspace Invitation",
    audience: "team",
    audienceLabel: "Team & Workspace",
    department: "team",
    triggerSummary: "Sent from team@casefolio.com when an Owner/Admin invites a collaborator.",
    buildSample: (base) =>
      buildTeamInvitationEmail({
        organizationName: "Northwind Design Studio",
        inviterName: "Nadia Al-Khatib",
        acceptUrl: `${resolveAppBase(base)}/account/team?token=sample_invite_token`,
        role: "admin",
        appBaseUrl: base,
      }),
  },
  {
    key: "team.member_joined",
    title: "Teammate Accepted Invitation (To Owner)",
    audience: "team",
    audienceLabel: "Team & Workspace",
    department: "team",
    triggerSummary: "Notifies the Workspace Owner when an invited member claims their seat.",
    buildSample: (base) =>
      buildTeamMemberJoinedEmail({
        ownerName: "Nadia Al-Khatib",
        memberName: "Omar Zaid",
        memberEmail: "omar@northwind.design",
        organizationName: "Northwind Design Studio",
        role: "member",
        appBaseUrl: base,
      }),
  },
  {
    key: "team.role_updated",
    title: "Team Member Role Changed",
    audience: "team",
    audienceLabel: "Team & Workspace",
    department: "team",
    triggerSummary: "Sent to a team member when the Owner updates their role (Admin ↔ Member).",
    buildSample: (base) =>
      buildTeamRoleUpdatedEmail({
        memberName: "Omar Zaid",
        organizationName: "Northwind Design Studio",
        newRole: "admin",
        appBaseUrl: base,
      }),
  },
  {
    key: "team.ownership_transfer_requested",
    title: "Workspace Ownership Transfer Request",
    audience: "team",
    audienceLabel: "Team & Workspace",
    department: "team",
    triggerSummary: "Sent to the designated successor with a 48-hour confirmation window.",
    buildSample: (base) =>
      buildOwnershipTransferRequestedEmail({
        recipientName: "Omar Zaid",
        currentOwnerName: "Nadia Al-Khatib",
        organizationName: "Northwind Design Studio",
        expiresAtIso: "2026-11-16T18:00:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "team.ownership_transferred",
    title: "Workspace Ownership Handoff Completed",
    audience: "team",
    audienceLabel: "Team & Workspace",
    department: "team",
    triggerSummary: "Sent to both the new Owner and previous Owner once transfer is accepted.",
    buildSample: (base) =>
      buildOwnershipTransferredEmail({
        recipientRole: "new_owner",
        previousOwnerName: "Nadia Al-Khatib",
        newOwnerName: "Omar Zaid",
        organizationName: "Northwind Design Studio",
        appBaseUrl: base,
      }),
  },
  {
    key: "team.member_removed",
    title: "Member Removed & 90-Day Recovery Vault Notice",
    audience: "team",
    audienceLabel: "Team & Workspace",
    department: "team",
    triggerSummary: "Sent when a member is removed, linking to their 90-day private work vault.",
    buildSample: (base) =>
      buildTeamMemberRemovedEmail({
        memberName: "Omar Zaid",
        organizationName: "Northwind Design Studio",
        appBaseUrl: base,
      }),
  },

  // Billing & Subscriptions
  {
    key: "billing.subscription_activated",
    title: "Subscription Activated (Pro / Teams)",
    audience: "billing",
    audienceLabel: "Billing & Plans",
    department: "billing",
    triggerSummary: "Sent from billing@casefolio.com when Paddle activates a paid plan.",
    buildSample: (base) =>
      buildSubscriptionActivatedEmail({
        name: "Nadia Al-Khatib",
        plan: "pro",
        interval: "yearly",
        renewsAtIso: "2027-11-14T00:00:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "billing.seat_updated",
    title: "Team Seat Capacity Updated",
    audience: "billing",
    audienceLabel: "Billing & Plans",
    department: "billing",
    triggerSummary: "Sent when a Team Owner purchases prorated seats or schedules a renewal decrease.",
    buildSample: (base) =>
      buildTeamSeatUpdatedEmail({
        name: "Nadia Al-Khatib",
        organizationName: "Northwind Design Studio",
        changeKind: "increase_immediate",
        currentSeats: 3,
        targetSeats: 6,
        chargedUsd: 42.5,
        appBaseUrl: base,
      }),
  },
  {
    key: "billing.payment_failed",
    title: "Past-Due Payment Failed (10-Day Grace)",
    audience: "billing",
    audienceLabel: "Billing & Plans",
    department: "billing",
    triggerSummary: "Urgent dunning alert when a subscription renewal fails in Paddle (starts 10-day grace).",
    buildSample: (base) =>
      buildPaymentFailedEmail({
        plan: "pro",
        daysRemaining: 10,
        graceEndsAtIso: "2026-12-24T00:00:00.000Z",
        billingUrl: `${resolveAppBase(base)}/account/billing`,
        appBaseUrl: base,
      }),
  },
  {
    key: "billing.renewal_grace_reminder",
    title: "10-Day Renewal Countdown Reminder",
    audience: "billing",
    audienceLabel: "Billing & Plans",
    department: "billing",
    triggerSummary: "Sent on day 5 and day 9 of the 10-day renewal grace window before projects lock.",
    buildSample: (base) =>
      buildRenewalGraceReminderEmail({
        name: "Nadia Al-Khatib",
        plan: "pro",
        daysRemaining: 1,
        graceEndsAtIso: "2026-12-24T00:00:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "billing.grace_expired_locked",
    title: "Renewal Grace Ended — Projects Locked",
    audience: "billing",
    audienceLabel: "Billing & Plans",
    department: "billing",
    triggerSummary: "Sent after 10 days unpaid when Pro reverts to Free or Team workspace locks.",
    buildSample: (base) =>
      buildGraceExpiredLockedEmail({
        name: "Nadia Al-Khatib",
        plan: "pro",
        lockedCount: 4,
        appBaseUrl: base,
      }),
  },
  {
    key: "team.workspace_dissolved",
    title: "Team Workspace Closed Notification",
    audience: "team",
    audienceLabel: "Teams & Collaboration",
    department: "team",
    triggerSummary: "Sent to former teammates when the sole Owner permanently closes a Team workspace.",
    buildSample: (base) =>
      buildTeamWorkspaceDissolvedEmail({
        memberName: "Nadia Al-Khatib",
        organizationName: "Northwind Design Studio",
        appBaseUrl: base,
      }),
  },
  {
    key: "billing.subscription_canceled",
    title: "Subscription Cancellation Scheduled / Ended",
    audience: "billing",
    audienceLabel: "Billing & Plans",
    department: "billing",
    triggerSummary: "Confirms scheduled period-end or immediate cancellation with draft retention reassurance.",
    buildSample: (base) =>
      buildSubscriptionCanceledEmail({
        name: "Nadia Al-Khatib",
        plan: "pro",
        immediate: false,
        effectiveEndIso: "2026-12-14T00:00:00.000Z",
        appBaseUrl: base,
      }),
  },
  {
    key: "billing.subscription_resumed",
    title: "Subscription Resumed Confirmation",
    audience: "billing",
    audienceLabel: "Billing & Plans",
    department: "billing",
    triggerSummary: "Sent when a user removes a scheduled cancellation and resumes auto-renewal.",
    buildSample: (base) =>
      buildSubscriptionResumedEmail({
        name: "Nadia Al-Khatib",
        plan: "pro",
        appBaseUrl: base,
      }),
  },

  // Support & Help Desk
  {
    key: "support.ticket_received",
    title: "Support Ticket Auto-Acknowledgement (To User)",
    audience: "support",
    audienceLabel: "Support Desk",
    department: "support",
    triggerSummary: "Sent from support@casefolio.com to verified users submitting a help request.",
    buildSample: (base) =>
      buildSupportTicketReceiptEmail({
        ticketCode: "CF-84920",
        topic: "Billing & plans",
        subjectLine: "Need VAT invoice for studio annual plan",
        appBaseUrl: base,
      }),
  },
  {
    key: "support.ticket_intake_alert",
    title: "Inbound Support Ticket Dispatch (To support@casefolio.com)",
    audience: "support",
    audienceLabel: "Support Desk",
    department: "support",
    triggerSummary: "Delivers full ticket + Reply-To user header into support@casefolio.com.",
    buildSample: (base) =>
      buildSupportTicketIntakeAlertEmail({
        ticketCode: "CF-84920",
        requesterEmail: "nadia@northwind.design",
        requesterUserId: "00000000-0000-4000-8000-000000000099",
        topic: "Billing & plans",
        subjectLine: "Need VAT invoice for studio annual plan",
        message:
          "Hi team,\nCould we add our studio VAT number to invoice #INV-2026-9921? Thank you!",
        appBaseUrl: base,
      }),
  },

  // Platform Administration & Governance
  {
    key: "admin.role_changed",
    title: "Platform Admin / Superadmin Role Updated",
    audience: "admin",
    audienceLabel: "Admin & Governance",
    department: "admin",
    triggerSummary: "Sent from admin@casefolio.com when a user is promoted or demoted in Admin Settings.",
    buildSample: (base) =>
      buildAdminRoleChangedEmail({
        name: "Kareem Saleh",
        previousRole: "user",
        nextRole: "admin",
        appBaseUrl: base,
      }),
  },
  {
    key: "admin.account_suspended",
    title: "Account Suspended Notice (From Administration)",
    audience: "admin",
    audienceLabel: "Admin & Governance",
    department: "admin",
    triggerSummary: "Sent from admin@casefolio.com when an admin suspends an account & revokes sessions.",
    buildSample: (base) =>
      buildAdminAccountSuspendedEmail({
        name: "Sample User",
        appBaseUrl: base,
      }),
  },
  {
    key: "admin.account_reactivated",
    title: "Account Reactivated Notice (From Administration)",
    audience: "admin",
    audienceLabel: "Admin & Governance",
    department: "admin",
    triggerSummary: "Sent from admin@casefolio.com when an admin lifts an account suspension.",
    buildSample: (base) =>
      buildAdminAccountReactivatedEmail({
        name: "Sample User",
        appBaseUrl: base,
      }),
  },
  {
    key: "admin.moderation_takedown",
    title: "Case Study Unpublished (Policy Moderation)",
    audience: "admin",
    audienceLabel: "Admin & Governance",
    department: "admin",
    triggerSummary: "Sent from admin@casefolio.com when moderation unpublishes a public case study.",
    buildSample: (base) =>
      buildAdminModerationTakedownEmail({
        projectName: "Confidential Client Prototype",
        editorUrl: `${resolveAppBase(base)}/editor/00000000-0000-4000-8000-000000000101`,
        appBaseUrl: base,
      }),
  },
  {
    key: "admin.abuse_report_alert",
    title: "Inbound Abuse Report Alert (To admin@casefolio.com)",
    audience: "admin",
    audienceLabel: "Admin & Governance",
    department: "admin",
    triggerSummary: "Alerts admin@casefolio.com immediately when a visitor reports a public case study.",
    buildSample: (base) =>
      buildAdminAbuseReportAlertEmail({
        reportId: "rep_01J9XYZ",
        projectName: "Copied Banking Concept",
        projectSlug: "copied-banking-concept",
        category: "Copyright or trademark infringement",
        details: "Screens 3 and 4 reproduce proprietary unreleased UI assets without permission.",
        appBaseUrl: base,
      }),
  },
  {
    key: "admin.custom_notice",
    title: "Official Direct Admin Message (From admin@casefolio.com)",
    audience: "admin",
    audienceLabel: "Admin & Governance",
    department: "admin",
    triggerSummary: "Dispatched directly by admins from /admin/emails or /admin/users/[id].",
    buildSample: (base) =>
      buildAdminCustomNoticeEmail({
        recipientName: "Lina Haddad",
        subject: "Featured showcase selection — Casefolio Editorial Picks",
        heading: "Your case study was shortlisted by our editorial team",
        message:
          "We loved reviewing your recent Fintech case study on Casefolio.\n\nReply directly to this email if you would like us to feature it in next week's Studio Showcase.",
        ctaLabel: "Open your dashboard",
        ctaUrl: `${resolveAppBase(base)}/dashboard`,
        appBaseUrl: base,
      }),
  },
] as const;

export function findCatalogTemplateByKey(key: string): EmailCatalogEntry | undefined {
  return EMAIL_TEMPLATE_CATALOG.find((item) => item.key === key);
}

export async function renderCatalogTemplatePreview(
  key: string,
  appBaseUrl?: string,
): Promise<{
  entry: EmailCatalogEntry;
  department: EmailDepartment;
  from: string;
  senderAddress: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
} | null> {
  const entry = findCatalogTemplateByKey(key);
  if (!entry) return null;
  const sampleInput = entry.buildSample(appBaseUrl);
  const rendered = await renderCasefolioEmail(sampleInput);
  return {
    entry,
    ...rendered,
  };
}
