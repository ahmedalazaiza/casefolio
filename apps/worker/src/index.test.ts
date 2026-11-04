import { describe, expect, it } from "vitest";
import { getWorkerHealth, WORKER_SERVICE_NAME } from "./index";

describe("worker bootstrap", () => {
  it("reports ready health state", () => {
    expect(getWorkerHealth()).toEqual({
      service: WORKER_SERVICE_NAME,
      status: "ready",
    });
  });
});
