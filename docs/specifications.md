# Technical Specifications

Specification version: 0.1.0  
Status: Baseline

## SPEC-DATA-01: Campaign domain contract

The canonical aggregate is `AemSpotlight`:

```ts
type AemSpotlight = {
  id: string;
  scenes: SpotlightScene[]; // at least one, ordered
};
```

Each scene contains validated title, subtitle, CTA, brand/accent colors, image
reference, duration, animation preset, rendition choice, effect choice/intensity,
and optional future overlay fields. The executable schema is
[`src/aem/schema.ts`](../src/aem/schema.ts); this document describes intent, while
the schema is normative for runtime behavior.

Required invariants:

- `id` is non-empty.
- `scenes.length >= 1`.
- `durationSeconds` is a positive integer.
- `effectIntensity` is between 0 and 1.
- animation and effect values are allow-listed enums.
- missing optional fields receive documented defaults.

## SPEC-AEM-01: AEM integration

Configuration is supplied through environment variables. The GraphQL endpoint and
fragment path must be explicit in production. The client maps AEM GraphQL nodes
through `mapAemItemToSpotlight` and resolves image references against the configured
AEM base URL.

The integration supports:

- Content Fragment GraphQL queries;
- single-scene and nested/container item mapping;
- author/publish tier selection;
- optional persisted query configuration;
- strict and best-effort validation modes;
- in-memory response caching in the server runtime.

## SPEC-TEMPLATE-01: Template contract

Templates are versioned product assets:

```ts
type VideoTemplate = {
  id: string;
  version: string;
  supportedRatios: Array<"16x9" | "9x16" | "1x1" | "4K">;
  requiredFields: string[];
  brandTokenSet: string;
};
```

The current executable template is the Spotlight family, registered in
[`src/index.tsx`](../src/index.tsx). Campaign Intelligence is a composition variant
that prepends a 90-frame intro to the same campaign sequence.

Template compatibility must define maximum copy lengths, fallback behavior, font
requirements, image policy, safe areas, and output formats.

## SPEC-DESIGN-01: Visual and motion contract

[`DESIGN.md`](../DESIGN.md) is normative for tokens, typography, spacing, component
roles, motion timing, voice, brand story, anti-patterns, and delivery rules.
The implementation tokens live in `src/design-system/motion.ts`.

Motion must be deterministic and frame-driven. Current timing constants include
30fps output, 90 intro frames, 18-frame scene exits, and two-frame character
staggering. New animation must explain its semantic purpose in the design contract.

## SPEC-PLAYER-01: Preview workspace

The Player workspace must expose:

- source identity and whether content is live or mock;
- campaign duration and scene count;
- output format selection;
- timeline/scene visibility;
- review state and local draft state;
- validation or loading failures;
- a preview that uses the same composition family as final render;
- a short Campaign Intelligence opener that makes the authored-content,
  composition, and multi-channel delivery flow visible before the campaign scenes.

Local drafts currently use browser storage. This is a demo persistence mechanism,
not a multi-user source of truth. Durable drafts require a backend model, identity,
authorization, revision IDs, and conflict handling.

## SPEC-RENDER-01: Rendering

Supported composition families:

| ID suffix | Dimensions | Primary use |
|---|---:|---|
| `16x9` | 1280x720 | desktop, YouTube, presentation |
| `9x16` | 720x1280 | stories, reels, short-form vertical |
| `1x1` | 1080x1080 | feed and square placements |
| `4K` | 3840x2160 | premium landscape output |

Duration is derived from the sum of scene durations; Campaign Intelligence adds
the documented intro duration. A successful render must be playable by a standard
MP4 consumer and must use the selected campaign data.

## SPEC-OPS-01: Provenance and audit contract

The first implementation is available through `GET /api/provenance/` and
`POST /api/provenance/jobs`. It persists local development records in
`.local/provenance/jobs.json`, creates a SHA-256 hash of the validated campaign
snapshot, deduplicates output formats, and starts each job in `queued` state.

The first PostgreSQL migration is available at
[`db/migrations/001_provenance.sql`](../db/migrations/001_provenance.sql). It is
the target schema for a future `PostgresProvenanceStore` and render-job service.

Planned render metadata:

```ts
type RenderProvenance = {
  renderId: string;
  campaignId: string;
  contentFragmentPath: string;
  contentRevision?: string;
  templateId: string;
  templateVersion: string;
  designSystemVersion: string;
  renderingEngine: "remotion" | "videoflow";
  outputFormat: "16x9" | "9x16" | "1x1" | "4K";
  createdAt: string;
};
```

The local adapter is not a multi-user production database. Production storage
should use a transactional relational database for records and AEM DAM/object
storage for media. The API contract should remain stable while that adapter changes.

## SPEC-QUALITY-01: Verification gates

Required checks for changes affecting product behavior:

1. `npm run type-check`
2. `npm run lint`
3. `npm run test`
4. `npm run build:web` for Player changes
5. `npm run verify:aem` for AEM integration changes
6. one smoke still or MP4 render for composition changes
7. `git diff --check`

The verification record belongs in the pull request or release notes.
