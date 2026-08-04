# Product Documentation

This directory is the source of truth for product intent, architecture, contracts,
and engineering decisions. Documents use stable identifiers so requirements can be
traced to implementation and verification.

## Document map

| Document | Purpose | Status |
|---|---|---|
| [PRD](PRD.md) | Product goals, users, scope, outcomes, and release criteria | Baseline |
| [Architecture](architecture.md) | System boundaries, data flow, runtime topology, and security | Baseline |
| [Technical specifications](specifications.md) | Normative contracts for content, templates, preview, rendering, and operations | Baseline |
| [Decision log](decision-log.md) | Why major choices were made and what would cause reconsideration | Active |
| [Re-engineering guide](reengineering.md) | How to rebuild the system from contracts and verify parity | Active |
| [Spec-driven development](spec-driven-development.md) | Required workflow from requirement through verification | Active |
| [Production readiness](production-readiness.md) | Quality, security, and operational readiness assessment | Active |
| [Provenance API](provenance-api.md) | Local render-job contract and production replacement boundary | Active |
| [Production database](../db/README.md) | PostgreSQL provenance, review, output, and audit schema | Baseline |
| [Identity and access](identity-and-access.md) | Human SSO, roles, AEM service credentials, and authorization plan | Baseline |
| [Evidence matrix](evidence-matrix.md) | Verified facts, planned claims, and reproducible proof | Active |
| [Launch plan](launch-plan.md) | Staged path from showcase to design-partner beta | Active |
| [Guiding principles](guiding-principles.md) | Reusable product and architecture principles | Active |
| [Load testing](load-testing.md) | Local concurrency test and production capacity path | Active |
| [EDS compatibility](eds-compatibility.md) | Edge Delivery Services fit and adapter boundary | Active |
| [Design contract](../DESIGN.md) | Visual, motion, voice, and delivery rules | Active |
| [Domain model](domain-model.md) | AEM-to-domain translation and invariants | Active |
| [Positioning and support](positioning-and-support.md) | Customer promise and support boundary | Active |
| [AEM integration guide](aem-integration-guide.md) | Configuration and AEM setup | Active |
| [Project status](../STATUS.md) | Implemented capabilities and known limitations | Snapshot |

## Traceability convention

- `PRD-*` identifies a product requirement.
- `ARCH-*` identifies an architecture rule.
- `SPEC-*` identifies a technical contract.
- `ADR-*` identifies a decision record.
- `TEST-*` identifies verification evidence or a required verification step.

Current evidence labels include `TEST-AEM` for the local AEM Author GraphQL and
live render path, and `TEST-LOCAL` for repository-only validation. A pull request
should replace these labels with links to its CI run, artifact, or test output.

When changing behavior, update the relevant requirement or specification first,
then the implementation and tests. A decision record should be added when the
change affects a boundary, contract, license, security posture, or customer promise.

## Status vocabulary

- **Implemented**: exists in the repository and has automated or documented evidence.
- **Verified**: implemented and checked against a real integration or render.
- **Planned**: accepted scope that is not implemented yet.
- **Adapter-ready**: boundary exists, but the alternate implementation is not complete.
- **Out of scope**: intentionally not promised by this product version.
