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
  Sequence,
  staticFile
} from "remotion";
import { useEffect, useState, useCallback, useRef } from "react";
import {
  AemSpotlight,
  SpotlightScene,
  getDynamicRenditionUrl,
  AnimationStyle
} from "../aem/aemClient";
import {
  calculatePulse,
  calculateGlitch,
  warmupSpotlightWasm,
  isWasmAvailable
} from "../wasm/spotlightEffects";
import { SpotlightErrorBoundary, AssetErrorPlaceholder } from "../components/ErrorBoundary";
import {
  trackRenderStart,
  trackRenderComplete,
  trackRenderError,
  trackError,
  trackPerformance,
  RenderMetrics
} from "../telemetry";
import { AURORA } from "../design-system/motion";

export type SpotlightProps = {
  spotlight?: AemSpotlight;
};

export const CAMPAIGN_INTELLIGENCE_INTRO_FRAMES = AURORA.timing.introFrames;

type AnimationConfig = {
  spring: { mass: number; damping: number; stiffness: number };
  text: { translateY: [number, number]; opacity: [number, number] };
  image: { scale: [number, number]; rotate: [number, number] };
};

const ANIMATION_PRESETS: Record<AnimationStyle, AnimationConfig> = {
  cinematic: {
    spring: { mass: 1.2, damping: 20, stiffness: 100 },
    text: { translateY: [60, 0], opacity: [0, 1] },
    image: { scale: [1.1, 1], rotate: [2, 0] }
  },
  energetic: {
    spring: { mass: 0.4, damping: 10, stiffness: 200 },
    text: { translateY: [100, 0], opacity: [0, 1] },
    image: { scale: [0.8, 1], rotate: [-5, 0] }
  },
  minimal: {
    spring: { mass: 1, damping: 20, stiffness: 100 },
    text: { translateY: [20, 0], opacity: [0, 1] },
    image: { scale: [1, 1], rotate: [0, 0] }
  }
};

/**
 * Frame-driven radial pulse background — replaces @remotion/lottie.
 * No async loading required; driven entirely by useCurrentFrame + spring.
 */
const PulseBackground: React.FC<{ color: string; fps: number }> = ({ color, fps }) => {
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
          opacity
        }}
      />
    </AbsoluteFill>
  );
};

const SignalHUD: React.FC<{
  scene: SpotlightScene;
  frame: number;
  fps: number;
  isPortrait: boolean;
}> = ({ scene, frame, fps, isPortrait }) => {
  const reveal = spring({
    frame: Math.max(frame - 14, 0),
    fps,
    config: { mass: 0.7, damping: 18, stiffness: 120 }
  });
  const signal = Math.round(scene.effectIntensity * 100);
  const accent = scene.accentColor || "#82ffca";
  const metrics = [
    { label: "CONTENT", value: scene.eyebrow || "AEM / LIVE" },
    { label: "MOTION", value: scene.animationStyle.toUpperCase() },
    { label: scene.metricLabel || "SIGNAL", value: scene.metricValue || `${signal}%` }
  ];

  return (
    <div
      style={{
        position: "absolute",
        top: isPortrait ? "15%" : "18%",
        right: isPortrait ? "8%" : "9%",
        width: isPortrait ? "84%" : 260,
        padding: "0.85rem",
        border: "1px solid rgba(255,255,255,0.28)",
        background: "linear-gradient(135deg, rgba(255,255,255,0.16), rgba(255,255,255,0.03))",
        backdropFilter: "blur(14px)",
        color: "#fff",
        opacity: reveal * 0.9,
        transform: `translateX(${interpolate(reveal, [0, 1], [28, 0])}px)`,
        zIndex: 4
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          marginBottom: "0.65rem",
          fontSize: "0.62rem",
          letterSpacing: "0.14em",
          opacity: 0.7
        }}
      >
        <span>LIVE COMPOSITION</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          <i
            style={{
              display: "inline-block",
              width: 6,
              height: 6,
              borderRadius: "50%",
              background: "#82ffca"
            }}
          />{" "}
          REC
        </span>
      </div>
      {metrics.map((metric, index) => (
        <div
          key={metric.label}
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "1rem",
            padding: "0.42rem 0",
            borderTop:
              index === 0 ? "1px solid rgba(255,255,255,0.16)" : "1px solid rgba(255,255,255,0.10)",
            fontSize: "0.68rem"
          }}
        >
          <span style={{ opacity: 0.55, letterSpacing: "0.1em" }}>{metric.label}</span>
          <strong style={{ letterSpacing: "0.08em" }}>{metric.value}</strong>
        </div>
      ))}
      <div
        style={{
          display: "flex",
          gap: 3,
          alignItems: "flex-end",
          height: 18,
          marginTop: "0.45rem"
        }}
      >
        {Array.from({ length: 18 }, (_, index) => (
          <span
            key={index}
            style={{
              flex: 1,
              height: `${5 + ((index * 17 + frame * 3) % 13)}px`,
              background: index / 18 < scene.effectIntensity ? accent : "rgba(255,255,255,0.22)"
            }}
          />
        ))}
      </div>
    </div>
  );
};

