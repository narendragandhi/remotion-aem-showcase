import {
  AbsoluteFill,
  interpolate,
  Img,
  spring,
  useCurrentFrame,
  useVideoConfig,
  Series,
  staticFile,
} from "remotion";
import { useEffect, useState, useCallback, useRef } from "react";
import { Lottie, LottieAnimationData } from "@remotion/lottie";
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
import { AssetLoadError } from "../errors";
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

interface LottieState {
  data: LottieAnimationData | null;
  loading: boolean;
  error: Error | null;
}

const SpotlightSceneComponent: React.FC<{ scene: SpotlightScene }> = ({
  scene,
}) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const [lottieState, setLottieState] = useState<LottieState>({
    data: null,
    loading: false,
    error: null,
  });
  const [imageError, setImageError] = useState(false);
  const [wasmReady, setWasmReady] = useState(false);

  const preset =
    ANIMATION_PRESETS[scene.animationStyle] || ANIMATION_PRESETS.minimal;
  const entrance = spring({ frame, fps, config: preset.spring });

  const isPortrait = height > width;
  const isSquare = Math.abs(height - width) < 10;

  // Initialize WASM
  useEffect(() => {
    warmupSpotlightWasm().then(() => setWasmReady(true));
  }, []);

  // Load Lottie animation with proper error handling
  useEffect(() => {
    if (!scene.lottieUrl) return;

    setLottieState({ data: null, loading: true, error: null });

    const resolvedUrl = scene.lottieUrl.startsWith("http")
      ? scene.lottieUrl
      : staticFile(scene.lottieUrl);

    fetch(resolvedUrl)
      .then((res) => {
        if (!res.ok) {
          throw new AssetLoadError(
            `Failed to load Lottie: ${res.status}`,
            scene.lottieUrl,
            "lottie"
          );
        }
        return res.json();
      })
      .then((data) => {
        setLottieState({ data, loading: false, error: null });
      })
      .catch((err) => {
        console.error("[Lottie] Load error:", err);
        setLottieState({
          data: null,
          loading: false,
          error: err instanceof Error ? err : new Error(String(err)),
        });
      });
  }, [scene.lottieUrl]);

  // Calculate normalized progress for effects
  const normalized = Math.min(frame / Math.max(durationInFrames - 1, 1), 1);

  // WASM Effects (with graceful degradation)
  const glow =
    scene.effectType === "glow" && wasmReady
      ? calculatePulse(normalized, scene.effectIntensity)
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

  // Dynamic image URL with optimization
  const dynamicImageUrl = getDynamicRenditionUrl(
    scene.imageUrl,
    width,
    height,
    scene.renditionType
  );

  // Image error handler
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
      {/* Lottie Background Overlay */}
      {lottieState.data && (
        <AbsoluteFill style={{ opacity: 0.15, transform: "scale(1.2)" }}>
          <Lottie animationData={lottieState.data} />
        </AbsoluteFill>
      )}

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

      {/* SVG Overlay */}
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
            src={scene.svgOverlayUrl.startsWith("http")
              ? scene.svgOverlayUrl
              : staticFile(scene.svgOverlayUrl)}
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

  // Track render start (only once)
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

  // Track render completion (when we reach the last frame)
  useEffect(() => {
    if (frame === durationInFrames - 1 && metricsRef.current) {
      trackRenderComplete(metricsRef.current);
    }
  }, [frame, durationInFrames]);

  if (!spotlight || !spotlight.scenes || spotlight.scenes.length === 0) {
    // Track error for empty content
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
