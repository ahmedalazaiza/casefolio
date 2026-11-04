import {
  Body,
  Button,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Preview,
  Section,
  Text,
  render,
  toPlainText,
} from "react-email";
import { Resend } from "resend";
import { env } from "@/env";

const FROM_ADDRESS = "Casefolio <noreply@casefolio.app>";

function isLiveResendKey(apiKey: string): boolean {
  return (
    apiKey.startsWith("re_") &&
    !apiKey.startsWith("re_dev_") &&
    !apiKey.startsWith("re_test_")
  );
}

interface AuthEmailTemplateProps {
  previewText: string;
  heading: string;
  body: string;
  code?: string;
  ctaLabel?: string;
  ctaUrl?: string;
  footerNote?: string;
}

function CasefolioAuthEmail({
  previewText,
  heading,
  body,
  code,
  ctaLabel,
  ctaUrl,
  footerNote = "If you did not request this email, you can safely ignore it.",
}: AuthEmailTemplateProps) {
  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body style={{ fontFamily: "system-ui, -apple-system, sans-serif", margin: 0, padding: "32px 16px" }}>
        <Container style={{ maxWidth: "480px", margin: "0 auto", padding: "32px", border: "1px solid #ededef", borderRadius: "16px" }}>
          <Text style={{ fontSize: "12px", fontWeight: 600, letterSpacing: "0.06em", textTransform: "uppercase", margin: "0 0 12px" }}>
            CASEFOLIO
          </Text>
          <Heading as="h1" style={{ fontSize: "24px", fontWeight: 600, margin: "0 0 12px" }}>
            {heading}
          </Heading>
          <Text style={{ fontSize: "15px", lineHeight: "1.55", margin: "0 0 20px" }}>
            {body}
          </Text>

          {code && (
            <Section style={{ padding: "16px", borderRadius: "12px", backgroundColor: "#f4f4f5", textAlign: "center", marginBottom: "20px" }}>
              <Text style={{ fontFamily: "ui-monospace, monospace", fontSize: "28px", fontWeight: 700, letterSpacing: "0.22em", margin: 0 }}>
                {code}
              </Text>
            </Section>
          )}

          {ctaLabel && ctaUrl && (
            <Section style={{ marginBottom: "20px" }}>
              <Button
                href={ctaUrl}
                style={{
                  backgroundColor: "#4f46e5",
                  color: "#ffffff",
                  borderRadius: "999px",
                  padding: "12px 24px",
                  fontSize: "14px",
                  fontWeight: 600,
                  textDecoration: "none",
                  display: "inline-block",
                }}
              >
                {ctaLabel}
              </Button>
            </Section>
          )}

          <Hr style={{ borderColor: "#ededef", margin: "24px 0 16px" }} />
          <Text style={{ fontSize: "12px", color: "#71717a", margin: 0 }}>
            {footerNote}
          </Text>
        </Container>
      </Body>
    </Html>
  );
}

export async function renderAndDeliverEmail(params: {
  to: string;
  subject: string;
  template: AuthEmailTemplateProps;
}): Promise<{ delivered: boolean; html: string; text: string }> {
  const html = await render(<CasefolioAuthEmail {...params.template} />);
  const text = toPlainText(html);

  if (!isLiveResendKey(env.RESEND_API_KEY)) {
    // Local dev / CI mode: never log PII or tokens per 02-RULES.md §5
    return { delivered: false, html, text };
  }

  const resend = new Resend(env.RESEND_API_KEY);
  const { error } = await resend.emails.send({
    from: FROM_ADDRESS,
    to: params.to,
    subject: params.subject,
    html,
    text,
  });

  if (error) {
    throw new Error(`Resend email delivery failed: ${error.message}`);
  }

  return { delivered: true, html, text };
}

export async function sendVerificationOtpEmail(data: {
  email: string;
  otp: string;
  type: "sign-in" | "email-verification" | "forget-password" | "change-email";
}) {
  const isReset = data.type === "forget-password";
  return renderAndDeliverEmail({
    to: data.email,
    subject: isReset ? "Your Casefolio password reset code" : "Verify your Casefolio email",
    template: {
      previewText: `Your 6-digit Casefolio code is ${data.otp}`,
      heading: isReset ? "Reset your password" : "Verify your email",
      body: "Enter the 6-digit verification code below to continue in Casefolio. This code expires in 10 minutes.",
      code: data.otp,
    },
  });
}

export async function sendMagicLinkEmail(data: { email: string; url: string }) {
  return renderAndDeliverEmail({
    to: data.email,
    subject: "Sign in to Casefolio",
    template: {
      previewText: "Your one-click sign-in link for Casefolio",
      heading: "Sign in to Casefolio",
      body: "Click the button below to securely sign in to your Casefolio workspace. This link can only be used once and expires in 5 minutes.",
      ctaLabel: "Sign in to Casefolio",
      ctaUrl: data.url,
    },
  });
}

export async function sendPasswordResetEmail(data: { email: string; url: string }) {
  return renderAndDeliverEmail({
    to: data.email,
    subject: "Reset your Casefolio password",
    template: {
      previewText: "Reset your Casefolio account password",
      heading: "Reset your password",
      body: "We received a request to reset the password for your Casefolio account. Choose a new password using the link below.",
      ctaLabel: "Choose new password",
      ctaUrl: data.url,
    },
  });
}

export async function sendTeamInvitationEmail(data: {
  email: string;
  organizationName: string;
  inviterName: string;
  acceptUrl: string;
  role: string;
}) {
  return renderAndDeliverEmail({
    to: data.email,
    subject: `Join ${data.organizationName} on Casefolio`,
    template: {
      previewText: `${data.inviterName} invited you to collaborate on Casefolio`,
      heading: `Join ${data.organizationName}`,
      body: `${data.inviterName} invited you to join ${data.organizationName} as ${data.role} on Casefolio.`,
      ctaLabel: "Accept invitation",
      ctaUrl: data.acceptUrl,
    },
  });
}