const SpotlightSceneComponent: React.FC<{
  scene: SpotlightScene;
  index: number;
  totalScenes: number;
}> = ({ scene, index, totalScenes }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames, width, height } = useVideoConfig();
  const [imageError, setImageError] = useState(false);

  // delayRender: Remotion holds every frame until continueRender is called,
  // ensuring WASM effects are ready before the first frame is captured.
  const [wasmHandle] = useState(() => delayRender("Warming up WASM effects"));

  const preset = ANIMATION_PRESETS[scene.animationStyle] || ANIMATION_PRESETS.minimal;
  const entrance = spring({ frame, fps, config: preset.spring });

  const isPortrait = height > width;
  const isSquare = Math.abs(height - width) < 10;

  // Initialize WASM — always unblock render when done (success or failure)
  useEffect(() => {
    warmupSpotlightWasm()
      .catch(() => {}) // calculate* functions use the exact JS fallback
      .finally(() => continueRender(wasmHandle));
  }, [wasmHandle]);

  // Calculate normalized progress for effects
  const normalized = Math.min(frame / Math.max(durationInFrames - 1, 1), 1);
  const exitOpacity = interpolate(
    frame,
    [Math.max(durationInFrames - AURORA.timing.sceneExitFrames, 0), durationInFrames - 1],
    [1, 0],
    { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
  );
  const sceneProgress = interpolate(frame, [0, Math.max(durationInFrames - 1, 1)], [0, 100], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });

  // WASM Effects (with graceful degradation to JS fallback)
  const glow = scene.effectType === "glow" ? calculatePulse(normalized, scene.effectIntensity) : 0;
  const glitch =
    scene.effectType === "glitch" ? calculateGlitch(normalized, scene.effectIntensity) : 0;

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
        opacity: exitOpacity,
        filter:
          scene.effectType === "glitch"
            ? `hue-rotate(${glitch * 20}deg) blur(${Math.abs(glitch) * 2}px)`
            : "none"
      }}
    >
      {/* Native Remotion pulse background — frame-driven, no async loading */}
      <PulseBackground color="#ffffff" fps={fps} />

      {/* Cinematic editorial layer: animated progress, scene index, and grid */}
      <AbsoluteFill style={{ pointerEvents: "none", opacity: 0.32 }}>
        <div
          style={{
            position: "absolute",
            inset: "8%",
            border: "1px solid rgba(255,255,255,0.22)",
            borderRadius: "2rem"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "8%",
            right: "8%",
            top: "8%",
            height: 3,
            background: "rgba(255,255,255,0.2)"
          }}
        >
          <div style={{ width: `${sceneProgress}%`, height: "100%", background: "#fff" }} />
        </div>
        <div
          style={{
            position: "absolute",
            top: "10%",
            right: "8%",
            color: "#fff",
            fontSize: isPortrait ? "1rem" : "0.8rem",
            letterSpacing: "0.18em",
            fontWeight: 700
          }}
        >
          {String(index + 1).padStart(2, "0")} / {String(totalScenes).padStart(2, "0")}
        </div>
        <div
          style={{
            position: "absolute",
            inset: 0,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.07) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.07) 1px, transparent 1px)",
            backgroundSize: isPortrait ? "80px 80px" : "120px 120px",
            transform: `translateY(${frame * 0.25}px)`
          }}
        />
      </AbsoluteFill>

      <div
        style={{
          position: "absolute",
          width: isPortrait ? "90%" : "48%",
          height: isPortrait ? "44%" : "72%",
          left: isPortrait ? "5%" : "46%",
          top: isPortrait ? "25%" : "14%",
          border: "1px solid rgba(255,255,255,0.16)",
          borderRadius: "50%",
          transform: `rotate(${frame * 0.35}deg) scale(${1 + glow * 0.04})`,
          opacity: 0.7,
          pointerEvents: "none"
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 10,
            height: 10,
            borderRadius: "50%",
            background: "#fff",
            top: "12%",
            left: "16%",
            boxShadow: "0 0 24px #fff"
          }}
        />
        <div
          style={{
            position: "absolute",
            width: "6px",
            height: "6px",
            borderRadius: "50%",
            background: "#82ffca",
            bottom: "18%",
            right: "12%"
          }}
        />
      </div>

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
          zIndex: 1
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
            color: "#ffffff"
          }}
        >
          <p
            style={{
              fontSize: subtitleFontSize,
              textTransform: "uppercase",
              margin: 0,
              letterSpacing: "0.1em",
              fontWeight: 500
            }}
          >
            {scene.subtitle}
          </p>
          <h1
            style={{
              margin: "0.5rem 0",
              fontSize: titleFontSize,
              lineHeight: 1.1,
              fontWeight: 700
            }}
          >
            {scene.title.split("").map((character, characterIndex) => {
              const characterEntrance = spring({
                frame: Math.max(frame - characterIndex * AURORA.timing.characterStaggerFrames, 0),
                fps,
                config: preset.spring
              });
              return (
                <span
                  key={`${character}-${characterIndex}`}
                  style={{
                    display: "inline-block",
                    opacity: characterEntrance,
                    transform: `translateY(${interpolate(characterEntrance, [0, 1], [28, 0])}px)`
                  }}
                >
                  {character === " " ? "\u00a0" : character}
                </span>
              );
            })}
          </h1>
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
                  : "0 4px 12px rgba(0,0,0,0.1)"
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
            justifyContent: "center"
          }}
        >
          <div
            style={{
              width: isPortrait ? "80%" : "100%",
              aspectRatio: "1",
              borderRadius: "1.5rem",
              overflow: "hidden",
              boxShadow: "0 30px 60px rgba(0,0,0,0.25)",
              transform: `scale(${imageScale}) rotate(${imageRotate + glitch * 2}deg) translateX(${glitch * 5}px)`
            }}
          >
            {imageError ? (
              <AssetErrorPlaceholder assetType="image" />
            ) : (
              <Img
                src={dynamicImageUrl}
                style={{
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                  transform: `scale(${1 + normalized * 0.08})`,
                  filter: `saturate(${1 + glow * 0.35}) contrast(${1 + glow * 0.12})`
                }}
                onError={handleImageError}
              />
            )}
          </div>
          <div
            style={{
              position: "absolute",
              width: isPortrait ? "72%" : "38%",
              height: isPortrait ? "28%" : "42%",
              border: "1px solid rgba(255,255,255,0.55)",
              transform: `translate(${Math.sin(frame / 18) * 18}px, ${Math.cos(frame / 23) * 14}px) rotate(${Math.sin(frame / 30) * 3}deg)`,
              pointerEvents: "none"
            }}
          />
        </div>
      </div>

      <div
        style={{
          position: "absolute",
          left: basePadding,
          bottom: basePadding,
          display: "flex",
          gap: "0.6rem",
          alignItems: "center",
          color: "rgba(255,255,255,0.72)",
          fontSize: isPortrait ? "1rem" : "0.75rem",
          letterSpacing: "0.12em",
          textTransform: "uppercase",
          zIndex: 3
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: "50%",
            background: "#fff",
            boxShadow: scene.effectType === "glow" ? `0 0 ${12 + glow * 30}px #fff` : "none"
          }}
        />
        <span>AEM live signal</span>
        <span style={{ opacity: 0.45 }}>·</span>
        <span>Remotion motion system</span>
      </div>

      <SignalHUD scene={scene} frame={frame} fps={fps} isPortrait={isPortrait} />

      {/* SVG Overlay (e.g. brand icon) */}
      {scene.svgOverlayUrl && (
        <div
          style={{
            position: "absolute",
            top: "4rem",
            right: "4rem",
            width: "8rem",
            height: "8rem",
            opacity: interpolate(entrance, [0, 1], [0, 0.5])
          }}
        >
          <Img
            src={
              scene.svgOverlayUrl.startsWith("http")
                ? scene.svgOverlayUrl
                : staticFile(scene.svgOverlayUrl)
            }
            style={{ width: "100%", height: "100%" }}
            onError={() => console.warn("[SVG] Failed to load:", scene.svgOverlayUrl)}
          />
        </div>
      )}
    </AbsoluteFill>
  );
};

