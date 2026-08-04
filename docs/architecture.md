# System Architecture

Architecture version: 0.1.0  
Status: Baseline

## 1. Context

```text
 AEM Author / DAM
       |
       | GraphQL + asset delivery
       v
 Authenticated server boundary
       |
       +--> validated campaign model --> Remotion Player --> marketer review
       |
       +--> validated campaign model --> Remotion renderer --> FFmpeg/ffprobe gate --> MP4/DAM
       |
       +--> telemetry/cache/health
```

The browser must not call AEM with author credentials. Local development uses the
Vite `/api/aem` proxy; production requires an equivalent authenticated backend.

## 2. Logical components

| Component | Responsibility | Main location |
|---|---|---|
| AEM integration | GraphQL request, asset URL resolution, auth configuration | `src/aem/` |
| Schema boundary | Parse and constrain untrusted AEM data | `src/aem/schema.ts` |
| Domain mapper | Translate GraphQL nodes into `AemSpotlight` | `src/aem/aemClient.ts` |
| Template contract | Stable campaign/template shape and validation | `src/templates/` |
| Design system | Shared color, typography, spacing, motion tokens | `DESIGN.md`, `src/design-system/` |
| Composition | Frame-driven visual output and scene sequencing | `src/compositions/` |
| Player workspace | Preview, sources, formats, review/draft controls | `web/App.tsx` |
| Rendering adapter | Engine registry and future alternate engine boundary | `src/rendering/` |
| Media validation | Verify container, codec, dimensions, duration, and byte size after render | `scripts/validate-media.mjs` |
| Effects | Deterministic pulse/glitch math and fallback | `src/wasm/` |
| Reliability | Typed errors, cache, health, telemetry | `src/errors/`, `src/cache/`, `src/health/`, `src/telemetry/` |
| Provenance | Immutable render identity, content hash, lifecycle, and output references | `src/provenance/`, `/api/provenance` |

## 3. Runtime flows

### Preview flow

1. The workspace requests campaign data from its same-origin backend route.
2. The backend authenticates to AEM and queries GraphQL.
3. The response is parsed into the validated scene model.
4. The Player receives the same campaign shape used by the composition.
5. The UI displays source, format, scene count, duration, and validation/review state.

### Render flow

1. A render command resolves explicit props or configured AEM content.
2. `calculateMetadata` resolves the campaign and computes duration from scenes.
3. The composition renders deterministic frames at 30fps.
4. Assets are resolved through AEM/Dynamic Media rules; authenticated assets may
   be materialized as data URLs by the live render script.
5. Remotion emits an MP4 for the selected composition.
6. `ffprobe` validates the MP4 container, video stream, dimensions, duration, and
   byte size before the worker records completion and checksum provenance.

### Failure flow

```text
AEM failure -> typed fetch error -> mock/fallback or visible failure
Invalid data -> validation error -> warning/fallback according to strict mode
Asset failure -> placeholder/error boundary -> render remains inspectable
WASM failure -> JS effects fallback -> deterministic output
Media validation failure -> retryable render failure -> no completed output record
```

## 4. Data ownership and boundaries

- AEM owns authored copy, asset references, scene ordering, and authored motion
  parameters.
- The application owns validation, defaults, renderer-safe mapping, caching, and
  presentation behavior.
- The design system owns visual tokens and motion semantics.
- The template owns which fields are required, optional, or ignored.
- Dynamic Media owns image delivery/rendition optimization, not video composition.

## 5. Security architecture

- `AEM_TOKEN`, IMS credentials, and signing keys are server-only secrets.
- Node-only modules are dynamically imported so they do not enter the browser bundle.
- CORS is an explicit AEM deployment concern, not a reason to expose credentials.
- A production backend must authenticate the requesting user, authorize the
  fragment/template, and avoid accepting arbitrary remote asset URLs without policy.
- Render requests should be immutable and auditable once submitted.

## 6. Deployment topology

### Development

```text
Vite web server :5173 -> /api/aem -> AEM Author :4502
Remotion CLI -> AEM directly or mock data -> local MP4
```

### Production target

```text
Browser -> authenticated application backend
                    |
                    +-> AEM Publish/Author tier
                    +-> cache / render queue
                    +-> Remotion render worker
                              |
                              +-> FFmpeg/ffprobe media quality gate
                    +-> AEM DAM or delivery storage
```

The repository now implements a local/demo path, durable PostgreSQL persistence,
a reference Remotion worker, and a worker-side FFmpeg/ffprobe quality gate.
Production queueing, worker isolation, leases, durable identity/authorization, and
managed output storage remain product work. The production worker image only needs
to include Node, Chromium, Remotion's browser dependencies, and FFmpeg; no new
application service is required for media validation. `Dockerfile.worker` is the
reproducible reference image and runs as a non-root user.

The local provenance API persists jobs to `.local/provenance/jobs.json`. This is a
development adapter behind the `ProvenanceStore` interface. A production deployment
should replace it with PostgreSQL or an equivalent transactional store, while
placing rendered binaries and thumbnails in AEM DAM or object storage.

The executable relational target is documented in [`db/README.md`](../db/README.md)
and [`001_provenance.sql`](../db/migrations/001_provenance.sql). It separates
campaign revisions, render jobs, outputs, review events, and lifecycle audit events.

## 7. Architecture rules

| ID | Rule |
|---|---|
| ARCH-01 | AEM response shapes do not cross directly into compositions. |
| ARCH-02 | All external content passes through runtime validation. |
| ARCH-03 | Preview and render consume the same domain/template contract. |
| ARCH-04 | Design tokens are shared; engines do not define competing visual systems. |
| ARCH-05 | Browser code never owns AEM credentials. |
| ARCH-06 | Every new output format declares dimensions and safe-area behavior. |
| ARCH-07 | Alternate engines implement adapters behind the rendering boundary. |
| ARCH-08 | A render cannot be marked completed until its media artifact passes the format contract. |
