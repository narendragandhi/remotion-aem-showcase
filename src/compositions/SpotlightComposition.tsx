import {
  AbsoluteFill,
  continueRender,
  delayRender,
  interpolate,
  Img,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Series,
  staticFile,
} from "remotion";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  AemSpotlight,
  SpotlightScene,
  getDynamicRenditionUrl,
  AnimationStyle,
} from "../aem/aemClient";
import {
  calculatePulse,
  calculateGlitch,
  warmupSpotlightWasm,
  isWasmAvailable,
} from "../wasm/spotlightEffects";
import {
  SpotlightErrorBoundary,
  AssetErrorPlaceholder,
} from "../components/ErrorBoundary";
import {
  trackRenderStart,
  trackRenderComplete,
  trackRenderError,
  trackError,
  trackPerformance,
  RenderMetrics,
} from "../telemetry";

export type SpotlightProps = {
  spotlight: AemSpotlight;
};

type AnimationConfig = {
  spring: { mass: number; damping: number; stiffness: number };
  text: { translateY: [number, number]; opacity: [number, number] };
  image: { scale: [number, number]; rotate: [number, number] };
};

const ANIMATION_PRESETS: Record<AnimationStyle, AnimationConfig> = {
  cinematic: {
    spring: { mass: 1.2, damping: 20, stiffness: 100 },
    text: { translateY: [60, 0], opacity: [0, 1] },
    image: { scale: [1.1, 1], rotate: [2, 0] },
  },
  energetic: {
    spring: { mass: 0.4, damping: 10, stiffness: 200 },
    text: { translateY: [100, 0], opacity: [0, 1] },
    image: { scale: [0.8, 1], rotate: [-5, 0] },
  },
  minimal: {
    spring: { mass: 1, damping: 20, stiffness: 100 },
    text: { translateY: [20, 0], opacity: [0, 1] },
    image: { scale: [1, 1], rotate: [0, 0] },
  },
};

/**
 * Frame-driven radial pulse background — replaces @remotion/lottie.
 * No async loading required; driven entirely by useCurrentFrame + spring.
 */
