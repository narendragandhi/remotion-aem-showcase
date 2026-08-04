# Production Database

The migration in `db/migrations/001_provenance.sql` is the production relational
model for the current provenance contract.

## Tables

- `campaign_revisions`: immutable AEM/content snapshots and hashes.
- `render_jobs`: template, engine, formats, actor, and lifecycle state.
- `render_outputs`: generated asset references and checksums.
- `campaign_review_events`: durable approval/review history.
- `render_job_events`: append-only lifecycle audit trail.

## Deployment requirements

- PostgreSQL 14+ with `pgcrypto` enabled for UUID generation.
- A migration runner with transaction support and rollback policy.
- Separate application roles for migrations, API writes, and read-only reporting.
- Encryption at rest and managed backups.
- Retention policy for content snapshots and rendered outputs.
- Row-level authorization or service-layer authorization by tenant/campaign.

The repository includes a PostgreSQL client and adapter. Set `DATABASE_URL` before
starting the web server to use PostgreSQL; when it is absent, the local Vite server
falls back to `.local/provenance/jobs.json`.

## Start local PostgreSQL

Docker is the supported local path:

```bash
docker compose up -d postgres
docker compose ps
```

The container listens only on `127.0.0.1:55432`. The migration directory is mounted
as PostgreSQL initialization scripts, so a fresh named volume creates the schema
automatically. For an existing volume, apply a changed migration explicitly with
your migration tool or:

```bash
docker compose exec -T postgres psql -U remotion -d remotion_provenance \
  < db/migrations/001_provenance.sql
```

Apply subsequent migrations explicitly, in order. The worker lease migration is:

```bash
docker compose exec -T postgres psql -U remotion -d remotion_provenance \
  -f /docker-entrypoint-initdb.d/002_worker_leases.sql
```

Local connection string:

```text
postgresql://remotion:remotion_local_dev@127.0.0.1:55432/remotion_provenance
```

The password is intentionally for localhost development only.

## Verify the application integration

With PostgreSQL running and the web server started using `DATABASE_URL`, run:

```bash
PROVENANCE_API_BASE_URL=http://127.0.0.1:5176 npm run verify:provenance:db
```

This creates a Northstar render job, transitions it through `rendering` and
`completed`, writes an output URL, and confirms the API can read the job back.

## Run the local render worker

With the database running, process one queued job:

```bash
DATABASE_URL=postgresql://remotion:remotion_local_dev@127.0.0.1:55432/remotion_provenance \
  npm run worker:provenance -- --once
```

Outputs are written beneath `.local/provenance/outputs/<render-id>/`, validated with
FFmpeg's `ffprobe`, checksummed, and recorded in `render_outputs`. The completion
audit event includes the validated container, codec, dimensions, duration, and byte
size. The worker claims jobs with a lease, retries up to `max_attempts`, and marks a
job failed after the retry limit. Omit `--once` to run a polling worker. This is a
local worker reference; production should isolate workers and run them behind a
managed queue.

Install FFmpeg locally before running the worker (`brew install ffmpeg` on macOS,
or the equivalent package for the worker image). Set `FFPROBE_BIN` when the binary
is not on `PATH`.

For a reproducible worker image, build `Dockerfile.worker` from the repository root:

```bash
docker build -f Dockerfile.worker -t remotion-aem-worker .
docker run --rm \
  -e DATABASE_URL=postgresql://remotion:remotion_local_dev@host.docker.internal:55432/remotion_provenance \
  -e PROVENANCE_WORKER_ID=local-container \
  remotion-aem-worker --once
```

The image includes Chromium for Remotion and FFmpeg for artifact validation. It runs
as the unprivileged `node` user. Production should provide the database URL and AEM
credentials through a managed secret store, not through the image or a checked-in
environment file.
