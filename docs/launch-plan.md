# Launch Plan

This is the smallest path from showcase to a trustworthy design-partner beta.
It intentionally prioritizes proof, security, and operability over feature volume.

## Stage 1 — Public showcase

Status: **Ready with honest positioning**

- Northstar campaign studio and fictional product catalog
- Live AEM and mock content paths
- Remotion Player preview
- Multi-format compositions
- Local PostgreSQL provenance path
- Reference render worker
- Evidence matrix and production-readiness boundary

Public language:

> Production-quality AEM/Remotion showcase foundation.

## Stage 2 — Design-partner beta

Status: **Next target**

Required gates:

1. Deploy behind HTTPS and an OIDC identity provider.
2. Add the five application roles in `docs/identity-and-access.md`.
3. Use managed PostgreSQL with backups and migrations.
4. Run the worker in an isolated service with a queue, lease monitoring, and logs.
5. Verify AEM Cloud Service Author and Publish behavior.
6. Add asset host allowlists and render quotas.
7. Establish support ownership and a short incident runbook.

Beta success criteria:

- one real customer campaign can be previewed;
- an approved campaign produces a multi-format MP4;
- every output has content, template, actor, and checksum provenance;
- a failed render is visible, retryable, and supportable;
- no customer credentials or content cross tenant boundaries.

## Stage 3 — General availability

Status: **Not started**

Only begin after beta evidence exists. Add durable review collaboration, tenant
administration, retention/deletion controls, load testing, disaster recovery,
security review, SLA/ownership, and production publishing integrations.

## What we will not add before beta

- A second renderer without a customer-backed use case
- A general-purpose video editor
- Arbitrary plugin/animation systems
- Multiple persistence abstractions beyond the current store boundary
- AI authoring claims without a real supported workflow

## Go/no-go review

Use the [evidence matrix](evidence-matrix.md), not visual enthusiasm, to decide
whether a stage is complete. Every “verified” claim must have a reproducible
command, test, integration record, or artifact.
