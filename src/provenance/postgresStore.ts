import { createHash, randomUUID } from "node:crypto";
import { Pool, type PoolClient } from "pg";
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

type RenderJobRow = {
  render_id: string;
  campaign_id: string;
  content_fragment_path: string;
  content_revision: string | null;
  template_id: string;
  template_version: string;
  design_system_version: string;
  rendering_engine: RenderJob["renderingEngine"];
  output_formats: RenderJob["outputFormats"];
  source: RenderJob["source"];
  content_hash: string;
  requested_by: string;
  status: RenderJob["status"];
  created_at: Date;
  updated_at: Date;
  completed_at: Date | null;
  failure_reason: string | null;
  output_urls: Record<string, string> | null;
};

const mapRow = (row: RenderJobRow): RenderJob => ({
  renderId: row.render_id,
  campaignId: row.campaign_id,
  contentFragmentPath: row.content_fragment_path,
  contentRevision: row.content_revision ?? undefined,
  templateId: row.template_id,
  templateVersion: row.template_version,
  designSystemVersion: row.design_system_version,
  renderingEngine: row.rendering_engine,
  outputFormats: row.output_formats,
  source: row.source,
  contentHash: row.content_hash,
  requestedBy: row.requested_by,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  status: row.status,
  completedAt: row.completed_at?.toISOString(),
  failureReason: row.failure_reason ?? undefined,
  outputUrls: row.output_urls ?? {}
});

const selectColumns = `
  r.render_id, c.campaign_id, c.content_fragment_path, c.content_revision,
  r.template_id, r.template_version, r.design_system_version, r.rendering_engine,
  r.output_formats, c.source, c.content_hash, r.requested_by, r.status,
  r.created_at, r.updated_at, r.completed_at, r.failure_reason,
  coalesce(jsonb_object_agg(o.output_format, o.asset_url) filter (where o.output_format is not null), '{}'::jsonb) as output_urls
  from render_jobs r
  join campaign_revisions c on c.id = r.campaign_revision_id
  left join render_outputs o on o.render_id = r.render_id`;

export class PostgresProvenanceStore implements ProvenanceStore {
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000 });
  }

  async list(): Promise<RenderJob[]> {
    const result = await this.pool.query<RenderJobRow>(
      `select ${selectColumns} group by r.render_id, c.id order by r.created_at desc`
    );
    return result.rows.map(mapRow);
  }

  async create(input: CreateRenderJobInput): Promise<RenderJob> {
    const client = await this.pool.connect();
    const renderId = `render_${randomUUID()}`;
    const contentHash = hashContent(input.content);
    try {
      await client.query("begin");
      const revision = await client.query<{ id: string }>(
        `insert into campaign_revisions (campaign_id, content_fragment_path, content_revision, content_hash, source, content_snapshot)
         values ($1, $2, $3, $4, $5, $6::jsonb)
         on conflict (campaign_id, content_hash) do update set content_revision = excluded.content_revision
         returning id`,
        [
          input.campaignId,
          input.contentFragmentPath,
          input.contentRevision ?? null,
          contentHash,
          input.source,
          JSON.stringify(input.content)
        ]
      );
      await client.query(
        `insert into render_jobs (render_id, campaign_revision_id, template_id, template_version, design_system_version, rendering_engine, output_formats, requested_by)
         values ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          renderId,
          revision.rows[0].id,
          input.templateId,
          input.templateVersion,
          input.designSystemVersion,
          input.renderingEngine,
          input.outputFormats,
          input.requestedBy || "local-marketer"
        ]
      );
      await client.query(
        `insert into render_job_events (render_id, from_status, to_status, actor_id, metadata)
         values ($1, null, 'queued', $2, $3::jsonb)`,
        [renderId, input.requestedBy || "local-marketer", JSON.stringify({ contentHash })]
      );
      await client.query("commit");
      return (await this.getById(client, renderId))!;
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async update(id: string, patch: RenderJobPatch): Promise<RenderJob | null> {
    const client = await this.pool.connect();
    try {
      await client.query("begin");
      const current = await client.query<{ status: RenderJob["status"] }>(
        "select status from render_jobs where render_id = $1 for update",
        [id]
      );
      if (!current.rowCount) {
        await client.query("rollback");
        return null;
      }
      const currentStatus = current.rows[0].status;
      if (
        patch.status &&
        patch.status !== currentStatus &&
        !ALLOWED_TRANSITIONS[currentStatus].includes(patch.status)
      ) {
        throw new Error(`Invalid render job transition: ${currentStatus} -> ${patch.status}`);
      }
      const nextStatus = patch.status ?? currentStatus;
      await client.query(
        `update render_jobs set status = $2, failure_reason = coalesce($3, failure_reason), completed_at = case when $2 = 'completed' then now() else completed_at end where render_id = $1`,
        [id, nextStatus, patch.failureReason ?? null]
      );
      if (patch.outputUrls) {
        for (const [format, assetUrl] of Object.entries(patch.outputUrls)) {
          if (!assetUrl) continue;
          await client.query(
            `insert into render_outputs (render_id, output_format, asset_url) values ($1, $2, $3)
             on conflict (render_id, output_format) do update set asset_url = excluded.asset_url`,
            [id, format, assetUrl]
          );
        }
      }
      if (patch.status && patch.status !== currentStatus) {
        await client.query(
          `insert into render_job_events (render_id, from_status, to_status, actor_id) values ($1, $2, $3, $4)`,
          [id, currentStatus, patch.status, "provenance-api"]
        );
      }
      await client.query("commit");
      return this.getById(client, id);
    } catch (error) {
      await client.query("rollback");
      throw error;
    } finally {
      client.release();
    }
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private async getById(client: PoolClient, id: string): Promise<RenderJob | null> {
    const result = await client.query<RenderJobRow>(
      `select ${selectColumns} where r.render_id = $1 group by r.render_id, c.id`,
      [id]
    );
    return result.rows[0] ? mapRow(result.rows[0]) : null;
  }
}
