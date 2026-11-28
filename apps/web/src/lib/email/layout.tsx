import {
  Body,
  Button,
  Column,
  Container,
  Head,
  Heading,
  Hr,
  Html,
  Img,
  Link,
  Preview,
  Row,
  Section,
  Text,
} from "react-email";
import type { DepartmentSenderProfile } from "@/lib/email/senders";

export type EmailCalloutTone = "info" | "warning" | "danger" | "success" | "accent";

export interface EmailSpecRow {
  label: string;
  value: string;
}

export interface EmailHighlightStep {
  title: string;
  description: string;
}

export interface CasefolioV3EmailTemplateProps {
  previewText: string;
  eyebrow?: string;
  heading: string;
  greeting?: string;
  paragraphs: string[];
  code?: string;
  codeCaption?: string;
  callout?: {
    tone: EmailCalloutTone;
    title: string;
    body: string;
  };
  specs?: EmailSpecRow[];
  highlights?: EmailHighlightStep[];
  quoteBlock?: {
    label: string;
    content: string;
  };
  ctaLabel?: string;
  ctaUrl?: string;
  secondaryCta?: {
    label: string;
    url: string;
  };
  footerNote?: string;
  appBaseUrl?: string;
  sender: DepartmentSenderProfile;
  replyToAddress?: string;
}

const CALLOUT_PALETTE: Record<
  EmailCalloutTone,
  { bg: string; border: string; title: string; text: string }
> = {
  info: {
    bg: "#F4F1EA",
    border: "#D5D2C9",
    title: "#20211D",
    text: "#505246",
  },
  warning: {
    bg: "#FFFBEB",
    border: "#FDE68A",
    title: "#92400E",
    text: "#5C4018",
  },
  danger: {
    bg: "#FEF2F2",
    border: "#FECACA",
    title: "#B91C1C",
    text: "#691E1E",
  },
  success: {
    bg: "#ECFDF5",
    border: "#A7F3D0",
    title: "#065F46",
    text: "#1B4B3A",
  },
  accent: {
    bg: "#F6FCE0",
    border: "#D9F233",
    title: "#20211D",
    text: "#505246",
  },
};

const FONT_SANS =
  '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
const FONT_MONO =
  'ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, "Liberation Mono", monospace';

