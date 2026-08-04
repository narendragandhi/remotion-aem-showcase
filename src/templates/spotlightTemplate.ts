import { z } from "zod";
import { parseAemSpotlight, SpotlightScene } from "../aem/schema";

export const VideoRatioSchema = z.enum(["16x9", "9x16", "1x1", "4K"]);
export type VideoRatio = z.infer<typeof VideoRatioSchema>;

export const VideoTemplateSchema = z.object({
  id: z.string().min(1),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "Use semantic versioning"),
  supportedRatios: z.array(VideoRatioSchema).min(1),
  requiredFields: z.array(z.string().min(1)),
  brandTokenSet: z.string().min(1)
});

export type VideoTemplate = z.infer<typeof VideoTemplateSchema>;

export const SPOTLIGHT_TEMPLATE: VideoTemplate = {
  id: "aem-spotlight",
  version: "1.0.0",
  supportedRatios: ["16x9", "9x16", "1x1", "4K"],
  requiredFields: ["title", "imageUrl", "durationSeconds"],
  brandTokenSet: "spotlight-default"
};

export type TemplateIssue = {
  severity: "error" | "warning";
  field?: string;
  message: string;
};

const MAX_TEXT_LENGTHS: Partial<Record<keyof SpotlightScene, number>> = {
  title: 80,
  subtitle: 48,
  cta: 32
};

/**
 * Validates content against template constraints that are presentation-specific
 * and therefore do not belong in the generic AEM domain schema.
 */
export const validateSpotlightForTemplate = (
  input: unknown,
  ratio: VideoRatio,
  template: VideoTemplate = SPOTLIGHT_TEMPLATE
): TemplateIssue[] => {
  const issues: TemplateIssue[] = [];
  const parsedTemplate = VideoTemplateSchema.safeParse(template);

  if (!parsedTemplate.success) {
    return [{ severity: "error", message: "Template configuration is invalid." }];
  }

  if (!parsedTemplate.data.supportedRatios.includes(ratio)) {
    issues.push({
      severity: "error",
      message: `Template ${parsedTemplate.data.id} does not support ${ratio}.`
    });
  }

  const parsedSpotlight = (() => {
    try {
      return parseAemSpotlight(input);
    } catch {
      return null;
    }
  })();

  if (!parsedSpotlight) {
    return [
      ...issues,
      { severity: "error", message: "Content does not match the AEM video schema." }
    ];
  }

  parsedSpotlight.scenes.forEach((scene, index) => {
    const sceneLabel = `Scene ${index + 1}`;

    if (!scene.imageUrl) {
      issues.push({
        severity: "error",
        field: `scenes.${index}.imageUrl`,
        message: `${sceneLabel} is missing an image asset.`
      });
    }

    for (const [field, maxLength] of Object.entries(MAX_TEXT_LENGTHS)) {
      const value = scene[field as keyof SpotlightScene];
      if (typeof value === "string" && value.length > maxLength) {
        issues.push({
          severity: "warning",
          field: `scenes.${index}.${field}`,
          message: `${sceneLabel} ${field} is ${value.length} characters; the recommended maximum is ${maxLength}.`
        });
      }
    }
  });

  return issues;
};
