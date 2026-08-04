/**
 * Fetch a live Spotlight fragment server-side, then pass normalized props to
 * Remotion. This keeps video rendering independent of author-origin CORS.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { spawnSync } = require("child_process");

const composition = process.argv[2] || "AEMSpotlight-16x9";
const output = process.argv[3] || "out/spotlight_aem_live.mp4";
const baseUrl = process.env.AEM_BASE_URL;
const endpoint = process.env.AEM_GRAPHQL_ENDPOINT;
const fragmentPath = process.env.AEM_CONTENT_FRAGMENT_PATH;
const token = process.env.AEM_TOKEN;

if (!baseUrl || !endpoint || !fragmentPath) {
  throw new Error("AEM_BASE_URL, AEM_GRAPHQL_ENDPOINT, and AEM_CONTENT_FRAGMENT_PATH are required");
}

const campaignPaths = [
  fragmentPath,
  "/content/dam/remotion/spotlight/live-showcase-proof",
  "/content/dam/remotion/spotlight/live-showcase-cta"
];
const query = `query {
  hook: spotlightVideoSceneByPath(_path: "${campaignPaths[0]}") { item {
    _path title eyebrow subtitle { plaintext } cta brandColor accentColor metricLabel metricValue imageUrl durationSeconds
    animationStyle renditionType effectType effectIntensity lottieUrl svgOverlayUrl
  } }
  proof: spotlightVideoSceneByPath(_path: "${campaignPaths[1]}") { item {
    _path title eyebrow subtitle { plaintext } cta brandColor accentColor metricLabel metricValue imageUrl durationSeconds
    animationStyle renditionType effectType effectIntensity lottieUrl svgOverlayUrl
  } }
  cta: spotlightVideoSceneByPath(_path: "${campaignPaths[2]}") { item {
    _path title eyebrow subtitle { plaintext } cta brandColor accentColor metricLabel metricValue imageUrl durationSeconds
    animationStyle renditionType effectType effectIntensity lottieUrl svgOverlayUrl
  } }
}`;

async function main() {
  const response = await fetch(`${baseUrl}${endpoint}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(token ? { Authorization: token } : {}) },
    body: JSON.stringify({ query })
  });
  const payload = await response.json();
  const items = [payload.data?.hook?.item, payload.data?.proof?.item, payload.data?.cta?.item].filter(Boolean);
  if (!response.ok || payload.errors?.length || items.length !== 3) {
    throw new Error(`AEM live props request failed: ${JSON.stringify(payload)}`);
  }

  const scenes = [];
  for (const item of items) {
    let imageUrl = item.imageUrl || "";
    if (imageUrl.startsWith("/")) {
      const imageResponse = await fetch(`${baseUrl}${imageUrl}`, {
        headers: token ? { Authorization: token } : {}
      });
      if (!imageResponse.ok) {
        throw new Error(`AEM image request failed: ${imageResponse.status} ${imageUrl}`);
      }
      const contentType = imageResponse.headers.get("content-type") || "application/octet-stream";
      imageUrl = `data:${contentType};base64,${Buffer.from(await imageResponse.arrayBuffer()).toString("base64")}`;
    }
    scenes.push({
      title: item.title || "Untitled",
      eyebrow: item.eyebrow || "AEM / LIVE",
      subtitle: item.subtitle?.plaintext || "",
      cta: item.cta || "Learn more",
      brandColor: item.brandColor || "#0E3B5A",
      accentColor: item.accentColor || "#82ffca",
      metricLabel: item.metricLabel || "SIGNAL",
      metricValue: item.metricValue || `${Math.round((Number(item.effectIntensity) || 0.5) * 100)}%`,
      imageUrl,
      durationSeconds: Number(item.durationSeconds) || 4,
      animationStyle: item.animationStyle || "minimal",
      renditionType: item.renditionType || "optimized",
      effectType: item.effectType || "none",
      effectIntensity: Number(item.effectIntensity) || 0.5,
      lottieUrl: item.lottieUrl || "",
      svgOverlayUrl: item.svgOverlayUrl || ""
    });
  }
  const spotlight = { id: "live-showcase", scenes };

  const propsPath = path.join(os.tmpdir(), `remotion-aem-props-${process.pid}.json`);
  fs.writeFileSync(propsPath, JSON.stringify({ spotlight }), "utf8");
  const result = spawnSync("npx", ["remotion", "render", "src/index.tsx", composition, output, `--props=${propsPath}`], {
    stdio: "inherit",
    env: { ...process.env, USE_MOCK_AEM: "false", AEM_STRICT_MODE: "true" }
  });
  fs.unlinkSync(propsPath);
  process.exit(result.status ?? 1);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
