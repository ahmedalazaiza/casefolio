import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { Render, type Config, type Data } from "@puckeditor/core";
import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { casefolioPuckConfig, TemplatePuckRenderer } from "@/components/editor/puck-config";
import { validateTemplateDocument, type TemplateDocument } from "@/lib/template/schema";

function resolveReferencePath(fileName: string): string {
  for (const candidate of [
    resolve(process.cwd(), `reference/${fileName}`),
    resolve(process.cwd(), `../../reference/${fileName}`),
  ]) {
    if (existsSync(candidate)) {
      return candidate;
    }
  }
  return resolve(process.cwd(), `reference/${fileName}`);
}

function loadOrbitDocument(): TemplateDocument {
  const parsed = validateTemplateDocument(
    JSON.parse(readFileSync(resolveReferencePath("template.example.json"), "utf-8")),
  );
  if (!parsed.ok) {
    throw new Error(`Orbit fixture failed validation: ${JSON.stringify(parsed.issues)}`);
  }
  return parsed.data;
}

function loadCinemaDocument(): TemplateDocument {
  const parsed = validateTemplateDocument(
    JSON.parse(readFileSync(resolveReferencePath("template.cinema.json"), "utf-8")),
  );
  if (!parsed.ok) {
    throw new Error(`Cinema fixture failed validation: ${JSON.stringify(parsed.issues)}`);
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

  it("renders reference/template.cinema.json (.Cinema) with angled iPhone Pro, plain wireframes, design-system swatches, and MacBook/Tablet overrides", () => {
    const cinema = loadCinemaDocument();
    const { container } = render(<TemplatePuckRenderer document={cinema} />);

    expect(screen.getByRole("heading", { level: 1, name: ".Cinema" })).toBeInTheDocument();
    expect(screen.getByText("We fixed it.")).toBeInTheDocument();
    expect(screen.getByText("How cinema apps compare")).toBeInTheDocument();
    expect(screen.getByText("Eight-step ticket booking journey")).toBeInTheDocument();
    expect(screen.getByText("Interactive auditorium seat map")).toBeInTheDocument();
    expect(screen.getByText("+47%")).toBeInTheDocument();
    // Design system section reads live hex values from theme.colors
    expect(screen.getByText("#E50914")).toBeInTheDocument();
    expect(screen.getByText("#0A0A0C")).toBeInTheDocument();

    // 1 Hero iPhone + 10 Final UI iPhones + 1 Feature Spotlight iPhone = 12 iPhone Pro models
    expect(container.querySelectorAll('[data-device-model="iphone"]').length).toBe(12);
    // 1 Hero logo + 5 Wireframe screens = 6 plain frames
    expect(container.querySelectorAll('[data-device-model="plain"]').length).toBe(6);

    // Per-slot device override to macbook & tablet renders corresponding hardware frames
    const hybridCinema = structuredClone(cinema);
    const hero = hybridCinema.puck.content[0];
    if (hero?.type === "Hero" && hero.props.mockup) {
      hero.props.mockup.device = "macbook";
    }
    const { container: hybridContainer } = render(<TemplatePuckRenderer document={hybridCinema} />);
    expect(hybridContainer.querySelectorAll('[data-device-model="macbook"]').length).toBe(1);
  });

  it("renders Figma Case Study Set v1 templates (Northwind, Pulse, Atlas) end-to-end and supports Pulse Web View (1440px) & Mobile View (390px)", () => {
    for (const [fileName, expectedTitle] of [
      ["template.northwind.json", "Northwind: turning freight chaos into a calm control room"],
      ["template.pulse.json", "Pulse: a fitness coach that fits into your day"],
      ["template.atlas.json", "Atlas: plan on your laptop, live it on your phone"],
    ] as const) {
      const parsed = validateTemplateDocument(
        JSON.parse(readFileSync(resolveReferencePath(fileName), "utf-8")),
      );
      expect(parsed.ok).toBe(true);
      if (!parsed.ok) continue;

      const { unmount } = render(<TemplatePuckRenderer document={parsed.data} />);
      expect(screen.getByRole("heading", { level: 1, name: expectedTitle })).toBeInTheDocument();
      unmount();
    }

    const pulseParsed = validateTemplateDocument(
      JSON.parse(readFileSync(resolveReferencePath("template.pulse.json"), "utf-8")),
    );
    expect(pulseParsed.ok).toBe(true);
    if (!pulseParsed.ok) return;

    const { container: mobileContainer, unmount: unmountMobile } = render(
      <TemplatePuckRenderer document={pulseParsed.data} viewport="mobile" />,
    );
    expect(
      mobileContainer
        .querySelector('[data-slot="template-puck-renderer"]')
        ?.getAttribute("data-viewport"),
    ).toBe("mobile");
    expect(mobileContainer.querySelector('[data-slot="hero-mockup-stage"]')).not.toBeNull();
    // 1 hero iPhone + 8 gallery iPhones = 9 mobile device frames
    expect(mobileContainer.querySelectorAll('[data-device-frame="mobile"]').length).toBe(9);
    unmountMobile();

    const northwindParsed = validateTemplateDocument(
      JSON.parse(readFileSync(resolveReferencePath("template.northwind.json"), "utf-8")),
    );
    expect(northwindParsed.ok).toBe(true);
    if (!northwindParsed.ok) return;

    const { container: northwindContainer, unmount: unmountNorthwind } = render(
      <TemplatePuckRenderer document={northwindParsed.data} viewport="mobile" />,
    );
    // 1 hero browser + 4 gallery browsers = 5 browser frames
    expect(northwindContainer.querySelectorAll('[data-device-model="browser"]').length).toBe(5);
    // 1 logo + 1 overview banner + 4 process step images + 1 quote avatar = 7 plain frames
    expect(northwindContainer.querySelectorAll('[data-device-model="plain"]').length).toBe(7);
    unmountNorthwind();

    const atlasParsed = validateTemplateDocument(
      JSON.parse(readFileSync(resolveReferencePath("template.atlas.json"), "utf-8")),
    );
    expect(atlasParsed.ok).toBe(true);
    if (!atlasParsed.ok) return;

    const { container: atlasContainer, unmount: unmountAtlas } = render(
      <TemplatePuckRenderer document={atlasParsed.data} viewport="mobile" />,
    );
    // 1 hero browser + 4 web gallery browsers = 5 browser frames
    expect(atlasContainer.querySelectorAll('[data-device-model="browser"]').length).toBe(5);
    // 4 mobile gallery iPhones + 1 custom cross-platform iPhone = 5 iPhone frames
    expect(atlasContainer.querySelectorAll('[data-device-model="iphone"]').length).toBe(5);
    expect(atlasContainer.querySelector('[data-slot="custom-mockup-stage"]')).not.toBeNull();
    unmountAtlas();
  });
});
