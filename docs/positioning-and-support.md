# AEM Video Factory: Positioning & Support

## Product position

**AEM Video Factory turns governed AEM content into reusable, on-brand video
compositions that can be previewed, personalized, and delivered in every channel
format.**

Short version:

> Author once in AEM. Preview instantly. Render every video format from one brand system.

This is a content-to-video product for AEM teams, not a general-purpose video editor.
Its advantage is the connection between structured content, reusable motion design,
and repeatable rendering.

## Primary audience

- **AEM teams:** own Content Fragment Models, DAM assets, permissions, and publishing.
- **Brand and creative teams:** own templates, motion rules, typography, and visual QA.
- **Marketing operations:** need localized, personalized, multi-format output at scale.
- **Developers and agencies:** integrate render requests into campaigns and workflows.

## Four product pillars

| Pillar | Customer outcome | Current foundation | Product support needed |
|---|---|---|---|
| Video composition & animation | Consistent motion without hand-editing every video | `SpotlightComposition`, scene sequencing, animation presets, effects | Versioned templates, transition rules, captions, audio, safe-area validation |
| Brand/template systems | Authors can change content without breaking the brand | Brand color, CTA, image, animation, and effect fields | Template packages, brand tokens, font policy, approval/versioning, template previews |
| Dynamic AEM data | Published content drives the rendered video | GraphQL mapping, schema validation, live metadata loading | AEM permissions, OAuth validation, cache policy, webhook/event triggers, audit trail |
| Preview via Remotion Player | Stakeholders can review before rendering | Web Player with mock scenarios and ratio controls | Live CF preview, draft/published mode, scene timeline, shareable review links |

## What we support

### Video composition and animation

Supported now:

- Ordered multi-scene compositions
- 16:9, 9:16, 1:1, and 4K output targets
- Cinematic, energetic, and minimal presets
- Frame-driven pulse/glow and glitch effects
- AEM-driven scene duration and visual configuration

Next product-grade additions:

- Template versioning and backwards-compatible migrations
- Audio, captions, and accessibility-safe typography
- Explicit transition configuration between scenes
- Automated safe-area and text-overflow checks

### Brand and template systems

The product should treat templates as governed assets, not arbitrary code. Each
template needs a stable identifier, supported fields, aspect-ratio behavior,
brand constraints, and a version.

Recommended template contract:

```ts
type VideoTemplate = {
  id: string;
  version: string;
  supportedRatios: Array<"16x9" | "9x16" | "1x1" | "4K">;
  requiredFields: string[];
  brandTokenSet: string;
};
```

### Dynamic AEM data

The supported flow is:

```text
AEM Content Fragment
  → GraphQL contract
  → validated domain model
  → template props
  → Player preview or server render
```

Production support must preserve the distinction between author preview, publish
content, and an explicitly supplied render payload. Every render should record the
fragment path, template version, content revision, and output formats.

### Preview via Remotion Player

The Player is the review surface for authors and stakeholders. It should support:

- Selecting a Content Fragment or campaign
- Switching output ratios
- Scrubbing scenes and reviewing timing
- Showing validation warnings before render
- Comparing draft and published content
- Starting a render only after approval

## Support boundaries

We support the template engine, AEM data contract, preview behavior, and rendering
outputs. We do not promise that arbitrary AEM fields, arbitrary third-party fonts,
or arbitrary Lottie files will render without template-specific support.

Every supported template should publish a compatibility matrix covering:

- AEM fields and fallback behavior
- Image and font requirements
- Supported aspect ratios
- Maximum text lengths
- Audio/caption requirements
- Render duration and output constraints

## Positioning language

Use:

- “AEM-native video automation”
- “Structured content to multi-format video”
- “One governed template, every channel format”
- “Preview in the browser, render on demand”

Avoid:

- “AI video editor” unless AI authoring is actually included
- “No-code video creation” while templates still require engineering
- “Real-time rendering” when output is an asynchronous render job
- “Supports every AEM field” without a published template contract

## Success criteria for the first product release

- A user can select one live AEM Content Fragment in the Player.
- The same content previews correctly in all supported ratios.
- An approved preview produces a valid MP4 for each selected ratio.
- The render records its template version and AEM content revision.
- A failed asset or validation issue is visible before a production render.
