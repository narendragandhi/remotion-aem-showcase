# Release Process

## Versioning

Use semantic versioning for published releases:

- patch: fixes with no contract change;
- minor: backward-compatible features or template additions;
- major: breaking content, template, API, or deployment contracts.

## Release checklist

1. Update `STATUS.md` and the relevant PRD/spec/ADR.
2. Run `npm run validate`, `npm run build:web`, and `npm run check:docs`.
3. Run a representative mock render and, when configured, live AEM verification.
4. Record supported composition IDs and known limitations.
5. Update release notes with migration notes.
6. Tag the commit as `vX.Y.Z` and attach verified MP4/still artifacts when useful.

## Compatibility policy

Content and template contracts are public product surfaces. Breaking changes
require migration notes, updated fixtures, and an ADR. Renderer changes must not
silently change the content contract.
