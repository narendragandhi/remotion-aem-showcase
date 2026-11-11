# Remotion AEM Spotlight

[![CI](https://github.com/narendragandhi/remotion-aem-showcase/actions/workflows/ci.yml/badge.svg)](https://github.com/narendragandhi/remotion-aem-showcase/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/version-0.2.0-orange)](./package.json)

AEM-native video automation: author structured content once, preview it in the browser,
and render on-brand video for every channel format. See the [documentation index](docs/README.md)
for the PRD, architecture, specifications, decision log, and re-engineering guide.

## Features

- **Multi-Channel Delivery**: 16:9, 9:16, 1:1, and 4K compositions from a single codebase
- **AEM Integration**: GraphQL-powered content from AEM as a Cloud Service
- **Dynamic Media Ready**: Uses Adobe Image Serving modifiers when authored assets are Dynamic Media URLs
- **Renderer-neutral design system**: Campaign Motion tokens keep motion language independent from Remotion or VideoFlow
- **Portable design contract**: `DESIGN.md` defines the visual direction, motion rules, components, and anti-patterns
- **Animation Presets**: Cinematic, Energetic, and Minimal motion styles
- **WASM Effects**: Custom pulse/glitch math in WebAssembly with identical JS fallback
- **Type Safety**: Zod schema validation for all AEM data
- **Error Resilience**: Graceful fallbacks and error boundaries throughout
- **Render provenance**: Local render-job API records content hash, template, engine, formats, and lifecycle

## Demo

Smoke-rendered stills from the latest build — all generated from a single AEM Content Fragment:

| 16:9 — Desktop / YouTube | 9:16 — Stories / Reels | 1:1 — Feed / LinkedIn |
|:---:|:---:|:---:|
| ![16x9 still](./docs/stills/smoke_16x9.png) | ![9x16 still](./docs/stills/smoke_9x16.png) | ![1x1 still](./docs/stills/smoke_1x1.png) |

> Full video renders (`.mp4`) are attached to each [GitHub Release](https://github.com/narendragandhi/remotion-aem-showcase/releases).

---

See [the pilot runbook](docs/pilot-runbook.md) for the authenticated Node service and remaining acceptance gates. Static Vercel hosting alone does not provide the pilot APIs.

## Quick Start

```bash
# Install dependencies
npm install

# Start Remotion preview
npm run start

# Start the Player showcase with the local AEM proxy
npm run dev:web

# Run tests
npm run test

# Type check
npm run type-check

# Render all formats
npm run render:all
```

### Optional local provenance database

Start PostgreSQL 16 with Docker and apply the provenance schema:

```bash
docker compose up -d postgres
docker compose ps
```

It listens only on `127.0.0.1:55432`. The local connection string is:

```text
postgresql://remotion:remotion_local_dev@127.0.0.1:55432/remotion_provenance
```

The full schema, reset/migration guidance, and production deployment requirements
are documented in [db/README.md](db/README.md).

## Project Structure

```
remotion-aem-showcase/
├── src/
│   ├── index.tsx                   # Composition registry
│   ├── aem/
│   │   ├── aemClient.ts           # AEM GraphQL client
│   │   ├── aemClient.test.ts      # TDD test suite
│   │   └── schema.ts              # Zod validation schemas
│   ├── compositions/
│   │   └── SpotlightComposition.tsx  # Main video component
│   ├── templates/
│   │   └── spotlightTemplate.ts      # Versioned template contract + validation
│   ├── components/
│   │   └── ErrorBoundary.tsx      # Error handling UI
│   ├── errors/
│   │   └── index.ts               # Typed error classes
│   ├── wasm/
│   │   ├── spotlightEffects.ts    # WASM loader + JS fallback
│   │   ├── spotlightEffects.test.ts
│   │   ├── spotlight_effects.wat  # WASM source
│   │   └── spotlight_effects.wasm # Compiled binary
│   └── mock/
│       └── aem.json               # Mock content fragment data
├── public/
│   └── spotlight_effects.wasm     # Static WASM asset
├── docs/
│   ├── README.md                 # Documentation index and traceability convention
│   ├── PRD.md                    # Product requirements
│   ├── architecture.md           # System architecture and security boundaries
│   ├── specifications.md         # Normative technical contracts
│   ├── decision-log.md           # Product and architecture decisions
│   ├── reengineering.md          # Rebuild/parity guide
│   ├── bmad-spec.md              # BMAD phases & acceptance criteria
│   ├── bead-tasks.md             # BEAD task tracking
│   ├── domain-model.md           # DDD bounded contexts
│   ├── gastown-orchestration.md  # AI agent orchestration
│   └── wasm-workflow.md          # WASM integration guide
├── remotion.config.ts             # Remotion CLI configuration
├── vitest.config.ts               # Test configuration
└── package.json
```

## Environment Configuration

Copy `.env.example` to `.env` and configure:

```bash
# AEM Cloud Service
AEM_BASE_URL=https://publish-p12345-e67890.adobeaemcloud.com
AEM_TOKEN=<your-ims-bearer-token>
AEM_GRAPHQL_ENDPOINT=/content/_cq_graphql/global/endpoint.json
AEM_CONTENT_FRAGMENT_PATH=/content/dam/your-project/spotlight

# Optional: Use persisted query for CDN caching
# AEM_PERSISTED_QUERY=/your-project/spotlight-query

# Development mode
USE_MOCK_AEM=true
```

## Available Scripts

| Command | Description |
|---------|-------------|
| `npm start` | Launch Remotion preview |
| `npm test` | Run Vitest test suite |
| `npm run test:watch` | Run tests in watch mode |
| `npm run test:coverage` | Generate coverage report |
| `npm run render` | Render default composition |
| `npm run render:all` | Render all aspect ratios |
| `npm run render:live:aem` | Fetch live AEM content server-side and render 16:9 |
| `npm run render:live:intelligence` | Render the live AEM campaign with the Campaign Intelligence opening |
| `npm run render:live:aem:all` | Fetch one live AEM fragment and render 16:9, 9:16, 1:1, and 4K sequentially |
| `npm run test:smoke` | Generate PNG stills for verification |
| `npm run lint` | ESLint check |
| `npm run lint:fix` | Auto-fix lint issues |
| `npm run format` | Prettier formatting |
| `npm run type-check` | TypeScript validation |
| `npm run validate` | Run all checks (type-check + lint + test) |
| `npm run build:wasm` | Rebuild WASM binary |
| `npm run deploy:aem` | (Experimental) Render and upload to AEM |

## Production Deployment

### Live Player Preview

`npm run dev:web` exposes a same-origin `/api/aem` middleware for local Player
preview. It keeps AEM credentials server-side, proxies GraphQL and DAM assets,
and enables the **Live AEM · spotlight/live-showcase** source in the showcase.
For production, deploy the equivalent authenticated backend route rather than
exposing author credentials to the browser.

### Dynamic Media boundary

Dynamic Media remains the asset delivery and optimization layer. If a Content
Fragment provides an Adobe Image Serving URL such as `/is/image/...`, the
composition adds Dynamic Media modifiers (`wid`, `hei`, `qlt`, `fit`, and
`fmt`) for the selected output format. Remotion owns the timeline, animation,
brand system, and final video render; it does not duplicate Dynamic Media’s
asset transformation or delivery responsibilities.

### 1. AEM Configuration
The project includes reference configurations in `/aem-config`:
- **Content Fragment Model**: `spotlight-cfm.json` (Blueprint for AEM).
- **CORS Policy**: `CORSPolicyImpl~spotlight.cfg.json` (Required for cross-origin asset access).

### 2. Upload to AEM Assets
After rendering, you can upload the final video to the AEM DAM:
```bash
# Set AEM Author tier credentials
export AEM_BASE_URL=https://author-p12345-e67890.adobeaemcloud.com
export AEM_TOKEN=<ims-bearer-token>

# Upload rendered video
node scripts/upload-to-aem.js out/spotlight_16x9.mp4 /content/dam/spotlight/videos/hero_spotlight.mp4
```

## Compositions

| ID | Dimensions | Use Case |
|----|------------|----------|
| `AEMSpotlight-16x9` | 1280x720 | YouTube, Desktop, TV |
| `AEMSpotlight-9x16` | 720x1280 | Instagram Stories, TikTok, Reels |
| `AEMSpotlight-1x1` | 1080x1080 | Instagram Feed, LinkedIn |
| `AEMSpotlight-4K` | 3840x2160 | Premium content |

## AEM Content Fragment Model

The spotlight expects content fragments with these fields:

| Field | Type | Description |
|-------|------|-------------|
| `title` | Text | Hero headline |
| `subtitle` | Text | Supporting line |
| `cta` | Text | Call-to-action button text |
| `brandColor` | Text | Background color (CSS hex) |
| `image` | Content Reference | Hero image asset |
| `durationSeconds` | Number | Scene duration |
| `animationStyle` | Enum | `cinematic`, `energetic`, `minimal` |
| `renditionType` | Enum | `web`, `optimized`, `original` |
| `effectType` | Enum | `none`, `glow`, `glitch` |
| `effectIntensity` | Number | 0.0 to 1.0 |
| `lottieUrl` | Text | Reserved for a future Lottie renderer; native pulse is used today |
| `svgOverlayUrl` | Text | URL to SVG overlay |

For multi-scene videos, use a Container Fragment with nested scene fragments.

## Architecture

### Rendering engines

The AEM content contract and Campaign Motion tokens are renderer-neutral. Remotion
is the active adapter today; VideoFlow is isolated as an Apache-2.0 adapter
target so the campaign model, marketer workspace, and AEM integration do not
need to change if the rendering engine changes. See
`src/rendering/engines.ts` and `src/design-system/motion.ts`.

### Data Flow

```
AEM Content Fragment
    ↓ GraphQL API
fetchAemSpotlight()
    ↓ Zod Validation
AemSpotlight aggregate
    ↓ Props
SpotlightComposition
    ↓ Series Sequencing
SpotlightSceneComponent (per scene)
    ↓ WASM Effects
Rendered Video
```

### Error Handling

The application uses typed errors for different failure modes:

- `AemFetchError` - GraphQL request failures
- `AemValidationError` - Invalid response data
- `WasmLoadError` - WASM module load failures
- `AssetLoadError` - Image/Lottie/SVG load failures

All errors are recoverable with graceful fallbacks to mock data or placeholder UI.

### WASM Effects

The project implements custom pulse and glitch math in a hand-written `.wat` module,
loaded via Remotion's `staticFile()` helper with an identical JS fallback.

- **Pulse/Glow**: Smooth CTA button glow driven by normalised frame progress
- **Glitch**: Pseudo-random distortion applied to hue-rotate and translate transforms

The WASM value here is demonstrating the integration pattern (async load, `delayRender`
gating, graceful fallback) rather than raw compute performance — the JS fallback
produces identical output. A real production use case would move heavier per-frame
processing (colour grading, noise generation) into WASM.

## Development

### TDD Workflow

1. Write tests in `src/**/*.test.ts`
2. Run `npm run test:watch`
3. Implement feature
4. Verify with `npm run validate`

### Adding New Effects

1. Update `spotlight_effects.wat` with new function
2. Run `npm run build:wasm` to regenerate binary
3. Add corresponding JS fallback in `spotlightEffects.ts`
4. Export new function and add tests

## Deployment

### CI/CD Integration

```yaml
# Example GitHub Action
- name: Install dependencies
  run: npm ci

- name: Validate
  run: npm run validate

- name: Render videos
  run: npm run render:all

- name: Upload to AEM Assets
  run: # Your upload script
```

### Environment Variables for CI

Set these secrets in your CI environment:

- `AEM_BASE_URL` - AEM Cloud Service URL
- `AEM_TOKEN` - IMS Service Account token

## Methodology

This project follows:

- **BMAD** (Build/Model/Analyze/Document) for spec-driven development
- **BEAD** (Build/Execute/Analyze/Document) for task tracking
- **Gastown** for AI agent orchestration
- **DDD** (Domain-Driven Design) for bounded contexts
- **TDD** for test-first development

See `/docs` for detailed methodology documentation.

## Additional Documentation

| Document | Description |
|----------|-------------|
| [AEM Integration Guide](docs/aem-integration-guide.md) | Live AEM endpoints, sandbox setup, authentication |
| [Performance Profiling](docs/performance-profiling.md) | WASM vs JS benchmarks, optimization strategies |
| [Monitoring & Observability](docs/monitoring-observability.md) | Telemetry, error tracking, alerting |
| [TUTORIAL.md](TUTORIAL.md) | 10-minute quick start guide |
| [EXAMPLES.md](EXAMPLES.md) | Enterprise use case examples |
| [CONTRIBUTING.md](CONTRIBUTING.md) | Development setup, extension points, and PR expectations |
| [SECURITY.md](SECURITY.md) | Security boundaries and vulnerability reporting |
| [RELEASES.md](RELEASES.md) | Versioning and release checklist |

## License

Apache 2.0 — see [LICENSE](./LICENSE)

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md) for setup, extension workflows, traceability,
verification, and pull-request expectations. Run `npm run validate` and
`npm run check:docs` before submitting a change.

Development follows the [spec-driven development workflow](docs/spec-driven-development.md):
requirements and contracts are updated before implementation, and every behavior
change carries tests or rendered/integration evidence.

See the [production readiness assessment](docs/production-readiness.md) for the
current quality, security, and deployment boundary.

See the [evidence matrix](docs/evidence-matrix.md) for what is verified, partial,
planned, or not yet proven.
