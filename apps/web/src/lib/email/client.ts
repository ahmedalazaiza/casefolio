import { createElement } from "react";
import { render, toPlainText } from "react-email";
import { Resend } from "resend";
import { env } from "@/env";
import {
  CasefolioV3EmailLayout,
  type CasefolioV3EmailTemplateProps,
} from "@/lib/email/layout";
import {
  resolveDepartmentSender,
  type EmailDepartment,
} from "@/lib/email/senders";

export interface EmailDispatchAuditEntry {
  templateKey: string;
  department: EmailDepartment;
  from: string;
  replyTo: string;
  subject: string;
  deliveredViaResend: boolean;
  htmlLength: number;
  timestamp: string;
}

const globalDispatchStore = globalThis as unknown as {
  __casefolioEmailDispatches?: EmailDispatchAuditEntry[];
};

function recordEmailDispatchAudit(entry: EmailDispatchAuditEntry): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  if (!globalDispatchStore.__casefolioEmailDispatches) {
    globalDispatchStore.__casefolioEmailDispatches = [];
  }
  const list = globalDispatchStore.__casefolioEmailDispatches;
  list.push(entry);
  if (list.length > 150) {
    list.splice(0, list.length - 150);
  }
}

/**
 * Non-PII dev/test inspection helper — deliberately omits recipient email addresses
 * to satisfy strict privacy & logging invariants (`02-RULES.md §5`).
 */
export function getRecentEmailDispatchesForDev(): EmailDispatchAuditEntry[] {
  if (process.env.NODE_ENV === "production") {
    return [];
  }
  return [...(globalDispatchStore.__casefolioEmailDispatches ?? [])];
}

export function clearRecentEmailDispatchesForDev(): void {
  if (process.env.NODE_ENV === "production") {
    return;
  }
  globalDispatchStore.__casefolioEmailDispatches = [];
}

export function isLiveResendKey(apiKey: string = env.RESEND_API_KEY): boolean {
  return (
    apiKey.startsWith("re_") &&
    !apiKey.startsWith("re_dev_") &&
    !apiKey.startsWith("re_test_")
  );
}

function senderAddressDomain(address: string): string {
  const parts = address.toLowerCase().split("@");
  return parts[1] ?? "casefolio.com";
}

export interface SendCasefolioEmailInput {
  to: string | string[];
  department: EmailDepartment;
  templateKey: string;
  subject: string;
  replyTo?: string;
  appBaseUrl?: string;
  content: Omit<CasefolioV3EmailTemplateProps, "sender" | "replyToAddress" | "appBaseUrl">;
}

export interface SendCasefolioEmailResult {
  delivered: boolean;
  department: EmailDepartment;
  from: string;
  senderAddress: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}

function sanitizeHeaderLine(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}

export async function renderCasefolioEmail(
  input: Omit<SendCasefolioEmailInput, "to">,
): Promise<{
  department: EmailDepartment;
  from: string;
  senderAddress: string;
  replyTo: string;
  subject: string;
  html: string;
  text: string;
}> {
  const sender = resolveDepartmentSender(input.department);
  const replyTo = sanitizeHeaderLine(input.replyTo ?? "") || sender.defaultReplyTo;
  const safeSubject = sanitizeHeaderLine(input.subject);
  const appBaseUrl = (input.appBaseUrl ?? env.NEXT_PUBLIC_APP_URL ?? "https://casefolio.com").replace(
    /\/+$/,
    "",
  );

  const html = await render(
    createElement(CasefolioV3EmailLayout, {
      ...input.content,
      sender,
      replyToAddress: replyTo,
      appBaseUrl,
    }),
  );
  const text = toPlainText(html);

  return {
    department: input.department,
    from: sender.formattedFrom,
    senderAddress: sender.address,
    replyTo,
    subject: safeSubject,
    html,
    text,
  };
}

export async function sendCasefolioEmail(
  input: SendCasefolioEmailInput,
): Promise<SendCasefolioEmailResult> {
  const rendered = await renderCasefolioEmail(input);

  const recipients = (Array.isArray(input.to) ? input.to : [input.to])
    .map((addr) => sanitizeHeaderLine(addr))
    .filter(Boolean);

  if (recipients.length === 0) {
    return {
      ...rendered,
      delivered: false,
    };
  }

  let delivered = false;

  if (isLiveResendKey(env.RESEND_API_KEY)) {
    const resend = new Resend(env.RESEND_API_KEY);
    const primaryPayload = {
      from: rendered.from,
      to: recipients.length === 1 ? recipients[0]! : recipients,
      replyTo: rendered.replyTo,
      subject: rendered.subject,
      html: rendered.html,
      text: rendered.text,
      headers: {
        "X-Casefolio-Department": input.department,
        "X-Casefolio-Template": input.templateKey,
      },
    };

    let { error } = await resend.emails.send(primaryPayload);

    // When custom domain DNS isn't verified on Resend yet (e.g. default casefolio.com during staging),
    // automatically retry via Resend's verified onboarding@resend.dev sender so verified test recipients still receive OTPs.
    if (
      error &&
      env.EMAIL_DOMAIN === "casefolio.com" &&
      /domain.*not verified|not verified|verify.*domain/i.test(error.message ?? "")
    ) {
      const displayName = rendered.from.includes("<")
        ? rendered.from.slice(0, rendered.from.indexOf("<")).trim()
        : "Casefolio";
      const fallbackRes = await resend.emails.send({
        ...primaryPayload,
        from: `${displayName} <onboarding@resend.dev>`,
      });
      error = fallbackRes.error;
    }

    if (error) {
      throw new Error(`Resend email delivery failed: ${error.message}`);
    }
    delivered = true;
  }

  const senderDomain = senderAddressDomain(rendered.senderAddress);
  const safeReplyToForAudit = rendered.replyTo.toLowerCase().endsWith(`@${senderDomain}`)
    ? rendered.replyTo
    : "requester-reply-to-redacted";

  recordEmailDispatchAudit({
    templateKey: input.templateKey,
    department: input.department,
    from: rendered.from,
    replyTo: safeReplyToForAudit,
    subject: rendered.subject,
    deliveredViaResend: delivered,
    htmlLength: rendered.html.length,
    timestamp: new Date().toISOString(),
  });

  return {
    ...rendered,
    delivered,
  };
}