/**
 * A compact data-story opening. It uses the same AEM scenes as the main
 * composition and makes the content → motion → delivery pipeline legible.
 */
const CampaignIntelligenceIntro: React.FC<{ spotlight: AemSpotlight }> = ({ spotlight }) => {
  const frame = useCurrentFrame();
  const { fps, width, height } = useVideoConfig();
  const isPortrait = height > width;
  const heroScene = spotlight.scenes[0];
  const reveal = spring({ frame, fps, config: { mass: 0.8, damping: 18, stiffness: 100 } });
  const exit = interpolate(frame, [66, 89], [1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp"
  });
  const cards = [
    { label: "AUTHORED", value: `${spotlight.scenes.length} scenes`, color: "#82ffca" },
    { label: "COMPOSED", value: "React motion", color: "#ffb84d" },
    { label: "DELIVERED", value: "4 formats", color: "#c8a8ff" }
  ];

  return (
    <AbsoluteFill
      style={{
        background: "#090B16",
        color: "#fff",
        opacity: exit,
        overflow: "hidden",
        padding: isPortrait ? "10% 8%" : "7% 8%"
      }}
    >
      <div
        style={{
          position: "absolute",
          inset: 0,
          background:
            "radial-gradient(circle at 70% 35%, rgba(20,115,230,0.32), transparent 42%), linear-gradient(135deg, #0E3B5A 0%, #090B16 62%)"
        }}
      />
      <div
        style={{
          position: "absolute",
          inset: 0,
          opacity: 0.22,
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)",
          backgroundSize: isPortrait ? "70px 70px" : "110px 110px",
          transform: `translateY(${frame * 0.4}px)`
        }}
      />
      <div
        style={{
          position: "relative",
          zIndex: 1,
          opacity: reveal,
          transform: `translateY(${interpolate(reveal, [0, 1], [35, 0])}px)`
        }}
      >
        <div
          style={{
            fontSize: isPortrait ? "0.8rem" : "0.65rem",
            letterSpacing: "0.24em",
            color: "#82ffca",
            fontWeight: 700
          }}
        >
          AEM CONTENT OPERATING SYSTEM
        </div>
        <h1
          style={{
            margin: "1rem 0 0.5rem",
            fontSize: isPortrait ? "3.4rem" : "4.6rem",
            lineHeight: 0.98,
            letterSpacing: "-0.06em",
            maxWidth: isPortrait ? "100%" : 800
          }}
        >
          Campaign
          <br />
          <span style={{ color: "#82ffca" }}>intelligence.</span>
        </h1>
        <p
          style={{
            margin: 0,
            maxWidth: 560,
            color: "rgba(255,255,255,0.62)",
            fontSize: isPortrait ? "1.2rem" : "1rem",
            lineHeight: 1.5
          }}
        >
          One authored brief becomes a living motion system—previewable, reorderable, and ready for
          every channel.
        </p>
      </div>
      <div
        style={{
          position: "absolute",
          right: isPortrait ? "8%" : "8%",
          top: isPortrait ? "28%" : "16%",
          width: isPortrait ? "84%" : "34%",
          height: isPortrait ? "24%" : "54%",
          border: "1px solid rgba(130,255,202,0.36)",
          background: "rgba(5,8,18,0.42)",
          boxShadow: "0 0 90px rgba(20,115,230,0.22)",
          opacity: interpolate(reveal, [0, 1], [0, 1]),
          transform: `translateY(${interpolate(reveal, [0, 1], [30, 0])}px)`,
          overflow: "hidden",
          zIndex: 2
        }}
      >
        <div
          style={{
            position: "absolute",
            inset: 0,
            background: `linear-gradient(135deg, ${heroScene.brandColor}99, transparent 58%)`
          }}
        />
        <Img
          src={getDynamicRenditionUrl(heroScene.imageUrl, width, height, heroScene.renditionType)}
          style={{
            position: "absolute",
            right: 0,
            top: 0,
            width: "68%",
            height: "100%",
            objectFit: "cover",
            opacity: 0.72,
            transform: `scale(${1.08 - reveal * 0.08})`
          }}
        />
        <div
          style={{
            position: "absolute",
            inset: 0,
            background:
              "linear-gradient(90deg, rgba(5,8,18,0.98) 0%, rgba(5,8,18,0.58) 48%, rgba(5,8,18,0.08) 100%)"
          }}
        />
        <div
          style={{
            position: "absolute",
            left: "7%",
            top: "10%",
            color: "#82ffca",
            fontSize: "0.58rem",
            letterSpacing: "0.18em",
            fontWeight: 700
          }}
        >
          CONTENT FRAGMENT / LIVE
        </div>
        <div
          style={{
            position: "absolute",
            left: "7%",
            bottom: "12%",
            width: "55%",
            color: "#fff"
          }}
        >
          <div style={{ fontSize: "0.68rem", color: "rgba(255,255,255,0.58)" }}>
            {heroScene.eyebrow}
          </div>
          <div
            style={{
              marginTop: "0.35rem",
              fontSize: isPortrait ? "1.4rem" : "1.65rem",
              lineHeight: 1,
              letterSpacing: "-0.04em",
              fontWeight: 700
            }}
          >
            {heroScene.title}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.4rem",
              alignItems: "center",
              marginTop: "0.75rem",
              color: "#82ffca",
              fontSize: "0.62rem",
              letterSpacing: "0.12em"
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#82ffca" }} />
            READY TO COMPOSE
          </div>
        </div>
        <div
          style={{
            position: "absolute",
            right: "5%",
            top: "8%",
            color: "rgba(255,255,255,0.52)",
            fontSize: "0.58rem",
            letterSpacing: "0.14em"
          }}
        >
          {String(frame).padStart(3, "0")} / 090
        </div>
      </div>
      <div
        style={{
          position: "absolute",
          left: isPortrait ? "8%" : "8%",
          right: isPortrait ? "8%" : "8%",
          bottom: isPortrait ? "12%" : "11%",
          display: "grid",
          gridTemplateColumns: isPortrait ? "1fr" : "repeat(3, 1fr)",
          gap: "0.75rem",
          zIndex: 1
        }}
      >
        {cards.map((card, index) => {
          const cardReveal = spring({
            frame: Math.max(frame - 18 - index * 8, 0),
            fps,
            config: { mass: 0.6, damping: 16, stiffness: 120 }
          });
          return (
            <div
              key={card.label}
              style={{
                padding: "1rem",
                border: `1px solid ${card.color}66`,
                background: "rgba(255,255,255,0.07)",
                backdropFilter: "blur(12px)",
                opacity: cardReveal,
                transform: `translateY(${interpolate(cardReveal, [0, 1], [24, 0])}px)`
              }}
            >
              <div
                style={{
                  color: card.color,
                  fontSize: "0.62rem",
                  letterSpacing: "0.18em",
                  fontWeight: 700
                }}
              >
                {card.label}
              </div>
              <div
                style={{
                  marginTop: "0.45rem",
                  fontSize: isPortrait ? "1.35rem" : "1.15rem",
                  fontWeight: 700
                }}
              >
                {card.value}
              </div>
            </div>
          );
        })}
      </div>
      <div
        style={{
          position: "absolute",
          right: "8%",
          top: "8%",
          color: "rgba(255,255,255,0.42)",
          fontSize: "0.65rem",
          letterSpacing: "0.16em"
        }}
      >
        LIVE / {String(frame).padStart(3, "0")}
      </div>
    </AbsoluteFill>
  );
};

