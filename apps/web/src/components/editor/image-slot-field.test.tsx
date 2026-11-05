import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ImageSlotField } from "@/components/editor/image-slot-field";
import type { ImageSlotValue, TemplateSlotDefinition } from "@/lib/template/schema";

function createTestPngBytes(width: number, height: number): Uint8Array {
  const signature = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

  function makeChunk(type: string, data: Uint8Array): Uint8Array {
    const out = new Uint8Array(12 + data.length);
    const view = new DataView(out.buffer);
    view.setUint32(0, data.length, false);
    for (let i = 0; i < 4; i += 1) {
      out[4 + i] = type.charCodeAt(i);
    }
    out.set(data, 8);
    view.setUint32(8 + data.length, 0x11223344, false);
    return out;
  }

  const ihdrData = new Uint8Array(13);
  const ihdrView = new DataView(ihdrData.buffer);
  ihdrView.setUint32(0, width, false);
  ihdrView.setUint32(4, height, false);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 2; // color type RGB

  const ihdr = makeChunk("IHDR", ihdrData);
  const idat = makeChunk(
    "IDAT",
    new Uint8Array([0x78, 0x9c, 0x63, 0x60, 0x00, 0x00, 0x00, 0x02, 0x00, 0x01]),
  );
  const iend = makeChunk("IEND", new Uint8Array(0));

  const total = signature.length + ihdr.length + idat.length + iend.length;
  const combined = new Uint8Array(total);
  let cursor = 0;
  for (const part of [signature, ihdr, idat, iend]) {
    combined.set(part, cursor);
    cursor += part.length;
  }
  return combined;
}

function StatefulSlotHarness({
  slotKey,
  label,
  slotDefinition,
  initialValue,
  onValueUpdated,
}: {
  slotKey: string;
  label: string;
  slotDefinition: TemplateSlotDefinition;
  initialValue?: ImageSlotValue;
  onValueUpdated?: (val: ImageSlotValue) => void;
}) {
  const [value, setValue] = useState<ImageSlotValue | undefined>(initialValue);
  return (
    <ImageSlotField
      slotKey={slotKey}
      label={label}
      slotDefinition={slotDefinition}
      projectId="11111111-1111-4111-8111-111111111111"
      value={value}
      onChange={(next) => {
        setValue(next);
        onValueUpdated?.(next);
      }}
      putTransport={async ({ onProgress }) => {
        onProgress?.(64);
        onProgress?.(100);
      }}
    />
  );
}

