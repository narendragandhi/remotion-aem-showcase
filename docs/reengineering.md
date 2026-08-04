# Re-engineering and Parity Guide

This guide describes how to rebuild the product without relying on undocumented
implementation details. Rebuild from the contracts first, then choose an engine.

## 1. Minimum contract set

Read these in order:

1. [PRD](PRD.md) — what the product promises.
2. [Architecture](architecture.md) — boundaries and runtime flows.
3. [Technical specifications](specifications.md) — executable contracts.
4. [Design contract](../DESIGN.md) — visual/motion behavior.
5. [Decision log](decision-log.md) — why the boundaries exist.
6. [Domain model](domain-model.md) — AEM translation and invariants.

## 2. Rebuild sequence

### Step 1: Implement the domain contract

Create the `AemSpotlight` aggregate and scene schema. Add defaults, enum checks,
duration validation, color validation, and tests before building a UI.

### Step 2: Implement the AEM anti-corruption layer

Implement configuration, authentication, GraphQL query, asset URL resolution, and
mapping. Keep raw GraphQL types out of compositions. Add mock fixtures so the
system runs without AEM.

### Step 3: Implement the template contract

Create a versioned Spotlight template with declared fields, ratios, safe areas,
fallbacks, and maximum copy lengths. Make the template consume only the domain
contract and design tokens.

### Step 4: Implement deterministic composition

At 30fps, derive total duration from scene durations, sequence scenes, and use
frame-based interpolation/springs. Implement the design-system timing constants and
verify representative frames for every aspect ratio.

### Step 5: Implement preview and render using the same composition

The Player and CLI renderer must share the composition and props. Do not create a
separate “preview approximation” that can drift from final output.

### Step 6: Add operational boundaries

Add server-side secrets, caching, typed errors, health checks, telemetry, and a
render provenance record. Only then add production persistence or queues.

### Step 7: Add alternate engines only behind the contract

An alternate renderer must consume the same campaign, template, token, and output
contracts. It must pass parity tests for timing, text, format dimensions, and key
visual states before being described as supported.

## 3. Parity test vectors

Use the existing mock scenarios as canonical fixtures:

- `src/mock/aem.json` — baseline spotlight;
- `src/mock/examples/loyalty_year_in_review.json`;
- `src/mock/examples/social_localized_news.json`;
- `src/mock/examples/global_campaign_multilang.json`;
- `src/mock/examples/ecommerce_product_spotlight.json`.

For each fixture verify:

- parsed aggregate and scene count;
- computed duration;
- fallback behavior for missing optional fields;
- all four output dimensions;
- title/CTA safe-area behavior;
- effect fallback when WASM is unavailable;
- valid preview and at least one valid MP4.

## 4. Evidence checklist

Record the following for every reimplementation or major change:

```text
Repository revision:
Design system version:
Template ID/version:
Engine/version:
AEM endpoint/tier:
Fixture or fragment path:
Output formats:
Validation commands:
Rendered artifacts:
Known deviations:
```

## 5. What is not yet re-engineerable from code alone

The following need future explicit contracts before they can be rebuilt with full
parity:

- durable draft/review persistence;
- multi-user authorization and conflict resolution;
- render queue/job lifecycle;
- content revision provenance;
- captions and audio behavior;
- production VideoFlow adapter;
- formal template package/distribution format.
