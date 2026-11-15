// @vitest-environment node
import { eq, like } from "@casefolio/db";
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";
import type * as AuthEmailModule from "@/lib/auth/email";
import type * as AuthSessionModule from "@/lib/auth/session";
import { db, dbSchema } from "@/lib/db";
import {
  attemptSupportTicketDelivery,
  createSupportTicket,
  retrySupportTicketDeliveries,
  summarizeDeliveryError,
} from "./tickets";

const { getServerSessionMock, renderAndDeliverEmailMock } = vi.hoisted(() => ({
  getServerSessionMock: vi.fn(),
  renderAndDeliverEmailMock: vi.fn(),
}));

vi.mock("@/lib/auth/session", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthSessionModule>();
  return { ...actual, getServerSession: getServerSessionMock };
});

vi.mock("@/lib/auth/email", async (importOriginal) => {
  const actual = await importOriginal<typeof AuthEmailModule>();
  return { ...actual, renderAndDeliverEmail: renderAndDeliverEmailMock };
});

const RUN = `t${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
const DOMAIN = `${RUN}.example`;

function ticketRequest(overrides: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return new Request("http://localhost:3000/api/help/contact", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify({
      email: `person@${DOMAIN}`,
      topic: "Exports",
      subject: "Export is stuck",
      message: "My export has been processing for a long time.",
      ...overrides,
    }),
  });
}

async function loadTicket(code: string) {
  const [row] = await db
    .select()
    .from(dbSchema.supportTickets)
    .where(eq(dbSchema.supportTickets.code, code));
  return row;
}

async function wipe() {
  await db.delete(dbSchema.supportTickets).where(like(dbSchema.supportTickets.email, `%@${DOMAIN}`));
  await db.delete(dbSchema.appRateLimits).where(like(dbSchema.appRateLimits.key, `help-contact:%${RUN}%`));
}

describe("support ticket persistence & delivery (B4)", () => {
  beforeEach(async () => {
    getServerSessionMock.mockReset();
    renderAndDeliverEmailMock.mockReset();
    getServerSessionMock.mockResolvedValue(null);
    await wipe();
  });

  afterAll(async () => {
    await wipe();
  });

  it("persists the ticket even when the email provider throws, and says 'queued' with a redacted error", async () => {
    const { POST } = await import("@/app/api/help/contact/route");
    renderAndDeliverEmailMock.mockRejectedValue(
      new Error(`Resend down for ops@secret.example key re_abcdefghijklmnop ${"x".repeat(1000)}`),
    );

    const res = await POST(ticketRequest({}, { "x-forwarded-for": `10.0.0.1, 198.51.100.1${RUN.length}` }));
    expect(res.status).toBe(200);
    const body = (await res.json()) as { ok: boolean; ticketCode: string; delivery: string };
    expect(body.ok).toBe(true);
    expect(body.delivery).toBe("queued");

    const row = await loadTicket(body.ticketCode);
    expect(row).toBeDefined();
    expect(row?.intakeEmailDeliveredAt).toBeNull();
    expect(row?.deliveryAttempts).toBe(1);
    expect(row?.lastDeliveryError).toBeTruthy();
    expect(row?.lastDeliveryError?.length).toBeLessThanOrEqual(300);
    expect(row?.lastDeliveryError).not.toContain("ops@secret.example");
    expect(row?.lastDeliveryError).not.toContain("re_abcdefghijklmnop");
  });

  it("reports 'queued' (not 'sent') when the provider is not live and nothing was delivered", async () => {
    const { POST } = await import("@/app/api/help/contact/route");
    renderAndDeliverEmailMock.mockResolvedValue({ delivered: false });

    const body = (await (await POST(ticketRequest())).json()) as { ticketCode: string; delivery: string };
    expect(body.delivery).toBe("queued");
    const row = await loadTicket(body.ticketCode);
    expect(row?.intakeEmailDeliveredAt).toBeNull();
    expect(row?.lastDeliveryError).toMatch(/not configured/i);
  });

  it("marks the ticket delivered and returns ticket code + expected response time on success", async () => {
    const { POST } = await import("@/app/api/help/contact/route");
    renderAndDeliverEmailMock.mockResolvedValue({ delivered: true });

    const body = (await (await POST(ticketRequest())).json()) as {
      ticketCode: string;
      delivery: string;
      expectedResponse: string;
    };
    expect(body.delivery).toBe("sent");
    expect(body.ticketCode).toMatch(/^CF-\d{5}$/);
    expect(body.expectedResponse).toMatch(/business day/);
    const row = await loadTicket(body.ticketCode);
    expect(row?.intakeEmailDeliveredAt).toBeInstanceOf(Date);
    expect(row?.lastDeliveryError).toBeNull();
  });

  it("only sends the receipt to a verified session email, never to an arbitrary address", async () => {
    const { POST } = await import("@/app/api/help/contact/route");
    renderAndDeliverEmailMock.mockResolvedValue({ delivered: true });
    const [user] = await db
      .insert(dbSchema.users)
      .values({
        name: "Ticket User",
        email: `owner@${DOMAIN}`,
        emailVerified: true,
      })
      .returning();
    try {
      getServerSessionMock.mockResolvedValue({
        user: { id: user!.id, email: `owner@${DOMAIN}`, emailVerified: true },
      });
      const ok = (await (await POST(ticketRequest({ email: `owner@${DOMAIN}` }))).json()) as {
        ticketCode: string;
      };
      const recipients = renderAndDeliverEmailMock.mock.calls.map((c) => c[0]?.to);
      expect(recipients).toEqual(["support@casefolio.com", `owner@${DOMAIN}`]);
      expect((await loadTicket(ok.ticketCode))?.userId).toBe(user!.id);

      renderAndDeliverEmailMock.mockClear();
      await POST(ticketRequest({ email: `someone-else@${DOMAIN}` }));
      expect(renderAndDeliverEmailMock.mock.calls.map((c) => c[0]?.to)).toEqual(["support@casefolio.com"]);
    } finally {
      await db.delete(dbSchema.supportTickets).where(like(dbSchema.supportTickets.email, `%@${DOMAIN}`));
      await db.delete(dbSchema.users).where(eq(dbSchema.users.id, user!.id));
    }
  });

  it("a failing receipt does not flip an already delivered intake back to undelivered", async () => {
    renderAndDeliverEmailMock
      .mockResolvedValueOnce({ delivered: true })
      .mockRejectedValueOnce(new Error("receipt boom"));
    const ticket = await createSupportTicket({
      userId: null,
      email: `person@${DOMAIN}`,
      topic: "Other",
      subject: "Hello there",
      message: "Hello there, a long enough message.",
      projectRef: null,
    });
    const outcome = await attemptSupportTicketDelivery(ticket, { receiptTo: `person@${DOMAIN}` });
    expect(outcome).toBe("sent");
    const row = await loadTicket(ticket.code);
    expect(row?.intakeEmailDeliveredAt).toBeInstanceOf(Date);
    expect(row?.lastDeliveryError).toMatch(/Receipt email failed/);
  });

  it("validation failures never create a ticket or send mail", async () => {
    const { POST } = await import("@/app/api/help/contact/route");
    const res = await POST(ticketRequest({ subject: "x", email: "not-an-email" }));
    expect(res.status).toBe(400);
    expect(renderAndDeliverEmailMock).not.toHaveBeenCalled();
    const rows = await db
      .select()
      .from(dbSchema.supportTickets)
      .where(like(dbSchema.supportTickets.email, `%@${DOMAIN}`));
    expect(rows).toHaveLength(0);
  });

  it("returns 503 (not a fake success) when the ticket cannot be persisted", async () => {
    const { POST } = await import("@/app/api/help/contact/route");
    vi.spyOn(db, "insert").mockImplementationOnce(() => {
      throw new Error("db unavailable");
    });
    const res = await POST(ticketRequest());
    expect(res.status).toBe(503);
    const body = (await res.json()) as { ok: boolean };
    expect(body.ok).toBe(false);
    expect(renderAndDeliverEmailMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });

  it("rate-limits with a shared limiter (8/min per actor) regardless of spoofed untrusted headers", async () => {
    await db.delete(dbSchema.appRateLimits).where(like(dbSchema.appRateLimits.key, "help-contact:%"));
    const { POST } = await import("@/app/api/help/contact/route");
    renderAndDeliverEmailMock.mockResolvedValue({ delivered: true });
    const statuses: number[] = [];
    for (let i = 0; i < 10; i += 1) {
      const res = await POST(
        ticketRequest(
          {},
          {
            "cf-connecting-ip": `203.0.113.${i + 1}`,
            "x-real-ip": `203.0.114.${i + 1}`,
          },
        ),
      );
      statuses.push(res.status);
    }
    expect(statuses.slice(0, 8).every((s) => s === 200)).toBe(true);
    expect(statuses.slice(8)).toEqual([429, 429]);
    await db.delete(dbSchema.appRateLimits).where(like(dbSchema.appRateLimits.key, "help-contact:%"));
  });

  it("retries code allocation on unique-code collision", async () => {
    const first = await createSupportTicket(
      {
        userId: null,
        email: `a@${DOMAIN}`,
        topic: "Other",
        subject: "First ticket",
        message: "First ticket message body.",
        projectRef: null,
      },
      () => "CF-00001",
    );
    const codes = ["CF-00001", "CF-00001", "CF-00002"];
    const second = await createSupportTicket(
      {
        userId: null,
        email: `b@${DOMAIN}`,
        topic: "Other",
        subject: "Second ticket",
        message: "Second ticket message body.",
        projectRef: null,
      },
      () => codes.shift() ?? "CF-00003",
    );
    expect(first.code).toBe("CF-00001");
    expect(second.code).toBe("CF-00002");
    await db.delete(dbSchema.supportTickets).where(eq(dbSchema.supportTickets.code, "CF-00001"));
    await db.delete(dbSchema.supportTickets).where(eq(dbSchema.supportTickets.code, "CF-00002"));
  });

  it("throws after exhausting collision retries instead of overwriting", async () => {
    const existing = await createSupportTicket(
      {
        userId: null,
        email: `a@${DOMAIN}`,
        topic: "Other",
        subject: "Existing ticket",
        message: "Existing ticket message body.",
        projectRef: null,
      },
      () => "CF-00009",
    );
    await expect(
      createSupportTicket(
        {
          userId: null,
          email: `b@${DOMAIN}`,
          topic: "Other",
          subject: "Colliding ticket",
          message: "Colliding ticket message body.",
          projectRef: null,
        },
        () => "CF-00009",
      ),
    ).rejects.toThrow(/unique support ticket code/);
    expect((await loadTicket(existing.code))?.email).toBe(`a@${DOMAIN}`);
    await db.delete(dbSchema.supportTickets).where(eq(dbSchema.supportTickets.code, "CF-00009"));
  });

  describe("retrySupportTicketDeliveries", () => {
    async function seed(attempts: number, ageMs: number, delivered = false) {
      const [row] = await db
        .insert(dbSchema.supportTickets)
        .values({
          code: `CF-${Math.floor(Math.random() * 90000 + 10000)}`,
          email: `retry${attempts}@${DOMAIN}`,
          topic: "Other",
          subject: "Retry me",
          message: "Retry me please, long enough.",
          deliveryAttempts: attempts,
          intakeEmailDeliveredAt: delivered ? new Date() : null,
          createdAt: new Date(Date.now() - ageMs),
        })
        .returning();
      return row!;
    }

    it("delivers eligible tickets, skips delivered, exhausted and not-yet-due ones", async () => {
      renderAndDeliverEmailMock.mockResolvedValue({ delivered: true });
      const due = await seed(1, 10 * 60_000); // backoff 2min, age 10min → due
      const notDue = await seed(3, 2 * 60_000); // backoff 8min, age 2min → wait
      const exhausted = await seed(5, 24 * 3_600_000);
      const done = await seed(0, 3_600_000, true);

      const result = await retrySupportTicketDeliveries(20);
      expect(result).toMatchObject({ claimed: 1, delivered: 1, stillQueued: 0 });
      expect(renderAndDeliverEmailMock).toHaveBeenCalledTimes(1);

      const dueRow = await loadTicket(due.code);
      expect(dueRow?.intakeEmailDeliveredAt).toBeInstanceOf(Date);
      expect(dueRow?.deliveryAttempts).toBe(2);
      expect((await loadTicket(notDue.code))?.deliveryAttempts).toBe(3);
      expect((await loadTicket(exhausted.code))?.deliveryAttempts).toBe(5);
      expect((await loadTicket(done.code))?.deliveryAttempts).toBe(0);
    });

    it("keeps failing tickets queued with an incremented attempt count and stops at 5", async () => {
      renderAndDeliverEmailMock.mockRejectedValue(new Error("provider 500"));
      const ticket = await seed(4, 48 * 3_600_000);
      const result = await retrySupportTicketDeliveries(20);
      expect(result).toMatchObject({ claimed: 1, delivered: 0, stillQueued: 1 });
      const row = await loadTicket(ticket.code);
      expect(row?.deliveryAttempts).toBe(5);
      expect(row?.lastDeliveryError).toMatch(/provider 500/);

      renderAndDeliverEmailMock.mockClear();
      const again = await retrySupportTicketDeliveries(20);
      expect(again.claimed).toBe(0);
      expect(renderAndDeliverEmailMock).not.toHaveBeenCalled();
    });

    it("respects the limit and does not double-claim under concurrent runs", async () => {
      renderAndDeliverEmailMock.mockResolvedValue({ delivered: true });
      for (let i = 0; i < 4; i += 1) await seed(1, 60 * 60_000 + i);
      const [a, b] = await Promise.all([
        retrySupportTicketDeliveries(2),
        retrySupportTicketDeliveries(2),
      ]);
      expect(a.claimed + b.claimed).toBe(4);
      expect(renderAndDeliverEmailMock).toHaveBeenCalledTimes(4);
    });
  });

  it("summarizeDeliveryError redacts and truncates", () => {
    const out = summarizeDeliveryError(new Error(`Bearer abc.def me@x.io ${"y".repeat(600)}`));
    expect(out.length).toBeLessThanOrEqual(300);
    expect(out).not.toContain("me@x.io");
    expect(out).not.toContain("abc.def");
    expect(summarizeDeliveryError({ weird: true })).toBe("Unknown delivery error");
  });
});
