import { describe, expect, it } from "vitest";
import {
  buildZipArchive,
  computeBehanceSliceRanges,
  getWorkerHealth,
  listZipEntryNames,
  signExportRenderToken,
  verifyExportRenderToken,
  WORKER_SERVICE_NAME,
} from "./index";

describe("casefolio-export-worker (C-602)", () => {
  it("reports ready health state", () => {
    expect(getWorkerHealth()).toEqual({
      service: WORKER_SERVICE_NAME,
      status: "ready",
    });
  });

  it("signs and verifies short-lived HMAC export render tokens", () => {
    const secret = "unit-test-export-signing-secret-32chars";
    const nowMs = 1_750_000_000_000;
    const token = signExportRenderToken(
      {
        exportId: "11111111-1111-4111-8111-111111111111",
        projectId: "22222222-2222-4222-8222-222222222222",
        ttlMs: 60_000,
        nowMs,
      },
      secret,
    );

    const valid = verifyExportRenderToken(token, {
      expectedExportId: "11111111-1111-4111-8111-111111111111",
      secret,
      nowMs: nowMs + 30_000,
    });
    expect(valid).toEqual({
      kind: "export-render",
      exportId: "11111111-1111-4111-8111-111111111111",
      projectId: "22222222-2222-4222-8222-222222222222",
      exp: nowMs + 60_000,
    });

    // Expired token rejected
    expect(
      verifyExportRenderToken(token, {
        expectedExportId: "11111111-1111-4111-8111-111111111111",
        secret,
        nowMs: nowMs + 60_001,
      }),
    ).toBeNull();

    // Mismatched exportId rejected
    expect(
      verifyExportRenderToken(token, {
        expectedExportId: "99999999-9999-4999-8999-999999999999",
        secret,
        nowMs,
      }),
    ).toBeNull();

    // Tampered signature rejected
    expect(
      verifyExportRenderToken(`${token}tamper`, {
        secret,
        nowMs,
      }),
    ).toBeNull();
  });

  it("slices Behance heights at 1960px intervals and packs valid PKZIP archives", () => {
    const slices = computeBehanceSliceRanges(4200, 1960);
    expect(slices).toEqual([
      { y: 0, height: 1960 },
      { y: 1960, height: 1960 },
      { y: 3920, height: 280 },
    ]);

    const fakePng = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
    const zipBytes = buildZipArchive([
      { name: "behance-slice-01.png", data: fakePng },
      { name: "behance-slice-02.png", data: fakePng },
      { name: "behance-slice-03.png", data: fakePng },
    ]);

    // PKZIP local file header magic bytes (0x04034b50 -> 50 4b 03 04)
    expect(Array.from(zipBytes.slice(0, 4))).toEqual([0x50, 0x4b, 0x03, 0x04]);
    expect(listZipEntryNames(zipBytes)).toEqual([
      "behance-slice-01.png",
      "behance-slice-02.png",
      "behance-slice-03.png",
    ]);
  });
});