/**
 * Main Spotlight Composition component.
 * Renders a sequence of scenes from AEM Content Fragments.
 * Includes telemetry tracking for render metrics.
 */
export const SpotlightComposition: React.FC<SpotlightProps> = ({ spotlight }) => {
  const { fps, width, height, durationInFrames } = useVideoConfig();
  const frame = useCurrentFrame();
  const metricsRef = useRef<RenderMetrics | null>(null);
  const renderStartedRef = useRef(false);

  // Track render start (only once per composition mount)
  useEffect(() => {
    if (renderStartedRef.current) return;
    renderStartedRef.current = true;

    const effectsUsed =
      spotlight?.scenes?.map((s) => s.effectType).filter((e) => e !== "none") ?? [];

    metricsRef.current = trackRenderStart({
      compositionId: `AEMSpotlight-${width}x${height}`,
      width,
      height,
      durationFrames: durationInFrames,
      fps,
      sceneCount: spotlight?.scenes?.length ?? 0,
      effectsUsed: [...new Set(effectsUsed)],
      wasmEnabled: isWasmAvailable()
    });

    trackPerformance("render_init", performance.now(), "ms", {
      compositionId: `AEMSpotlight-${width}x${height}`,
      sceneCount: spotlight?.scenes?.length ?? 0
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
      spotlightId: spotlight?.id
    });

    return (
      <AbsoluteFill
        style={{
          backgroundColor: "#0E3B5A",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "#ffffff",
          fontSize: "2rem"
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
              <SpotlightSceneComponent
                scene={scene}
                index={index}
                totalScenes={spotlight.scenes.length}
              />
            </SpotlightErrorBoundary>
          </Series.Sequence>
        ))}
      </Series>
    </SpotlightErrorBoundary>
  );
};

export const CampaignIntelligenceComposition: React.FC<SpotlightProps> = ({ spotlight }) => {
  if (!spotlight || spotlight.scenes.length === 0)
    return <SpotlightComposition spotlight={spotlight} />;
  const introDuration = CAMPAIGN_INTELLIGENCE_INTRO_FRAMES;
  return (
    <SpotlightErrorBoundary>
      <Sequence durationInFrames={introDuration}>
        <CampaignIntelligenceIntro spotlight={spotlight} />
      </Sequence>
      <Sequence from={introDuration}>
        <SpotlightComposition spotlight={spotlight} />
      </Sequence>
    </SpotlightErrorBoundary>
  );
};
