# Guiding Principles

These principles explain how to build a credible, extensible product without
turning an early showcase into a prematurely complex platform.

## 1. Start with a narrow promise

Name the one customer outcome the system proves. For this project: structured AEM
content becomes governed, previewable, multi-format motion. Every feature should
strengthen that loop or wait for customer evidence.

## 2. Make ownership explicit

Give each system one job:

- AEM owns authored content and asset references.
- The application owns validation, policy, and orchestration.
- The design system owns visual and motion rules.
- Remotion owns composition and frame output.
- FFmpeg validates media artifacts.
- PostgreSQL owns durable workflow and provenance.
- Object storage or DAM owns binary delivery.

When two systems appear to own the same concern, define an adapter or remove the
duplication.

## 3. Build one contract, then reuse it

Validate external data at the boundary and map it into a domain model. Preview,
render, tests, provenance, and alternate engines should consume that same validated
contract. This prevents the demo from becoming a separate product from the thing
that eventually ships.

## 4. Prefer replaceable edges over speculative platforms

Use interfaces around persistence, rendering, identity, and delivery. Implement one
useful adapter first. Do not add a second engine, queue, or database abstraction until
there is a customer-backed reason to do so.

## 5. Make claims earn their adjectives

Classify capabilities as verified, partially verified, planned, or not verified.
Attach every strong claim to a test, artifact, integration record, or reproducible
command. “Production-quality foundation” is precise; “enterprise-ready” is a gate.

## 6. Turn failures into designed states

Validate input, show useful fallbacks, record lifecycle transitions, retry bounded
failures, and reject bad output before publication. A failure that is visible and
recoverable is part of the product, not an afterthought.

## 7. Keep the demo cinematic and the system legible

Use a strong first reveal, real-looking content, meaningful motion, and a small
number of high-signal controls. Put depth in the architecture and evidence, not in
an ever-growing editor surface.

## 8. Separate showcase readiness from production readiness

A showcase needs a repeatable happy path and honest boundaries. Production additionally
needs identity, authorization, isolation, managed infrastructure, observability,
backups, recovery, security testing, ownership, and support. Do not hide those gates
inside marketing language.

## 9. Document decisions at the boundary

Record why a technology was chosen, what it owns, what it does not own, and what
evidence would change the decision. A concise decision log is more reusable than a
large implementation diary.

## 10. Optimize for the next proof

After the core loop works, choose the smallest experiment that reduces the largest
risk: a real AEM Cloud Service campaign, a failed render recovery, a second format,
a customer review, or a security test. Progress is evidence, not feature count.

## Reusable review questions

Before calling another project ready for its next stage, ask:

1. What exact promise does the demo prove?
2. Which system owns each important concern?
3. What is verified by a repeatable artifact?
4. What is only designed or locally demonstrated?
5. What failure states are visible and recoverable?
6. What production gates are still open?
7. What is the next smallest proof that materially reduces risk?
