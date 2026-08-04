import { Player } from "@remotion/player";
import { useEffect, useMemo, useState } from "react";
import { SpotlightComposition } from "../src/compositions/SpotlightComposition";
import defaultMock from "../src/mock/aem.json";
import loyaltyMock from "../src/mock/examples/loyalty_year_in_review.json";
import ecommerceMock from "../src/mock/examples/ecommerce_product_spotlight.json";
import newsMock from "../src/mock/examples/social_localized_news.json";
import globalMock from "../src/mock/examples/global_campaign_multilang.json";
import northstarLumaMock from "../src/mock/examples/northstar_luma_one_launch.json";
import northstarFieldKitMock from "../src/mock/examples/northstar_field_kit.json";
import northstarMembersMock from "../src/mock/examples/northstar_members_year.json";
import northstarFranceMock from "../src/mock/examples/northstar_fr_launch.json";
import northstarRetailMock from "../src/mock/examples/northstar_retail_offer.json";
import {
  AemGraphQLResponseSchema,
  AemGraphQLItemSchema,
  parseAemSpotlight,
  type SpotlightScene,
  type AemSpotlight
} from "../src/aem/schema";
import { mapAemItemToSpotlight } from "../src/aem/aemClient";
import {
  SPOTLIGHT_TEMPLATE,
  validateSpotlightForTemplate
} from "../src/templates/spotlightTemplate";
import type { RenderJob } from "../src/provenance/provenance";

const toSpotlight = (data: unknown): AemSpotlight => parseAemSpotlight(data);

const MOCKS = {
  default: { label: "AEM + Remotion", data: toSpotlight(defaultMock) },
  loyalty: { label: "Loyalty Year in Review", data: toSpotlight(loyaltyMock) },
  ecommerce: { label: "E-Commerce Spotlight", data: toSpotlight(ecommerceMock) },
  news: { label: "Localized News", data: toSpotlight(newsMock) },
  global: { label: "Global Campaign", data: toSpotlight(globalMock) },
  northstarLuma: { label: "Northstar · Luma One Launch", data: toSpotlight(northstarLumaMock) },
  northstarFieldKit: { label: "Northstar · Field Kit", data: toSpotlight(northstarFieldKitMock) },
  northstarMembers: { label: "Northstar · Member Year", data: toSpotlight(northstarMembersMock) },
  northstarFrance: { label: "Northstar · France Launch", data: toSpotlight(northstarFranceMock) },
  northstarRetail: { label: "Northstar · Summer Reset", data: toSpotlight(northstarRetailMock) }
} as const;

const RATIOS = [
  { id: "16x9", label: "16:9", width: 1280, height: 720 },
  { id: "9x16", label: "9:16", width: 720, height: 1280 },
  { id: "1x1", label: "1:1", width: 1080, height: 1080 },
  { id: "4K", label: "4K", width: 3840, height: 2160 }
] as const;

type MockKey = keyof typeof MOCKS;
type SourceKey = MockKey | "live";
type RatioId = (typeof RATIOS)[number]["id"];
type ReviewState = "draft" | "in-review" | "approved";
type ReviewEvent = { state: ReviewState; at: string };

type CampaignDraft = {
  campaignName: string;
  reviewState: ReviewState;
  previewOverrides: Partial<SpotlightScene>;
  sceneOrder: number[];
  reviewHistory: ReviewEvent[];
  savedAt: string;
};

const DRAFT_PREFIX = "remotion-aem-campaign:";

