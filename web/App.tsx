import { Player } from "@remotion/player";
import { useState } from "react";
import { SpotlightComposition } from "../src/compositions/SpotlightComposition";
import defaultMock from "../src/mock/aem.json";
import loyaltyMock from "../src/mock/examples/loyalty_year_in_review.json";
import ecommerceMock from "../src/mock/examples/ecommerce_product_spotlight.json";
import newsMock from "../src/mock/examples/social_localized_news.json";
import globalMock from "../src/mock/examples/global_campaign_multilang.json";
import type { AemSpotlight } from "../src/aem/schema";

const MOCKS = {
  default: { label: "AEM + Remotion", data: defaultMock as unknown as AemSpotlight },
  loyalty: { label: "Loyalty Year in Review", data: loyaltyMock as unknown as AemSpotlight },
  ecommerce: { label: "E-Commerce Spotlight", data: ecommerceMock as unknown as AemSpotlight },
  news: { label: "Localized News", data: newsMock as unknown as AemSpotlight },
  global: { label: "Global Campaign", data: globalMock as unknown as AemSpotlight },
} as const;

const RATIOS = [
  { id: "16x9", label: "16:9", width: 1280, height: 720 },
  { id: "9x16", label: "9:16", width: 720, height: 1280 },
  { id: "1x1", label: "1:1", width: 1080, height: 1080 },
] as const;

type MockKey = keyof typeof MOCKS;
type RatioId = (typeof RATIOS)[number]["id"];

const FPS = 30;

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.6875rem",
  color: "#555",
  marginBottom: "0.375rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600,
};

