# Security, operations and render acceptance — 2026-11-11

Status: hardening implemented with local evidence; production acceptance remains incomplete.

## Implemented controls

- Exact HTTPS asset origin allowlist in API and worker (`ASSET_ALLOWED_ORIGINS`, comma-separated origins). Empty configuration denies remote assets. Rejects embedded credentials, HTTP, file URLs and lookalike hosts. Existing local-file/data URL workflows must be adapted before using the restricted worker.
- Limits: 30 scenes, 120 seconds of campaign content, 20 queued/rendering jobs globally. PostgreSQL queue admission uses a transaction advisory lock. Four formats maximum was already enforced by the job schema. Worker timeout remains per format.
- 60 API requests/minute per socket address with bounded rate-limit state; 1 MB request bodies; request/header/idle timeouts. Reverse-proxy deployments need matching ingress limits; X-Forwarded-For is deliberately not trusted.
- CSP, frame denial, MIME sniff protection, no-referrer, no-store API responses. CSP permits HTTPS images and inline styles for the renderer.
- Structured HTTP event logs record request ID, status, method and latency without request bodies or authorization headers. Liveness `/health/live`; authenticated database readiness `/api/health/ready`.
- Graceful HTTP listener shutdown on SIGTERM.
- `ops/backup.sh` creates private PostgreSQL custom-format backups, validates their catalog, and writes a checksum. `ops/restore-check.sh` restores into an explicitly supplied separate empty database with fail-on-error semantics. Both shell scripts pass syntax checking; real backup/restore was not possible in this session.
- Missing-image handling corrected so an empty URL shows the placeholder instead of crashing Remotion.

## Evidence

- Type check, lint and 50 unit tests passed.
- Node service and browser builds passed.
- HTTP smoke proved: 401 without token; 200 static UI; 404 authenticated unknown route; CSP header; 429 after the request limit.
- Actual two-second H.264 samples rendered and ffprobe validated:
  - `out/acceptance-16x9.mp4`: 1280×720
  - `out/acceptance-9x16.mp4`: 720×1280
  - `out/acceptance-1x1.mp4`: 1080×1080
- Inputs were one mock scene with remote images deliberately omitted. These outputs exercise the fallback and format pipeline; they are not live AEM videos.
- Midpoint frames inspected. Landscape is readable; portrait HUD overlaps heading and square title breaks awkwardly across lines. These visual issues still need correction before customer acceptance. Missing-image placeholder has poor contrast and should not be accepted in an approved output.

Logs in `/tmp`: `remotion-hardening-validation.log`, `remotion-hardening-server.log`, `remotion-hardening-web.log`, `remotion-acceptance-render.log`, `remotion-acceptance-portrait.log`, `remotion-acceptance-square.log`.

## Environment blockers and remaining acceptance

Docker daemon was unavailable, and local AEM localhost:4502 refused connections, including probes outside the sandbox. No Cloud credentials/runtime were verified. No database recovery, queue-cap race, live AEM read or Cloud asset delivery evidence is claimed.

Production workers additionally require enforced outbound networking: a URL allowlist alone does not stop a trusted host redirecting Chromium to a private destination or DNS rebinding. Apply an egress proxy/firewall allowlist and block private/link-local/metadata destinations. Run workers with CPU/memory/PID limits and independent writable output volumes. Scan dependencies and pinned container images before deployment; scans were not run here.

Before release:

1. Provision PostgreSQL and verify queue admission, health, and backup/restore in an isolated database.
2. Deploy behind TLS, ingress throttling, network egress restrictions and organizational identity. Shared pilot token remains a limited operator control.
3. Alert on readiness failures, 5xx rates, queue depth/age, failed attempts, lease expiry and disk usage. Schedule encrypted off-host backups with retention and record a recovery time objective; scripts alone do not supply backup operations.
4. Correct portrait/square text/HUD layout and review all scenes at introduction, midpoint, transition and exit, using approved real images and maximum authored text.
5. Run strict live Cloud fetch → render → verified output with provenance, never mock fallback. Verify publish-tier asset permissions and Cloud upload separately.
