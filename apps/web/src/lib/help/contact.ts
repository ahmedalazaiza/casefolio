import { randomInt } from "node:crypto";
import { z } from "zod";

export const SUPPORT_TOPICS = [
  "Exports",
  "Templates & editor",
  "Publishing & links",
  "Billing & plans",
  "Account & teams",
  "Other",
] as const;

export type SupportTopic = (typeof SUPPORT_TOPICS)[number];

export const supportTicketInputSchema = z.object({
  email: z.string().trim().email("Enter a valid reply-to email address."),
  topic: z.enum(SUPPORT_TOPICS).default("Exports"),
  relatedProject: z.string().trim().max(160).optional().default(""),
  subject: z
    .string()
    .trim()
    .min(4, "Subject must be at least 4 characters.")
    .max(160, "Subject must be 160 characters or fewer."),
  message: z
    .string()
    .trim()
    .min(10, "Please describe the issue in at least 10 characters.")
    .max(4000, "Message must be 4,000 characters or fewer."),
  attachmentName: z.string().trim().max(200).optional().default(""),
  includeDiagnostics: z.boolean().default(true),
  diagnosticSummary: z.string().trim().max(500).optional().default(""),
});

export type SupportTicketInput = z.infer<typeof supportTicketInputSchema>;

export function generateSupportTicketCode(): string {
  const codeNum = randomInt(10000, 99999);
  return `CF-${codeNum}`;
}