const readDraft = (sourceKey: SourceKey): CampaignDraft | null => {
  try {
    const raw = window.localStorage.getItem(`${DRAFT_PREFIX}${sourceKey}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<CampaignDraft>;
    if (
      typeof parsed.campaignName !== "string" ||
      !["draft", "in-review", "approved"].includes(parsed.reviewState ?? "") ||
      typeof parsed.savedAt !== "string"
    )
      return null;
    return {
      campaignName: parsed.campaignName,
      reviewState: parsed.reviewState as ReviewState,
      previewOverrides: parsed.previewOverrides ?? {},
      sceneOrder: Array.isArray(parsed.sceneOrder) ? parsed.sceneOrder : [],
      reviewHistory: Array.isArray(parsed.reviewHistory) ? parsed.reviewHistory : [],
      savedAt: parsed.savedAt
    };
  } catch {
    return null;
  }
};

const FPS = 30;

const LABEL_STYLE: React.CSSProperties = {
  display: "block",
  fontSize: "0.6875rem",
  color: "#555",
  marginBottom: "0.375rem",
  textTransform: "uppercase",
  letterSpacing: "0.06em",
  fontWeight: 600
};

export default function App() {
  const [sourceKey, setSourceKey] = useState<SourceKey>("northstarLuma");
  const [ratioId, setRatioId] = useState<RatioId>("16x9");
  const [liveSpotlight, setLiveSpotlight] = useState<AemSpotlight | null>(null);
  const [liveError, setLiveError] = useState<string | null>(null);
  const [liveLoading, setLiveLoading] = useState(false);
  const [reviewState, setReviewState] = useState<ReviewState>("draft");
  const [campaignName, setCampaignName] = useState("Spotlight campaign");
  const [previewOverrides, setPreviewOverrides] = useState<Partial<SpotlightScene>>({});
  const [sceneOrder, setSceneOrder] = useState<number[]>([]);
  const [reviewHistory, setReviewHistory] = useState<ReviewEvent[]>([]);
  const [savedAt, setSavedAt] = useState<string | null>(null);
  const [draftNotice, setDraftNotice] = useState("");
  const [renderJobs, setRenderJobs] = useState<RenderJob[]>([]);
  const [jobNotice, setJobNotice] = useState("");

  useEffect(() => {
    void fetch("/api/provenance/")
      .then((response) => response.json() as Promise<{ jobs?: RenderJob[] }>)
      .then((payload) => setRenderJobs(payload.jobs ?? []))
      .catch(() => setJobNotice("Provenance backend unavailable"));
  }, []);

  useEffect(() => {
    if (sourceKey !== "live") return;

    const loadLiveSpotlight = async () => {
      setLiveLoading(true);
      setLiveError(null);
      try {
        const response = await fetch("/api/aem/content/_cq_graphql/spotlight/endpoint.json", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: `query {
              hook: spotlightVideoSceneByPath(_path: "/content/dam/remotion/spotlight/live-showcase") { item {
              _path title eyebrow subtitle { plaintext } cta brandColor accentColor metricLabel metricValue imageUrl durationSeconds
              animationStyle renditionType effectType effectIntensity lottieUrl svgOverlayUrl
              } }
              proof: spotlightVideoSceneByPath(_path: "/content/dam/remotion/spotlight/live-showcase-proof") { item {
                _path title eyebrow subtitle { plaintext } cta brandColor accentColor metricLabel metricValue imageUrl durationSeconds
                animationStyle renditionType effectType effectIntensity lottieUrl svgOverlayUrl
              } }
              cta: spotlightVideoSceneByPath(_path: "/content/dam/remotion/spotlight/live-showcase-cta") { item {
                _path title eyebrow subtitle { plaintext } cta brandColor accentColor metricLabel metricValue imageUrl durationSeconds
                animationStyle renditionType effectType effectIntensity lottieUrl svgOverlayUrl
              } }
            }`
          })
        });
        const rawPayload = await response.json();
        const payload = AemGraphQLResponseSchema.parse(rawPayload);
        const aliases = ["hook", "proof", "cta"] as const;
        const items = aliases.map((alias) =>
          AemGraphQLItemSchema.parse(rawPayload.data?.[alias]?.item)
        );
        if (!response.ok || payload.errors?.length || items.length !== 3) {
          throw new Error(
            payload.errors?.[0]?.message ?? "Live AEM showcase campaign was not found."
          );
        }
        const scenes = items.map(
          (item) => mapAemItemToSpotlight(item, { baseUrl: "/api/aem" }).scenes[0]
        );
        setLiveSpotlight({ id: "live-showcase", scenes });
      } catch (error) {
        setLiveSpotlight(null);
        setLiveError(error instanceof Error ? error.message : "Unable to load live AEM content.");
      } finally {
        setLiveLoading(false);
      }
    };

    void loadLiveSpotlight();
  }, [sourceKey]);

  const sourceSpotlight =
    sourceKey === "live" ? (liveSpotlight ?? MOCKS.default.data) : MOCKS[sourceKey].data;
  useEffect(() => {
    const saved = readDraft(sourceKey);
    setPreviewOverrides(saved?.previewOverrides ?? {});
    setSceneOrder(saved?.sceneOrder ?? []);
    setReviewState(saved?.reviewState ?? "draft");
    setCampaignName(
      saved?.campaignName ??
        (sourceKey === "live" ? "Spotlight live campaign" : MOCKS[sourceKey].label)
    );
    setReviewHistory(saved?.reviewHistory ?? []);
    setSavedAt(saved?.savedAt ?? null);
    setDraftNotice(saved ? "Saved draft restored" : "New campaign draft");
  }, [sourceKey]);

  const orderedSpotlight = useMemo<AemSpotlight>(() => {
    const order =
      sceneOrder.length === sourceSpotlight.scenes.length
        ? sceneOrder
        : sourceSpotlight.scenes.map((_, index) => index);
    return {
      ...sourceSpotlight,
      scenes: order.map((index) => sourceSpotlight.scenes[index]).filter(Boolean)
    };
  }, [sourceSpotlight, sceneOrder]);
  const spotlight = useMemo<AemSpotlight>(
    () => ({
      ...orderedSpotlight,
      scenes: orderedSpotlight.scenes.map((scene, index) =>
        index === 0 ? { ...scene, ...previewOverrides } : scene
      )
    }),
    [orderedSpotlight, previewOverrides]
  );
  const ratio = RATIOS.find((r) => r.id === ratioId)!;
  const totalFrames = spotlight.scenes.reduce((a, s) => a + s.durationSeconds, 0) * FPS;
  const totalSeconds = spotlight.scenes.reduce((a, s) => a + s.durationSeconds, 0);
  const templateIssues = validateSpotlightForTemplate(spotlight, ratioId, SPOTLIGHT_TEMPLATE);
  const setPreviewField = <K extends keyof SpotlightScene>(field: K, value: SpotlightScene[K]) => {
    setPreviewOverrides((current) => ({ ...current, [field]: value }));
  };
  const changeReviewState = (nextState: ReviewState) => {
    setReviewState(nextState);
    setReviewHistory((current) => [...current, { state: nextState, at: new Date().toISOString() }]);
  };
  const moveScene = (index: number, direction: -1 | 1) => {
    const currentOrder =
      sceneOrder.length === sourceSpotlight.scenes.length
        ? [...sceneOrder]
        : sourceSpotlight.scenes.map((_, sceneIndex) => sceneIndex);
    const target = index + direction;
    if (target < 0 || target >= currentOrder.length) return;
    [currentOrder[index], currentOrder[target]] = [currentOrder[target], currentOrder[index]];
    setSceneOrder(currentOrder);
  };
  const resetSceneOrder = () => setSceneOrder([]);
  const saveDraft = () => {
    const nextSavedAt = new Date().toISOString();
    const draft: CampaignDraft = {
      campaignName,
      reviewState,
      previewOverrides,
      sceneOrder,
      reviewHistory,
      savedAt: nextSavedAt
    };
    window.localStorage.setItem(`${DRAFT_PREFIX}${sourceKey}`, JSON.stringify(draft));
    setSavedAt(nextSavedAt);
    setDraftNotice("Draft saved locally");
  };
  const exportBrief = () => {
    const brief = {
      campaignName,
      reviewState,
      source: sourceKey,
      template: SPOTLIGHT_TEMPLATE,
      formats: RATIOS.map((item) => ({
        ...item,
        issues: validateSpotlightForTemplate(spotlight, item.id, SPOTLIGHT_TEMPLATE)
      })),
      spotlight
    };
    const blob = new Blob([JSON.stringify(brief, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `${campaignName.toLowerCase().replace(/[^a-z0-9]+/g, "-") || "campaign"}-brief.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const createRenderJob = async () => {
    setJobNotice("Recording render provenance…");
    try {
      const response = await fetch("/api/provenance/jobs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          campaignId: spotlight.id,
          contentFragmentPath:
            sourceKey === "live" ? "/content/dam/remotion/spotlight/live-showcase" : spotlight.id,
          templateId: SPOTLIGHT_TEMPLATE.id,
          templateVersion: SPOTLIGHT_TEMPLATE.version,
          designSystemVersion: "0.1.0",
          renderingEngine: "remotion",
          outputFormats: [ratioId],
          source: sourceKey === "live" ? "aem" : "mock",
          content: spotlight,
          requestedBy: "local-marketer"
        })
      });
      const payload = (await response.json()) as { job?: RenderJob; error?: string };
      if (!response.ok || !payload.job)
        throw new Error(payload.error ?? "Unable to create render job");
      setRenderJobs((current) => [payload.job!, ...current]);
      setJobNotice(`Queued ${payload.job.renderId}`);
    } catch (error) {
      setJobNotice(error instanceof Error ? error.message : "Unable to create render job");
    }
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#0a0a0f",
        color: "#fff",
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}
    >
      {/* Header */}
      <header
        style={{
          padding: "1.25rem 2rem",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex",
          alignItems: "center",
          gap: "0.875rem"
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
            flexShrink: 0
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
              letterSpacing: "-0.01em"
            }}
          >
            Northstar Goods Motion Studio
          </h1>
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#555" }}>
            AEM content → governed motion → every channel
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
            textDecoration: "none"
          }}
        >
          GitHub ↗
        </a>
      </header>

      <main style={{ maxWidth: 1100, margin: "0 auto", padding: "2rem 1.5rem" }}>
        <section
          aria-label="Northstar campaign studio introduction"
          style={{
            marginBottom: "1.5rem",
            padding: "1.6rem",
            border: "1px solid rgba(130,255,202,0.18)",
            borderRadius: "16px",
            background:
              "radial-gradient(circle at 88% 18%, rgba(20,115,230,0.25), transparent 34%), linear-gradient(135deg, #0d1725 0%, #101827 58%, #18253b 100%)",
            position: "relative",
            overflow: "hidden"
          }}
        >
          <div style={{ position: "relative", zIndex: 1, maxWidth: 720 }}>
            <div style={{ ...LABEL_STYLE, color: "#82FFCA", marginBottom: "0.55rem" }}>
              NORTHSTAR GOODS / CAMPAIGN STUDIO
            </div>
            <h2
              style={{
                margin: 0,
                fontSize: "clamp(1.8rem, 4vw, 3.2rem)",
                lineHeight: 0.98,
                letterSpacing: "-0.06em",
                maxWidth: 650
              }}
            >
              One authored brief.
              <br />A living motion system.
            </h2>
            <p
              style={{
                margin: "1rem 0 0",
                color: "rgba(255,255,255,0.68)",
                lineHeight: 1.55,
                maxWidth: 590
              }}
            >
              Explore how Northstar turns product intent, proof, and member signals into on-brand
              stories—previewed in the browser and ready for every channel.
            </p>
            <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap", marginTop: "1.15rem" }}>
              {["5 campaign stories", "4 output formats", "AEM live-ready"].map((label) => (
                <span
                  key={label}
                  style={{
                    color: "#d7fff0",
                    border: "1px solid rgba(130,255,202,0.28)",
                    borderRadius: "999px",
                    padding: "0.35rem 0.65rem",
                    fontSize: "0.7rem"
                  }}
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
          <div
            style={{
              position: "absolute",
              right: "7%",
              top: "18%",
              width: 150,
              height: 150,
              border: "1px solid rgba(130,255,202,0.3)",
              borderRadius: "50%",
              boxShadow: "0 0 80px rgba(130,255,202,0.12)"
            }}
          />
          <div
            style={{
              position: "absolute",
              right: "10%",
              top: "30%",
              width: 80,
              height: 80,
              border: "1px solid rgba(200,168,255,0.45)",
              transform: "rotate(45deg)"
            }}
          />
        </section>

        {/* Controls */}
        <div
          style={{
            display: "flex",
            gap: "1.5rem",
            marginBottom: "1.5rem",
            flexWrap: "wrap",
            alignItems: "flex-end"
          }}
        >
          {/* Content Fragment selector */}
          <div>
            <label style={LABEL_STYLE}>Content Fragment</label>
            <select
              value={sourceKey}
              onChange={(e) => setSourceKey(e.target.value as SourceKey)}
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
                backgroundPosition: "right 0.75rem center"
              }}
            >
              <optgroup label="Live source">
                <option value="live">Live AEM · spotlight/live-showcase</option>
              </optgroup>
              <optgroup label="Northstar Goods campaigns">
                {(Object.keys(MOCKS) as MockKey[])
                  .filter((key) => key.startsWith("northstar"))
                  .map((k) => (
                    <option key={k} value={k}>
                      {MOCKS[k].label}
                    </option>
                  ))}
              </optgroup>
              <optgroup label="Integration examples">
                {(Object.keys(MOCKS) as MockKey[])
                  .filter((key) => !key.startsWith("northstar") && key !== "default")
                  .map((k) => (
                    <option key={k} value={k}>
                      {MOCKS[k].label}
                    </option>
                  ))}
              </optgroup>
            </select>
          </div>

          {sourceKey === "live" && (
            <div style={{ fontSize: "0.75rem", color: liveError ? "#ff9f9f" : "#6fbdff" }}>
              {liveLoading ? "Loading live AEM…" : (liveError ?? "Live AEM content loaded")}
            </div>
          )}

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
                padding: "0.25rem"
              }}
            >
              {RATIOS.map((r) => (
                <button
                  key={r.id}
                  onClick={() => setRatioId(r.id)}
                  style={{
                    background: ratioId === r.id ? "rgba(255,255,255,0.1)" : "transparent",
                    color: ratioId === r.id ? "#fff" : "#555",
                    border: "none",
                    borderRadius: "6px",
                    padding: "0.375rem 0.875rem",
                    fontSize: "0.8125rem",
                    cursor: "pointer",
                    fontWeight: ratioId === r.id ? 600 : 400,
                    transition: "all 0.15s"
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
              textAlign: "right"
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

        <section
          aria-label="Campaign workspace"
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            border: "1px solid rgba(20,115,230,0.25)",
            borderRadius: "12px",
            background: "linear-gradient(135deg, rgba(20,115,230,0.10), rgba(14,59,90,0.08))"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <div>
              <div style={{ ...LABEL_STYLE, color: "#6fbdff", marginBottom: "0.25rem" }}>
                Campaign workspace
              </div>
              <strong style={{ fontSize: "1rem" }}>Shape the story before production</strong>
            </div>
            <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
              <select
                aria-label="Review status"
                value={reviewState}
                onChange={(event) => changeReviewState(event.target.value as ReviewState)}
                style={{
                  background: "#111",
                  color: "#ddd",
                  border: "1px solid rgba(255,255,255,0.14)",
                  borderRadius: "6px",
                  padding: "0.45rem"
                }}
              >
                <option value="draft">Draft</option>
                <option value="in-review">In review</option>
                <option value="approved">Approved</option>
              </select>
              <button
                onClick={saveDraft}
                style={{
                  background: "transparent",
                  color: "#9bcfff",
                  border: "1px solid rgba(155,207,255,0.35)",
                  borderRadius: "6px",
                  padding: "0.45rem 0.65rem",
                  cursor: "pointer"
                }}
              >
                Save draft
              </button>
              <button
                onClick={exportBrief}
                style={{
                  background: "#1473E6",
                  color: "white",
                  border: 0,
                  borderRadius: "6px",
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer"
                }}
              >
                Export brief
              </button>
              <button
                onClick={() => void createRenderJob()}
                disabled={templateIssues.some((issue) => issue.severity === "error")}
                style={{
                  background: "#82FFCA",
                  color: "#07131a",
                  border: 0,
                  borderRadius: "6px",
                  padding: "0.5rem 0.75rem",
                  cursor: "pointer",
                  opacity: templateIssues.some((issue) => issue.severity === "error") ? 0.45 : 1
                }}
              >
                Create render job
              </button>
            </div>
          </div>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "minmax(180px, 1fr) minmax(180px, 1fr) minmax(180px, 1fr)",
              gap: "0.75rem",
              marginTop: "1rem"
            }}
          >
            <label style={{ ...LABEL_STYLE, color: "#777" }}>
              Campaign name
              <input
                aria-label="Campaign name"
                value={campaignName}
                onChange={(event) => setCampaignName(event.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "0.35rem",
                  background: "#0c0c11",
                  color: "#eee",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  padding: "0.55rem"
                }}
              />
            </label>
            <label style={{ ...LABEL_STYLE, color: "#777" }}>
              Headline
              <input
                aria-label="Preview headline"
                value={spotlight.scenes[0]?.title ?? ""}
                onChange={(event) => setPreviewField("title", event.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "0.35rem",
                  background: "#0c0c11",
                  color: "#eee",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  padding: "0.55rem"
                }}
              />
            </label>
            <label style={{ ...LABEL_STYLE, color: "#777" }}>
              CTA
              <input
                aria-label="Preview CTA"
                value={spotlight.scenes[0]?.cta ?? ""}
                onChange={(event) => setPreviewField("cta", event.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  boxSizing: "border-box",
                  marginTop: "0.35rem",
                  background: "#0c0c11",
                  color: "#eee",
                  border: "1px solid rgba(255,255,255,0.12)",
                  borderRadius: "6px",
                  padding: "0.55rem"
                }}
              />
            </label>
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.5rem",
              alignItems: "center",
              marginTop: "0.75rem",
              color: "#888",
              fontSize: "0.75rem"
            }}
          >
            <span
              style={{
                width: 8,
                height: 8,
                borderRadius: "50%",
                background: Object.keys(previewOverrides).length ? "#ffd15c" : "#4bd37b"
              }}
            />
            {Object.keys(previewOverrides).length
              ? "Preview overrides are active — AEM content is unchanged"
              : "Using authored content"}
            {Object.keys(previewOverrides).length > 0 && (
              <button
                onClick={() => setPreviewOverrides({})}
                style={{
                  marginLeft: "auto",
                  background: "transparent",
                  color: "#9bcfff",
                  border: 0,
                  cursor: "pointer"
                }}
              >
                Reset overrides
              </button>
            )}
          </div>
          <div
            style={{
              display: "flex",
              gap: "0.75rem",
              alignItems: "center",
              marginTop: "0.55rem",
              color: "#666",
              fontSize: "0.7rem"
            }}
          >
            <span>
              {savedAt
                ? `Last saved ${new Date(savedAt).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`
                : draftNotice}
            </span>
            {reviewHistory.length > 0 && (
              <span>
                · {reviewHistory.length} review event{reviewHistory.length === 1 ? "" : "s"}
              </span>
            )}
          </div>
        </section>

        <section
          aria-label="Render provenance"
          style={{
            marginBottom: "1rem",
            padding: "1rem",
            border: "1px solid rgba(130,255,202,0.18)",
            borderRadius: "12px",
            background: "rgba(130,255,202,0.035)"
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "1rem",
              alignItems: "center",
              flexWrap: "wrap"
            }}
          >
            <div>
              <div style={{ ...LABEL_STYLE, color: "#82FFCA", marginBottom: "0.25rem" }}>
                Render provenance
              </div>
              <strong style={{ fontSize: "0.95rem" }}>
                Every output gets an explainable record
              </strong>
            </div>
            <span style={{ color: "#777", fontSize: "0.72rem" }}>
              {jobNotice ||
                `${renderJobs.length} recorded job${renderJobs.length === 1 ? "" : "s"}`}
            </span>
          </div>
          {renderJobs.length > 0 && (
            <div style={{ marginTop: "0.75rem", display: "grid", gap: "0.4rem" }}>
              {renderJobs.slice(0, 3).map((job) => (
                <div
                  key={job.renderId}
                  style={{
                    display: "grid",
                    gridTemplateColumns: "minmax(170px, 1fr) auto auto auto",
                    gap: "0.75rem",
                    alignItems: "center",
                    color: "#aaa",
                    fontSize: "0.72rem"
                  }}
                >
                  <code style={{ color: "#c8a8ff" }}>{job.renderId}</code>
                  <span>{job.status}</span>
                  <span>{job.outputFormats.join(", ")}</span>
                  <span title={job.contentHash}>sha256:{job.contentHash.slice(0, 10)}…</span>
                </div>
              ))}
            </div>
          )}
        </section>

        <section
          aria-label="Format readiness"
          style={{
            marginBottom: "1rem",
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
            gap: "0.625rem"
          }}
        >
          {RATIOS.map((item) => {
            const issues = validateSpotlightForTemplate(spotlight, item.id, SPOTLIGHT_TEMPLATE);
            const ready = !issues.some((issue) => issue.severity === "error");
            return (
              <button
                key={item.id}
                onClick={() => setRatioId(item.id)}
                style={{
                  textAlign: "left",
                  background: ratioId === item.id ? "rgba(20,115,230,0.16)" : "#0e0e14",
                  color: "#ddd",
                  border: `1px solid ${ratioId === item.id ? "rgba(20,115,230,0.65)" : "rgba(255,255,255,0.08)"}`,
                  borderRadius: "8px",
                  padding: "0.7rem",
                  cursor: "pointer"
                }}
              >
                <strong style={{ display: "block" }}>{item.label}</strong>
                <span style={{ color: ready ? "#67db91" : "#ff9f9f", fontSize: "0.7rem" }}>
                  {ready
                    ? "Ready to render"
                    : `${issues.length} issue${issues.length === 1 ? "" : "s"}`}
                </span>
              </button>
            );
          })}
        </section>

        <section
          aria-label="Scene sequence"
          style={{
            marginBottom: "1rem",
            display: "flex",
            alignItems: "center",
            gap: "0.75rem",
            flexWrap: "wrap",
            color: "#888",
            fontSize: "0.75rem"
          }}
        >
          <strong style={{ color: "#bbb" }}>Scene sequence</strong>
          <span>Reorder the story and the Player updates instantly.</span>
          {sceneOrder.length > 0 && (
            <button
              onClick={resetSceneOrder}
              style={{
                marginLeft: "auto",
                background: "transparent",
                color: "#9bcfff",
                border: 0,
                cursor: "pointer"
              }}
            >
              Reset sequence
            </button>
          )}
        </section>

        {templateIssues.length > 0 && (
          <section
            aria-label="Template validation"
            style={{
              marginBottom: "1rem",
              padding: "0.875rem 1rem",
              borderRadius: "8px",
              border: `1px solid ${templateIssues.some((i) => i.severity === "error") ? "rgba(255,106,106,0.35)" : "rgba(255,196,87,0.35)"}`,
              background: templateIssues.some((i) => i.severity === "error")
                ? "rgba(120,20,30,0.18)"
                : "rgba(120,80,20,0.18)",
              color: "#ddd",
              fontSize: "0.8125rem"
            }}
          >
            <strong style={{ display: "block", marginBottom: "0.35rem" }}>
              {templateIssues.some((i) => i.severity === "error")
                ? "Needs attention before render"
                : "Review recommended"}
            </strong>
            {templateIssues.map((issue, index) => (
              <div
                key={`${issue.field ?? "issue"}-${index}`}
                style={{ color: issue.severity === "error" ? "#ffb0b0" : "#ffd98a" }}
              >
                {issue.message}
              </div>
            ))}
          </section>
        )}

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
            padding: ratioId === "9x16" ? "2rem" : 0
          }}
        >
          <Player
            key={`${sourceKey}-${ratioId}`}
            component={SpotlightComposition}
            inputProps={{ spotlight }}
            durationInFrames={totalFrames}
            compositionWidth={ratio.width}
            compositionHeight={ratio.height}
            fps={FPS}
            style={{
              width: ratioId === "9x16" ? "min(340px, 80vw)" : "100%",
              maxHeight: "70vh"
            }}
            controls
            loop
            autoPlay
            acknowledgeRemotionLicense
            spaceKeyToPlayOrPause
          />
        </div>

        {/* Scene cards */}
        <div
          style={{
            marginTop: "1rem",
            display: "grid",
            gridTemplateColumns: `repeat(${Math.min(spotlight.scenes.length, 4)}, 1fr)`,
            gap: "0.625rem"
          }}
        >
          {spotlight.scenes.map((scene, i) => (
            <div
              key={i}
              style={{
                background: "#0e0e14",
                border: "1px solid rgba(255,255,255,0.06)",
                borderRadius: "8px",
                padding: "0.75rem"
              }}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "0.5rem",
                  marginBottom: "0.35rem"
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
                    border: "1px solid rgba(255,255,255,0.1)"
                  }}
                />
                <span
                  style={{
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    color: "#bbb",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}
                >
                  {scene.title}
                </span>
                <div style={{ marginLeft: "auto", display: "flex", gap: "0.2rem" }}>
                  <button
                    aria-label={`Move ${scene.title} earlier`}
                    onClick={() => moveScene(i, -1)}
                    disabled={i === 0}
                    style={{
                      background: "transparent",
                      color: i === 0 ? "#333" : "#9bcfff",
                      border: 0,
                      cursor: i === 0 ? "default" : "pointer",
                      fontSize: "0.8rem"
                    }}
                  >
                    ↑
                  </button>
                  <button
                    aria-label={`Move ${scene.title} later`}
                    onClick={() => moveScene(i, 1)}
                    disabled={i === spotlight.scenes.length - 1}
                    style={{
                      background: "transparent",
                      color: i === spotlight.scenes.length - 1 ? "#333" : "#9bcfff",
                      border: 0,
                      cursor: i === spotlight.scenes.length - 1 ? "default" : "pointer",
                      fontSize: "0.8rem"
                    }}
                  >
                    ↓
                  </button>
                </div>
              </div>
              <div
                style={{
                  fontSize: "0.6875rem",
                  color: "#444",
                  display: "flex",
                  gap: "0.4rem",
                  flexWrap: "wrap"
                }}
              >
                <span>{scene.animationStyle}</span>
                {scene.effectType !== "none" && <span>· {scene.effectType}</span>}
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
            flexWrap: "wrap"
          }}
        >
          {[
            "AEM Content Fragments",
            "GraphQL",
            "Remotion 4",
            "WASM Effects",
            "Zod Validation",
            "Multi-format",
            `Template ${SPOTLIGHT_TEMPLATE.version}`
          ].map((badge) => (
            <span
              key={badge}
              style={{
                fontSize: "0.6875rem",
                color: "#444",
                border: "1px solid rgba(255,255,255,0.07)",
                borderRadius: "999px",
                padding: "0.25rem 0.625rem"
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
          marginTop: "2rem"
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
