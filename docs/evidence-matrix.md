# Evidence and Claims Matrix

This document distinguishes demonstrated behavior from planned architecture. A
claim may only be described as implemented when it has repository evidence or a
repeatable integration check.

## Status vocabulary

- **Verified:** repeatable test, build, live integration, or generated artifact exists.
- **Partially verified:** one environment/path is verified, but production variants remain.
- **Planned:** documented design; implementation is not present.
- **Not verified:** no reliable evidence yet.

## Product claims

| Claim | Status | Evidence | Limitation |
|---|---|---|---|
| AEM GraphQL content maps into the domain model | Partially verified | `npm test`; local AEM verification; `src/aem/aemClient.ts` | Cloud Service/publish-tier evidence pending |
| Northstar campaign fixtures validate | Verified | `npm test`; Zod parsing in `web/App.tsx` | Fixtures are fictional and use stock image URLs |
| Remotion Player previews the same composition family | Verified | `npm run build:web`; Playwright browser snapshot | Browser test is local, not a hosted deployment test |
| 16:9, 9:16, 1:1, and 4K compositions exist | Verified | `src/index.tsx`; `npm run build:web`; smoke/render scripts | Full 4K live render is not required on every PR |
| Live AEM campaign renders to MP4 | Partially verified | `scripts/render-live-aem.cjs`; local AEM MP4 artifacts | Cloud Service asset policy and publish tier pending |
| Dynamic Media remains complementary | Partially verified | `getDynamicRenditionUrl` tests/code | Requires customer Dynamic Media delivery test |
| PostgreSQL provenance persistence works | Verified | `npm run verify:provenance:db`; local PostgreSQL rows | Local Docker only |
| PostgreSQL-backed worker creates and validates a real MP4 | Partially verified | `npm run worker:provenance -- --once`; `scripts/validate-media.mjs`; `.local/provenance/outputs/` | Requires FFmpeg/ffprobe locally; managed worker remains unverified |
| Provenance API handles concurrent requests | Partially verified | `npm run load:test:provenance` | Local concurrency only; no production API, queue, AEM, or render-throughput evidence |
| Worker leases/retries/timeouts exist | Partially verified | `db/migrations/002_worker_leases.sql`; worker code; real leased render | Successful lease path verified; forced crash/retry test remains |
| Human SSO and role authorization exist | Planned | `docs/identity-and-access.md`, ADR-007 | No OIDC callback, session, or authorization middleware yet |
| Adobe IMS OAuth service identity is used | Partially verified | AEM token manager and configuration | Local token path exists; production secret rotation/policy pending |
| Multi-user drafts and approvals exist | Planned | PRD and PostgreSQL schema target | UI state is local; API authorization is not implemented |

## Quality and security claims

| Claim | Status | Evidence | Limitation |
|---|---|---|---|
| Runtime input validation exists | Verified | Zod schemas and 41 tests | Production API auth still required |
| Provenance API has payload limits and lifecycle validation | Verified | `src/provenance/`; provenance tests | Local Vite middleware only |
| Browser does not receive AEM credentials | Partially verified | server-side proxy and dynamic Node imports | Production deployment must preserve the boundary |
| Production-grade security | Not verified | `docs/production-readiness.md` lists controls | Auth, authorization, rate limits, headers, scanning, and threat tests remain |
| Production-grade resilience | Not verified | PostgreSQL/worker reference implementation | Managed queues, worker isolation, backups, alerts, and recovery remain |
| Community contributor readiness | Verified | governance docs, templates, CODEOWNERS, CI | Maintainer response process still depends on repository operations |

## Reproduction commands

```bash
npm run validate
npm run build:web
npm run check:docs
npm run verify:provenance:db
DATABASE_URL=postgresql://remotion:remotion_local_dev@127.0.0.1:55432/remotion_provenance \
  npm run worker:provenance -- --once
```

For AEM evidence, configure a non-secret `.env` and run:

```bash
npm run verify:aem
npm run render:live:aem
```

For browser evidence, start the web server and use Playwright against the local
URL. Record the URL, commit, source campaign, format, console errors, and artifact
path in the review or release record.

## Current honest product statement

> This repository contains a verified AEM/Remotion showcase foundation with a
> local PostgreSQL provenance path and reference render worker. It is not yet a
> generally available production service with identity, authorization, managed
> workers, or Cloud Service deployment evidence.
