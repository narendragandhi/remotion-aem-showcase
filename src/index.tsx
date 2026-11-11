import { CalculateMetadataFunction, Composition, registerRoot } from "remotion";
import {
  CampaignIntelligenceComposition,
  CAMPAIGN_INTELLIGENCE_INTRO_FRAMES,
  SpotlightComposition
} from "./compositions/SpotlightComposition";
import defaultMock from "./mock/aem.json";
import loyaltyMock from "./mock/examples/loyalty_year_in_review.json";
import ecommerceMock from "./mock/examples/ecommerce_product_spotlight.json";
import newsMock from "./mock/examples/social_localized_news.json";
import globalMock from "./mock/examples/global_campaign_multilang.json";
import { AemSpotlight, fetchAemSpotlight } from "./aem/aemClient";
import { parseAemSpotlight } from "./aem/schema";

const FPS = 30;

const getMockData = () => {
  switch (process.env.REMOTION_MOCK_FILE) {
    case "loyalty":
      return loyaltyMock;
    case "ecommerce":
      return ecommerceMock;
    case "news":
      return newsMock;
    case "global":
      return globalMock;
    default:
      return defaultMock;
  }
};

const parseMockSpotlight = (): AemSpotlight => parseAemSpotlight(getMockData());

const totalDurationInFrames = (spotlight: AemSpotlight): number =>
  Math.ceil(spotlight.scenes.reduce((acc, scene) => acc + scene.durationSeconds, 0) * FPS);

export type RemotionProps = {
  spotlight?: AemSpotlight;
};

const resolveSpotlight = async (props: RemotionProps): Promise<AemSpotlight> => {
  return (
    (props.spotlight ? parseAemSpotlight(props.spotlight) : undefined) ??
    (process.env.USE_MOCK_AEM === "true" || !process.env.AEM_BASE_URL
      ? parseMockSpotlight()
      : await fetchAemSpotlight({
          strictMode: process.env.AEM_STRICT_MODE === "true"
        }))
  );
};

/** Resolve content and duration once before the render starts. */
const calculateMetadata: CalculateMetadataFunction<RemotionProps> = async ({ props }) => {
  const spotlight = await resolveSpotlight(props);

  return {
    durationInFrames: totalDurationInFrames(spotlight),
    props: { spotlight }
  };
};

const calculateCampaignIntelligenceMetadata: CalculateMetadataFunction<RemotionProps> = async ({
  props
}) => {
  const spotlight = await resolveSpotlight(props);
  return {
    durationInFrames: totalDurationInFrames(spotlight) + CAMPAIGN_INTELLIGENCE_INTRO_FRAMES,
    props: { spotlight }
  };
};

export const RemotionVideo: React.FC = () => (
  <>
    <Composition
      id="AEMSpotlight-16x9"
      component={SpotlightComposition}
      width={1280}
      height={720}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="AEMSpotlight-9x16"
      component={SpotlightComposition}
      width={720}
      height={1280}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="AEMSpotlight-1x1"
      component={SpotlightComposition}
      width={1080}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="AEMSpotlight-4K"
      component={SpotlightComposition}
      width={3840}
      height={2160}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateMetadata}
    />
    <Composition
      id="AEMCampaignIntelligence-16x9"
      component={CampaignIntelligenceComposition}
      width={1280}
      height={720}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateCampaignIntelligenceMetadata}
    />
    <Composition
      id="AEMCampaignIntelligence-9x16"
      component={CampaignIntelligenceComposition}
      width={720}
      height={1280}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateCampaignIntelligenceMetadata}
    />
    <Composition
      id="AEMCampaignIntelligence-1x1"
      component={CampaignIntelligenceComposition}
      width={1080}
      height={1080}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateCampaignIntelligenceMetadata}
    />
    <Composition
      id="AEMCampaignIntelligence-4K"
      component={CampaignIntelligenceComposition}
      width={3840}
      height={2160}
      fps={FPS}
      durationInFrames={1}
      defaultProps={{}}
      calculateMetadata={calculateCampaignIntelligenceMetadata}
    />
  </>
);

registerRoot(RemotionVideo);
