# Gastown Orchestration: AI Agents for the Spotlight Workflow

Gastown ensures the BMAD phases above are translated into agent-level work items. The Mayor agent acts as the gateway between BMAD strategic tasks, BEAD progress, and the agent pods that implement the content delivery.

## Workflow
1. **BMAD PM Agent** triggers: "Deliver Spotlight hero video powered by AEM." The spec in `docs/bmad-spec.md` becomes the prime artifact.
2. **Mayor Agent** reads the spec, breaks the deliverable into GasTown workstreams (e.g., `Build Remotion MCP`, `Fetch AEM fragment`, `Validate defaults`) and creates BEAD tasks (`docs/bead-tasks.md`).
3. **Developer Agent** picks up the `build` bead to code `SpotlightComposition`, `mapAemItemToSpotlight`, and add Vitest coverage, reporting frame-level artifacts back to the Mayor.
4. **QA Agent** is triggered once tests pass; it reruns `npm run test`, inspects the composition preview, and flags deviations.
5. After the QA bead closes, the Mayor notifies the BMAD Architect/PM agents, which assures the spec closes before Phase 06 (Operations).

## Signal Flow
- BMAD spec → default `mock/aem.json` + domain model (see `docs/domain-model.md`).
- Gastown Mayor monitors BEAD statuses and ensures the `execute` bead populates real AEM endpoints (controlled via `USE_MOCK_AEM`).
- When the `remotion render` pipeline is triggered, Gastown ensures the `spotlight` data passed to the MCP matches the domain contract before promoting the video.

## Agent tooling notes
- The Mayor agent stores the test plan in a shared artifact: `src/aem/aemClient.test.ts` ensures the mapping logic respects DDD guards before execution; the agent flags any failing test as an `Analyze` bead.
- The Gastown mayor can orchestrate further MI/OPS tasks to publish the rendered video to AEM Assets or a marketing portal once BMAD Phase 06 (Operations) is in flight.
