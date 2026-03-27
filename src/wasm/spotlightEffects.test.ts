import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  spotlightMath,
  resetWasmState,
  isWasmAvailable,
} from "./spotlightEffects";

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
});
