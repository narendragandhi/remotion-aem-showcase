import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import mockData from "../mock/aem.json";
import {
  mapAemItemToSpotlight,
  getDynamicRenditionUrl,
  resolveAssetUrl,
  validateMockData,
  fetchAemSpotlight,
} from "./aemClient";
import { AemGraphQLItem } from "./schema";

describe("mapAemItemToSpotlight", () => {
  it("maps a single scene correctly with all fields", () => {
    const item: AemGraphQLItem = {
      _path: "/content/dam/example/spotlight",
      title: "Spotlight",
      subtitle: "DDP Launch",
      cta: "Open",
      brandColor: "#FF6600",
      image: { _publishUrl: "https://example.com/hero.png" },
      durationSeconds: 8,
      animationStyle: "cinematic",
      renditionType: "optimized",
      effectType: "glitch",
      effectIntensity: 0.7,
      lottieUrl: "https://example.com/anim.json",
      svgOverlayUrl: "https://example.com/overlay.svg",
    };

    const result = mapAemItemToSpotlight(item);

    expect(result.id).toBe("/content/dam/example/spotlight");
    expect(result.scenes).toHaveLength(1);
    expect(result.scenes[0]).toEqual({
      title: "Spotlight",
      subtitle: "DDP Launch",
      cta: "Open",
      brandColor: "#FF6600",
      imageUrl: "https://example.com/hero.png",
      durationSeconds: 8,
      animationStyle: "cinematic",
      renditionType: "optimized",
      effectType: "glitch",
      effectIntensity: 0.7,
      lottieUrl: "https://example.com/anim.json",
      svgOverlayUrl: "https://example.com/overlay.svg",
    });
  });

  it("applies defaults for missing fields", () => {
    const item: AemGraphQLItem = {
      _path: "/content/dam/example/spotlight",
    };

    const result = mapAemItemToSpotlight(item);

    expect(result.id).toBe("/content/dam/example/spotlight");
    expect(result.scenes[0]).toMatchObject({
      title: "Untitled",
      subtitle: "",
      cta: "Learn more",
      brandColor: "#0E3B5A",
      animationStyle: "minimal",
      renditionType: "optimized",
      effectType: "none",
      effectIntensity: 0.5,
      lottieUrl: "",
      svgOverlayUrl: "",
    });
  });

  it("handles nested items (container fragment)", () => {
    const item: AemGraphQLItem = {
      _path: "/content/dam/container",
      items: [
        {
          title: "Scene 1",
          image: { _publishUrl: "https://example.com/1.png" },
          durationSeconds: 5,
        },
        {
          title: "Scene 2",
          image: { _publishUrl: "https://example.com/2.png" },
          durationSeconds: 3,
        },
      ],
    };

    const result = mapAemItemToSpotlight(item);

    expect(result.id).toBe("/content/dam/container");
    expect(result.scenes).toHaveLength(2);
    expect(result.scenes[0].title).toBe("Scene 1");
    expect(result.scenes[1].title).toBe("Scene 2");
  });

  it("clamps effectIntensity to valid range", () => {
    const item: AemGraphQLItem = {
      _path: "/content/dam/test",
      effectIntensity: 2.5, // Out of range
      image: { _publishUrl: "https://example.com/test.png" },
    };

    const result = mapAemItemToSpotlight(item);

    expect(result.scenes[0].effectIntensity).toBe(1); // Clamped to max
  });

  it("handles author URL fallback", () => {
    const item: AemGraphQLItem = {
      _path: "/content/dam/test",
      image: { _authorUrl: "https://author.example.com/hero.png" },
    };

    const result = mapAemItemToSpotlight(item);

    expect(result.scenes[0].imageUrl).toBe("https://author.example.com/hero.png");
  });

  it("handles image path with base URL resolution", () => {
    const originalEnv = process.env.AEM_BASE_URL;
    process.env.AEM_BASE_URL = "https://publish.example.com";

    const item: AemGraphQLItem = {
      _path: "/content/dam/test",
      image: { _path: "/content/dam/images/hero.png" },
    };

    const result = mapAemItemToSpotlight(item);

    expect(result.scenes[0].imageUrl).toBe(
      "https://publish.example.com/content/dam/images/hero.png"
    );

    process.env.AEM_BASE_URL = originalEnv;
  });
});

