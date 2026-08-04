# Provenance API

The local development server exposes a small render-job API. It is an adapter for
the production provenance contract, not a production service.

## Endpoints

### `GET /api/provenance/`

Returns the newest recorded jobs:

```json
{ "jobs": [] }
```

### `POST /api/provenance/jobs`

Creates a job in `queued` state. The request must contain a validated campaign
snapshot, template/design versions, engine, source, and one or more unique output
formats. The body is limited to 1 MB and unknown fields are rejected.

The server computes `contentHash` from the validated campaign snapshot. The hash is
an integrity/provenance identifier; it is not a replacement for a durable AEM
content revision.

### `PATCH /api/provenance/jobs/:renderId`

Updates lifecycle or output fields. Valid lifecycle transitions are:

```text
queued -> rendering -> completed
queued -> failed
rendering -> failed
```

Completed and failed jobs are immutable. Output URLs must be absolute URLs in the
current adapter; production should use signed delivery URLs or approved AEM DAM
references.

## Production replacement

`PostgresProvenanceStore` is now available and selected by `DATABASE_URL`. Preserve
the schemas, lifecycle rules, content hash semantics, and API response shape when
deploying it. Add authentication, authorization, rate limits, audit actor identity,
retention, and queue ownership before exposing the endpoints outside local development.