const PulseBackground: React.FC<{ color: string; fps: number }> = ({
  color,
  fps,
}) => {
  const frame = useCurrentFrame();
  // Slow breathe: one cycle every 90 frames (3 s at 30 fps)
  const cycle = frame % 90;
  const breathe = spring({ frame: cycle, fps, config: { mass: 2, damping: 40, stiffness: 40 } });
  const scale = interpolate(breathe, [0, 1], [1, 1.3]);
  const opacity = interpolate(breathe, [0, 1], [0.08, 0.18]);

  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div
        style={{
          position: "absolute",
          top: "50%",
          left: "50%",
          width: "140%",
          paddingBottom: "140%",
          transform: `translate(-50%, -50%) scale(${scale})`,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${color}cc 0%, ${color}00 70%)`,
          opacity,
        }}
      />
    </AbsoluteFill>
  );
};

const SpotlightSceneComponent: React.FC<{ scene: SpotlightScene }> = ({
  scene,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const [imageError, setImageError] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);

  // delayRender: Remotion holds every frame until continueRender is called,
  // ensuring WASM effects are ready before the first frame is captured.
  const [wasmHandle] = useState(() => delayRender("Warming up WASM effects"));

  const preset =
    ANIMATION_PRESETS[scene.animationStyle] || ANIMATION_PRESETS.minimal;
  const entrance = spring({ frame, fps, config: preset.spring });

  const isPortrait = height > width;
  const isSquare = Math.abs(height - width) < 10;

  // Initialize WASM — always unblock render when done (success or failure)
  useEffect(() => {
    warmupSpotlightWasm()
      .then(() => setWasmReady(true))
      .catch(() => {}) // graceful degradation: JS fallback will be used
      .finally(() => continueRender(wasmHandle));
  }, [wasmHandle]);

  // Calculate normalized progress for effects
  const normalized = Math.min(frame / Math.max(durationInFrames - 1, 1), 1);

  // WASM Effects (with graceful degradation to JS fallback)
  const glow =
    scene.effectType === "glow" && wasmReady
      ? calculatePulse(normalized, scene.effectIntensity)
      : scene.effectType === "glow"
      ? normalized * scene.effectIntensity
      : 0;
  const glitch =
    scene.effectType === "glitch" && wasmReady
      ? calculateGlitch(normalized, scene.effectIntensity)
      : 0;

  // Animation interpolations
  const textOpacity = interpolate(entrance, [0, 1], preset.text.opacity);
  const textTranslateY = interpolate(entrance, [0, 1], preset.text.translateY);
  const imageScale = interpolate(entrance, [0, 1], preset.image.scale);
  const imageRotate = interpolate(entrance, [0, 1], preset.image.rotate);

  // Responsive styling
  const basePadding = isPortrait ? "4rem" : "2rem";
  const titleFontSize = isPortrait ? "6rem" : isSquare ? "4.5rem" : "4rem";
  const subtitleFontSize = isPortrait ? "2rem" : "1.5rem";

  // Dynamic image URL with AEM rendition optimisation
  const dynamicImageUrl = getDynamicRenditionUrl(
    scene.imageUrl,
    width,
    height,
    scene.renditionType
  );

  const handleImageError = useCallback(() => {
    console.error("[Image] Failed to load:", scene.imageUrl);
    setImageError(true);
  }, [scene.imageUrl]);

  return (
    <AbsoluteFill
      style={{
        backgroundColor: scene.brandColor,
        filter:
          scene.effectType === "glitch"
            ? `hue-rotate(${glitch * 20}deg) blur(${Math.abs(glitch) * 2}px)`
            : "none",
      }}
    >
      {/* Native Remotion pulse background — frame-driven, no async loading */}
      <PulseBackground color="#ffffff" fps={fps} />

      {/* Main Content */}
      <div
        style={{
          padding: basePadding,
          display: "flex",
          flexDirection: isPortrait ? "column" : "row",
          width: "100%",
          height: "100%",
          alignItems: "center",
          justifyContent: "center",
          gap: "2rem",
          zIndex: 1,
        }}
      >
        {/* Text Content */}
        <div
          style={{
            flex: isPortrait ? "0 0 auto" : 1,
            opacity: textOpacity,
            transform: `translateY(${textTranslateY + glitch * 10}px)`,
            textAlign: isPortrait ? "center" : "left",
            display: "flex",
            flexDirection: "column",
            alignItems: isPortrait ? "center" : "flex-start",
            zIndex: 2,
            color: "#ffffff",
          }}
        >
          <p
            style={{
              fontSize: subtitleFontSize,
              textTransform: "uppercase",
              margin: 0,
              letterSpacing: "0.1em",
              fontWeight: 500,
            }}
          >
            {scene.subtitle}
          </p>
          <h1
            style={{
              margin: "0.5rem 0",
              fontSize: titleFontSize,
              lineHeight: 1.1,
              fontWeight: 700,
            }}
          >
            {scene.title}
          </h1>
          <p
            style={{
              fontSize: "1.25rem",
              maxWidth: "28rem",
              opacity: 0.9,
              lineHeight: 1.5,
            }}
          >
            AEM-driven{" "}
            {scene.effectType !== "none"
              ? scene.effectType
              : scene.animationStyle}{" "}
            visual experience.
          </p>
          <div
            style={{
              marginTop: "2rem",
              padding: "0.75rem 1.5rem",
              backgroundColor: "#fff",
              color: scene.brandColor,
              fontWeight: 600,
              borderRadius: "999px",
              display: "inline-flex",
              gap: "0.5rem",
              alignItems: "center",
              boxShadow:
                scene.effectType === "glow"
                  ? `0 0 ${10 + glow * 60}px rgba(255, 255, 255, ${0.2 + glow * 0.4})`
                  : "0 4px 12px rgba(0,0,0,0.1)",
            }}
          >
            {scene.cta}
          </div>
        </div>

        {/* Image Content */}
        <div
          style={{
            flex: 1,
            minHeight: 0,
            width: "100%",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
          }}
        >
          <div
            style={{
              width: isPortrait ? "80%" : "100%",
              aspectRatio: "1",
              borderRadius: "1.5rem",
              overflow: "hidden",
              boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
              transform: `scale(${imageScale}) rotate(${imageRotate + glitch * 2}deg) translateX(${glitch * 5}px)`,
            }}
          >
            {imageError ? (
              <AssetErrorPlaceholder assetType="image" />
            ) : (
              <Img
                src={dynamicImageUrl}
                style={{ width: "100%", height: "100%", objectFit: "cover" }}
                onError={handleImageError}
              />
            )}
          </div>
        </div>
      </div>

      {/* SVG Overlay (e.g. brand icon) */}
      {scene.svgOverlayUrl && (
        <div
          style={{
            position: "absolute",
            top: "4rem",
            right: "4rem",
            width: "8rem",
            height: "8rem",
            opacity: interpolate(entrance, [0, 1], [0, 0.5]),
          }}
        >
          <Img
            src={
              scene.svgOverlayUrl.startsWith("http")
                ? scene.svgOverlayUrl
                : staticFile(scene.svgOverlayUrl)
            }
            style={{ width: "100%", height: "100%" }}
            onError={() =>
              console.warn("[SVG] Failed to load:", scene.svgOverlayUrl)
            }
          />
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * Main Spotlight Composition component.
 * Renders a sequence of scenes from AEM Content Fragments.
 * Includes telemetry tracking for render metrics.
 */
export const SpotlightComposition: React.FC<SpotlightProps> = ({
  spotlight,
}) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const metricsRef = useRef<RenderMetrics | null>(null);
  const renderStartedRef = useRef(false);

  // Track render start (only once per composition mount)
  useEffect(() => {
    if (renderStartedRef.current) return;
    renderStartedRef.current = true;

    const effectsUsed = spotlight?.scenes
      ?.map((s) => s.effectType)
      .filter((e) => e !== "none") ?? [];

    metricsRef.current = trackRenderStart({
      compositionId: `AEMSpotlight-${width}x${height}`,
      width,
      height,
      durationFrames: durationInFrames,
      fps,
      sceneCount: spotlight?.scenes?.length ?? 0,
      effectsUsed: [...new Set(effectsUsed)],
      wasmEnabled: isWasmAvailable(),
    });

    trackPerformance("render_init", performance.now(), "ms", {
      compositionId: `AEMSpotlight-${width}x${height}`,
      sceneCount: spotlight?.scenes?.length ?? 0,
    });
  }, [spotlight, width, height, durationInFrames, fps]);

  // Track render completion at the last frame
  useEffect(() => {
    if (frame === durationInFrames - 1 && metricsRef.current) {
      trackRenderComplete(metricsRef.current);
    }
  }, [frame, durationInFrames]);

  if (!spotlight || !spotlight.scenes || spotlight.scenes.length === 0) {
    if (metricsRef.current) {
      trackRenderError(metricsRef.current, new Error("No content available"));
    }
    trackError("content_error", new Error("No spotlight scenes provided"), {
      spotlightId: spotlight?.id,
    });

    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#0E3B5A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: "2rem",
        }}
      >
        No content available
      </AbsoluteFill>
    );
  }

  return (
    <SpotlightErrorBoundary>
      <Series>
        {spotlight.scenes.map((scene, index) => (
          <Series.Sequence
            key={`${spotlight.id}-scene-${index}`}
            durationInFrames={scene.durationSeconds * fps}
          >
            <SpotlightErrorBoundary>
              <SpotlightSceneComponent scene={scene} />
            </SpotlightErrorBoundary>
          </Series.Sequence>
        ))}
      </Series>
    </SpotlightErrorBoundary>
  );
};
