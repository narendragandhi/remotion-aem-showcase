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
import { trackAemFetch, trackError, createTimer } from "../telemetry";

// Dynamic imports keep Node-only modules (jsonwebtoken, crypto, fs) out of
// the webpack/browser bundle. These are only called from fetchAemSpotlight
// which runs server-side (renders/scripts), never inside a composition.
const getAccessToken = async (): Promise<string | null> => {
  const { getAccessToken: _get } = await import("./tokenManager");
  return _get();
};

const getCachedAemResponse = async <T>(key: string): Promise<T | null> => {
  const { getCachedAemResponse: _get } = await import("../cache");
  return _get<T>(key);
};

const cacheAemResponse = async <T>(key: string, data: T): Promise<void> => {
  const { cacheAemResponse: _set } = await import("../cache");
  _set(key, data);
};

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
  strictMode?: boolean;
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
  strictMode: process.env.AEM_STRICT_MODE === "true",
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

  const { baseUrl, token, graphqlEndpoint, contentFragmentPath, persistedQueryPath, strictMode, useMock } = resolvedConfig;

  // Check cache first (unless using mock)
  const cacheKey = contentFragmentPath || "/content/dam/content-fragments/spotlight";
  if (!useMock && baseUrl) {
    const cached = await getCachedAemResponse<AemSpotlight>(cacheKey);
    if (cached) {
      console.info("[AEM] Using cached response");
      return cached;
    }
  }

  // Initialize telemetry tracker
  const telemetryTracker = trackAemFetch(
    baseUrl ? `${baseUrl}${graphqlEndpoint}` : "mock",
    contentFragmentPath ?? "/content/dam/content-fragments/spotlight",
    useMock || !baseUrl
  );
  const fetchTimer = createTimer("aem_fetch_duration", { endpoint: baseUrl || "mock" });

  // Use mock data if configured or no base URL (and not in strict mode)
  if ((useMock || !baseUrl) && !strictMode) {
    console.info("[AEM] Using mock data");
    const result = AemSpotlightSchema.safeParse(mockData);
    fetchTimer.stop();
    if (result.success) {
      telemetryTracker.complete(result.data.scenes.length);
      return result.data;
    }
    const mapped = mapAemItemToSpotlight(mockData as unknown as AemGraphQLItem);
    telemetryTracker.complete(mapped.scenes.length);
    return mapped;
  }

  if (!baseUrl && strictMode) {
    const error = new AemFetchError("AEM_BASE_URL is missing in strict mode", 400);
    telemetryTracker.error(error.message);
    trackError("aem_config_error", error, { strictMode: true }, false);
    throw error;
  }

  // Determine endpoint URL
  let endpoint: string;
  let body: string | undefined;
  let method: "GET" | "POST" = "POST";

  if (persistedQueryPath) {
    // Principal Recommendation: Use persisted queries for CDN cache hits
    endpoint = `${baseUrl}${PERSISTED_QUERY_PATH}${persistedQueryPath}`;
    method = "GET";
  } else {
    // Inline queries (Dev only)
    endpoint = `${baseUrl}${graphqlEndpoint}`;
    body = JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: { path: contentFragmentPath },
    });
  }

  try {
    // Get token (supports both static and IMS auto-refresh)
    const accessToken = token || (await getAccessToken());

    const res = await fetch(endpoint, {
      method,
      headers: {
        "Content-Type": "application/json",
        ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
      },
      ...(body ? { body } : {}),
    });

    if (!res.ok) {
      const error = new AemFetchError(
        `AEM GraphQL request failed: ${res.status} ${res.statusText}`,
        res.status,
        endpoint
      );
      telemetryTracker.error(error.message);
      trackError("aem_fetch_error", error, { status: res.status, endpoint });
      throw error;
    }

    const json = await res.json();
    const parseResult = AemGraphQLResponseSchema.safeParse(json);

    if (!parseResult.success) {
      const error = new AemValidationError(
        "Invalid AEM GraphQL response structure",
        parseResult.error.issues.map((e) => e.message)
      );
      telemetryTracker.error(error.message);
      trackError("aem_validation_error", error, { issues: parseResult.error.issues });
      throw error;
    }

    const response = parseResult.data;

    if (response.errors && response.errors.length > 0) {
      const error = new AemFetchError(
        `AEM GraphQL errors: ${response.errors.map((e) => e.message).join("; ")}`,
        undefined,
        endpoint
      );
      telemetryTracker.error(error.message);
      trackError("aem_graphql_error", error, { graphqlErrors: response.errors });
      throw error;
    }

    const item =
      response.data?.contentFragmentByPath?.item ??
      response.data?.contentFragmentList?.items?.[0] ??
      response.data?.spotlightList?.items?.[0];

    if (!item) {
      const error = new AemValidationError("No content fragment found in AEM response", ["Missing item"]);
      telemetryTracker.error(error.message);
      trackError("aem_content_error", error, { endpoint });
      throw error;
    }

    const spotlight = mapAemItemToSpotlight(item, resolvedConfig);
    fetchTimer.stop();
    telemetryTracker.complete(spotlight.scenes.length);

    // Cache successful response
    await cacheAemResponse(cacheKey, spotlight);

    return spotlight;
  } catch (error) {
    fetchTimer.stop();

    if (strictMode) {
      console.error("[AEM-STRICT] Failing render due to AEM error:", error instanceof Error ? error.message : String(error));
      throw error;
    }

    console.warn("[AEM] Error encountered, falling back to mock data (Non-Strict Mode)");
    trackError(
      "aem_fallback",
      error instanceof Error ? error : new Error(String(error)),
      { fallbackToMock: true },
      true,
      true
    );

    const fallbackResult = AemSpotlightSchema.safeParse(mockData);
    if (fallbackResult.success) {
      telemetryTracker.complete(fallbackResult.data.scenes.length);
      return fallbackResult.data;
    }
    const mapped = mapAemItemToSpotlight(mockData as unknown as AemGraphQLItem);
    telemetryTracker.complete(mapped.scenes.length);
    return mapped;
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
