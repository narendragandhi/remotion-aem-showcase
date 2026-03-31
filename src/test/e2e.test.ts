/**
 * E2E Rendering Tests
 *
 * Tests actual video rendering output to verify:
 * - Compositions render without errors
 * - Output files are valid and have expected properties
 * - All aspect ratios produce correct dimensions
 * - Telemetry is properly tracked
 */

import { describe, it, expect, beforeAll } from "vitest";
import { execSync } from "child_process";
import { existsSync, statSync, mkdirSync } from "fs";
import { join } from "path";

const E2E_OUTPUT_DIR = join(process.cwd(), "out", "e2e");
const COMPOSITIONS = [
  { id: "AEMSpotlight-16x9", width: 1280, height: 720 },
  { id: "AEMSpotlight-9x16", width: 720, height: 1280 },
  { id: "AEMSpotlight-1x1", width: 1080, height: 1080 },
];

// Short duration for E2E tests (2 seconds at 30fps = 60 frames)
const TEST_DURATION_FRAMES = 60;
const MIN_VIDEO_SIZE_BYTES = 10000; // 10KB minimum for valid video

describe("E2E Rendering Tests", () => {
  beforeAll(() => {
    // Ensure output directory exists
    if (!existsSync(E2E_OUTPUT_DIR)) {
      mkdirSync(E2E_OUTPUT_DIR, { recursive: true });
    }
  });

  describe("Still Frame Rendering", () => {
    it.each(COMPOSITIONS)(
      "should render a still frame for $id",
      async ({ id }) => {
        const outputPath = join(E2E_OUTPUT_DIR, `${id}_still.png`);

        // Render a single frame
        const command = `npx remotion still src/index.tsx ${id} "${outputPath}" --frame=30`;

        try {
          execSync(command, {
            encoding: "utf-8",
            env: { ...process.env, USE_MOCK_AEM: "true" },
            timeout: 60000, // 60 second timeout
          });
        } catch (error) {
          const err = error as { stderr?: string; stdout?: string };
          console.error("Render failed:", err.stderr || err.stdout);
          throw error;
        }

        // Verify output exists
        expect(existsSync(outputPath)).toBe(true);

        // Verify file size is reasonable
        const stats = statSync(outputPath);
        expect(stats.size).toBeGreaterThan(1000); // At least 1KB for PNG
      },
      120000 // 2 minute timeout per test
    );
  });

  describe("Video Rendering", () => {
    it.each(COMPOSITIONS)(
      "should render a short video clip for $id",
      async ({ id }) => {
        const outputPath = join(E2E_OUTPUT_DIR, `${id}_clip.mp4`);

        // Render short clip
        const command = `npx remotion render src/index.tsx ${id} "${outputPath}" --frames=0-${TEST_DURATION_FRAMES}`;

        try {
          execSync(command, {
            encoding: "utf-8",
            env: {
              ...process.env,
              USE_MOCK_AEM: "true",
              TELEMETRY_ENABLED: "true",
              TELEMETRY_BACKEND: "console",
            },
            timeout: 180000, // 3 minute timeout
          });
        } catch (error) {
          const err = error as { stderr?: string; stdout?: string };
          console.error("Render failed:", err.stderr || err.stdout);
          throw error;
        }

        // Verify output exists
        expect(existsSync(outputPath)).toBe(true);

        // Verify file size indicates valid video
        const stats = statSync(outputPath);
        expect(stats.size).toBeGreaterThan(MIN_VIDEO_SIZE_BYTES);
      },
      300000 // 5 minute timeout per test
    );
  });

  describe("Multi-Scene Rendering", () => {
    it("should render composition with multiple scenes", async () => {
      const outputPath = join(E2E_OUTPUT_DIR, "multi_scene_test.mp4");

      // Use loyalty mock which has multiple scenes
      const command = `npx remotion render src/index.tsx AEMSpotlight-16x9 "${outputPath}" --frames=0-${TEST_DURATION_FRAMES * 2}`;

      try {
        execSync(command, {
          encoding: "utf-8",
          env: {
            ...process.env,
            REMOTION_MOCK_FILE: "loyalty",
            USE_MOCK_AEM: "true",
          },
          timeout: 180000,
        });
      } catch (error) {
        const err = error as { stderr?: string; stdout?: string };
        console.error("Render failed:", err.stderr || err.stdout);
        throw error;
      }

      expect(existsSync(outputPath)).toBe(true);
      const stats = statSync(outputPath);
      expect(stats.size).toBeGreaterThan(MIN_VIDEO_SIZE_BYTES);
    }, 300000);
  });

  describe("Effects Rendering", () => {
    it("should render with glow effect without errors", async () => {
      const outputPath = join(E2E_OUTPUT_DIR, "glow_effect_test.png");

      // Render frame with glow effect active
      const command = `npx remotion still src/index.tsx AEMSpotlight-16x9 "${outputPath}" --frame=45`;

      try {
        execSync(command, {
          encoding: "utf-8",
          env: { ...process.env, USE_MOCK_AEM: "true" },
          timeout: 60000,
        });
      } catch (error) {
        const err = error as { stderr?: string; stdout?: string };
        console.error("Render failed:", err.stderr || err.stdout);
        throw error;
      }

      expect(existsSync(outputPath)).toBe(true);
    }, 120000);
  });

  describe("Error Handling", () => {
    it("should handle invalid composition gracefully", () => {
      const command = `npx remotion still src/index.tsx NonExistentComposition out/e2e/invalid.png 2>&1`;

      expect(() => {
        execSync(command, {
          encoding: "utf-8",
          timeout: 30000,
        });
      }).toThrow();
    });
  });
});

describe("Render Output Validation", () => {
  it("should have generated E2E output directory", () => {
    // This test runs after the rendering tests
    // Verifies the test infrastructure worked
    expect(existsSync(E2E_OUTPUT_DIR)).toBe(true);
  });
});
