// @vitest-environment node
import { beforeEach, describe, expect, it } from "vitest";
import {
  clearRecentEmailDispatchesForDev,
  EMAIL_DEPARTMENTS,
  EMAIL_TEMPLATE_CATALOG,
  getRecentEmailDispatchesForDev,
  listAllDepartmentSenders,
  renderCatalogTemplatePreview,
  resolveDepartmentSender,
  sendAdminAccountSuspensionEmail,
  sendAdminCustomNoticeEmail,
  sendAdminRoleChangedEmail,
  sendSupportTicketIntakeAlertEmail,
  sendWelcomeNewUserEmail,
} from "@/lib/email";

describe("Casefolio V3 Transactional Email System & Departmental Routing", () => {
  beforeEach(() => {
    clearRecentEmailDispatchesForDev();
  });

  it("resolves exact @casefolio.com addresses and Reply-To headers for all 7 departments", () => {
    const all = listAllDepartmentSenders();
    expect(all).toHaveLength(EMAIL_DEPARTMENTS.length);

    expect(resolveDepartmentSender("admin")).toMatchObject({
      displayName: "Casefolio Admin",
      address: "admin@casefolio.com",
      formattedFrom: "Casefolio Admin <admin@casefolio.com>",
      defaultReplyTo: "admin@casefolio.com",
    });

    expect(resolveDepartmentSender("security")).toMatchObject({
      displayName: "Casefolio Security",
      address: "security@casefolio.com",
      formattedFrom: "Casefolio Security <security@casefolio.com>",
      defaultReplyTo: "support@casefolio.com",
    });

    expect(resolveDepartmentSender("welcome")).toMatchObject({
      displayName: "Casefolio Studio",
      address: "hello@casefolio.com",
      formattedFrom: "Casefolio Studio <hello@casefolio.com>",
      defaultReplyTo: "support@casefolio.com",
    });

    expect(resolveDepartmentSender("team")).toMatchObject({
      displayName: "Casefolio Teams",
      address: "team@casefolio.com",
      formattedFrom: "Casefolio Teams <team@casefolio.com>",
      defaultReplyTo: "support@casefolio.com",
    });

    expect(resolveDepartmentSender("billing")).toMatchObject({
      displayName: "Casefolio Billing",
      address: "billing@casefolio.com",
      formattedFrom: "Casefolio Billing <billing@casefolio.com>",
      defaultReplyTo: "billing@casefolio.com",
    });

    expect(resolveDepartmentSender("notifications")).toMatchObject({
      displayName: "Casefolio Notifications",
      address: "notifications@casefolio.com",
      formattedFrom: "Casefolio Notifications <notifications@casefolio.com>",
      defaultReplyTo: "support@casefolio.com",
    });

    expect(resolveDepartmentSender("support")).toMatchObject({
      displayName: "Casefolio Support",
      address: "support@casefolio.com",
      formattedFrom: "Casefolio Support <support@casefolio.com>",
      defaultReplyTo: "support@casefolio.com",
    });
  });

  it("renders all 31 catalog templates in V3 Flat-Editorial HTML and plain text with zero undefined tokens", async () => {
    expect(EMAIL_TEMPLATE_CATALOG.length).toBeGreaterThanOrEqual(31);

    for (const entry of EMAIL_TEMPLATE_CATALOG) {
      const rendered = await renderCatalogTemplatePreview(
        entry.key,
        "https://casefolio.com",
      );
      expect(rendered, `Failed rendering ${entry.key}`).not.toBeNull();
      if (!rendered) continue;

      const expectedSender = resolveDepartmentSender(entry.department);
      expect(rendered.from).toBe(expectedSender.formattedFrom);
      expect(rendered.senderAddress).toBe(expectedSender.address);
      expect(rendered.subject.length).toBeGreaterThan(5);

      // Official Casefolio Brand & Editorial Checks
      expect(rendered.html).toContain('alt="Casefolio"');
      expect(rendered.html).toContain("/brand/logo-dark-transparent.png");
      expect(rendered.html).toContain(expectedSender.address);
      expect(rendered.html).toContain("#20211D");
      expect(rendered.html).toContain("#D9F233");
      expect(rendered.html).toContain("#F3F1E9");
      expect(rendered.html).not.toContain("box-shadow");
      expect(rendered.html).not.toContain("undefined");
      expect(rendered.text.length).toBeGreaterThan(40);
      expect(rendered.text).not.toContain("undefined");
    }
  });

  it("routes administrative emails from admin@casefolio.com and preserves Reply-To on support tickets without leaking PII in dev audits", async () => {
    const privateRecipient = "sensitive.designer.user@example.com";

    const adminRoleRes = await sendAdminRoleChangedEmail({
      to: privateRecipient,
      name: "Kareem",
      previousRole: "user",
      nextRole: "admin",
    });
    expect(adminRoleRes.from).toBe("Casefolio Admin <admin@casefolio.com>");
    expect(adminRoleRes.replyTo).toBe("admin@casefolio.com");
    expect(adminRoleRes.html).toContain("admin@casefolio.com");

    const suspendRes = await sendAdminAccountSuspensionEmail({
      to: privateRecipient,
      name: "Kareem",
      suspended: true,
    });
    expect(suspendRes.from).toBe("Casefolio Admin <admin@casefolio.com>");
    expect(suspendRes.subject).toContain("suspended");

    const noticeRes = await sendAdminCustomNoticeEmail({
      to: privateRecipient,
      recipientName: "Kareem",
      subject: "Official Studio Notice",
      heading: "Showcase Invitation",
      message: "Your portfolio has been selected for our monthly feature.",
    });
    expect(noticeRes.from).toBe("Casefolio Admin <admin@casefolio.com>");
    expect(noticeRes.html).toContain("Showcase Invitation");

    const welcomeRes = await sendWelcomeNewUserEmail({
      to: privateRecipient,
      name: "Kareem",
      jobTitle: "Lead Designer",
      designFocus: "web",
    });
    expect(welcomeRes.from).toBe("Casefolio Studio <hello@casefolio.com>");

    const supportIntakeRes = await sendSupportTicketIntakeAlertEmail({
      ticketCode: "CF-12345",
      requesterEmail: privateRecipient,
      topic: "Exports",
      subjectLine: "PDF export margin check",
      message: "Checking margin alignment on mobile viewports.",
    });
    expect(supportIntakeRes.from).toBe("Casefolio Support <support@casefolio.com>");
    expect(supportIntakeRes.replyTo).toBe(privateRecipient);

    // Ensure dev audit trail NEVER stores recipient email PII across ALL dispatches
    const allAudits = getRecentEmailDispatchesForDev();
    expect(allAudits.length).toBe(5);
    expect(JSON.stringify(allAudits)).not.toContain(privateRecipient);
  });
});
