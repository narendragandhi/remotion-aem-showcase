import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { FileProvenanceStore } from "./fileStore";
import { CreateRenderJobInputSchema, type CreateRenderJobInput } from "./provenance";

const input: CreateRenderJobInput = {
  campaignId: "campaign-1",
  contentFragmentPath: "/content/dam/northstar/campaigns/luma-one-launch",
  templateId: "AEMSpotlight",
  templateVersion: "1.0.0",
  designSystemVersion: "0.1.0",
  renderingEngine: "remotion",
  outputFormats: ["16x9", "9x16"],
  source: "mock",
  content: {
    id: "campaign-1",
    scenes: [
      {
        title: "Hello",
        eyebrow: "TEST",
        subtitle: "",
        cta: "Go",
        brandColor: "#000",
        accentColor: "#fff",
        metricLabel: "SIGNAL",
        metricValue: "100%",
        imageUrl: "",
        durationSeconds: 4,
        animationStyle: "minimal",
        renditionType: "optimized",
        effectType: "none",
        effectIntensity: 0.5,
        lottieUrl: "",
        svgOverlayUrl: ""
      }
    ]
  }
};

describe("provenance contracts", () => {
  it("rejects unsupported render engines and malformed colors", () => {
    expect(() => CreateRenderJobInputSchema.parse({ ...input, renderingEngine: "videoflow" })).toThrow();
    expect(() => CreateRenderJobInputSchema.parse({ ...input, content: { ...input.content, scenes: [{ ...input.content.scenes[0], brandColor: "!!!" }] } })).toThrow();
  });
  it("rejects duplicate output formats and unknown fields", () => {
    expect(() =>
      CreateRenderJobInputSchema.parse({ ...input, outputFormats: ["16x9", "16x9"] })
    ).toThrow("outputFormats must not contain duplicates");
    expect(() => CreateRenderJobInputSchema.parse({ ...input, unexpected: true })).toThrow();
  });

  it("persists hashed provenance and enforces lifecycle transitions", async () => {
    const file = join(mkdtempSync(join(tmpdir(), "provenance-")), "jobs.json");
    const store = new FileProvenanceStore(file);
    const job = await store.create(input);
    expect(job.renderId).toMatch(/^render_/);
    expect(job.contentHash).toHaveLength(64);
    expect(JSON.parse(readFileSync(file, "utf8"))).toHaveLength(1);
    await expect(store.update(job.renderId, { status: "completed" })).rejects.toThrow(
      "queued -> completed"
    );
    expect((await store.update(job.renderId, { status: "rendering" }))?.status).toBe("rendering");
    const completed = await store.update(job.renderId, {
      status: "completed",
      outputUrls: { "16x9": "https://cdn.example.test/video.mp4" }
    });
    expect(completed?.status).toBe("completed");
    expect(completed?.completedAt).toBeTruthy();
  });
});
