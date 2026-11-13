import { ImageResponse } from "next/og";
import { getPublishedProjectBySlug } from "@/lib/projects/publish";
import { CURATED_COLOR_PRESETS } from "@/lib/template/curated-themes";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const alt = "Casefolio Case Study Preview";
export const size = {
  width: 1200,
  height: 630,
};
export const contentType = "image/png";

interface OpenGraphImageProps {
  params: Promise<{ slug: string }>;
}

export default async function OpenGraphImage({ params }: OpenGraphImageProps): Promise<Response> {
  const { slug } = await params;
  const published = await getPublishedProjectBySlug(slug);

  if (!published) {
    return new Response("Not Found", { status: 404 });
  }

  const fallbackColors = CURATED_COLOR_PRESETS[0]!.colors;
  const colors = published.theme.colors;
  const bg = colors.background ?? fallbackColors.background!;
  const surface = colors.surface ?? fallbackColors.surface!;
  const primary = colors.primary ?? fallbackColors.primary!;
  const text = colors.text ?? fallbackColors.text!;
  const textMuted = colors.textMuted ?? fallbackColors.textMuted!;

  const authorName = published.owner.name?.trim() || "Portfolio Case Study";
  const projectTypeLabel =
    published.project.type === "mobile"
      ? "Mobile Case Study"
      : published.project.type === "web"
        ? "Web Case Study"
        : "Product Case Study";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 64,
          backgroundColor: bg,
          color: text,
        }}
      >
        {/* Top pill bar */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
              padding: "10px 20px",
              borderRadius: 999,
              backgroundColor: surface,
              color: primary,
              fontSize: 20,
              fontWeight: 600,
            }}
          >
            <span>{published.meta.eyebrow}</span>
          </div>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 18px",
              borderRadius: 999,
              backgroundColor: surface,
              color: textMuted,
              fontSize: 18,
              fontWeight: 500,
            }}
          >
            <span>{projectTypeLabel}</span>
          </div>
        </div>

        {/* Center headline & subtitle */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 20,
            maxWidth: 980,
          }}
        >
          <div
            style={{
              fontSize: 64,
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: "-0.025em",
              color: text,
            }}
          >
            {published.meta.title}
          </div>
          <div
            style={{
              fontSize: 26,
              lineHeight: 1.4,
              color: textMuted,
            }}
          >
            {published.meta.description}
          </div>
        </div>

        {/* Bottom brand & author footer */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            width: "100%",
            paddingTop: 28,
            borderTop: `2px solid ${surface}`,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 14,
            }}
          >
            {!published.project.whiteLabelEnabled ? (
              <div
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  backgroundColor: primary,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  color: bg,
                  fontSize: 20,
                  fontWeight: 700,
                }}
              >
                C
              </div>
            ) : null}
            <span
              style={{
                fontSize: 22,
                fontWeight: 600,
                color: text,
              }}
            >
              {authorName}
            </span>
          </div>

          <span
            style={{
              fontSize: 20,
              fontWeight: 500,
              color: textMuted,
            }}
          >
            {published.project.whiteLabelEnabled
              ? published.project.customDomain
                ? `${published.project.customDomain}/p/${published.project.slug}`
                : `/p/${published.project.slug}`
              : `casefolio.design/p/${published.project.slug}`}
          </span>
        </div>
      </div>
    ),
    {
      ...size,
    },
  );
}

