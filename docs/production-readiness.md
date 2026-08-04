# Production Readiness Assessment

Assessment version: 0.1.0  
Date: 2026-08-03  
Overall status: **Showcase-grade foundation; not yet approved for unrestricted production deployment**

## Executive assessment

The repository is a strong production-quality demo foundation. It demonstrates the
core product loop: structured AEM content becomes a validated campaign, previews in
the browser, and renders into multiple video formats.

It is not yet a production-grade multi-user application because identity, durable
operational infrastructure, authorization, render orchestration, and Cloud Service
verification are incomplete.

## Readiness scorecard

| Area | Status | Evidence / gap |
|---|---|---|
| Product behavior | Strong | AEM GraphQL, Player, multi-scene, multi-format render |
| Code quality | Strong foundation | TypeScript, Zod, tests, lint, formatting, CI |
| Documentation | Strong | PRD, architecture, specs, ADRs, contributor workflow |
| Preview experience | Demo-ready | Live AEM and mock paths; local drafts only |
| Rendering | Demo-ready | Remotion renders and smoke evidence; no job worker yet |
| Provenance | Partial | Local JSON adapter; production database needed |
| Identity/authentication | Not production-ready | Local API routes are unauthenticated |
| Authorization | Not production-ready | No campaign/template/format policy enforcement |
| AEM production integration | Incomplete | Local Author verified; Cloud Service/publish tier pending |
| Operational resilience | Incomplete | No queue, retries, worker isolation, backups, or recovery plan |
| Security hardening | Incomplete | Needs validation, rate limits, asset policy, headers, scanning |

## Security boundary assessment

### Current protections

- AEM credentials are intended to remain server-side.
- Human identity is planned as OIDC/SAML federation; AEM access is planned as Adobe IMS OAuth Server-to-Server.
- Node-only authentication modules are excluded from the browser path.
- AEM responses pass through runtime schemas and domain mapping.
- Typed errors and fallbacks make integration failures visible.
- Secrets and local provenance data are gitignored.

### Required before production

| ID | Control | Requirement |
|---|---|---|
| SEC-01 | Authentication | Require organizational identity for every backend/API request. |
| SEC-02 | Authorization | Enforce campaign, template, AEM tier, format, and approval permissions. |
| SEC-03 | API validation | Parse every request with schemas; reject unknown, oversized, or unsafe payloads. |
| SEC-04 | Asset policy | Allowlist AEM/Dynamic Media hosts and prevent arbitrary remote asset fetches. |
| SEC-05 | Abuse controls | Add rate limits, request timeouts, render quotas, and body-size limits. |
| SEC-06 | Browser security | Add security headers, CSP, secure cookies, CSRF protection, and safe CORS policy. |
| SEC-07 | Secrets | Use managed secret storage and short-lived service credentials. |
| SEC-08 | Supply chain | Run dependency audit/scanning and review lockfile changes. |
| SEC-09 | Audit | Store immutable actor, approval, content revision, template, and output events. |
| SEC-10 | Privacy | Define content retention, deletion, logging redaction, and regional storage rules. |

## Production architecture required

```text
Authenticated browser
        |
        v
Application API + authorization
        |
        +--> PostgreSQL: campaigns, revisions, approvals, provenance, jobs
        +--> Queue: render requests and retries
        +--> Render workers: isolated Remotion processes
        +--> AEM GraphQL/DAM: governed content and source assets
        +--> Object storage or AEM DAM: outputs and thumbnails
        +--> Observability: logs, metrics, traces, alerts
```

The current Vite API and `.local/provenance/jobs.json` are development adapters.
They must not be exposed as production services.

## Quality gates before production approval

1. Cloud Service Author and Publish tier verification.
2. Authenticated API integration tests.
3. PostgreSQL persistence and migration tests.
4. Render queue lifecycle tests, including retry and failure behavior.
5. Asset allowlist and SSRF regression tests.
6. Browser security-header and CSRF tests.
7. Backup/restore and retention test.
8. Load test for concurrent preview and render requests.
9. Dependency and container vulnerability scan.
10. Incident-response runbook and operational ownership.

## Release language

Until these controls are complete, use:

> “Production-quality AEM/Remotion showcase foundation.”

Avoid:

- “Secure for unrestricted production use”
- “Enterprise-ready” without identity, authorization, operations, and AEM Cloud evidence
- “Real-time rendering” when rendering is asynchronous
- “Auditable” when provenance is only stored locally
