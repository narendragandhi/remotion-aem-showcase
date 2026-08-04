/**
 * AEM Campaign Motion System, documented in the repository DESIGN.md.
 *
 * These tokens are renderer-neutral: Remotion, VideoFlow, or another engine
 * can consume the same palette, typography, spacing, and timing language.
 */
export const AURORA = {
  colors: {
    night: "#090B16",
    ocean: "#0E3B5A",
    electric: "#1473E6",
    mint: "#82FFCA",
    amber: "#FFB84D",
    violet: "#C8A8FF",
    white: "#FFFFFF",
    muted: "rgba(255,255,255,0.62)"
  },
  typography: {
    displayTracking: "-0.06em",
    eyebrowTracking: "0.24em",
    labelTracking: "0.14em"
  },
  spacing: {
    safeArea: "8%",
    cardRadius: "1.5rem",
    panelRadius: "0.75rem"
  },
  timing: {
    introFrames: 90,
    sceneExitFrames: 18,
    characterStaggerFrames: 2
  }
} as const;

export type AuroraMotionTokens = typeof AURORA;
