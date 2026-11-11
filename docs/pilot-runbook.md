# Campaign video pilot

Scope: one campaign template, one trusted operator/team, three output formats. The Node service and worker use PostgreSQL. Release beyond the pilot depends on a repeat-use trial showing production-time savings.

## Implemented

- Remotion versions pinned together in manifest and lockfile.
- Render composition props and mocks validated with Zod; invalid colors rejected.
- Job API accepts only the implemented Remotion engine.
- Async worker renews leases, guards completion/failure with worker + attempt ownership, isolates attempt outputs, and fails exhausted expired jobs. Heartbeat failures kill the render process. Completion holds a row lock before writing outputs.
- Production Node service serves the built UI, rejects unauthenticated API requests, permits job create/list and restricted GraphQL proxy routes. Browser token remains in memory. Request body capped at 1 MB; proxy timeout 30 seconds; redirects rejected. Job status writes remain worker-owned.

## Run locally

```sh
npm ci
npm run build:web
npm run build:server
docker compose up -d postgres
export DATABASE_URL=postgresql://remotion:remotion_local_dev@127.0.0.1:55432/remotion_provenance
# Generate an access secret, store it securely, and share only with the pilot operator.
export PILOT_API_TOKEN=YOUR_RANDOM_SECRET_AT_LEAST_32_CHARACTERS
# Optional live content source; Authorization value includes its Bearer/Basic prefix.
export AEM_BASE_URL=http://localhost:4502
export AEM_TOKEN=YOUR_AEM_AUTHORIZATION_VALUE
npm run start:server
```

Open http://127.0.0.1:5176 and enter the pilot secret. In another shell with the same DATABASE_URL, run `npm run worker:provenance`. PostgreSQL must have migrations 001 and 002 applied; docker init scripts apply them only for a fresh volume. Use Node 22 and installed Chrome/Chromium plus ffmpeg/ffprobe for rendering. Dockerfile.worker includes these runtime tools and required public assets.

Use a TLS reverse proxy to expose the service beyond localhost. A shared pilot token is a single trusted-operator boundary, not per-user enterprise identity. Organizational identity, role policy, quotas, and content/asset host restrictions are required before widening access. Vercel's static build cannot run this Node service; host the service on a Node runtime with PostgreSQL access.

## Evidence from implementation session

- `npm run validate`: passed, 42 tests; includes type checking browser and service code.
- `npm run build:web` and `npm run build:server`: passed.
- `node --check scripts/provenance-worker.mjs`: passed.
- Local HTTP smoke: anonymous API access rejected (401), static UI served (200), authenticated unknown route rejected (404).

## Acceptance still required

1. Run a real PostgreSQL-backed browser request and worker render in all three pilot formats.
2. Prove two-worker lease expiry/reclaim, stale completion rejection, final-attempt recovery, and no duplicate published output. The new ownership SQL is implemented but has not had that live concurrency test in this session.
3. Review video frames, crop/text overflow and asset loading; unit tests do not establish visual quality.
4. Verify live AEM Cloud content reads and governed DAM output upload. Current worker outputs remain local file URLs; browser download/DAM publication is unfinished.
5. Pilot with a marketing operator and record baseline time, time per approved output, rework and repeat use.

Next investment: governed DAM delivery and concurrency evidence. Defer additional engines and WASM expansion until the pilot proves value.

See [security and operations evidence](security-operations-evidence.md) for new controls, actual render samples, visual findings and remaining acceptance gates.