describe("getDynamicRenditionUrl", () => {
  it("handles Unsplash URLs correctly", () => {
    const url = "https://images.unsplash.com/photo-123?auto=format";
    const result = getDynamicRenditionUrl(url, 1280, 720, "web");

    expect(result).toBe(
      "https://images.unsplash.com/photo-123?auto=format&fit=crop&q=60&w=1280&h=720"
    );
  });

  it("applies optimized quality for Unsplash", () => {
    const url = "https://images.unsplash.com/photo-123";
    const result = getDynamicRenditionUrl(url, 800, 600, "optimized");

    expect(result).toContain("q=80");
  });

  it("applies original quality for Unsplash", () => {
    const url = "https://images.unsplash.com/photo-123";
    const result = getDynamicRenditionUrl(url, 800, 600, "original");

    expect(result).toContain("q=100");
  });

  it("handles AEM URLs with web-optimized params", () => {
    const url = "https://publish.example.com/content/dam/hero.jpg";
    const result = getDynamicRenditionUrl(url, 1920, 1080, "web");

    expect(result).toContain("width=1920");
    expect(result).toContain("height=1080");
    expect(result).toContain("quality=70");
    expect(result).toContain("preferwebp=true");
  });

  it("returns empty string for empty URL", () => {
    const result = getDynamicRenditionUrl("", 100, 100, "web");
    expect(result).toBe("");
  });

  it("handles relative paths with env base URL", () => {
    const originalEnv = process.env.AEM_BASE_URL;
    process.env.AEM_BASE_URL = "https://publish.example.com";

    const result = getDynamicRenditionUrl("/content/dam/hero.jpg", 800, 600, "optimized");

    expect(result).toContain("https://publish.example.com");
    expect(result).toContain("quality=85");

    process.env.AEM_BASE_URL = originalEnv;
  });
});

describe("resolveAssetUrl", () => {
  const originalEnv = process.env.AEM_BASE_URL;

  afterEach(() => {
    process.env.AEM_BASE_URL = originalEnv;
  });

  it("returns absolute URLs unchanged", () => {
    const url = "https://example.com/image.png";
    expect(resolveAssetUrl(url)).toBe(url);
  });

  it("returns http URLs unchanged", () => {
    const url = "http://example.com/image.png";
    expect(resolveAssetUrl(url)).toBe(url);
  });

  it("prepends base URL for relative paths", () => {
    process.env.AEM_BASE_URL = "https://publish.example.com";
    expect(resolveAssetUrl("/content/dam/image.png")).toBe(
      "https://publish.example.com/content/dam/image.png"
    );
  });

  it("uses config base URL over env var", () => {
    process.env.AEM_BASE_URL = "https://env.example.com";
    const config = { baseUrl: "https://config.example.com" };
    expect(resolveAssetUrl("/content/dam/image.png", config)).toBe(
      "https://config.example.com/content/dam/image.png"
    );
  });

  it("returns empty string for undefined", () => {
    expect(resolveAssetUrl(undefined)).toBe("");
  });

  it("returns empty string for empty string", () => {
    expect(resolveAssetUrl("")).toBe("");
  });
});

describe("validateMockData", () => {
  it("validates the mock data structure", () => {
    const result = validateMockData();
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });
});

describe("fetchAemSpotlight", () => {
  const originalFetch = global.fetch;
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.USE_MOCK_AEM = "true";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    process.env = { ...originalEnv };
  });

  it("returns mock data when USE_MOCK_AEM is true", async () => {
    const result = await fetchAemSpotlight();

    // Mock data goes through mapAemItemToSpotlight which uses _path or "cf-unknown"
    expect(result.scenes).toHaveLength(mockData.scenes.length);
    expect(result.scenes[0].title).toBe(mockData.scenes[0].title);
  });

  it("returns mock data when no base URL configured", async () => {
    process.env.USE_MOCK_AEM = "false";
    process.env.AEM_BASE_URL = "";

    const result = await fetchAemSpotlight();

    expect(result.scenes).toHaveLength(mockData.scenes.length);
  });

  it("makes GraphQL request when configured", async () => {
    process.env.USE_MOCK_AEM = "false";
    process.env.AEM_BASE_URL = "https://test.adobeaemcloud.com";
    process.env.AEM_TOKEN = "test-token";

    const mockResponse = {
      data: {
        contentFragmentByPath: {
          item: {
            _path: "/test/path",
            title: "Test Title",
            image: { _publishUrl: "https://example.com/test.png" },
            durationSeconds: 5,
          },
        },
      },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResponse),
    });

    const result = await fetchAemSpotlight();

    expect(global.fetch).toHaveBeenCalled();
    expect(result.id).toBe("/test/path");
    expect(result.scenes[0].title).toBe("Test Title");
  });

  it("falls back to mock data on fetch error", async () => {
    process.env.USE_MOCK_AEM = "false";
    process.env.AEM_BASE_URL = "https://test.adobeaemcloud.com";

    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const result = await fetchAemSpotlight();

    // Should fallback to mock data
    expect(result.scenes).toHaveLength(mockData.scenes.length);
  });

  it("falls back to mock data on network error", async () => {
    process.env.USE_MOCK_AEM = "false";
    process.env.AEM_BASE_URL = "https://test.adobeaemcloud.com";

    global.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    const result = await fetchAemSpotlight();

    // Should fallback to mock data
    expect(result.scenes).toHaveLength(mockData.scenes.length);
  });
});
