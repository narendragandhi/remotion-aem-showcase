/**
 * Render every supported composition from one live AEM Content Fragment.
 * Renders are intentionally sequential to keep local/CI memory predictable.
 */
const { spawnSync } = require("child_process");

const renders = [
  ["AEMSpotlight-16x9", "out/spotlight_aem_live_16x9.mp4"],
  ["AEMSpotlight-9x16", "out/spotlight_aem_live_9x16.mp4"],
  ["AEMSpotlight-1x1", "out/spotlight_aem_live_1x1.mp4"],
  ["AEMSpotlight-4K", "out/spotlight_aem_live_4k.mp4"]
];

for (const [composition, output] of renders) {
  console.log(`\n[Live AEM] Rendering ${composition} → ${output}`);
  const result = spawnSync(process.execPath, ["scripts/render-live-aem.cjs", composition, output], {
    stdio: "inherit",
    env: process.env
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}

console.log("\n[Live AEM] All formats rendered successfully.");
