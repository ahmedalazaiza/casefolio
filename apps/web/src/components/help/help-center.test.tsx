import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ContactSupportClient } from "./contact-support-client";
import { HelpArticleView } from "./help-article-view";
import { HelpCenterClient } from "./help-center-client";
import type { HelpArticle } from "@/lib/help/search";

const SAMPLE_ARTICLES: HelpArticle[] = [
  {
    slug: "getting-started",
    title: "Getting started",
    summary: "Create a project, pick a template and fill slots.",
    category: "Fundamentals",
    order: 1,
    updatedAt: "2026-04-15",
    keywords: ["wizard", "quickstart"],
    searchableText: "Create your first case study and fill screenshot slots.",
    blocks: [
      { type: "heading", level: 2, text: "Create your first case study" },
      {
        type: "paragraph",
        text: "Open **Projects** and pick `Orbit` to get started.",
      },
      {
        type: "callout",
        tone: "tip",
        text: "Free plan includes up to 2 projects.",
      },
    ],
  },
  {
    slug: "exports",
    title: "Exports",
    summary: "PNG, PDF and ZIP formats and expiry.",
    category: "Exports",
    order: 2,
    updatedAt: "2026-04-15",
    keywords: ["pdf", "layerat"],
    searchableText: "Export high-DPI PNG and paged A4 PDF documents.",
    blocks: [],
  },
];

describe("Help Center & Support UI (C-1003 · Figma 2:9899 / 2:10019 / 2:10147)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders help articles, filters instantaneously by search query, and clears search", async () => {
    const user = userEvent.setup();
    render(<HelpCenterClient articles={SAMPLE_ARTICLES} />);

    expect(
      screen.getByRole("heading", { level: 1, name: "How can we help?" }),
    ).toBeInTheDocument();
    const firstTitle = screen.getByRole("heading", { level: 2, name: "Getting started" });
    expect(firstTitle).toBeInTheDocument();
    expect(firstTitle.className).toContain("group-hover:text-[var(--cf-lp-ink)]");
    expect(firstTitle.className).not.toContain("group-hover:text-[var(--cf-royal)]");
    expect(screen.getByText("Exports")).toBeInTheDocument();

    const searchInput = screen.getByRole("searchbox", {
      name: "Search help articles",
    });
    await user.type(searchInput, "A4 PDF");

    expect(screen.getByText("Exports")).toBeInTheDocument();
    expect(screen.queryByText("Getting started")).not.toBeInTheDocument();

    await user.clear(searchInput);
    await user.type(searchInput, "unmatched-topic-999");
    expect(
      screen.getByText(/No articles match “unmatched-topic-999”/i),
    ).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Clear search" }));
    expect(screen.getByText("Getting started")).toBeInTheDocument();
  });

  it("renders parsed MDX headings, inline formatting, and Callout blocks", () => {
    const first = SAMPLE_ARTICLES[0]!;
    render(
      <HelpArticleView
        article={first}
        relatedArticles={SAMPLE_ARTICLES.slice(1)}
      />,
    );

    expect(
      screen.getByRole("heading", { level: 1, name: "Getting started" }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("heading", {
        level: 2,
        name: "Create your first case study",
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("Free plan includes up to 2 projects."),
    ).toBeInTheDocument();
  });

  it("submits the Contact support form and displays Ticket confirmation (Figma 2:10147)", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          ticketCode: "CF-48291",
          replyToEmail: "ahmed@example.com",
          delivery: "sent",
          expectedResponse: "within 1 business day",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(
      <ContactSupportClient
        defaultEmail="ahmed@example.com"
        projects={[{ id: "p1", title: "Mosaed — Debt app" }]}
      />,
    );

    await user.type(
      screen.getByLabelText("Subject"),
      "PDF export stuck on processing",
    );
    await user.type(
      screen.getByLabelText("Message"),
      "My A4 PDF export has been processing for 20 minutes...",
    );

    await user.click(screen.getByRole("button", { name: /Send message/i }));

    expect(
      await screen.findByRole("heading", { name: "Message sent" }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Ticket #CF-48291/i)).toBeInTheDocument();
    expect(screen.getByText("ahmed@example.com")).toBeInTheDocument();
  });

  it("tells the truth when the ticket was saved but email delivery is queued", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({
          ok: true,
          ticketCode: "CF-11111",
          replyToEmail: "ahmed@example.com",
          delivery: "queued",
          expectedResponse: "within 1 business day",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      ),
    );

    render(<ContactSupportClient defaultEmail="ahmed@example.com" />);
    await user.type(screen.getByLabelText("Subject"), "Cannot publish my page");
    await user.type(screen.getByLabelText("Message"), "Publishing fails with an unknown error.");
    await user.click(screen.getByRole("button", { name: /Send message/i }));

    expect(await screen.findByRole("heading", { name: "Request saved" })).toBeInTheDocument();
    expect(screen.queryByRole("heading", { name: "Message sent" })).not.toBeInTheDocument();
    expect(screen.getByText(/We saved your request and will follow up/i)).toBeInTheDocument();
    expect(screen.getByText(/Ticket #CF-11111/)).toBeInTheDocument();
    expect(screen.getByTestId("support-message-sent")).toHaveAttribute("aria-live", "polite");
    expect(screen.getByText(/within 1 business day/)).toBeInTheDocument();
  });

  it("shows the server error and keeps the form when the request is rejected", async () => {
    const user = userEvent.setup();
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(JSON.stringify({ ok: false, error: "Too many support requests." }), {
        status: 429,
        headers: { "Content-Type": "application/json" },
      }),
    );

    render(<ContactSupportClient defaultEmail="ahmed@example.com" />);
    await user.type(screen.getByLabelText("Subject"), "Cannot publish my page");
    await user.type(screen.getByLabelText("Message"), "Publishing fails with an unknown error.");
    await user.click(screen.getByRole("button", { name: /Send message/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Too many support requests.");
    expect(screen.getByLabelText("Subject")).toHaveValue("Cannot publish my page");
  });
});
