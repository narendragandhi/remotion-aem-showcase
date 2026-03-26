import mockData from "../mock/aem.json";
import { AemFetchError, AemValidationError } from "../errors";
import {
  AemSpotlight,
  SpotlightScene,
  AnimationStyle,
  RenditionType,
  EffectType,
  AemGraphQLItem,
  AemGraphQLResponseSchema,
  SpotlightSceneSchema,
  AemSpotlightSchema,
} from "./schema";

// Re-export types for backward compatibility
export type { AemSpotlight, SpotlightScene, AnimationStyle, RenditionType, EffectType };

/**
 * Configuration for AEM connection.
 */
export interface AemConfig {
  baseUrl: string;
  token?: string;
  graphqlEndpoint?: string;
  contentFragmentPath?: string;
  persistedQueryPath?: string;
  useMock?: boolean;
  publishTier?: boolean;
}

/**
 * Gets AEM configuration from environment variables.
 */
export const getAemConfig = (): AemConfig => ({
  baseUrl: process.env.AEM_BASE_URL ?? "",
  token: process.env.AEM_TOKEN,
  graphqlEndpoint: process.env.AEM_GRAPHQL_ENDPOINT ?? "/content/graphql/global/endpoint",
  contentFragmentPath: process.env.AEM_CONTENT_FRAGMENT_PATH ?? "/content/dam/content-fragments/spotlight",
  persistedQueryPath: process.env.AEM_PERSISTED_QUERY,
  useMock: process.env.USE_MOCK_AEM === "true",
  publishTier: process.env.AEM_PUBLISH_TIER === "true",
});

/**
 * Resolves an asset URL to an absolute URL.
 * Handles both absolute URLs and relative DAM paths from AEM.
 *
 * @param url - The URL or path to resolve
 * @param config - AEM configuration for base URL
 * @returns Absolute URL string
 */
export const resolveAssetUrl = (url: string | undefined, config?: AemConfig): string => {
  if (!url) return "";

  // Already absolute URL
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }

  // Relative DAM path - needs base URL
  const baseUrl = config?.baseUrl || process.env.AEM_BASE_URL || "";
  if (baseUrl && url.startsWith("/")) {
    return `${baseUrl}${url}`;
  }

  return url;
};

/**
 * Appends AEM-style image parameters for intelligent rendition selection.
 * Supports both AEM Dynamic Media and Web-Optimized Image Delivery.
 *
 * @param baseUrl - Original image URL
 * @param width - Desired width
 * @param height - Desired height
 * @param type - Rendition quality type
 * @returns URL with optimization parameters
 */
export const getDynamicRenditionUrl = (
  baseUrl: string,
  width: number,
  height: number,
  type: RenditionType
): string => {
  if (!baseUrl) return "";

  // Handle Unsplash URLs (for mock/demo data)
  if (baseUrl.includes("unsplash.com")) {
    const quality = type === "web" ? 60 : type === "optimized" ? 80 : 100;
    const cleanUrl = baseUrl.split("?")[0];
    return `${cleanUrl}?auto=format&fit=crop&q=${quality}&w=${width}&h=${height}`;
  }

  // Handle relative DAM paths
  let absoluteUrl = baseUrl;
  if (!baseUrl.startsWith("http")) {
    const aemBase = process.env.AEM_BASE_URL || "";
    absoluteUrl = `${aemBase}${baseUrl.startsWith("/") ? "" : "/"}${baseUrl}`;
  }

  try {
    const url = new URL(absoluteUrl);

    // AEM Web-Optimized Image Delivery parameters
    url.searchParams.set("width", String(Math.round(width)));
    url.searchParams.set("height", String(Math.round(height)));
    url.searchParams.set("quality", type === "web" ? "70" : type === "optimized" ? "85" : "100");
    url.searchParams.set("preferwebp", "true");

    // Add format hint for AEM Assets
    if (!url.pathname.includes(".")) {
      url.searchParams.set("format", "webply");
    }

    return url.toString();
  } catch {
    // If URL parsing fails, return original with query params appended
    const separator = baseUrl.includes("?") ? "&" : "?";
    const quality = type === "web" ? 70 : type === "optimized" ? 85 : 100;
    return `${baseUrl}${separator}width=${width}&height=${height}&quality=${quality}`;
  }
};

