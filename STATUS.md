# Project Status: Remotion AEM Spotlight

## Current State: Production-Ready Demo

This project is a fully working showcase of AEM + Remotion integration. It renders
correctly against mock data and is structured to connect to a real AEM Cloud Service
instance once credentials are configured (see `.env.example`).

---

## What Works

| Area | Status | Notes |
|------|--------|-------|
| Multi-format compositions (16:9, 9:16, 1:1, 4K) | ✅ | Verified via smoke stills |
| AEM GraphQL client with Zod validation | ✅ | Mock mode; real AEM untested |
| WASM pulse/glitch effects with JS fallback | ✅ | `delayRender` gates frames correctly |
| Native Remotion pulse background animation | ✅ | Frame-driven via `spring()` |
| Error boundaries + typed errors | ✅ | Gracefully handles asset 404s |
| Token manager (IMS/JWT) | ✅ | Node-only; not in browser bundle |
| In-memory response cache | ✅ | Node-only; not in browser bundle |
| Telemetry (console + webhook) | ✅ | Disabled by default (`TELEMETRY_ENABLED=true`) |
| CI pipeline | ✅ | Validate → smoke → E2E → deploy |

---

## What Requires a Real AEM Instance

The following cannot be tested without an AEM Cloud Service environment:

- Live GraphQL content fetching (`USE_MOCK_AEM=false`)
- IMS token auto-refresh (`AEM_IMS_*` env vars)
- DAM asset URL resolution
- Upload to AEM DAM (`scripts/upload-to-aem.js`)
- CI deploy job (requires `AEM_BASE_URL` + `AEM_TOKEN` secrets)

See `docs/aem-integration-guide.md` for setup instructions.

---

## Known Limitations

- **WASM scope**: The `.wat` file implements custom pulse/glitch math (not a general-purpose
  compute workload). The JS fallback produces identical visual output. The value of WASM here
  is demonstrating the integration pattern, not raw performance gain.
- **Telemetry**: Console and webhook backends are functional. Adobe Analytics integration
  would require adding `@adobe/alloy` and wiring `_satellite.track()` calls.
- **Mock examples**: `src/mock/examples/` contains additional scenario mocks
  (loyalty, ecommerce, news, global) selectable via `REMOTION_MOCK_FILE`.

---

## Dependency Notes

| Package | Location | Purpose |
|---------|----------|---------|
| `remotion` | dep | Core rendering |
| `react`, `react-dom` | dep | Required by Remotion |
| `jsonwebtoken` | dep | IMS JWT signing (server-side only) |
| `zod` | dep | Runtime schema validation |
| `@remotion/cli` | devDep | CLI for preview/render |
| `@types/jsonwebtoken` | devDep | TypeScript types |

---

## Completed Work

### Phase 1 — Core Implementation
- Multi-format composition architecture
- AEM GraphQL client + Zod schema validation
- WASM effects loader with JS fallback
- Multi-scene `Series` sequencing
- Mock data with 4 enterprise scenarios

### Phase 2 — Production Hardening
- Typed error classes + React error boundaries
- `delayRender`/`continueRender` for WASM readiness
- Node built-in stubs in webpack config (crypto, fs, path, buffer, util…)
- Dynamic imports for Node-only modules (cache, tokenManager) to keep browser bundle clean
- Frame-driven pulse background (replaced `@remotion/lottie` — headless Chrome timeout)
- Frame-driven spinner in `LoadingFallback` (replaced broken CSS animation)
- Removed unused production deps and viral-agent script
- Removed unimplemented adobe-analytics telemetry stub
- Comprehensive README, TUTORIAL, EXAMPLES, and docs/

---

## Next Steps (Post-Demo)

1. Wire to a real AEM Cloud Service sandbox and verify end-to-end
2. Implement Adobe Analytics telemetry via `@adobe/alloy`
3. Add personalization: user-segment-aware content fragment selection
4. Profile WASM vs JS on real render workloads
