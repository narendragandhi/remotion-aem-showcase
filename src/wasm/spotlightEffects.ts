import { staticFile } from "remotion";

/**
 * High-Performance Animation Math (Principal-Grade)
 * 
 * Maintainability Note: 
 * We use pure TypeScript as the primary implementation to ensure 
 * AEM Content Engineers can easily adjust the motion curves.
 * WASM is retained as a performance-optimized fallback.
 */
export const spotlightMath = {
  calculatePulse: (progress: number, amplitude: number): number => {
    const p = Math.max(0, Math.min(1, progress));
    const a = Math.max(0, Math.min(1, amplitude));
    return Math.min(p * a + p * 0.3, a);
  },
  calculateGlitch: (progress: number, intensity: number): number => {
    const p = Math.max(0, Math.min(1, progress));
    const i = Math.max(0, Math.min(1, intensity));
    return ((Math.ceil(p * 100) * 7 + 13) / 10) * i - 0.5;
  },
};

let wasmInstance: WebAssembly.Instance | null = null;
let wasmLoadPromise: Promise<void> | null = null;
let wasmLoadError: Error | null = null;

export const warmupSpotlightWasm = async (): Promise<void> => {
  if (wasmInstance || wasmLoadError) return;
  if (wasmLoadPromise) return wasmLoadPromise;

  wasmLoadPromise = (async () => {
    try {
      const wasmPath = staticFile("spotlight_effects.wasm");
      const response = await fetch(wasmPath);
      if (!response.ok) throw new Error(`WASM Fetch failed: ${response.status}`);
      const buffer = await response.arrayBuffer();
      const module = await WebAssembly.instantiate(buffer);
      wasmInstance = module.instance;
    } catch (error) {
      wasmLoadError = error instanceof Error ? error : new Error(String(error));
    }
  })();

  return wasmLoadPromise;
};

export const calculatePulse = (progress: number, amplitude: number): number => {
  if (wasmInstance) {
    try {
      const pulseStrength = wasmInstance.exports.pulseStrength as (p: number, a: number) => number;
      return pulseStrength(progress, amplitude);
    } catch (e) { /* Fallback */ }
  }
  return spotlightMath.calculatePulse(progress, amplitude);
};

export const calculateGlitch = (progress: number, intensity: number): number => {
  if (wasmInstance) {
    try {
      const glitchFactor = wasmInstance.exports.glitchFactor as (p: number, i: number) => number;
      return glitchFactor(progress, intensity);
    } catch (e) { /* Fallback */ }
  }
  return spotlightMath.calculateGlitch(progress, intensity);
};

export const isWasmAvailable = (): boolean => wasmInstance !== null;
export const resetWasmState = (): void => {
  wasmInstance = null;
  wasmLoadPromise = null;
  wasmLoadError = null;
};
