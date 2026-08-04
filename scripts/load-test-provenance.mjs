import { readFile } from "node:fs/promises";
import { performance } from "node:perf_hooks";

const args = new Map(
  process.argv.slice(2).map((value) => {
    const [key, raw] = value.replace(/^--/, "").split("=");
    return [key, raw ?? true];
  })
);
const baseUrl = String(args.get("base-url") || process.env.PROVENANCE_API_BASE_URL || "http://127.0.0.1:5176");
const requests = Number(args.get("requests") || 20);
const concurrency = Number(args.get("concurrency") || 4);
if (!Number.isInteger(requests) || requests < 1 || !Number.isInteger(concurrency) || concurrency < 1) {
  throw new Error("--requests and --concurrency must be positive integers");
}

const spotlight = JSON.parse(
  await readFile(new URL("../src/mock/examples/northstar_luma_one_launch.json", import.meta.url), "utf8")
);

const createPayload = (index) => ({
  campaignId: `${spotlight.id}-load-${Date.now()}-${index}`,
  contentFragmentPath: spotlight.id,
  templateId: "northstar-spotlight",
  templateVersion: "1.0.0",
  designSystemVersion: "0.1.0",
  renderingEngine: "remotion",
  outputFormats: ["16x9"],
  source: "mock",
  content: spotlight,
  requestedBy: "load-test"
});

async function createJob(index) {
  const started = performance.now();
  try {
    const response = await fetch(`${baseUrl}/api/provenance/jobs`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(createPayload(index))
    });
    const body = await response.text();
    return {
      ok: response.ok,
      status: response.status,
      latencyMs: performance.now() - started,
      error: response.ok ? undefined : body.slice(0, 200)
    };
  } catch (error) {
    return {
      ok: false,
      status: 0,
      latencyMs: performance.now() - started,
      error: error instanceof Error ? error.message : String(error)
    };
  }
}

const results = [];
for (let start = 0; start < requests; start += concurrency) {
  const batch = Array.from({ length: Math.min(concurrency, requests - start) }, (_, offset) =>
    createJob(start + offset)
  );
  results.push(...(await Promise.all(batch)));
}

const latencies = results.map((result) => result.latencyMs).sort((a, b) => a - b);
const percentile = (ratio) => latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * ratio))];
const failures = results.filter((result) => !result.ok);
const summary = {
  baseUrl,
  requests,
  concurrency,
  succeeded: requests - failures.length,
  failed: failures.length,
  latencyMs: {
    p50: Number(percentile(0.5).toFixed(1)),
    p95: Number(percentile(0.95).toFixed(1)),
    max: Number(Math.max(...latencies).toFixed(1))
  },
  failures: failures.slice(0, 5)
};
console.log(JSON.stringify(summary, null, 2));
if (failures.length) process.exitCode = 1;
