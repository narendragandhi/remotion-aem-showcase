# WASM Workflow: Spotlight Pulse Blend

Remotion is already a GPU-friendly renderer, but the MCU can still lean on WASM for repeatable number-crunching that stays decoupled from the render graph. This repo showcases that by routing the CTA glow into a tiny wave generator that mixes AEM data with frame progress via the `pulseStrength` export.

## How it works
1. **Domain input:** The normalized timeline (`frame / durationInFrames`) and the brand-driven amplitude live in `SpotlightComposition`.
2. **WASM helper:** `src/wasm/spotlightEffects.ts` asynchronously warms up `src/wasm/spotlight_effects.wasm` (built from the WAT in `src/wasm/spotlight_effects.wat`). Once instantiated, the exported `pulseStrength(float, float)` returns a clamped amplitude-aware shimmer that feeds the CTA shadow and any future compute-heavy transitions.
3. **Fallback:** Before the binary is ready, the same helper falls back to a pure-JS calculation so previews stay responsive and deterministic.

## Rebuilding the binary
Run `npm run build:wasm` whenever you tweak the WAT or manually want to regenerate the binary. The script in `scripts/build-spotlight-wasm.js` encodes the same sections shown in the WAT file so you can keep the artifact in source control without depending on native toolchains.

## Why it matters for AEM + Remotion
- Remotion can pull AEM fragments, but complex math (color mixing, audio normalization, Lottie interpolation) is easier to offload to WASM when the underlying data is already heavy. This example shows how you keep the BMAD/BEAD/Gastown specs intact while still introducing compiled performance hooks.
- AEM content editors stay in control of the domain shape, Remotion designers keep timeline authority, and the WASM helper becomes a reliable service level that all agents (Developer, QA, etc.) can test through TDD.
