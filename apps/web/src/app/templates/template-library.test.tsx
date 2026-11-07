import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { TemplateLibraryClient } from "./template-library-client";
import { validateTemplateDocument, type TemplateDocument } from "@/lib/template/schema";
import type { PublishedTemplateItem } from "@/lib/template/types";

function loadOrbitDoc(): TemplateDocument {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      const parsed = validateTemplateDocument(JSON.parse(readFileSync(candidate, "utf-8")));
      if (parsed.ok) return parsed.data;
    }
  }
  throw new Error("Failed to load Orbit template fixture");
}

function buildFixtures(): PublishedTemplateItem[] {
  const orbitDoc = loadOrbitDoc();
  return [
    {
      id: "tpl-orbit",
      versionId: "ver-orbit",
      slug: "orbit",
      name: "Orbit",
      type: "mobile",
      tier: "free",
      coverUrl: orbitDoc.template.cover.src,
      categoryName: "Fintech",
      categorySlug: "fintech",
      version: "1.0.0",
      sectionCount: 6,
      slotCount: 5,
      document: orbitDoc,
    },
    {
      id: "tpl-nova",
      versionId: "ver-nova",
      slug: "nova",
      name: "Nova",
      type: "mobile",
      tier: "pro",
      coverUrl: orbitDoc.template.cover.src,
      categoryName: "Fintech",
      categorySlug: "fintech",
      version: "1.0.0",
      sectionCount: 6,
      slotCount: 5,
      document: orbitDoc,
    },
    {
      id: "tpl-atlas",
      versionId: "ver-atlas",
      slug: "atlas",
      name: "Atlas",
      type: "web",
      tier: "pro",
      coverUrl: orbitDoc.template.cover.src,
      categoryName: "SaaS",
      categorySlug: "saas",
      version: "1.2.0",
      sectionCount: 6,
      slotCount: 5,
      document: {
        ...orbitDoc,
        template: { ...orbitDoc.template, name: "Atlas", slug: "atlas", type: "web", tier: "pro" },
      },
    },
  ];
}

const CATEGORIES = [
  { id: "c-fintech", name: "Fintech", slug: "fintech" },
  { id: "c-saas", name: "SaaS", slug: "saas" },
];

describe("TemplateLibraryClient (C-305)", () => {
  it("combines type, category, and tier filters and resets cleanly", () => {
    render(
      <TemplateLibraryClient
        templates={buildFixtures()}
        categories={CATEGORIES}
        userPlan="free"
        isAuthenticated
      />,
    );

    expect(screen.getAllByRole("article")).toHaveLength(3);

    // Filter by Type = Mobile app -> Orbit + Nova (2)
    fireEvent.click(screen.getByRole("button", { name: "Mobile app" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);

    // Combine with Category = Fintech -> still Orbit + Nova (2)
    fireEvent.click(screen.getByRole("button", { name: "Fintech" }));
    expect(screen.getAllByRole("article")).toHaveLength(2);

    // Combine with Tier = Pro -> only Nova (1)
    const tierGroup = screen.getByRole("group", { name: "Filter by plan tier" });
    fireEvent.click(within(tierGroup).getByRole("button", { name: "Pro" }));

    const remaining = screen.getAllByRole("article");
    expect(remaining).toHaveLength(1);
    expect(remaining[0]).toHaveAttribute("data-template-slug", "nova");

    // Reset filters -> back to 3
    fireEvent.click(screen.getByRole("button", { name: /Reset filters/i }));
    expect(screen.getAllByRole("article")).toHaveLength(3);
  });

  it("shows Pro badge and lock state for Free users, unlocks for Pro users, and opens live preview modal", () => {
    const { unmount } = render(
      <TemplateLibraryClient
        templates={buildFixtures()}
        categories={CATEGORIES}
        userPlan="free"
        isAuthenticated
      />,
    );

    const novaCard = document.querySelector('[data-template-slug="nova"]') as HTMLElement;
    const orbitCard = document.querySelector('[data-template-slug="orbit"]') as HTMLElement;

    expect(orbitCard).toHaveAttribute("data-locked", "false");
    expect(novaCard).toHaveAttribute("data-locked", "true");
    expect(within(novaCard).getByText("Pro")).toBeInTheDocument();
    expect(within(novaCard).getByTestId("pro-lock-badge-nova")).toBeInTheDocument();
    expect(within(novaCard).getByRole("link", { name: /Upgrade for Pro/i })).toBeInTheDocument();

    // Open Preview modal on Orbit
    fireEvent.click(within(orbitCard).getByRole("button", { name: /Preview/i }));
    expect(
      screen.getByRole("heading", { name: "Orbit — Banking that moves with you" }),
    ).toBeInTheDocument();

    unmount();

    // Pro user sees Nova unlocked
    render(
      <TemplateLibraryClient
        templates={buildFixtures()}
        categories={CATEGORIES}
        userPlan="pro"
        isAuthenticated
      />,
    );

    const novaProCard = document.querySelector('[data-template-slug="nova"]') as HTMLElement;
    expect(novaProCard).toHaveAttribute("data-locked", "false");
    expect(within(novaProCard).getByRole("link", { name: /Use template/i })).toBeInTheDocument();
  });

  it("renders uploaded /cdn/covers/* and external https:// cover thumbnails on template cards", () => {
    const fixtures = buildFixtures().map((item) =>
      item.slug === "nova"
        ? { ...item, coverUrl: "/cdn/covers/22222222-2222-4222-8222-222222222222.png" }
        : item.slug === "atlas"
          ? { ...item, coverUrl: "https://images.unsplash.com/photo-cover.webp" }
          : item,
    );

    render(
      <TemplateLibraryClient
        templates={fixtures}
        categories={CATEGORIES}
        userPlan="pro"
        isAuthenticated
      />,
    );

    const orbitImg = screen.getByAltText("Orbit cover thumbnail") as HTMLImageElement;
    expect(orbitImg.getAttribute("src")).toBe("/landing/orbit-home.svg");

    const novaImg = screen.getByAltText("Nova cover thumbnail") as HTMLImageElement;
    expect(novaImg.getAttribute("src")).toBe(
      "/cdn/covers/22222222-2222-4222-8222-222222222222.png",
    );

    const atlasImg = screen.getByAltText("Atlas cover thumbnail") as HTMLImageElement;
    expect(atlasImg.getAttribute("src")).toBe("https://images.unsplash.com/photo-cover.webp");
  });
});
