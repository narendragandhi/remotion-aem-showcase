import { createHash } from "node:crypto";
import { hostname } from "node:os";
import { mkdirSync, readFileSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";
import { spawn } from "node:child_process";
import { Pool } from "pg";
import { validateMediaFile } from "./validate-media.mjs";

import { validateAssets } from "./lib/asset-policy.mjs";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required");

const once = process.argv.includes("--once");
const pollMs = Number(process.env.PROVENANCE_WORKER_POLL_MS || 2000);
const leaseSeconds = Number(process.env.PROVENANCE_WORKER_LEASE_SECONDS || 900);
const renderTimeoutMs = Number(process.env.PROVENANCE_WORKER_TIMEOUT_MS || 900000);
for (const [name, value] of Object.entries({ pollMs, leaseSeconds, renderTimeoutMs })) {
  if (!Number.isFinite(value) || value <= 0) throw new Error(`${name} must be positive`);
}
if (leaseSeconds < 3) throw new Error("Worker leases must be at least three seconds");
const workerId = process.env.PROVENANCE_WORKER_ID || `${hostname()}-${process.pid}`;
const outputRoot = resolve(process.env.PROVENANCE_OUTPUT_DIR || ".local/provenance/outputs");
const pool = new Pool({ connectionString: databaseUrl, max: 2 });

const compositionFor = {
  "16x9": "AEMSpotlight-16x9",
  "9x16": "AEMSpotlight-9x16",
  "1x1": "AEMSpotlight-1x1",
  "4K": "AEMSpotlight-4K"
};

async function claimJob() {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query(`
      with exhausted as (
        update render_jobs set status = 'failed', failure_reason = 'Worker lease expired on final attempt', lease_until = null, worker_id = null
        where status = 'rendering' and lease_until < now() and attempt_count >= max_attempts
        returning render_id
      )
      insert into render_job_events (render_id, from_status, to_status, actor_id)
      select render_id, 'rendering', 'failed', 'lease-recovery' from exhausted
    `);
    const result = await client.query(`
      select r.render_id, r.rendering_engine, r.output_formats, c.content_snapshot, r.status, r.attempt_count, r.max_attempts
      from render_jobs r
      join campaign_revisions c on c.id = r.campaign_revision_id
      where (r.status = 'queued' or (r.status = 'rendering' and r.lease_until < now()))
        and r.attempt_count < r.max_attempts
      order by r.created_at
      for update skip locked
      limit 1
    `);
    if (!result.rowCount) {
      await client.query("rollback");
      return null;
    }
    const job = result.rows[0];
    await client.query(
      "update render_jobs set status = 'rendering', attempt_count = attempt_count + 1, lease_until = now() + ($2 * interval '1 second'), worker_id = $3 where render_id = $1",
      [job.render_id, leaseSeconds, workerId]
    );
    await client.query(
      "insert into render_job_events (render_id, from_status, to_status, actor_id, metadata) values ($1, $2, 'rendering', $3, $4::jsonb)",
      [job.render_id, job.status, workerId, JSON.stringify({ attempt: job.attempt_count + 1, leaseSeconds })]
    );
    await client.query("commit");
    return { ...job, attempt_count: job.attempt_count + 1 };
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function markFailed(job, error) {
  const renderId = job.render_id;
  const message = String(error);
  const result = await pool.query("update render_jobs set status = case when attempt_count < max_attempts then 'queued' else 'failed' end, failure_reason = $2, lease_until = null, worker_id = null where render_id = $1 and worker_id = $3 and attempt_count = $4 and status = 'rendering' and lease_until > now() returning status, attempt_count, max_attempts", [renderId, message, workerId, job.attempt_count]);
  if (!result.rowCount) return;
  const status = result.rows[0]?.status || "failed";
  const nextStatus = status === "queued" ? "queued" : "failed";
  await pool.query(
    "insert into render_job_events (render_id, from_status, to_status, actor_id, metadata) values ($1, 'rendering', $2, $3, $4::jsonb)",
    [renderId, nextStatus, workerId, JSON.stringify({ error: message, retrying: nextStatus === "queued", attempt: result.rows[0]?.attempt_count, maxAttempts: result.rows[0]?.max_attempts })]
  );
}

async function markCompleted(job, outputs) {
  const renderId = job.render_id;
  const client = await pool.connect();
  try {
    await client.query("begin");
    const owned = await client.query("select render_id from render_jobs where render_id = $1 and worker_id = $2 and attempt_count = $3 and status = 'rendering' and lease_until > now() for update", [renderId, workerId, job.attempt_count]);
    if (!owned.rowCount) throw new Error("Render lease lost before completion");
    for (const output of outputs) {
      await client.query(
        `insert into render_outputs (render_id, output_format, asset_url, checksum, byte_size)
         values ($1, $2, $3, $4, $5)
         on conflict (render_id, output_format) do update set asset_url = excluded.asset_url, checksum = excluded.checksum, byte_size = excluded.byte_size`,
        [renderId, output.format, output.url, output.checksum, output.byteSize]
      );
    }
    await client.query("update render_jobs set status = 'completed', completed_at = now(), lease_until = null, worker_id = null where render_id = $1", [renderId]);
    await client.query(
      "insert into render_job_events (render_id, from_status, to_status, actor_id, metadata) values ($1, 'rendering', 'completed', $2, $3::jsonb)",
      [
        renderId,
        workerId,
        JSON.stringify({
          formats: outputs.map((output) => output.format),
          mediaValidation: outputs.map((output) => ({ format: output.format, ...output.media }))
        })
      ]
    );
    await client.query("commit");
  } catch (error) {
    await client.query("rollback");
    throw error;
  } finally {
    client.release();
  }
}

async function renderWithLease(job, command, args, options) {
  await new Promise((resolveRender, reject) => {
    const child = spawn(command, args, options);
    let renewing = false;
    let leaseError;
    const timer = setInterval(async () => {
      if (renewing) return;
      renewing = true;
      try {
        const renewed = await pool.query("update render_jobs set lease_until = now() + ($4 * interval '1 second') where render_id = $1 and worker_id = $2 and attempt_count = $3 and status = 'rendering' and lease_until > now() returning render_id", [job.render_id, workerId, job.attempt_count, leaseSeconds]);
        if (!renewed.rowCount) throw new Error("Render lease lost");
      } catch (error) {
        leaseError = error;
        child.kill('SIGKILL');
      } finally { renewing = false; }
    }, Math.max(100, Math.floor(leaseSeconds * 1000 / 3)));
    child.once('error', error => { clearInterval(timer); reject(error); });
    child.once('close', (code, signal) => {
      clearInterval(timer);
      if (leaseError) reject(leaseError);
      else if (code !== 0) reject(new Error(`Render exited with code ${code}, signal ${signal}`));
      else resolveRender();
    });
  });
}

async function processJob(job) {
  mkdirSync(outputRoot, { recursive: true });
  const jobOutputRoot = resolve(outputRoot, job.render_id, `attempt-${job.attempt_count}`);
  mkdirSync(jobOutputRoot, { recursive: true });
  const propsPath = resolve(jobOutputRoot, "props.json");
  writeFileSync(propsPath, JSON.stringify({ spotlight: job.content_snapshot }), "utf8");
  const outputs = [];
  try {
    validateAssets(job.content_snapshot, process.env.ASSET_ALLOWED_ORIGINS || "");
    if (job.rendering_engine !== "remotion") throw new Error("Unsupported rendering engine");
    for (const format of job.output_formats) {
      const composition = compositionFor[format];
      const outputPath = resolve(jobOutputRoot, `${format}.mp4`);
      const command = process.platform === "win32" ? "npx.cmd" : "npx";
      await renderWithLease(job, command, ["remotion", "render", "src/index.tsx", composition, outputPath, `--props=${propsPath}`], {
        stdio: "inherit",
        timeout: renderTimeoutMs,
        env: { ...process.env, USE_MOCK_AEM: "false", AEM_STRICT_MODE: "true" }
      });
      const media = validateMediaFile(outputPath, format);
      const fileBytes = readFileSync(outputPath);
      outputs.push({
        format,
        media,
        url: `file://${outputPath}`,
        byteSize: statSync(outputPath).size,
        checksum: createHash("sha256").update(fileBytes).digest("hex")
      });
    }
    await markCompleted(job, outputs);
    console.log(`[Provenance worker] Completed ${job.render_id}`);
  } catch (error) {
    await markFailed(job, error instanceof Error ? error.message : String(error));
    console.error(`[Provenance worker] Failed ${job.render_id}:`, error);
  } finally {
    try { unlinkSync(propsPath); } catch { /* keep render artifacts, remove only props */ }
  }
}

async function main() {
  try {
    do {
      const job = await claimJob();
      if (job) await processJob(job);
      else if (!once) await new Promise((resolvePromise) => setTimeout(resolvePromise, pollMs));
      if (once) break;
    } while (true);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exitCode = 1;
});
