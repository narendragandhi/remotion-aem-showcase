# Domain Model & DDD Context

## Bounded contexts
- **Content Delivery (AEM):** Manages content fragments, color tokens, and image assets. GraphQL acts as the anti-corruption layer—`fetchAemSpotlight` translates raw nodes into our domain objects.
- **Video Delivery (Remotion MCP):** Focuses on rendering timelines, typography, animation, and AEM-derived metadata. The domain model ensures the Remotion composition only relies on intent, not implementation details of AEM.

## Aggregate root: `AemSpotlight`
| Attribute | Description | Invariant |
|-----------|-------------|-----------|
| `id` | Root fragment path | Never empty.
| `scenes` | Ordered list of scenes | Minimum 1 scene; total duration is sum of scene durations.

## Aggregate entity: `SpotlightScene`
| Attribute | Description | Invariant |
|-----------|-------------|-----------|
| `title` | Hero headline | Defaults to `Untitled`.
| `subtitle` | Supporting line | Optional but stored as empty string when absent.
| `cta` | CTA copy | Defaults to `Learn more`.
| `brandColor` | Background token | Validated via CSS; fallback `#0E3B5A`.
| `imageUrl` | Visual asset | Accepts absolute URLs.
| `durationSeconds` | Scene span | Cast to `number`.
| `animationStyle` | Motion preset | Enum: `cinematic`, `energetic`, `minimal`.
| `renditionType` | Asset quality | Enum: `web`, `optimized`, `original`.
| `effectType` | Visual filter | Enum: `none`, `glow`, `glitch`.
| `effectIntensity` | Filter strength | Float (0.0 to 1.0).
| `lottieUrl` | Animated asset | URL to Lottie JSON.
| `svgOverlayUrl` | Static overlay | URL to SVG asset.

## Value objects
- `SpotlightColor`: origin from AEM brand tokens mapped to CSS. Presentation logic (in `SpotlightComposition`) only sees the final hex string.
- `SpotlightDuration`: derived by `durationSeconds * FPS`; ensures the MCP timeline never relies on raw GraphQL numbers without validation.

## Domain services / translation
- `mapAemItemToSpotlight` acts as a domain service transforming GraphQL nodes into our aggregate root. Tests (`src/aem/aemClient.test.ts`) codify the invariants before any consumer builds UI layers.
- Future services can extend this module with caching, validation, or transformation rules that remain independent of the Remotion implementation.
