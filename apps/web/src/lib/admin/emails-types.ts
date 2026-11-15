import { z } from "zod";
import type { EmailDepartment } from "@/lib/email/senders";
import type { EmailAudienceGroup } from "@/lib/email/templates";

export interface AdminEmailDepartmentSummary {
  department: EmailDepartment;
  displayName: string;
  address: string;
  formattedFrom: string;
  defaultReplyTo: string;
  badgeLabel: string;
  categoryLabel: string;
  description: string;
}

export interface AdminEmailTemplateSummary {
  key: string;
  title: string;
  audience: EmailAudienceGroup;
  audienceLabel: string;
  department: EmailDepartment;
  senderAddress: string;
  formattedFrom: string;
  defaultReplyTo: string;
  triggerSummary: string;
}

export interface AdminEmailPreviewPayload {
  key: string;
  title: string;
  department: EmailDepartment;
  from: string;
  senderAddress: string;
  replyTo: string;
  subject: string;
  triggerSummary: string;
  html: string;
  text: string;
}

/**
 * Admin email abuse hardening (N2):
 * - `send_test` never accepts a recipient: the server always sends to the calling admin's own address.
 * - `send_admin_notice` targets an EXISTING user by id (resolved server-side); a free-form recipient
 *   address is rejected by `.strict()`.
 * - `ctaUrl` must be an http(s) URL here; the server additionally enforces same-origin with the app URL.
 */
const ctaUrlSchema = z
  .string()
  .trim()
  .max(2000, "CTA link is too long.")
  .url("CTA link must be a valid URL.")
  .refine((value) => /^https?:\/\//i.test(value), "CTA link must start with http:// or https://.");

export const adminEmailsPostSchema = z.discriminatedUnion("action", [
  z
    .object({
      action: z.literal("send_test"),
      templateKey: z.string().trim().min(2).max(100),
    })
    .strict(),
  z
    .object({
      action: z.literal("send_admin_notice"),
      targetUserId: z.string().uuid("Choose an existing user to notify."),
      subject: z
        .string()
        .trim()
        .min(3, "Subject must be at least 3 characters.")
        .max(160, "Subject must be 160 characters or fewer."),
      heading: z
        .string()
        .trim()
        .min(3, "Heading must be at least 3 characters.")
        .max(140, "Heading must be 140 characters or fewer."),
      message: z
        .string()
        .trim()
        .min(10, "Message must be at least 10 characters.")
        .max(4000, "Message must be 4,000 characters or fewer."),
      ctaLabel: z.string().trim().max(60).optional(),
      ctaUrl: ctaUrlSchema.optional().or(z.literal("")),
    })
    .strict(),
]);

export type AdminEmailsPostInput = z.infer<typeof adminEmailsPostSchema>;

/** `true` only for an http(s) URL whose origin equals the application origin. */
export function isSameOriginHttpUrl(rawUrl: string, appUrl: string): boolean {
  try {
    const candidate = new URL(rawUrl);
    const app = new URL(appUrl);
    if (candidate.protocol !== "http:" && candidate.protocol !== "https:") return false;
    if (candidate.username || candidate.password) return false;
    return candidate.origin === app.origin;
  } catch {
    return false;
  }
}