/**
 * GraphQL query for fetching spotlight content fragments.
 * Supports both single fragments with nested items and container fragments.
 */
const GRAPHQL_QUERY = `
  query Spotlight($path: String!) {
    contentFragmentByPath(_path: $path) {
      item {
        _path
        title
        subtitle
        cta
        brandColor
        image {
          _publishUrl
          _authorUrl
          _path
        }
        durationSeconds
        animationStyle
        renditionType
        effectType
        effectIntensity
        lottieUrl
        svgOverlayUrl
        items {
          _path
          title
          subtitle
          cta
          brandColor
          image {
            _publishUrl
            _authorUrl
            _path
          }
          durationSeconds
          animationStyle
          renditionType
          effectType
          effectIntensity
          lottieUrl
          svgOverlayUrl
        }
      }
    }
  }
`;

/**
 * GraphQL query for persisted query execution.
 */
const PERSISTED_QUERY_PATH = "/graphql/execute.json";

/**
 * Maps a raw AEM GraphQL item to a validated SpotlightScene.
 * Applies defaults and validates all fields via Zod schema.
 */
const mapSingleItemToScene = (
  item: AemGraphQLItem,
  config?: AemConfig
): SpotlightScene => {
  const defaultScene = (mockData.scenes[0] ?? {}) as Partial<SpotlightScene>;

  // Resolve image URL from various AEM formats
  const imageUrl = item.image?._publishUrl
    ?? item.image?._authorUrl
    ?? (item.image?._path ? resolveAssetUrl(item.image._path, config) : null)
    ?? defaultScene.imageUrl
    ?? "";

  // Build raw scene data
  const rawScene = {
    title: item.title ?? "Untitled",
    subtitle: item.subtitle ?? "",
    cta: item.cta ?? "Learn more",
    brandColor: item.brandColor ?? "#0E3B5A",
    imageUrl: resolveAssetUrl(imageUrl, config),
    durationSeconds: Number(item.durationSeconds) || defaultScene.durationSeconds || 4,
    animationStyle: (item.animationStyle as AnimationStyle) ?? "minimal",
    renditionType: (item.renditionType as RenditionType) ?? "optimized",
    effectType: (item.effectType as EffectType) ?? "none",
    effectIntensity: Math.max(0, Math.min(1, Number(item.effectIntensity) || 0.5)),
    lottieUrl: resolveAssetUrl(item.lottieUrl, config),
    svgOverlayUrl: resolveAssetUrl(item.svgOverlayUrl, config),
  };

  // Validate and apply defaults via Zod
  const result = SpotlightSceneSchema.safeParse(rawScene);
  if (result.success) {
    return result.data;
  }

  // Log validation errors but continue with best-effort data
  console.warn("[AEM] Scene validation warnings:", result.error.format());
  return rawScene as SpotlightScene;
};

/**
 * Maps a raw AEM GraphQL response item to a validated AemSpotlight aggregate.
 * Handles both single-scene fragments and container fragments with nested items.
 */
export const mapAemItemToSpotlight = (
  item: AemGraphQLItem,
  config?: AemConfig
): AemSpotlight => {
  const id = item._path ?? "cf-unknown";
  const nestedItems = item.items ?? [];

  let scenes: SpotlightScene[];

  if (nestedItems.length > 0) {
    // Container fragment with nested scene items
    scenes = nestedItems.map((nestedItem: AemGraphQLItem) => mapSingleItemToScene(nestedItem, config));
  } else {
    // Single scene fragment
    scenes = [mapSingleItemToScene(item, config)];
  }

  const spotlight = { id, scenes };

  // Validate the complete aggregate
  const result = AemSpotlightSchema.safeParse(spotlight);
  if (result.success) {
    return result.data;
  }

  console.warn("[AEM] Spotlight validation warnings:", result.error.format());
  return spotlight;
};

/**
 * Fetches spotlight data from AEM GraphQL API.
 *
 * @param config - Optional AEM configuration (uses env vars if not provided)
 * @returns Promise<AemSpotlight> - Validated spotlight data
 * @throws {AemFetchError} - If fetch fails and fallback is disabled
 * @throws {AemValidationError} - If response validation fails
 */
