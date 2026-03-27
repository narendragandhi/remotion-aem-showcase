import { Composition, registerRoot } from "remotion";
import { SpotlightComposition } from "./compositions/SpotlightComposition";
import defaultMock from "./mock/aem.json";
import loyaltyMock from "./mock/examples/loyalty_year_in_review.json";
import ecommerceMock from "./mock/examples/ecommerce_product_spotlight.json";
import newsMock from "./mock/examples/social_localized_news.json";
import globalMock from "./mock/examples/global_campaign_multilang.json";
import { AemSpotlight } from "./aem/aemClient";
import { parseAemSpotlight } from "./aem/schema";
import { z } from "zod";

// Principal Recommendation: Support dynamic mock swapping for demos
const getMockData = () => {
  const mode = process.env.REMOTION_MOCK_FILE;
  switch (mode) {
    case "loyalty": return loyaltyMock;
    case "ecommerce": return ecommerceMock;
    case "news": return newsMock;
    case "global": return globalMock;
    default: return defaultMock;
  }
};

const mockSpotlight = getMockData();
const FPS = 30;

// Validate and parse mock data with Zod for type safety
let spotlight: AemSpotlight;
try {
  spotlight = parseAemSpotlight(mockSpotlight);
} catch (error) {
  if (error instanceof z.ZodError) {
    console.error("[Remotion] Mock data validation failed:", error.format());
  }
  // Fallback to raw data if validation fails
  spotlight = mockSpotlight as unknown as AemSpotlight;
}

// Calculate total duration from all scenes
const totalDuration = spotlight.scenes.reduce(
  (acc, scene) => acc + scene.durationSeconds,
  0
);

/**
 * Root component that registers all compositions.
 * Each composition targets a different aspect ratio for multi-channel delivery.
 */
export const RemotionVideo: React.FC = () => (
  <>
    {/* Landscape 16:9 - YouTube, Desktop, TV */}
    <Composition
      id="AEMSpotlight-16x9"
      component={SpotlightComposition}
      width={1280}
      height={720}
      fps={FPS}
      durationInFrames={totalDuration * FPS}
      defaultProps={{ spotlight }}
    />

    {/* Portrait 9:16 - Instagram Stories, TikTok, Reels */}
    <Composition
      id="AEMSpotlight-9x16"
      component={SpotlightComposition}
      width={720}
      height={1280}
      fps={FPS}
      durationInFrames={totalDuration * FPS}
      defaultProps={{ spotlight }}
    />

    {/* Square 1:1 - Instagram Feed, LinkedIn */}
    <Composition
      id="AEMSpotlight-1x1"
      component={SpotlightComposition}
      width={1080}
      height={1080}
      fps={FPS}
      durationInFrames={totalDuration * FPS}
      defaultProps={{ spotlight }}
    />

    {/* 4K Landscape - Premium content */}
    <Composition
      id="AEMSpotlight-4K"
      component={SpotlightComposition}
      width={3840}
      height={2160}
      fps={FPS}
      durationInFrames={totalDuration * FPS}
      defaultProps={{ spotlight }}
    />
  </>
);

registerRoot(RemotionVideo);
