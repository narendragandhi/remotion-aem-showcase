import type { AemSpotlight } from "../aem/schema";
import { AemSpotlightSchema } from "../aem/schema";
import { z } from "zod";

export const RENDER_JOB_STATUSES = ["queued", "rendering", "completed", "failed"] as const;
export type RenderJobStatus = (typeof RENDER_JOB_STATUSES)[number];
export type ProvenanceFormat = "16x9" | "9x16" | "1x1" | "4K";

export const ProvenanceFormatSchema = z.enum(["16x9", "9x16", "1x1", "4K"]);
export const RenderJobStatusSchema = z.enum(RENDER_JOB_STATUSES);
export const RenderingEngineSchema = z.enum(["remotion", "videoflow"]);

export type RenderProvenance = {
  renderId: string;
  campaignId: string;
  contentFragmentPath: string;
  contentRevision?: string;
  templateId: string;
  templateVersion: string;
  designSystemVersion: string;
  renderingEngine: "remotion" | "videoflow";
  outputFormats: ProvenanceFormat[];
  source: "aem" | "mock";
  contentHash: string;
  requestedBy: string;
  createdAt: string;
};

export type RenderJob = RenderProvenance & {
  status: RenderJobStatus;
  updatedAt: string;
  completedAt?: string;
  failureReason?: string;
  outputUrls: Partial<Record<ProvenanceFormat, string>>;
};

export type CreateRenderJobInput = {
  campaignId: string;
  contentFragmentPath: string;
  contentRevision?: string;
  templateId: string;
  templateVersion: string;
  designSystemVersion: string;
  renderingEngine: RenderProvenance["renderingEngine"];
  outputFormats: ProvenanceFormat[];
  source: RenderProvenance["source"];
  content: AemSpotlight;
  requestedBy?: string;
};

export const CreateRenderJobInputSchema = z
  .object({
    campaignId: z.string().min(1).max(300),
    contentFragmentPath: z.string().min(1).max(500),
    contentRevision: z.string().max(300).optional(),
    templateId: z.string().min(1).max(100),
    templateVersion: z.string().min(1).max(50),
    designSystemVersion: z.string().min(1).max(50),
    renderingEngine: RenderingEngineSchema,
    outputFormats: z
      .array(ProvenanceFormatSchema)
      .min(1)
      .max(4)
      .refine(
        (formats) => new Set(formats).size === formats.length,
        "outputFormats must not contain duplicates"
      ),
    source: z.enum(["aem", "mock"]),
    content: AemSpotlightSchema,
    requestedBy: z.string().min(1).max(200).optional()
  })
  .strict();

export const RenderJobPatchSchema = z
  .object({
    status: RenderJobStatusSchema.optional(),
    failureReason: z.string().max(1000).optional(),
    outputUrls: z
      .object({
        "16x9": z.string().url().max(2000).optional(),
        "9x16": z.string().url().max(2000).optional(),
        "1x1": z.string().url().max(2000).optional(),
        "4K": z.string().url().max(2000).optional()
      })
      .strict()
      .optional()
  })
  .strict();

export type RenderJobPatch = z.infer<typeof RenderJobPatchSchema>;

export type ProvenanceStore = {
  list(): Promise<RenderJob[]>;
  create(input: CreateRenderJobInput): Promise<RenderJob>;
  update(id: string, patch: RenderJobPatch): Promise<RenderJob | null>;
};