export function CasefolioV3EmailLayout({
  previewText,
  eyebrow,
  heading,
  greeting,
  paragraphs,
  code,
  codeCaption,
  callout,
  specs,
  highlights,
  quoteBlock,
  ctaLabel,
  ctaUrl,
  secondaryCta,
  footerNote = "You are receiving this transactional message regarding your Casefolio account or workspace.",
  appBaseUrl = "https://casefolio.com",
  sender,
  replyToAddress,
}: CasefolioV3EmailTemplateProps) {
  const cleanBaseUrl = appBaseUrl.replace(/\/+$/, "");
  const effectiveReplyTo = replyToAddress || sender.defaultReplyTo;
  const calloutColors = callout ? CALLOUT_PALETTE[callout.tone] : null;

  return (
    <Html lang="en">
      <Head />
      <Preview>{previewText}</Preview>
      <Body
        style={{
          fontFamily: FONT_SANS,
          backgroundColor: "#F4F1EA",
          color: "#20211D",
          margin: 0,
          padding: "32px 14px",
          WebkitFontSmoothing: "antialiased",
        }}
      >
        <Container
          style={{
            maxWidth: "600px",
            width: "100%",
            margin: "0 auto",
            backgroundColor: "#FAF8F4",
            border: "1px solid #D8D4CA",
            borderRadius: "12px",
            overflow: "hidden",
          }}
        >
          {/* Studio Flat-Editorial Header */}
          <Section
            style={{
              backgroundColor: "#20211D",
              padding: "20px 28px 16px",
            }}
          >
            <Row>
              <Column style={{ verticalAlign: "middle" }}>
                <Link
                  href={cleanBaseUrl}
                  style={{ textDecoration: "none", display: "inline-block" }}
                >
                  <Img
                    src={`${cleanBaseUrl}/brand/logo-dark-transparent.png`}
                    alt="Casefolio"
                    width={136}
                    height={26}
                    style={{
                      display: "block",
                      width: "136px",
                      height: "26px",
                      border: 0,
                      outline: "none",
                      textDecoration: "none",
                      color: "#F3F1E9",
                      fontFamily: FONT_SANS,
                      fontSize: "15px",
                      fontWeight: 700,
                      letterSpacing: "-0.03em",
                    }}
                  />
                </Link>
              </Column>
              <Column align="right" style={{ verticalAlign: "middle" }}>
                <span
                  style={{
                    display: "inline-block",
                    backgroundColor: "#D9F233",
                    color: "#20211D",
                    fontFamily: FONT_MONO,
                    fontSize: "10px",
                    fontWeight: 700,
                    letterSpacing: "0.08em",
                    textTransform: "uppercase",
                    padding: "4px 9px",
                    borderRadius: "6px",
                  }}
                >
                  {sender.badgeLabel}
                </span>
              </Column>
            </Row>
          </Section>

          {/* Verified Sender Sub-Strip */}
          <Section
            style={{
              backgroundColor: "#282924",
              borderBottom: "1px solid #363730",
              padding: "8px 28px",
            }}
          >
            <Text
              style={{
                margin: 0,
                fontFamily: FONT_MONO,
                fontSize: "11px",
                lineHeight: "1.4",
                color: "#A6A69E",
                letterSpacing: "0.02em",
              }}
            >
              FROM: <strong style={{ color: "#F3F1E9", fontWeight: 600 }}>{sender.address}</strong>{" "}
              · {sender.categoryLabel.toUpperCase()}
            </Text>
          </Section>

          {/* Main Editorial Content */}
          <Section style={{ padding: "32px 28px 28px" }}>
            {eyebrow && (
              <Text
                style={{
                  margin: "0 0 10px",
                  fontFamily: FONT_MONO,
                  fontSize: "11px",
                  fontWeight: 700,
                  letterSpacing: "0.09em",
                  textTransform: "uppercase",
                  color: "#505246",
                }}
              >
                {eyebrow}
              </Text>
            )}

            <Heading
              as="h1"
              style={{
                margin: "0 0 18px",
                fontSize: "25px",
                lineHeight: "1.22",
                fontWeight: 700,
                letterSpacing: "-0.025em",
                color: "#20211D",
              }}
            >
              {heading}
            </Heading>

            {greeting && (
              <Text
                style={{
                  margin: "0 0 12px",
                  fontSize: "15px",
                  lineHeight: "1.6",
                  fontWeight: 600,
                  color: "#20211D",
                }}
              >
                {greeting}
              </Text>
            )}

            {paragraphs.map((paragraph, index) => (
              <Text
                key={index}
                style={{
                  margin: index === paragraphs.length - 1 ? "0 0 22px" : "0 0 14px",
                  fontSize: "15px",
                  lineHeight: "1.62",
                  color: "#505246",
                }}
              >
                {paragraph}
              </Text>
            ))}

            {/* Verification / Security Code Box */}
            {code && (
              <Section
                style={{
                  margin: "0 0 22px",
                  padding: "20px 16px",
                  backgroundColor: "#ECE8DE",
                  border: "1px solid #D5D2C9",
                  borderRadius: "8px",
                  textAlign: "center",
                }}
              >
                <Text
                  style={{
                    margin: 0,
                    fontFamily: FONT_MONO,
                    fontSize: "30px",
                    fontWeight: 700,
                    letterSpacing: "0.26em",
                    color: "#20211D",
                  }}
                >
                  {code}
                </Text>
                {codeCaption && (
                  <Text
                    style={{
                      margin: "8px 0 0",
                      fontFamily: FONT_MONO,
                      fontSize: "11px",
                      color: "#66645E",
                    }}
                  >
                    {codeCaption}
                  </Text>
                )}
              </Section>
            )}

            {/* Flat Semantic Callout */}
            {callout && calloutColors && (
              <Section
                style={{
                  margin: "0 0 22px",
                  padding: "14px 16px",
                  backgroundColor: calloutColors.bg,
                  border: `1px solid ${calloutColors.border}`,
                  borderRadius: "8px",
                }}
              >
                <Text
                  style={{
                    margin: "0 0 4px",
                    fontSize: "13px",
                    fontWeight: 700,
                    color: calloutColors.title,
                  }}
                >
                  {callout.title}
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "13px",
                    lineHeight: "1.55",
                    color: calloutColors.text,
                  }}
                >
                  {callout.body}
                </Text>
              </Section>
            )}

            {/* Architectural Key-Value Spec Table */}
            {specs && specs.length > 0 && (
              <Section
                style={{
                  margin: "0 0 22px",
                  backgroundColor: "#F4F1EA",
                  border: "1px solid #D8D4CA",
                  borderRadius: "8px",
                  padding: "4px 16px",
                }}
              >
                {specs.map((row, idx) => (
                  <Row
                    key={`${row.label}-${idx}`}
                    style={{
                      borderBottom:
                        idx < specs.length - 1 ? "1px solid #D5D2C9" : "none",
                      padding: "10px 0",
                    }}
                  >
                    <Column style={{ width: "38%", verticalAlign: "top", paddingRight: "10px" }}>
                      <Text
                        style={{
                          margin: 0,
                          fontFamily: FONT_MONO,
                          fontSize: "11px",
                          fontWeight: 600,
                          textTransform: "uppercase",
                          letterSpacing: "0.05em",
                          color: "#66645E",
                        }}
                      >
                        {row.label}
                      </Text>
                    </Column>
                    <Column style={{ width: "62%", verticalAlign: "top" }}>
                      <Text
                        style={{
                          margin: 0,
                          fontSize: "13px",
                          fontWeight: 600,
                          lineHeight: "1.45",
                          color: "#20211D",
                          wordBreak: "break-word",
                        }}
                      >
                        {row.value}
                      </Text>
                    </Column>
                  </Row>
                ))}
              </Section>
            )}

            {/* Quote / Message Content Block */}
            {quoteBlock && (
              <Section
                style={{
                  margin: "0 0 22px",
                  backgroundColor: "#F4F1EA",
                  border: "1px solid #D8D4CA",
                  borderLeft: "3px solid #20211D",
                  borderRadius: "8px",
                  padding: "14px 16px",
                }}
              >
                <Text
                  style={{
                    margin: "0 0 6px",
                    fontFamily: FONT_MONO,
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.06em",
                    color: "#20211D",
                  }}
                >
                  {quoteBlock.label}
                </Text>
                <Text
                  style={{
                    margin: 0,
                    fontSize: "14px",
                    lineHeight: "1.6",
                    color: "#20211D",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {quoteBlock.content}
                </Text>
              </Section>
            )}

            {/* Structured Highlight Steps */}
            {highlights && highlights.length > 0 && (
              <Section style={{ margin: "0 0 22px" }}>
                {highlights.map((step, idx) => (
                  <Section
                    key={idx}
                    style={{
                      marginBottom: idx < highlights.length - 1 ? "10px" : "0",
                      padding: "12px 14px",
                      backgroundColor: "#F4F1EA",
                      border: "1px solid #D8D4CA",
                      borderRadius: "8px",
                    }}
                  >
                    <Text
                      style={{
                        margin: "0 0 3px",
                        fontSize: "13px",
                        fontWeight: 700,
                        color: "#20211D",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: FONT_MONO,
                          color: "#505246",
                          marginRight: "8px",
                        }}
                      >
                        0{idx + 1}
                      </span>
                      {step.title}
                    </Text>
                    <Text
                      style={{
                        margin: 0,
                        fontSize: "13px",
                        lineHeight: "1.5",
                        color: "#505246",
                      }}
                    >
                      {step.description}
                    </Text>
                  </Section>
                ))}
              </Section>
            )}

            {/* Primary & Secondary Actions */}
            {ctaLabel && ctaUrl && (
              <Section style={{ margin: "4px 0 18px" }}>
                <Button
                  href={ctaUrl}
                  style={{
                    backgroundColor: "#20211D",
                    color: "#F3F1E9",
                    borderRadius: "8px",
                    padding: "13px 24px",
                    fontSize: "14px",
                    fontWeight: 600,
                    textDecoration: "none",
                    display: "inline-block",
                  }}
                >
                  {ctaLabel}
                </Button>

                {secondaryCta && (
                  <Link
                    href={secondaryCta.url}
                    style={{
                      display: "inline-block",
                      marginLeft: "14px",
                      fontSize: "13px",
                      fontWeight: 600,
                      color: "#20211D",
                      textDecoration: "underline",
                    }}
                  >
                    {secondaryCta.label}
                  </Link>
                )}
              </Section>
            )}

            {ctaUrl && (
              <Text
                style={{
                  margin: "0",
                  fontSize: "12px",
                  lineHeight: "1.5",
                  color: "#66645E",
                  wordBreak: "break-all",
                }}
              >
                Direct link:{" "}
                <Link href={ctaUrl} style={{ color: "#20211D", textDecoration: "underline" }}>
                  {ctaUrl}
                </Link>
              </Text>
            )}
          </Section>

          {/* Architectural Footer */}
          <Section
            style={{
              backgroundColor: "#F4F1EA",
              borderTop: "1px solid #D8D4CA",
              padding: "20px 28px 24px",
            }}
          >
            <Text
              style={{
                margin: "0 0 10px",
                fontSize: "12px",
                lineHeight: "1.55",
                color: "#505246",
              }}
            >
              {footerNote}
            </Text>

            <Text
              style={{
                margin: "0 0 12px",
                fontFamily: FONT_MONO,
                fontSize: "11px",
                lineHeight: "1.5",
                color: "#66645E",
              }}
            >
              Sent by <strong style={{ color: "#20211D" }}>{sender.displayName}</strong> (
              {sender.address}) · Reply-To: {effectiveReplyTo}
            </Text>

            <Hr style={{ borderColor: "#D8D4CA", margin: "12px 0" }} />

            <Text
              style={{
                margin: 0,
                fontSize: "12px",
                lineHeight: "1.5",
                color: "#66645E",
              }}
            >
              <Link
                href={`${cleanBaseUrl}/dashboard`}
                style={{ color: "#20211D", textDecoration: "none", fontWeight: 600 }}
              >
                Dashboard
              </Link>
              {"  ·  "}
              <Link
                href={`${cleanBaseUrl}/templates`}
                style={{ color: "#505246", textDecoration: "none" }}
              >
                Templates
              </Link>
              {"  ·  "}
              <Link
                href={`${cleanBaseUrl}/help`}
                style={{ color: "#505246", textDecoration: "none" }}
              >
                Help Center
              </Link>
              {"  ·  "}
              <Link
                href={`${cleanBaseUrl}/privacy`}
                style={{ color: "#505246", textDecoration: "none" }}
              >
                Privacy
              </Link>
              {"  ·  "}
              <Link
                href={`${cleanBaseUrl}/terms`}
                style={{ color: "#505246", textDecoration: "none" }}
              >
                Terms
              </Link>
            </Text>
          </Section>
        </Container>
      </Body>
    </Html>
  );
}

