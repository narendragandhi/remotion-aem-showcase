# Contributing

Thanks for helping improve AEM Video Factory. This repository is a product
prototype with a real AEM/Remotion integration, so changes should preserve both
the demo experience and the documented product boundaries.

## Start here

1. Read the [documentation index](docs/README.md).
2. Read the [PRD](docs/PRD.md), [architecture](docs/architecture.md), and
   [technical specifications](docs/specifications.md).
3. Follow the [re-engineering and parity guide](docs/reengineering.md) when
   adding a renderer, template, or integration.
4. Look for an existing issue before opening a new one.

All behavior changes follow the [spec-driven development workflow](docs/spec-driven-development.md).
Production-impacting changes must also update the [production readiness assessment](docs/production-readiness.md).

## Local setup

```bash
npm install
cp .env.example .env
npm run dev:web
```

The default web experience uses mock data. To use the local AEM Author instance,
set `AEM_BASE_URL`, `AEM_TOKEN`, `USE_MOCK_AEM=false`, and the GraphQL/fragment
settings in `.env`. Never commit `.env` or credentials.

## Common commands

| Command | Purpose |
|---|---|
| `npm run dev:web` | Start the Player workspace |
| `npm start` | Start the Remotion preview |
| `npm run validate` | Typecheck, lint, and unit tests |
| `npm run build:web` | Build the Player for production |
| `npm run test:smoke` | Render representative stills |
| `npm run check:docs` | Verify local Markdown links |
| `npm run verify:aem` | Check configured AEM connectivity |

## What to update

- Behavior change: update the relevant PRD/spec and tests.
- Boundary or technology change: add an ADR to `docs/decision-log.md`.
- Visual or motion change: update `DESIGN.md` and representative stills.
- AEM model change: update `aem-config/`, `docs/aem-integration-guide.md`, and
  schema/client tests.
- New template: add a versioned template contract, fixture, validation tests,
  and the extension guide in `docs/template-development.md`.

## Pull requests

Keep changes focused and explain the user or system problem, changed contract,
compatibility impact, verification performed, visual evidence, and any AEM
assumptions. All PRs must pass CI. Do not include secrets, generated videos,
coverage output, `.local` data, or browser session artifacts.

## Commit style

Use concise imperative commits with a conventional prefix where practical:

```text
feat(player): add render provenance history
fix(aem): reject invalid scene durations
docs(contributing): explain template extension workflow
test(provenance): cover failed job transitions
```

Prefer the smallest change that satisfies the contract. If a feature is not
production ready, label it as planned, partial, or adapter-ready.
