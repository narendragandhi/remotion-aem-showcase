/**
 * Engine-neutral rendering contract. Content, templates, and design tokens
 * should not know whether frames are produced by Remotion or VideoFlow.
 */
export type RenderingEngine = "remotion" | "videoflow";

export type EngineCapability =
  | "react-composition"
  | "json-composition"
  | "browser-preview"
  | "server-render"
  | "multi-format"
  | "aem-data";

export const RENDERING_ENGINES: Record<
  RenderingEngine,
  {
    label: string;
    license: string;
    capabilities: EngineCapability[];
    status: "active" | "adapter-ready";
  }
> = {
  remotion: {
    label: "Remotion",
    license: "Remotion Free/Company license",
    capabilities: [
      "react-composition",
      "browser-preview",
      "server-render",
      "multi-format",
      "aem-data"
    ],
    status: "active"
  },
  videoflow: {
    label: "VideoFlow",
    license: "Apache-2.0",
    capabilities: [
      "json-composition",
      "browser-preview",
      "server-render",
      "multi-format",
      "aem-data"
    ],
    status: "adapter-ready"
  }
};

export const resolveRenderingEngine = (value = process.env.VIDEO_ENGINE): RenderingEngine =>
  value === "videoflow" ? "videoflow" : "remotion";