export default function App() {
  const [mockKey, setMockKey] = useState<MockKey>("default");
  const [ratioId, setRatioId] = useState<RatioId>("16x9");

  const { data: spotlight } = MOCKS[mockKey];
  const ratio = RATIOS.find((r) => r.id === ratioId)!;
  const totalFrames =
    spotlight.scenes.reduce((a, s) => a + s.durationSeconds, 0) * FPS;
  const totalSeconds = spotlight.scenes.reduce(
    (a, s) => a + s.durationSeconds,
    0
  );

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily:
          '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "1.25rem 2rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: "0.875rem",
        }}
      >
        <div
          style={{
            width: 34,
            height: 34,
            background: "linear-gradient(135deg, #1473E6 0%, #0E3B5A 100%)",
            borderRadius: 8,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontSize: 15,
            flexShrink: 0,
          }}
        >
          ▶
        </div>
        <div>
          <h1
            style={{
              margin: 0,
              fontSize: "1rem",
              fontWeight: 600,
              letterSpacing: "-0.01em",
            }}
          >
            AEM + Remotion Showcase
          </h1>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#555" }}>
            Content Fragments → Multi-format video compositions
          </p>
        </div>
        <a
          href="https://github.com/narendragandhi/remotion-aem-showcase"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            marginLeft: "auto",
            fontSize: "0.8125rem",
            color: "#555",
            textDecoration: "none",
          }}
        >
          GitHub ↗
        </a>
      </header>

      <main
        style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}
      >
        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            alignItems: "flex-end",
          }}
        >
          {/* Content Fragment selector */}
          <div>
            <label style={LABEL_STYLE}>Content Fragment</label>
            <select
              value={mockKey}
              onChange={(e) => setMockKey(e.target.value as MockKey)}
              style={{
                background: "#111",
                color: "#ddd",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                padding: "0.5rem 2.25rem 0.5rem 0.75rem",
                fontSize: "0.875rem",
                cursor: "pointer",
                outline: "none",
                appearance: "none",
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' fill='%23666' viewBox='0 0 16 16'%3E%3Cpath d='M7.247 11.14L2.451 5.658C1.885 5.013 2.345 4 3.204 4h9.592a1 1 0 0 1 .753 1.659l-4.796 5.48a1 1 0 0 1-1.506 0z'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 0.75rem center",
              }}
            >
              {(Object.keys(MOCKS) as MockKey[]).map((k) => (
                <option key={k} value={k}>
                  {MOCKS[k].label}
                </option>
              ))}
            </select>
          </div>

          {/* Format selector */}
          <div>
            <label style={LABEL_STYLE}>Format</label>
            <div
              style={{
                display: "flex",
                gap: "0.375rem",
                background: "#111",
                border: "1px solid rgba(255,255,255,0.12)",
                borderRadius: "8px",
                padding: "0.25rem",
              }}
            >
              {RATIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRatioId(r.id)}
                  style={{
                    background:
                      ratioId === r.id
                        ? "rgba(255,255,255,0.1)"
                        : "transparent",
                    color: ratioId === r.id ? "#fff" : "#555",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.375rem 0.875rem",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    fontWeight: ratioId === r.id ? 600 : 400,
                    transition: "all 0.15s",
                  }}
                >
                  {r.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stats pill */}
          <div
            style={{
              marginLeft: "auto",
              fontSize: "0.8rem",
              color: "#444",
              lineHeight: 1.6,
              textAlign: "right",
            }}
          >
            <span>
              {spotlight.scenes.length} scene
              {spotlight.scenes.length !== 1 ? "s" : ""}
            </span>
            <span style={{ margin: "0 0.4rem", color: "#2a2a2a" }}>·</span>
            <span>{totalSeconds}s</span>
            <span style={{ margin: "0 0.4rem", color: "#2a2a2a" }}>·</span>
            <span>
              {ratio.width}×{ratio.height}
            </span>
          </div>
        </div>

        {/* Player container */}
        <div
          style={{
            background: "#080808",
            borderRadius: "12px",
            overflow: "hidden",
            border: "1px solid rgba(255,255,255,0.06)",
            display: "flex",
            justifyContent: "center",
            alignItems: "center",
            padding: ratioId === "9x16" ? "2rem" : 0,
          }}
        >
          <Player
            component={SpotlightComposition}
            inputProps={{ spotlight }}
            durationInFrames={totalFrames}
            compositionWidth={ratio.width}
            compositionHeight={ratio.height}
            fps={FPS}
            style={{
              width: ratioId === "9x16" ? "min(340px, 80vw)" : "100%",
              maxHeight: "70vh",
            }}
            controls
            loop
            autoPlay
            spaceKeyToPlayOrPause
          />
        </div>

        {/* Scene cards */}
        <div
          style={{
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(spotlight.scenes.length, 4)}, 1fr)`,
            gap: "0.625rem",
          }}
        >
          {spotlight.scenes.map((scene, i) => (
            <div
              key={i}
              style={{
                background: "#0e0e14",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px",
                padding: "0.75rem",
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.35rem",
                }}
              >
                <span
                  style={{
                    width: 10,
                    height: 10,
                    borderRadius: "50%",
                    background: scene.brandColor,
                    display: "inline-block",
                    flexShrink: 0,
                    border: "1px solid rgba(255,255,255,0.1)",
                  }}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#bbb",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                  }}
                >
                  {scene.title}
                </span>
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "#444",
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap",
                }}
              >
                <span>{scene.animationStyle}</span>
                {scene.effectType !== "none" && (
                  <span>· {scene.effectType}</span>
                )}
                <span>· {scene.durationSeconds}s</span>
              </div>
            </div>
          ))}
        </div>

        {/* Tech badges */}
        <div
          style={{
            marginTop: "2rem",
            display: "flex",
            gap: "0.5rem",
            flexWrap: "wrap",
          }}
        >
          {[
            "AEM Content Fragments",
            "GraphQL",
            "Remotion 4",
            "WASM Effects",
            "Zod Validation",
            "Multi-format",
          ].map((badge) => (
            <span
              key={badge}
              style={{
                fontSize: "0.6875rem",
                color: "#444",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "999px",
                padding: "0.25rem 0.625rem",
              }}
            >
              {badge}
            </span>
          ))}
        </div>
      </main>

      <footer
        style={{
          textAlign: "center",
          padding: "2rem",
          borderTop: "1px solid rgba(255,255,255,0.05)",
          color: "#2a2a2a",
          fontSize: "0.75rem",
          marginTop: "2rem",
        }}
      >
        AEM + Remotion ·{" "}
        <a
          href="https://github.com/narendragandhi/remotion-aem-showcase/blob/main/LICENSE"
          target="_blank"
          rel="noopener noreferrer"
          style={{ color: "#333", textDecoration: "none" }}
        >
          Apache 2.0
        </a>
      </footer>
    </div>
  );
}
