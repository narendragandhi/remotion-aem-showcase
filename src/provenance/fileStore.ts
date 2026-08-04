import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";
import type {
  CreateRenderJobInput,
  ProvenanceStore,
  RenderJob,
  RenderJobPatch
} from "./provenance";

const ALLOWED_TRANSITIONS: Record<RenderJob["status"], RenderJob["status"][]> = {
  queued: ["rendering", "failed"],
  rendering: ["completed", "failed"],
  completed: [],
  failed: []
};

const hashContent = (content: CreateRenderJobInput["content"]): string =>
  createHash("sha256").update(JSON.stringify(content)).digest("hex");

export class FileProvenanceStore implements ProvenanceStore {
  private jobs: RenderJob[];

  constructor(private readonly filePath: string) {
    this.jobs = this.read();
  }

  async list(): Promise<RenderJob[]> {
    return [...this.jobs].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async create(input: CreateRenderJobInput): Promise<RenderJob> {
    const now = new Date().toISOString();
    const job: RenderJob = {
      renderId: `render_${randomUUID()}`,
      campaignId: input.campaignId,
      contentFragmentPath: input.contentFragmentPath,
      contentRevision: input.contentRevision,
      templateId: input.templateId,
      templateVersion: input.templateVersion,
      designSystemVersion: input.designSystemVersion,
      renderingEngine: input.renderingEngine,
      outputFormats: [...new Set(input.outputFormats)],
      source: input.source,
      contentHash: hashContent(input.content),
      requestedBy: input.requestedBy || "local-marketer",
      createdAt: now,
      updatedAt: now,
      status: "queued",
      outputUrls: {}
    };
    this.jobs = [job, ...this.jobs];
    this.write();
    return job;
  }

  async update(id: string, patch: RenderJobPatch): Promise<RenderJob | null> {
    const index = this.jobs.findIndex((job) => job.renderId === id);
    if (index < 0) return null;
    const current = this.jobs[index];
    if (
      patch.status &&
      patch.status !== current.status &&
      !ALLOWED_TRANSITIONS[current.status].includes(patch.status)
    ) {
      throw new Error(`Invalid render job transition: ${current.status} -> ${patch.status}`);
    }
    const updated: RenderJob = {
      ...current,
      ...patch,
      updatedAt: new Date().toISOString(),
      ...(patch.status === "completed" ? { completedAt: new Date().toISOString() } : {})
    };
    this.jobs[index] = updated;
    this.write();
    return updated;
  }

  private read(): RenderJob[] {
    try {
      if (!existsSync(this.filePath)) return [];
      const parsed = JSON.parse(readFileSync(this.filePath, "utf8")) as unknown;
      return Array.isArray(parsed) ? (parsed as RenderJob[]) : [];
    } catch {
      return [];
    }
  }

  private write(): void {
    mkdirSync(dirname(this.filePath), { recursive: true });
    writeFileSync(this.filePath, `${JSON.stringify(this.jobs, null, 2)}\n`, "utf8");
  }
}
