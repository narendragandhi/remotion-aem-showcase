# Spec-Driven Development Workflow

This repository treats product specifications as the starting point for behavior
changes. Code and tests implement an agreed contract; they do not silently define
the product after the fact.

## Workflow

```text
Problem
  -> PRD requirement
  -> architecture/spec decision
  -> ADR when a boundary changes
  -> implementation
  -> tests and rendered evidence
  -> PR review and status update
```

## Before implementation

1. Describe the user or system problem.
2. Add or identify a stable requirement ID (`PRD-*`).
3. Define the technical contract (`SPEC-*`).
4. Update architecture rules (`ARCH-*`) if a boundary changes.
5. Add an ADR (`ADR-*`) for technology, license, security, persistence, or
   product-boundary decisions.
6. State what is out of scope and how compatibility will be preserved.

Small typo fixes and localized refactors may use the PR description as their
specification, but behavior changes still need traceability.

## During implementation

- Keep external data behind schemas and domain mappers.
- Add tests from the acceptance criteria, including failure paths.
- Update executable contracts and documentation together.
- Add fixtures for new AEM fields, templates, formats, or provenance states.
- Add visual evidence for Player/composition changes.
- Mark work as implemented, partial, planned, or adapter-ready.

## Before merge

The pull request must identify:

- requirement/spec/ADR IDs;
- changed contracts and migration impact;
- tests and commands run;
- render, screenshot, or AEM evidence where relevant;
- known limitations and follow-up work.

Required baseline checks:

```bash
npm run validate
npm run format:check
npm run check:docs
npm run build:web
```

Composition changes also require a smoke still or MP4. AEM integration changes
require `npm run verify:aem` when an environment is available.

## Definition of done

A change is complete only when:

- the behavior is specified;
- implementation and tests agree with the specification;
- the relevant docs and decision records are updated;
- verification evidence exists;
- unsupported behavior is explicitly documented;
- the PR is reviewable by someone who did not author the implementation.

## Releasing

Release notes must summarize contract changes, migration requirements, verification
evidence, and known limitations. See [RELEASES.md](../RELEASES.md).
