import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { ImageSlotFrame } from "@/components/sections/image-slot-frame";
import {
  buildCloudflareImageVariantUrl,
  buildResponsiveImageSrcSet,
  createCasefolioImageLoader,
  isRealCloudflareImagesConfigured,
  RESPONSIVE_CDN_WIDTHS,
} from "@/lib/storage/cloudflare-images";

describe("Cloudflare Images delivery + responsive srcset + next/image loader (C-503)", () => {
  const sampleAssetId = "44444444-4444-4444-8444-444444444444";

  it("constructs Cloudflare Images variant URLs with width, auto format, and exact pixel trim crop params", () => {
    const prodCfConfig = {
      accountHash: "k9LmN8pQrS7tUvWxYz12",
      deliveryOrigin: "https://imagedelivery.net",
      zoneOrigin: "https://casefolio.app",
    };

    expect(isRealCloudflareImagesConfigured(prodCfConfig)).toBe(true);

    // 1200x2400 source image cropped to { x: 180, y: 120, width: 810, height: 1755 }
    // top = 120, right = 1200 - (180 + 810) = 210, bottom = 2400 - (120 + 1755) = 525, left = 180
    const variantUrl = buildCloudflareImageVariantUrl({
      src: `/cdn/images/${sampleAssetId}?nw=1200&nh=2400`,
      assetId: sampleAssetId,
      width: 640,
      quality: 85,
      crop: { x: 180, y: 120, width: 810, height: 1755 },
      naturalDimensions: { width: 1200, height: 2400 },
      config: prodCfConfig,
    });

    expect(variantUrl).toBe(
      `https://imagedelivery.net/k9LmN8pQrS7tUvWxYz12/${sampleAssetId}/w=640,q=85,f=auto,fit=scale-down,trim=120;210;525;180`,
    );

    // External URL via Cloudflare zone /cdn-cgi/image/
    const zoneUrl = buildCloudflareImageVariantUrl({
      src: "https://cdn.casefolio.app/templates/orbit/cover.png",
      width: 1080,
      quality: 80,
      config: prodCfConfig,
    });
    expect(zoneUrl).toBe(
      "https://casefolio.app/cdn-cgi/image/w=1080,q=80,f=auto,fit=scale-down/https://cdn.casefolio.app/templates/orbit/cover.png",
    );
  });

  it("generates responsive srcset widths and next/image loader URLs in local dev CDN mode", () => {
    const localConfig = {
      accountHash: "your-cloudflare-images-account-hash",
      deliveryOrigin: "https://imagedelivery.net",
    };
    expect(isRealCloudflareImagesConfigured(localConfig)).toBe(false);

    const loader = createCasefolioImageLoader({
      assetId: sampleAssetId,
      crop: { x: 45, y: 0, width: 900, height: 1950 },
      naturalDimensions: { width: 990, height: 1950 },
      config: localConfig,
    });

    const loaded640 = loader({
      src: `/cdn/images/${sampleAssetId}?nw=990&nh=1950`,
      width: 640,
      quality: 85,
    });
    expect(loaded640).toBe(
      `/cdn/images/${sampleAssetId}?w=640&q=85&f=auto&nw=990&nh=1950&cx=45&cy=0&cw=900&ch=1950`,
    );

    const srcSet = buildResponsiveImageSrcSet({
      src: `/cdn/images/${sampleAssetId}?nw=990&nh=1950`,
      assetId: sampleAssetId,
      crop: { x: 45, y: 0, width: 900, height: 1950 },
      naturalDimensions: { width: 990, height: 1950 },
      config: localConfig,
    });

    for (const width of RESPONSIVE_CDN_WIDTHS) {
      expect(srcSet).toContain(`w=${width}`);
      expect(srcSet).toContain(`${width}w`);
    }
  });

  it("renders ImageSlotFrame via next/image with CDN URL, mobile sizes hint, and exact crop framing", () => {
    render(
      <ImageSlotFrame
        image={{
          slot: "hero.mockup",
          src: `/cdn/images/${sampleAssetId}?nw=1200&nh=2400`,
          alt: "Orbit wallet home screen",
          assetId: sampleAssetId,
          crop: { x: 150, y: 120, width: 900, height: 1950 },
        }}
        slotDefinition={{
          ratio: "9:19.5",
          minWidth: 390,
          device: "iphone",
        }}
        projectType="mobile"
        preferDeviceChrome
      />,
    );

    const img = screen.getByRole("img", { name: "Orbit wallet home screen" });
    expect(img.getAttribute("src")).toContain(`/cdn/images/${sampleAssetId}`);
    expect(img.getAttribute("srcset")).toContain(`/cdn/images/${sampleAssetId}?w=640`);
    expect(img.getAttribute("srcset")).toContain("cx=150&cy=120&cw=900&ch=1950");
    expect(img.getAttribute("sizes")).toBe("(max-width: 640px) 85vw, 320px");
    expect(img.style.width).toBe("133.3333%");
    expect(img.style.left).toBe("-16.6667%");
  });
});

