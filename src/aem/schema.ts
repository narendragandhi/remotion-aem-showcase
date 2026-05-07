import { z } from "zod";

/**
 * Zod schemas for AEM Content Fragment data validation.
 * These ensure runtime type safety for data coming from AEM GraphQL.
 */

// Animation style enum
export const AnimationStyleSchema = z.enum(["cinematic", "energetic", "minimal"]);
export type AnimationStyle = z.infer<typeof AnimationStyleSchema>;

// Rendition type enum
export const RenditionTypeSchema = z.enum(["web", "optimized", "original"]);
export type RenditionType = z.infer<typeof RenditionTypeSchema>;

// Effect type enum
export const EffectTypeSchema = z.enum(["none", "glow", "glitch"]);
export type EffectType = z.infer<typeof EffectTypeSchema>;

// CSS color validation (hex, rgb, named colors)
const cssColorRegex = /^(#([0-9A-Fa-f]{3}){1,2}|rgb\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*\)|[a-zA-Z]+)$/;
const CssColorSchema = z.string().regex(cssColorRegex, "Invalid CSS color format").or(z.string().min(1));


/**
 * Schema for a single spotlight scene.
 * Includes validation and default values for all fields.
 */
export const SpotlightSceneSchema = z.object({
  title: z.string().min(1).default("Untitled"),
  subtitle: z.string().default(""),
  cta: z.string().min(1).default("Learn more"),
  brandColor: CssColorSchema.default("#0E3B5A"),
  imageUrl: z.string().default(""),
  durationSeconds: z.number().positive().int().default(4),
  animationStyle: AnimationStyleSchema.default("minimal"),
  renditionType: RenditionTypeSchema.default("optimized"),
  effectType: EffectTypeSchema.default("none"),
  effectIntensity: z.number().min(0).max(1).default(0.5),
  lottieUrl: z.string().default(""),
  svgOverlayUrl: z.string().default(""),
});

export type SpotlightScene = z.infer<typeof SpotlightSceneSchema>;

/**
 * Schema for the AEM Spotlight aggregate root.
 * Contains an ID and array of scenes.
 */
export const AemSpotlightSchema = z.object({
  id: z.string().min(1),
  scenes: z.array(SpotlightSceneSchema).min(1),
});

export type AemSpotlight = z.infer<typeof AemSpotlightSchema>;

/**
 * Schema for raw AEM GraphQL image reference.
 */
const AemImageRefSchema = z.object({
  _publishUrl: z.string().optional(),
  _authorUrl: z.string().optional(),
  _path: z.string().optional(),
}).optional();

/**
 * Base schema for raw AEM GraphQL item (without recursion).
 */
const AemGraphQLItemBaseSchema = z.object({
  _path: z.string().optional(),
  title: z.string().optional(),
  subtitle: z.string().optional(),
  cta: z.string().optional(),
  brandColor: z.string().optional(),
  image: AemImageRefSchema,
  durationSeconds: z.union([z.number(), z.string()]).optional(),
  animationStyle: z.string().optional(),
  renditionType: z.string().optional(),
  effectType: z.string().optional(),
  effectIntensity: z.union([z.number(), z.string()]).optional(),
  lottieUrl: z.string().optional(),
  svgOverlayUrl: z.string().optional(),
});

/**
 * Schema for raw AEM GraphQL item (single content fragment).
 * Includes nested items for container fragments.
 */
export const AemGraphQLItemSchema: z.ZodType<AemGraphQLItem> = AemGraphQLItemBaseSchema.extend({
  items: z.array(z.lazy((): z.ZodType<AemGraphQLItem> => AemGraphQLItemSchema)).optional(),
});

export type AemGraphQLItem = z.infer<typeof AemGraphQLItemBaseSchema> & {
  items?: AemGraphQLItem[];
};

/**
 * Schema for AEM GraphQL response structure.
 */
export const AemGraphQLResponseSchema = z.object({
  data: z.object({
    // Standard Content Fragment by path query
    contentFragmentByPath: z.object({
      item: AemGraphQLItemSchema.optional(),
    }).optional(),
    // Alternative: Content Fragment list query
    contentFragmentList: z.object({
      items: z.array(AemGraphQLItemSchema).optional(),
    }).optional(),
    // Alternative: Persisted query results
    spotlightList: z.object({
      items: z.array(AemGraphQLItemSchema).optional(),
    }).optional(),
  }).optional(),
  errors: z.array(z.object({
    message: z.string(),
    locations: z.array(z.object({
      line: z.number(),
      column: z.number(),
    })).optional(),
    path: z.array(z.string()).optional(),
  })).optional(),
});

export type AemGraphQLResponse = z.infer<typeof AemGraphQLResponseSchema>;

/**
 * Validates and parses a SpotlightScene with defaults applied.
 * @throws {z.ZodError} if validation fails
 */
export const parseSpotlightScene = (data: unknown): SpotlightScene => {
  return SpotlightSceneSchema.parse(data);
};

/**
 * Safely parses a SpotlightScene, returning null on failure.
 */
export const safeParseSpotlightScene = (
  data: unknown
): { success: true; data: SpotlightScene } | { success: false; error: z.ZodError } => {
  return SpotlightSceneSchema.safeParse(data);
};

/**
 * Validates and parses an AemSpotlight aggregate.
 * @throws {z.ZodError} if validation fails
 */
export const parseAemSpotlight = (data: unknown): AemSpotlight => {
  return AemSpotlightSchema.parse(data);
};

/**
 * Safely parses an AemSpotlight, returning null on failure.
 */
export const safeParseAemSpotlight = (
  data: unknown
): { success: true; data: AemSpotlight } | { success: false; error: z.ZodError } => {
  return AemSpotlightSchema.safeParse(data);
};
