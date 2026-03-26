import { vi, beforeEach } from "vitest";

// Mock Remotion's staticFile for tests
vi.mock("remotion", async () => {
  const actual = await vi.importActual("remotion");
  return {
    ...actual,
    staticFile: (path: string) => `/public/${path}`,
    delayRender: () => Symbol("delay-render-handle"),
    continueRender: () => {},
  };
});

// Mock fetch for WASM loading
global.fetch = vi.fn();

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
});
