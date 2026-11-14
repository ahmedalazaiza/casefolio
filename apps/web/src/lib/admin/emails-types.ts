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

export const adminEmailsPostSchema = z.discriminatedUnion("action", [
  z.object({
    action: z.literal("send_test"),
    templateKey: z.string().trim().min(2).max(100),
    recipientEmail: z.string().trim().email("Enter a valid recipient email address."),
  }),
  z.object({
    action: z.literal("send_admin_notice"),
    recipientEmail: z.string().trim().email("Enter a valid recipient email address."),
    recipientName: z.string().trim().max(120).optional(),
    targetUserId: z.string().uuid().optional(),
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
    ctaUrl: z.string().trim().url("CTA link must be a valid URL.").optional().or(z.literal("")),
  }),
]);

export type AdminEmailsPostInput = z.infer<typeof adminEmailsPostSchema>;

