import { describe, expect, it, vi, beforeEach } from "vitest";
import {
  calculatePulse,
  calculateGlitch,
  resetWasmState,
  isWasmAvailable,
} from "./spotlightEffects";

describe("spotlightEffects", () => {
  beforeEach(() => {
    resetWasmState();
    vi.clearAllMocks();
  });

  describe("calculatePulse (JS fallback)", () => {
    it("returns 0 for progress 0", () => {
      const result = calculatePulse(0, 0.5);
      expect(result).toBe(0);
    });

    it("increases with progress", () => {
      const low = calculatePulse(0.2, 0.5);
      const high = calculatePulse(0.8, 0.5);
      expect(high).toBeGreaterThan(low);
    });

    it("scales with amplitude", () => {
      const lowAmp = calculatePulse(0.5, 0.3);
      const highAmp = calculatePulse(0.5, 0.9);
      expect(highAmp).toBeGreaterThan(lowAmp);
    });

    it("clamps output to amplitude max", () => {
      const result = calculatePulse(1, 0.5);
      expect(result).toBeLessThanOrEqual(0.5);
    });

    it("clamps input progress to 0-1", () => {
      const negative = calculatePulse(-0.5, 0.5);
      const overOne = calculatePulse(1.5, 0.5);
      expect(negative).toBe(0);
      expect(overOne).toBeLessThanOrEqual(0.5);
    });

    it("clamps input amplitude to 0-1", () => {
      const result = calculatePulse(0.5, 2);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe("calculateGlitch (JS fallback)", () => {
    it("produces deterministic output for same input", () => {
      const result1 = calculateGlitch(0.5, 0.5);
      const result2 = calculateGlitch(0.5, 0.5);
      expect(result1).toBe(result2);
    });

    it("varies with progress", () => {
      const results = [0.1, 0.3, 0.5, 0.7, 0.9].map((p) =>
        calculateGlitch(p, 0.5)
      );
      const unique = new Set(results);
      expect(unique.size).toBeGreaterThan(1);
    });

    it("scales with intensity", () => {
      const lowIntensity = Math.abs(calculateGlitch(0.5, 0.2));
      const highIntensity = Math.abs(calculateGlitch(0.5, 0.8));
      expect(highIntensity).toBeGreaterThan(lowIntensity);
    });

    it("can return negative values", () => {
      // With the formula: ((ceil(progress * 100) * 7 + 13) / 10 * intensity - 0.5)
      // At progress = 0, intensity = 0.1: (1 * 7 + 13) / 10 * 0.1 - 0.5 = 2 * 0.1 - 0.5 = -0.3
      const result = calculateGlitch(0, 0.1);
      expect(result).toBeLessThan(0);
    });

    it("clamps input values", () => {
      // Should not throw with out-of-range inputs
      expect(() => calculateGlitch(-1, 2)).not.toThrow();
      expect(() => calculateGlitch(5, -1)).not.toThrow();
    });
  });

  describe("isWasmAvailable", () => {
    it("returns false when WASM not loaded", () => {
      expect(isWasmAvailable()).toBe(false);
    });
  });

  describe("resetWasmState", () => {
    it("resets WASM availability", () => {
      resetWasmState();
      expect(isWasmAvailable()).toBe(false);
    });
  });
});
