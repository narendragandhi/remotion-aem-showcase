# Architecture and Product Decision Log

Decisions are append-only. If a decision changes, add a superseding record and
link the old record; do not silently rewrite history.

## ADR-001 — Use AEM Content Fragments as campaign input

- **Status:** Accepted
- **Decision:** Treat structured AEM Content Fragment data as the authored source
  of campaign intent and use GraphQL as the integration boundary.
- **Why:** It preserves existing AEM governance, permissions, localization, and
  authoring workflows while giving the video system a stable contract.
- **Consequences:** The product must maintain schema mapping, defaults, validation,
  and AEM compatibility documentation.
- **Reconsider if:** the primary customer source becomes an external campaign
  database or an event stream with stronger guarantees.
- **Trace:** `PRD-G01`, `ARCH-01`, `SPEC-AEM-01`.

## ADR-002 — Use Remotion for the active renderer

- **Status:** Accepted
- **Decision:** Use React/Remotion for composition, browser preview, and server
  rendering in the current product.
- **Why:** One composition model can serve Player preview and MP4 output, and the
  existing project already demonstrates deterministic multi-format rendering.
- **Consequences:** Remotion licensing and operational requirements remain part of
  the product decision; render workers must be provisioned appropriately.
- **Reconsider if:** licensing, scale economics, or a customer requirement makes a
  renderer-neutral implementation materially better.
- **Trace:** `PRD-G02`, `PRD-G04`, `SPEC-RENDER-01`.

## ADR-003 — Keep a renderer-neutral seam

- **Status:** Accepted; alternate adapter not implemented
- **Decision:** Keep content contracts and design tokens independent from Remotion,
  and register alternate engine capability explicitly.
- **Why:** It reduces migration risk and allows an open-source path to be evaluated
  without forcing the product to support two renderers prematurely.
- **Consequences:** `src/rendering/engines.ts` is a registry, not a working second
  renderer. Claims must distinguish active from adapter-ready.
- **Reconsider if:** the seam begins adding abstraction without a concrete use case.
- **Trace:** `PRD-G06`, `ARCH-04`, `ARCH-07`.

## ADR-004 — Adopt an Open Design-inspired documentation shape

- **Status:** Accepted
- **Decision:** Use a portable, Markdown-based design contract covering color,
  typography, spacing, layout, components, motion, voice, brand, anti-patterns,
  and delivery.
- **Why:** It makes the visual system inspectable, portable, and re-engineerable,
  while keeping the project’s visual language original.
- **Consequences:** `DESIGN.md` becomes a versioned contract; visual changes need
  token and documentation updates, not only CSS/JS edits.
- **Reconsider if:** a formal external design-system package provides better
  governance without reducing portability.
- **Trace:** `PRD-G03`, `SPEC-DESIGN-01`, `DESIGN.md`.

## ADR-005 — Keep Dynamic Media complementary

- **Status:** Accepted
- **Decision:** Use Dynamic Media for image delivery, transformation, and rendition
  optimization; use this product for sequencing, animation, brand logic, and video.
- **Why:** It avoids duplicating Adobe’s asset delivery capability and clarifies the
  product boundary.
- **Consequences:** Asset URLs and rendition rules must be tested independently from
  timeline/render behavior.
- **Reconsider if:** the product expands into asset transformation or delivery.
- **Trace:** `PRD` non-goals, `SPEC-AEM-01`, `docs/aem-integration-guide.md`.

## ADR-006 — Prefer deterministic native motion over Lottie for the core demo

- **Status:** Accepted
- **Decision:** Use frame-driven React/Remotion motion and WASM/JS effects as the
  primary visual system; retain Lottie fields for compatibility/future support.
- **Why:** Deterministic rendering and browser/headless reliability are more valuable
  for the core product path than arbitrary animation-file compatibility.
- **Consequences:** The visual system has fewer arbitrary effects, but template
  behavior is more predictable.
- **Reconsider if:** customer-authored animation assets become a priority and a
  supported runtime can guarantee render parity.
- **Trace:** `DESIGN.md`, `src/wasm/`, `STATUS.md`.

## ADR-007 — Separate human identity from AEM service identity

- **Status:** Accepted; implementation planned
- **Decision:** Authenticate application users through OIDC, with SAML federation
  supported through the customer’s enterprise identity provider. Authenticate the
  application to AEM using Adobe IMS OAuth Server-to-Server credentials.
- **Why:** Human sessions need organization-managed SSO, role mapping, revocation,
  and audit identity. AEM API access needs a short-lived service token and must not
  depend on a browser session or expose an AEM secret.
- **Role mapping:** `campaign.viewer`, `campaign.editor`, `campaign.approver`,
  `campaign.renderer`, and `platform.admin`. The API enforces roles server-side.
- **Consequences:** The application needs an OIDC callback/session boundary,
  tenant/org mapping, authorization middleware, and a managed secret store for
  Adobe credentials. A local development bypass may remain enabled only when the
  app is bound to localhost.
- **Reconsider if:** the product is deployed entirely inside an Adobe-hosted shell
  that provides an authoritative user session and role context.
- **Trace:** `SEC-01`, `SEC-02`, `ARCH-05`, `SPEC-OPS-01`.
