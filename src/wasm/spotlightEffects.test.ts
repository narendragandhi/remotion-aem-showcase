import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  spotlightMath,
  resetWasmState,
  isWasmAvailable,
  warmupSpotlightWasm,
  calculatePulse,
  calculateGlitch,
} from "./spotlightEffects";
import fs from "fs";
import path from "path";

describe("spotlightEffects", () => {
  beforeEach(() => {
    resetWasmState();
    vi.clearAllMocks();
  });

  describe("spotlightMath (TypeScript Implementation)", () => {
    describe("calculatePulse", () => {
      it("returns 0 for progress 0", () => {
        const result = spotlightMath.calculatePulse(0, 0.5);
        expect(result).toBe(0);
      });

      it("increases with progress", () => {
        const low = spotlightMath.calculatePulse(0.2, 0.5);
        const high = spotlightMath.calculatePulse(0.8, 0.5);
        expect(high).toBeGreaterThan(low);
      });

      it("clamps output to amplitude max", () => {
        const result = spotlightMath.calculatePulse(1, 0.5);
        expect(result).toBeLessThanOrEqual(0.5);
      });
    });

    describe("calculateGlitch", () => {
      it("produces deterministic output for same input", () => {
        const result1 = spotlightMath.calculateGlitch(0.5, 0.5);
        const result2 = spotlightMath.calculateGlitch(0.5, 0.5);
        expect(result1).toBe(result2);
      });

      it("varies with progress", () => {
        const results = [0.1, 0.3, 0.5, 0.7, 0.9].map((p) =>
          spotlightMath.calculateGlitch(p, 0.5)
        );
        const unique = new Set(results);
        expect(unique.size).toBeGreaterThan(1);
      });
    });
  });

  describe("WASM Availability", () => {
    it("returns false when WASM not loaded", () => {
      expect(isWasmAvailable()).toBe(false);
    });
  });

  describe("WASM Loading and Integration", () => {
    it("should load WASM and execute math correctly matching JS", async () => {
      const wasmPath = path.join(process.cwd(), "public/spotlight_effects.wasm");
      const wasmBuffer = fs.readFileSync(wasmPath);

      // Mock fetch response for WASM loading
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: async () => wasmBuffer.buffer.slice(
          wasmBuffer.byteOffset,
          wasmBuffer.byteOffset + wasmBuffer.byteLength
        ),
      } as unknown as Response);

      await warmupSpotlightWasm();
      expect(isWasmAvailable()).toBe(true);

      // Verify that WASM calculation matches TS calculation
      const testCases = [
        { p: 0.0, amp: 0.5, intensity: 0.5 },
        { p: 0.25, amp: 0.8, intensity: 0.4 },
        { p: 0.5, amp: 0.6, intensity: 0.7 },
        { p: 0.75, amp: 0.9, intensity: 0.2 },
        { p: 1.0, amp: 0.7, intensity: 0.9 },
      ];

      for (const { p, amp, intensity } of testCases) {
        const wasmPulse = calculatePulse(p, amp);
        const jsPulse = spotlightMath.calculatePulse(p, amp);
        expect(wasmPulse).toBeCloseTo(jsPulse, 5);

        const wasmGlitch = calculateGlitch(p, intensity);
        const jsGlitch = spotlightMath.calculateGlitch(p, intensity);
        expect(wasmGlitch).toBeCloseTo(jsGlitch, 5);
      }
    });

    it("falls back gracefully to JS when fetch fails", async () => {
      const mockFetch = vi.mocked(global.fetch);
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      } as unknown as Response);

      await warmupSpotlightWasm();
      expect(isWasmAvailable()).toBe(false);

      const pulse = calculatePulse(0.5, 0.8);
      const expectedPulse = spotlightMath.calculatePulse(0.5, 0.8);
      expect(pulse).toBe(expectedPulse);
    });
  });
});
