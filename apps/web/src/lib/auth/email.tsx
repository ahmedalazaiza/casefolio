import {
  sendCasefolioEmail,
  type EmailDepartment,
  buildMagicLinkSignInEmail,
  buildPasswordResetLinkEmail,
  buildTeamInvitationEmail,
  buildVerificationOtpEmail,
  type EmailCalloutTone,
  type EmailSpecRow,
} from "@/lib/email";

export interface AuthEmailTemplateProps {
  previewText: string;
  eyebrow?: string;
  heading: string;
  body: string;
  code?: string;
  codeCaption?: string;
  callout?: {
    tone: EmailCalloutTone;
    title: string;
    body: string;
  };
  specs?: EmailSpecRow[];
  quoteBlock?: {
    label: string;
    content: string;
  };
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

export async function renderAndDeliverEmail(params: {
  to: string;
  subject: string;
  department?: EmailDepartment;
  replyTo?: string;
  templateKey?: string;
  appBaseUrl?: string;
  template: AuthEmailTemplateProps;
}): Promise<{
  delivered: boolean;
  html: string;
  text: string;
  from?: string;
  replyTo?: string;
}> {
  const paragraphs = params.template.body
    .split(/\n{2,}/)
    .map((line) => line.trim())
    .filter(Boolean);

  const result = await sendCasefolioEmail({
    to: params.to,
    department: params.department ?? "notifications",
    templateKey: params.templateKey ?? "generic.transactional",
    subject: params.subject,
    replyTo: params.replyTo,
    appBaseUrl: params.appBaseUrl,
    content: {
      previewText: params.template.previewText,
      eyebrow: params.template.eyebrow,
      heading: params.template.heading,
      paragraphs: paragraphs.length > 0 ? paragraphs : [params.template.body],
      code: params.template.code,
      codeCaption: params.template.codeCaption,
      callout: params.template.callout,
      specs: params.template.specs,
      quoteBlock: params.template.quoteBlock,
      ctaLabel: params.template.ctaLabel,
      ctaUrl: params.template.ctaUrl,
      footerNote:
        params.template.footerNote ??
        "If you did not request this email, you can safely ignore it.",
    },
  });

  return {
    delivered: result.delivered,
    html: result.html,
    text: result.text,
    from: result.from,
    replyTo: result.replyTo,
  };
}

export async function sendVerificationOtpEmail(data: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}) {
  const built = buildVerificationOtpEmail({
    otp: data.otp,
    type: data.type,
  });
  const result = await sendCasefolioEmail({
    to: data.email,
    ...built,
  });
  return {
    delivered: result.delivered,
    html: result.html,
    text: result.text,
    from: result.from,
    replyTo: result.replyTo,
  };
}

export async function sendMagicLinkEmail(data: { email: string; url: string }) {
  const built = buildMagicLinkSignInEmail({ url: data.url });
  const result = await sendCasefolioEmail({
    to: data.email,
    ...built,
  });
  return {
    delivered: result.delivered,
    html: result.html,
    text: result.text,
    from: result.from,
    replyTo: result.replyTo,
  };
}

export async function sendPasswordResetEmail(data: { email: string; url: string }) {
  const built = buildPasswordResetLinkEmail({ url: data.url });
  const result = await sendCasefolioEmail({
    to: data.email,
    ...built,
  });
  return {
    delivered: result.delivered,
    html: result.html,
    text: result.text,
    from: result.from,
    replyTo: result.replyTo,
  };
}

export async function sendTeamInvitationEmail(data: {
  email: string;
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  role: string;
}) {
  const built = buildTeamInvitationEmail({
    organizationName: data.organizationName,
    inviterName: data.inviterName,
    acceptUrl: data.acceptUrl,
    role: data.role,
  });
  const result = await sendCasefolioEmail({
    to: data.email,
    ...built,
  });
  return {
    delivered: result.delivered,
    html: result.html,
    text: result.text,
    from: result.from,
    replyTo: result.replyTo,
  };
}
