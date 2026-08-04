import { readFileSync } from "node:fs";

const baseUrl = process.env.PROVENANCE_API_BASE_URL || "http://127.0.0.1:5176";
const content = JSON.parse(readFileSync("src/mock/examples/northstar_luma_one_launch.json", "utf8"));
const input = {
  campaignId: content.id,
  contentFragmentPath: content.id,
  templateId: "AEMSpotlight",
  templateVersion: "1.0.0",
  designSystemVersion: "0.1.0",
  renderingEngine: "remotion",
  outputFormats: ["16x9"],
  source: "mock",
  content,
  requestedBy: "provenance-db-smoke"
};

const request = async (path, options) => {
  const response = await fetch(`${baseUrl}${path}`, options);
  const payload = await response.json();
  if (!response.ok) throw new Error(`${path} returned ${response.status}: ${payload.error || "unknown error"}`);
  return payload;
};

const json = (body) => ({ method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
const created = await request("/api/provenance/jobs", json(input));
const renderId = created.job.renderId;
await request(`/api/provenance/jobs/${renderId}`, { ...json({ status: "rendering" }), method: "PATCH" });
const completed = await request(`/api/provenance/jobs/${renderId}`, { ...json({ status: "completed", outputUrls: { "16x9": "https://cdn.example.test/provenance-smoke.mp4" } }), method: "PATCH" });
const listed = await request("/api/provenance/", { method: "GET" });

if (completed.job.status !== "completed" || !listed.jobs.some((job) => job.renderId === renderId)) {
  throw new Error("Provenance job was not completed and returned by the API");
}

console.log(JSON.stringify({ renderId, status: completed.job.status, jobsVisible: listed.jobs.length }, null, 2));
