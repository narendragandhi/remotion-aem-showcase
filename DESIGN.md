# AEM Campaign Motion System

Version: 0.1.0  
Direction: editorial data cinema  
Primary surface: marketer campaign workspace + generated video

This is the visual contract for the AEM campaign showcase. It follows the
portable design-system shape used by Open Design while remaining original to
this project. The same decisions must hold in the Player, Remotion renders,
and future VideoFlow/browser-native adapters.

## 1. Color

| Token | Value | Use |
|---|---|---|
| `night` | `#090B16` | Canvas and intro background |
| `ocean` | `#0E3B5A` | AEM brand foundation |
| `electric` | `#1473E6` | Actions and active controls |
| `mint` | `#82FFCA` | Live signal, success, authored data |
| `amber` | `#FFB84D` | Proof, attention, motion intensity |
| `violet` | `#C8A8FF` | Publish and multi-format output |
| `white` | `#FFFFFF` | Primary type and contrast |

Content-authored `brandColor` and `accentColor` may override scene surfaces,
but must remain legible against the safe-area background.

## 2. Typography

- Display type is large, tight, and kinetic: tracking `-0.06em`.
- Eyebrows and data labels are uppercase with wide tracking.
- Headlines use character-level entrance motion only when the text is short
  enough to remain readable.
- Avoid more than two type scales in a single scene.

## 3. Spacing and layout

- Keep key content inside an 8% safe area on landscape compositions.
- Use 8px-derived spacing for panels and controls.
- Use asymmetric composition: text establishes intent, imagery provides energy,
  and data panels explain the system.
- Portrait layouts stack content and preserve the same reading order.

## 4. Components

- Campaign Intelligence intro
- Scene sequence rail
- Live Composition HUD
- Kinetic headline
- Dynamic image frame
- Metric signal bars
- Format readiness cards
- Review status control

Every component must be usable with AEM-authored content and must degrade to a
valid placeholder when optional assets are unavailable.

## 5. Motion

- Motion is frame-driven and deterministic.
- Intro duration: 90 frames at 30fps.
- Scene exits use an 18-frame fade.
- Kinetic characters stagger by 2 frames.
- Use spring motion for entrance and interpolation for progress.
- Prefer one dominant motion idea per scene: cinematic, energetic, or minimal.
- Effects must be meaningful: glow communicates signal, glitch communicates
  transformation, and parallax communicates depth.

## 6. Voice

- Confident, concise, and editorial.
- Write for marketers first and engineers second.
- Prefer verbs: “Author”, “Compose”, “Preview”, “Publish”.
- Data labels should be scannable: `MOTION READY`, `4 / 4`, `AEM LIVE SIGNAL`.

## 7. Brand

The product story is: structured AEM intent becomes expressive, multi-channel
motion. Dynamic Media supplies optimized assets; the campaign system supplies
meaning, sequencing, and branded animation.

The visual signature is dark editorial space, electric data accents, glass-like
information panels, and precise motion—not generic AI gradients or stock-video
montage.

## 8. Anti-patterns

- Do not add visual effects that do not communicate content or system state.
- Do not hardcode authored metrics into a template.
- Do not expose AEM credentials in browser code.
- Do not introduce a second design language for another rendering engine.
- Do not add controls that do not change preview, content, review, or delivery.
- Do not let panels cover headlines or crop essential image subjects.

## 9. Delivery contract

- Source of truth: AEM Content Fragment plus validated campaign overrides.
- Preview: Remotion Player today; browser-native and VideoFlow adapters may use
  the same contract.
- Render targets: 16:9, 9:16, 1:1, and 4K.
- Review states: draft, in-review, approved.
- Required verification: typecheck, lint, tests, production build, live AEM
  GraphQL check, and at least one real MP4 render.