export const fetchAemSpotlight = async (
  config?: Partial<AemConfig>
): Promise<AemSpotlight> => {
  const resolvedConfig = { ...getAemConfig(), ...config };

  // Use mock data if configured or no base URL
  if (resolvedConfig.useMock || !resolvedConfig.baseUrl) {
    console.info("[AEM] Using mock data");
    // Mock data is already in final format, validate and return directly
    const result = AemSpotlightSchema.safeParse(mockData);
    if (result.success) {
      return result.data;
    }
    // Fallback to treating as GraphQL item
    return mapAemItemToSpotlight(mockData as unknown as AemGraphQLItem);
  }

  const { baseUrl, token, graphqlEndpoint, contentFragmentPath, persistedQueryPath } = resolvedConfig;

  // Determine endpoint URL
  let endpoint: string;
  let body: string | undefined;
  let method: "GET" | "POST" = "POST";

  if (persistedQueryPath) {
    // Use persisted query (GET request, CDN cacheable)
    endpoint = `${baseUrl}${PERSISTED_QUERY_PATH}${persistedQueryPath}`;
    method = "GET";
  } else {
    // Use inline GraphQL query (POST request)
    endpoint = `${baseUrl}${graphqlEndpoint}`;
    body = JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { path: contentFragmentPath },
    });
  }

  try {
    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      ...(body ? { body } : {}),
    });

    if (!res.ok) {
      throw new AemFetchError(
        `AEM GraphQL request failed: ${res.status} ${res.statusText}`,
        res.status,
        endpoint
      );
    }

    const json = await res.json();

    // Validate response structure
    const parseResult = AemGraphQLResponseSchema.safeParse(json);
    if (!parseResult.success) {
      throw new AemValidationError(
        "Invalid AEM GraphQL response structure",
        parseResult.error.issues.map((e) => e.message)
      );
    }

    const response = parseResult.data;

    // Check for GraphQL errors
    if (response.errors && response.errors.length > 0) {
      throw new AemFetchError(
        `AEM GraphQL errors: ${response.errors.map((e) => e.message).join("; ")}`,
        undefined,
        endpoint
      );
    }

    // Extract item from response (try multiple query result shapes)
    const item =
      response.data?.contentFragmentByPath?.item ??
      response.data?.contentFragmentList?.items?.[0] ??
      response.data?.spotlightList?.items?.[0];

    if (!item) {
      throw new AemValidationError(
        "No content fragment found in AEM response",
        ["Missing item in response"]
      );
    }

    return mapAemItemToSpotlight(item, resolvedConfig);
  } catch (error) {
    // Re-throw our typed errors
    if (error instanceof AemFetchError || error instanceof AemValidationError) {
      console.error(`[AEM] ${error.name}:`, error.message);

      // For recoverable errors, fall back to mock data
      if (error.recoverable) {
        console.warn("[AEM] Falling back to mock data");
        // Mock data is already in final format
        const fallbackResult = AemSpotlightSchema.safeParse(mockData);
        if (fallbackResult.success) {
          return fallbackResult.data;
        }
        return mapAemItemToSpotlight(mockData as unknown as AemGraphQLItem);
      }

      throw error;
    }

    // Wrap unknown errors
    const fetchError = new AemFetchError(
      error instanceof Error ? error.message : String(error),
      undefined,
      endpoint
    );

    console.error("[AEM] Unexpected error:", fetchError.message);
    console.warn("[AEM] Falling back to mock data");
    // Mock data is already in final format
    const result = AemSpotlightSchema.safeParse(mockData);
    if (result.success) {
      return result.data;
    }
    return mapAemItemToSpotlight(mockData as unknown as AemGraphQLItem);
  }
};

/**
 * Validates that the mock data is correctly structured.
 * Useful for development and testing.
 */
export const validateMockData = (): { valid: boolean; errors: string[] } => {
  const result = AemSpotlightSchema.safeParse(mockData);
  if (result.success) {
    return { valid: true, errors: [] };
  }
  return {
    valid: false,
    errors: result.error.issues.map((e) => `${e.path.join(".")}: ${e.message}`),
  };
};