describe("ImageSlotField with react-easy-crop (C-502)", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("locks crop aspect ratio strictly to template.slots[slotKey].ratio (9:19.5 for hero.mockup) and persists crop", async () => {
    const assetId = "22222222-2222-4222-8222-222222222222";
    const patchCalls: Array<{ url: string; body: unknown }> = [];

    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
      const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      if (url === "/api/uploads/presign") {
        return new Response(
          JSON.stringify({
            ok: true,
            assetId,
            r2Key: `projects/proj/slots/hero.mockup/${assetId}.png`,
            slot: "hero.mockup",
            mode: "local",
            uploadUrl: "/api/uploads/local-put?token=signed",
            uploadMethod: "PUT",
            uploadHeaders: { "Content-Type": "image/png" },
            completeToken: "complete-token-12345678901234567890",
            expiresInSeconds: 300,
            maxFileBytes: 5 * 1024 * 1024,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url === "/api/uploads/complete") {
        return new Response(
          JSON.stringify({
            ok: true,
            asset: {
              id: assetId,
              projectId: "11111111-1111-4111-8111-111111111111",
              r2Key: `projects/proj/slots/hero.mockup/${assetId}.png`,
              slot: "hero.mockup",
              crop: { x: 350, y: 0, width: 900, height: 1950 },
              width: 1600,
              height: 1950,
              bytes: 1200,
              mimeType: "image/png",
              deliveryUrl: `/api/assets/${assetId}?nw=1600&nh=1950`,
            },
          }),
          { status: 201, headers: { "Content-Type": "application/json" } },
        );
      }

      if (url.startsWith("/api/assets/") && init?.method === "PATCH") {
        patchCalls.push({
          url,
          body: JSON.parse(String(init.body)),
        });
        return new Response(JSON.stringify({ ok: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        });
      }

      throw new Error(`Unexpected fetch URL: ${url}`);
    });

    const updates: ImageSlotValue[] = [];

    render(
      <StatefulSlotHarness
        slotKey="hero.mockup"
        label="Hero mockup slot"
        slotDefinition={{ ratio: "9:19.5", minWidth: 390, device: "iphone" }}
        onValueUpdated={(val) => updates.push(val)}
      />,
    );

    const fileInput = screen.getByTestId("slot-file-input-hero.mockup");
    // 1600x1950 wide PNG -> centered 9:19.5 crop should be { x: 350, y: 0, width: 900, height: 1950 }
    const pngBytes = createTestPngBytes(1600, 1950);
    const pngFile = new File([pngBytes.slice().buffer], "home-screen.png", {
      type: "image/png",
    });

    fireEvent.change(fileInput, { target: { files: [pngFile] } });

    const cropDialog = await screen.findByTestId("image-slot-crop-dialog");
    expect(cropDialog).toHaveAttribute("data-locked-ratio", "9:19.5");
    expect(Number(cropDialog.getAttribute("data-locked-aspect"))).toBeCloseTo(9 / 19.5, 6);
    expect(screen.getByText(/Locked ratio · 9:19\.5/)).toBeInTheDocument();

    const parsedCropAttr = JSON.parse(cropDialog.getAttribute("data-crop-rect") || "{}");
    expect(parsedCropAttr).toEqual({ x: 350, y: 0, width: 900, height: 1950 });
    expect(parsedCropAttr.width / parsedCropAttr.height).toBeCloseTo(9 / 19.5, 4);

    fireEvent.click(screen.getByTestId("crop-dialog-apply"));

    await waitFor(() => {
      expect(screen.queryByTestId("image-slot-crop-dialog")).toBeNull();
    });

    const latest = updates.at(-1);
    expect(latest).toBeDefined();
    expect(latest?.slot).toBe("hero.mockup");
    expect(latest?.assetId).toBe(assetId);
    expect(latest?.crop).toEqual({ x: 350, y: 0, width: 900, height: 1950 });
    expect(patchCalls).toHaveLength(1);
    expect(patchCalls[0]?.body).toEqual({
      crop: { x: 350, y: 0, width: 900, height: 1950 },
    });
    expect(fetchMock).toHaveBeenCalled();
  });

  it("restores persisted crop rectangle when re-opening crop modal, supports Reset crop, Remove, and rejects unsupported .heic files", async () => {
    const assetId = "33333333-3333-4333-8333-333333333333";
    vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ ok: true }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const savedCrop = { x: 180, y: 120, width: 810, height: 1755 };
    let latestValue: ImageSlotValue | undefined;

    render(
      <StatefulSlotHarness
        slotKey="hero.mockup"
        label="Hero mockup slot"
        slotDefinition={{ ratio: "9:19.5", minWidth: 390, device: "iphone" }}
        initialValue={{
          slot: "hero.mockup",
          src: `/api/assets/${assetId}?nw=1200&nh=2400`,
          alt: "Saved wallet screen",
          assetId,
          crop: savedCrop,
        }}
        onValueUpdated={(val) => {
          latestValue = val;
        }}
      />,
    );

    // 1. Re-open crop modal -> restores exact saved crop
    fireEvent.click(screen.getByTestId("slot-crop-btn-hero.mockup"));

    const cropDialog = await screen.findByTestId("image-slot-crop-dialog");
    expect(JSON.parse(cropDialog.getAttribute("data-crop-rect") || "{}")).toEqual(savedCrop);

    // 2. Click Reset crop -> re-centers 1200x2400 to locked 9:19.5 ({ x: 46, y: 0, width: 1108, height: 2400 })
    fireEvent.click(screen.getByTestId("crop-dialog-reset"));
    const resetCrop = JSON.parse(cropDialog.getAttribute("data-crop-rect") || "{}");
    expect(resetCrop).toEqual({ x: 46, y: 0, width: 1108, height: 2400 });
    expect(resetCrop.width / resetCrop.height).toBeCloseTo(9 / 19.5, 3);

    fireEvent.click(screen.getByTestId("crop-dialog-apply"));
    await waitFor(() => {
      expect(latestValue?.crop).toEqual({ x: 46, y: 0, width: 1108, height: 2400 });
    });

    // 3. Reject unsupported .heic file with clear Figma-aligned message without wiping existing image
    const fileInput = screen.getByTestId("slot-file-input-hero.mockup");
    const heicFile = new File([new Uint8Array([1, 2, 3, 4])], "settings.heic", {
      type: "image/heic",
    });
    fireEvent.change(fileInput, { target: { files: [heicFile] } });

    const errorBanner = await screen.findByTestId("slot-error-hero.mockup");
    expect(errorBanner).toHaveTextContent('"settings.heic" isn\'t a supported file type');
    expect(screen.getByTestId("slot-filled-preview-hero.mockup")).toBeInTheDocument();

    // 4. Remove clears src, assetId, and crop cleanly
    fireEvent.click(screen.getByTestId("slot-remove-btn-hero.mockup"));
    expect(latestValue).toEqual({
      slot: "hero.mockup",
      src: "",
      alt: "Saved wallet screen",
      assetId: null,
      crop: null,
    });
    expect(screen.getByTestId("slot-dropzone-hero.mockup")).toBeInTheDocument();
  });
});
