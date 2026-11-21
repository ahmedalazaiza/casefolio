import { existsSync } from "node:fs";
import { resolve } from "node:path";
import "@testing-library/jest-dom/vitest";
import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";

const rootEnv = resolve(process.cwd(), ".env");
const exampleEnv = resolve(process.cwd(), ".env.example");
if (!process.env.DATABASE_URL) {
  if (existsSync(rootEnv)) {
    process.loadEnvFile(rootEnv);
  } else if (existsSync(exampleEnv)) {
    process.loadEnvFile(exampleEnv);
  }
}

// The signed local billing simulator needs an explicit opt-in and placeholder token/key in Vitest
// even when the developer's local .env contains real Paddle Sandbox/Live credentials.
process.env.PADDLE_ENV = "sandbox";
process.env.ALLOW_SIMULATED_BILLING = "1";
process.env.NEXT_PUBLIC_PADDLE_CLIENT_TOKEN = "test_your_paddle_client_token";
process.env.PADDLE_API_KEY = "pdl_sdbx_apikey_your_key";

afterEach(() => {
  cleanup();
});

if (typeof window !== "undefined") {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });

  class ResizeObserverMock {
    observe() {}
    unobserve() {}
    disconnect() {}
  }

  window.ResizeObserver = ResizeObserverMock;

  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => {};
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => {};
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => {};
  }
}
