# Template Development Guide

Templates are the main extension point for contributors. A template is a governed
product contract plus a composition implementation, not only a React component.

## Required pieces

1. Stable template ID and semantic version.
2. Required and optional content fields.
3. Supported ratios and dimensions.
4. Safe-area and maximum-copy rules.
5. Brand token set and motion semantics.
6. Fallback behavior for missing images or optional fields.
7. Fixture data covering normal and boundary cases.
8. Unit validation tests and at least one smoke render.
9. README/spec updates and an ADR for a new architectural boundary.

## Recommended implementation sequence

1. Add or update the domain schema only if the content contract requires it.
2. Add a versioned template descriptor in `src/templates/`.
3. Implement composition behavior using `src/design-system/motion.ts`.
4. Register supported output compositions in `src/index.tsx`.
5. Add Player selection only after the composition is renderable from fixtures.
6. Add provenance metadata so outputs identify the template version.

## Review checklist

- Does the template work in mock mode without AEM?
- Does the Player use the same props and composition as the renderer?
- Are text overflow and portrait behavior handled?
- Does every effect communicate content or state?
- Are authored values validated and bounded?
- Are output dimensions and safe areas documented?
- Are `npm run validate`, `npm run build:web`, `npm run check:docs`, and a smoke
  render clean?
