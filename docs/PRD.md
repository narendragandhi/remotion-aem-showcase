# Product Requirements Document

Product: AEM Video Factory / Remotion AEM Spotlight  
Document version: 0.1.0  
Status: Baseline  
Last reviewed: 2026-08-03

## 1. Product summary

AEM Video Factory turns governed AEM Content Fragment data and DAM assets into
repeatable, on-brand video compositions. Marketers preview the result in the
browser, review it, and render one campaign into multiple channel formats.

The product is a content-to-video system, not a general-purpose timeline editor.
Its differentiator is the connection between structured AEM intent, reusable
motion templates, and deterministic multi-format delivery.

## 2. Problem

Marketing teams repeatedly recreate similar videos for different channels. This
causes inconsistent branding, manual production work, slow approvals, and weak
traceability between authored content and the final asset. AEM already governs
content and assets, but it does not by itself provide a reusable motion system or
video preview/render workflow.

## 3. Users

| User | Need |
|---|---|
| Marketer | Preview and request channel-ready video without editing code |
| Brand/creative owner | Govern templates, tokens, typography, and motion behavior |
| AEM author | Author structured content and assets using approved models |
| Marketing operations | Produce consistent localized or variant outputs at scale |
| Developer/agency | Extend templates and integrate render workflows safely |

## 4. Product principles

1. AEM is the source of authored campaign intent.
2. Templates are governed product assets, not undocumented component code.
3. Preview and final render must use the same validated content contract.
4. Motion communicates content or system state; effects are not decoration.
5. Credentials remain server-side.
6. Renderer choice is isolated behind a stable content and template contract.
7. Every production output should be explainable from content revision, template
   version, design tokens, engine, and output format.

## 5. Goals

| ID | Goal | Success signal |
|---|---|---|
| PRD-G01 | Convert structured AEM content into video | Valid MP4 from a supported fragment |
| PRD-G02 | Preview before rendering | Player shows the same campaign and ratio as the renderer |
| PRD-G03 | Preserve brand consistency | Templates and tokens constrain authored variation |
| PRD-G04 | Support channel variants | 16:9, 9:16, 1:1, and 4K outputs are available |
| PRD-G05 | Make decisions reproducible | Render metadata records all governing inputs |
| PRD-G06 | Keep future engine options open | Remotion is active; alternate engine boundary is explicit |

## 6. Non-goals for the current product version

- General-purpose manual video editing.
- Arbitrary AEM field rendering without a template contract.
- Unbounded third-party font, Lottie, or SVG compatibility.
- Claiming real-time final video rendering when rendering is asynchronous.
- Replacing AEM Dynamic Media. Dynamic Media remains the asset delivery and
  transformation layer; this product owns sequencing, motion, and video output.
- Production VideoFlow rendering. The adapter seam is documented, but the adapter
  is not implemented.

## 7. Functional requirements

| ID | Requirement | Status | Trace |
|---|---|---|---|
| PRD-F01 | Load a spotlight campaign from AEM GraphQL | Implemented | `src/aem/aemClient.ts`, `TEST-AEM` |
| PRD-F02 | Validate external AEM data at runtime | Implemented | `src/aem/schema.ts`, unit tests |
| PRD-F03 | Support ordered multi-scene campaigns | Implemented | `mapAemItemToSpotlight`, composition |
| PRD-F04 | Preview campaign data in Remotion Player | Implemented | `web/App.tsx` |
| PRD-F05 | Render supported aspect ratios | Implemented | `src/index.tsx` |
| PRD-F06 | Use mock scenarios when AEM is unavailable | Implemented | `src/mock/`, `src/index.tsx` |
| PRD-F07 | Show validation/review state before rendering | Partial | workspace state exists; durable backend is planned |
| PRD-F08 | Record content/template/render provenance | Partial | local durable adapter; production database planned |
| PRD-F09 | Provide shareable review links | Planned | requires persistence and authorization |
| PRD-F10 | Support localized/personalized variants | Planned | requires variant selection contract |

`TEST-AEM` currently means the local AEM Author endpoint and live three-scene
campaign render. Cloud Service and publish-tier verification remain release work.

## 8. Quality attributes

- **Determinism:** frame-driven animation, stable inputs, and no time-based side
  effects in compositions.
- **Security:** AEM credentials and token signing are server-side only.
- **Resilience:** typed errors, schema validation, cache, fallbacks, and error
  boundaries make failures visible and recoverable.
- **Accessibility:** preview UI must expose readable labels, focusable controls,
  contrast-safe states, and captions when audio is introduced.
- **Performance:** preview should remain responsive for a normal campaign; final
  rendering may be asynchronous and should expose progress/failure state.
- **Portability:** content and design contracts must not encode Remotion-specific
  implementation details.

## 9. Release acceptance

Release 0.1 is acceptable when:

- a live AEM fragment loads through the configured GraphQL endpoint;
- the Player can preview all supported ratios;
- at least one live campaign renders to a valid MP4;
- mock mode remains usable without AEM;
- `npm run validate` and `npm run build:web` pass;
- the design, architecture, specs, and decision log are updated with the release;
- known limitations are visible in `STATUS.md`.

## 10. Future product milestones

1. Persist campaigns, drafts, review states, and render jobs.
2. Version templates and brand token sets.
3. Add captions, audio policy, safe-area validation, and text-length linting.
4. Add render provenance and audit events.
5. Add webhook/event-triggered renders and publish-tier policies.
6. Implement a second renderer only when a real use case justifies it.
