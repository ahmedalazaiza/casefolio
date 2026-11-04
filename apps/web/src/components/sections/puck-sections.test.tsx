import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Render, type Config, type Data } from "@puckeditor/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { casefolioPuckConfig, TemplatePuckRenderer } from "@/components/editor/puck-config";
import { validateTemplateDocument, type TemplateDocument } from "@/lib/template/schema";

function resolveOrbitPath(): string {
  for (const candidate of [
    resolve(process.cwd(), "reference/template.example.json"),
    resolve(process.cwd(), "../../reference/template.example.json"),
  ]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return resolve(process.cwd(), "reference/template.example.json");
}

function loadOrbitDocument(): TemplateDocument {
  const parsed = validateTemplateDocument(JSON.parse(readFileSync(resolveOrbitPath(), "utf-8")));
  if (!parsed.ok) {
    throw new Error(`Orbit fixture failed validation: ${JSON.stringify(parsed.issues)}`);
  }
  return parsed.data;
}

describe("Puck section components & TemplatePuckRenderer (C-302)", () => {
  it("renders reference/template.example.json (Orbit) via Puck <Render> with mobile device frames", () => {
    const orbit = loadOrbitDocument();

    const { container } = render(<TemplatePuckRenderer document={orbit} />);

    expect(
      screen.getByRole("heading", { name: "Orbit — Banking that moves with you" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Lead Product Designer")).toBeInTheDocument();
    expect(
      screen.getByText("68% of new users dropped off before making their first deposit."),
    ).toBeInTheDocument();
    expect(screen.getByText("Research")).toBeInTheDocument();
    expect(screen.getByText("Final Screens")).toBeInTheDocument();
    expect(screen.getByText("+42%")).toBeInTheDocument();

    const wrapper = container.querySelector('[data-slot="template-puck-renderer"]');
    expect(wrapper).not.toBeNull();
    expect(wrapper?.getAttribute("style")).toContain(
      `--tpl-color-primary: ${orbit.template.theme.colors.primary}`,
    );
    expect(wrapper?.getAttribute("style")).toContain(
      `--tpl-font-heading: ${orbit.template.theme.fonts.heading.family}`,
    );

    const mobileFrames = container.querySelectorAll('[data-device-frame="mobile"]');
    // 1 hero mockup + 6 gallery screens = 7 mobile device frames
    expect(mobileFrames.length).toBe(7);
  });

  it("renders Web variant with browser window chrome and Quote/CTA/Custom sections", () => {
    const orbit = loadOrbitDocument();
    const webDoc: TemplateDocument = {
      ...orbit,
      template: {
        ...orbit.template,
        type: "web",
        slots: {
          "hero.mockup": { ratio: "16:10", minWidth: 1200, device: "browser" },
          "gallery.screen": { ratio: "16:10", minWidth: 1200, device: "browser" },
        },
      },
      puck: {
        root: { props: { title: "Atlas Web Platform" } },
        content: [
          {
            type: "Hero",
            props: {
              id: "Hero-web",
              eyebrow: "Case Study · Website",
              title: "Atlas — Analytics for modern teams",
              subtitle: "Rebuilding enterprise dashboards.",
              mockup: { slot: "hero.mockup", src: "", alt: "Dashboard view", crop: null },
              background: "background",
              accent: "primary",
            },
          },
          {
            type: "Quote",
            props: {
              id: "Quote-1",
              quote: "Setup time dropped from two weeks to ten minutes.",
              author: "Maya Lin",
              role: "VP of Product",
              background: "surface",
            },
          },
          {
            type: "CTA",
            props: {
              id: "CTA-1",
              heading: "Explore the live prototype",
              subheading: "Interactive walkthrough available.",
              primaryLabel: "Open prototype",
              primaryHref: "https://example.com/prototype",
              background: "background",
              accent: "primary",
            },
          },
          {
            type: "Custom",
            props: {
              id: "Custom-1",
              heading: "Design System Architecture",
              body: {
                type: "doc",
                content: [
                  {
                    type: "paragraph",
                    content: [{ type: "text", text: "Built entirely on semantic CSS tokens." }],
                  },
                ],
              },
              background: "surface",
            },
          },
          {
            type: "Results",
            props: {
              id: "Results-hidden",
              hidden: true,
              heading: "Hidden Results Section",
              metrics: [{ value: "99%", label: "Uptime" }],
              background: "primary",
            },
          },
        ],
        zones: {},
      },
    };

    const { container } = render(
      <Render
        config={casefolioPuckConfig as unknown as Config}
        data={webDoc.puck as unknown as Data}
        metadata={{ projectType: "web", slots: webDoc.template.slots }}
      />,
    );

    expect(
      screen.getByRole("heading", { name: "Atlas — Analytics for modern teams" }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Setup time dropped from two weeks to ten minutes/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Open prototype" })).toHaveAttribute(
      "href",
      "https://example.com/prototype",
    );
    expect(screen.getByText("Built entirely on semantic CSS tokens.")).toBeInTheDocument();
    expect(screen.queryByText("Hidden Results Section")).toBeNull();

    const heroEl = container.querySelector('[data-section-type="Hero"]');
    expect(heroEl?.getAttribute("data-variant")).toBe("web");
    expect(container.querySelectorAll('[data-device-frame="web"]').length).toBe(1);
  });
});
