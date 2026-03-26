import { staticFile } from "remotion";

let wasmInstance: WebAssembly.Instance | null = null;
let wasmLoadPromise: Promise<void> | null = null;
let wasmLoadError: Error | null = null;

/**
 * Pure JS fallback implementations for environments without WASM support.
 * These match the WASM functions exactly for consistent behavior.
 */
const jsFallback = {
  pulseStrength: (progress: number, amplitude: number): number => {
    // Math: progress * amplitude + progress * 0.3, clamped by amplitude
    return Math.min(progress * amplitude + progress * 0.3, amplitude);
  },
  glitchFactor: (progress: number, intensity: number): number => {
    // Pseudo-random jitter: (ceil(progress * 100) * 7 + 13) / 10 * intensity - 0.5
    return ((Math.ceil(progress * 100) * 7 + 13) / 10) * intensity - 0.5;
  },
};

/**
 * Loads and initializes the WASM module.
 * Uses Remotion's staticFile() for proper path resolution in all environments.
 * Falls back to JS implementation if WASM fails to load.
 */
export const warmupSpotlightWasm = async (): Promise<void> => {
  // Already loaded
  if (wasmInstance) return;

  // Already loading - wait for existing promise
  if (wasmLoadPromise) return wasmLoadPromise;

  // Previous load failed - don't retry (use JS fallback)
  if (wasmLoadError) return;

  wasmLoadPromise = (async () => {
    try {
      // Use staticFile for proper path resolution in Remotion
      const wasmPath = staticFile("spotlight_effects.wasm");
      const response = await fetch(wasmPath);

      if (!response.ok) {
        throw new Error(`Failed to fetch WASM: ${response.status} ${response.statusText}`);
      }

      const buffer = await response.arrayBuffer();
      const module = await WebAssembly.instantiate(buffer);
      wasmInstance = module.instance;
    } catch (error) {
      wasmLoadError = error instanceof Error ? error : new Error(String(error));
      console.warn(
        "[SpotlightEffects] WASM load failed, using JS fallback:",
        wasmLoadError.message
      );
      // Don't throw - we'll use JS fallback
    }
  })();

  return wasmLoadPromise;
};

/**
 * Checks if WASM is available and loaded.
 */
export const isWasmAvailable = (): boolean => {
  return wasmInstance !== null;
};

/**
 * Calculates pulse/glow intensity for CTA effects.
 * @param progress - Animation progress (0.0 to 1.0)
 * @param amplitude - Effect intensity from AEM (0.0 to 1.0)
 * @returns Pulse strength value
 */
export const calculatePulse = (progress: number, amplitude: number): number => {
  // Clamp inputs to valid range
  const p = Math.max(0, Math.min(1, progress));
  const a = Math.max(0, Math.min(1, amplitude));

  if (wasmInstance) {
    try {
      const pulseStrength = wasmInstance.exports.pulseStrength as (
        p: number,
        a: number
      ) => number;
      return pulseStrength(p, a);
    } catch (error) {
      console.warn("[SpotlightEffects] WASM pulseStrength failed:", error);
    }
  }

  return jsFallback.pulseStrength(p, a);
};

/**
 * Calculates glitch jitter for visual distortion effects.
 * @param progress - Animation progress (0.0 to 1.0)
 * @param intensity - Effect intensity from AEM (0.0 to 1.0)
 * @returns Glitch factor value (can be negative)
 */
export const calculateGlitch = (progress: number, intensity: number): number => {
  // Clamp inputs to valid range
  const p = Math.max(0, Math.min(1, progress));
  const i = Math.max(0, Math.min(1, intensity));

  if (wasmInstance) {
    try {
      const glitchFactor = wasmInstance.exports.glitchFactor as (
        p: number,
        i: number
      ) => number;
      return glitchFactor(p, i);
    } catch (error) {
      console.warn("[SpotlightEffects] WASM glitchFactor failed:", error);
    }
  }

  return jsFallback.glitchFactor(p, i);
};

/**
 * Resets the WASM state. Useful for testing.
 */
export const resetWasmState = (): void => {
  wasmInstance = null;
  wasmLoadPromise = null;
  wasmLoadError = null;
};
