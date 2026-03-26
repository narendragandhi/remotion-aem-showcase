# BMAD Spec: AEM Spotlight Video

## Strategic Intent (BMAD Phases 00-03)
- **Phase 00 (Initialization):** Stakeholders agree on a showcase that proves AEM content fragments can drive personalized Remotion MCP output.
- **Phase 01 (Discovery):** Map business outcomes (launch spotlight) to AEM content fragments, GraphQL contract, and Remotion deliverable.
- **Phase 02 (Modeling):** Define the `AemSpotlight` domain model (see `docs/domain-model.md`) as the shared language between AEM content engineers and video developers.
- **Phase 03 (Architecture):** Align on data ingestion (GraphQL), Remotion composition, and branching strategy for MCP preview vs render and CI automation.

## Development Specification (Phase 04 & 05)
- **Goal:** Render a multi-scene hero reel that supports various aspect ratios (16:9, 9:16, 1:1) and pulls sequences of content fragments from AEM.
- **Input contract:** GraphQL query returns a list of items, each containing `_path`, `title`, `subtitle`, `cta`, `brandColor`, `image._publishUrl`, and `durationSeconds`.
- **Remotion Delivery:** 
  - `SpotlightComposition` consumes `AemSpotlight` (now an aggregate of scenes) and handles layout shifts based on the composition's dimensions.
  - Compositions are exported for landscape (16:9), portrait (9:16), and square (1:1) formats.
- **Acceptance Criteria:**
  - Multiple aspect ratios (16:9, 9:16, 1:1) render correctly with responsive typography and layout.
  - Sequential scenes are rendered using Remotion `<Series>` based on AEM data.
  - Unit tests (see `src/aem/aemClient.test.ts`) verify multi-scene mapping logic.
  - GraphQL fetch returns a list of items that match the scene domain spec.

## Traceability
- BMAD documents link to the BEAD task board `docs/bead-tasks.md`.
- Gastown orchestration (see `docs/gastown-orchestration.md`) drives the AI agent handoff for this spec.
- The spec drives Domain-Driven Design decisions described in `docs/domain-model.md`.

## TDD guardrails
- Write the unit test in `src/aem/aemClient.test.ts` *before* adjusting the mapping logic so the default data path stays green.
- Use `npm run test` (Vitest) to keep the spec honest after each change.

## WASM pulse effect
- The CTA glow is driven by `src/wasm/spotlight_effects.wasm` and the helper `src/wasm/spotlightEffects.ts`, showing how compute-heavy animation math can live in WASM while Remotion stays declarative.
- Regenerate the `.wasm` binary via `npm run build:wasm` (the Node script at `scripts/build-spotlight-wasm.js` encodes the same pulse logic described by the spec above).
